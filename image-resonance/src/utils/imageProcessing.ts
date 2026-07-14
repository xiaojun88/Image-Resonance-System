// ===== 感知哈希 (pHash) =====
// 用于检测相似图片

export async function computePerceptualHash(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      try {
        const hash = computeHashFromImage(img)
        resolve(hash)
      } catch (e) {
        reject(e)
      }
    }
    img.onerror = reject
    img.src = dataUrl
  })
}

function computeHashFromImage(img: HTMLImageElement): string {
  // 缩放到 16x16
  const size = 16
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, size, size)

  // 转灰度并计算均值
  const pixels = ctx.getImageData(0, 0, size, size).data
  const grayValues: number[] = []
  for (let i = 0; i < pixels.length; i += 4) {
    const gray = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]
    grayValues.push(gray)
  }
  const avg = grayValues.reduce((a, b) => a + b, 0) / grayValues.length

  // 生成哈希（每像素大于均值则为1）
  let hash = ''
  for (const gray of grayValues) {
    hash += gray >= avg ? '1' : '0'
  }

  // 转为十六进制便于存储
  let hex = ''
  for (let i = 0; i < hash.length; i += 4) {
    hex += parseInt(hash.slice(i, i + 4), 2).toString(16)
  }
  return hex
}

export function hammingDistance(hash1: string, hash2: string): number {
  // 将hex转回二进制字符串比较
  const bin1 = hexToBin(hash1)
  const bin2 = hexToBin(hash2)
  let distance = 0
  for (let i = 0; i < Math.min(bin1.length, bin2.length); i++) {
    if (bin1[i] !== bin2[i]) distance++
  }
  return distance
}

function hexToBin(hex: string): string {
  let bin = ''
  for (const char of hex) {
    bin += parseInt(char, 16).toString(2).padStart(4, '0')
  }
  return bin
}

// ===== 图片处理工具 =====

export function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = dataUrl
  })
}

export function createThumbnail(dataUrl: string, maxSize: number = 200): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const { width, height } = calcThumbSize(img.width, img.height, maxSize)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', 0.7))
    }
    img.onerror = reject
    img.src = dataUrl
  })
}

function calcThumbSize(w: number, h: number, max: number) {
  if (w <= max && h <= max) return { width: w, height: h }
  const ratio = Math.min(max / w, max / h)
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) }
}

// ===== 去白底算法 =====
// 从边缘向内填充透明，但保留内部不连通区域（如牙齿、白衣）

export async function removeWhiteBackground(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const timeout = setTimeout(() => {
      img.src = ''
      reject(new Error('去白底处理超时'))
    }, 60000) // 60秒超时保护

    img.onload = () => {
      clearTimeout(timeout)
      try {
        // 过大图片跳过处理，避免浏览器崩溃
        const maxPixels = 8000 * 8000
        if (img.width * img.height > maxPixels) {
          reject(new Error(`图片过大 (${img.width}×${img.height})，跳过去白底`))
          return
        }

        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0)

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const { data, width, height } = imageData
        const totalPixels = width * height

      // visited标记，从边缘开始BFS
      const visited = new Uint8Array(totalPixels)
      const queue: number[] = []

      // 判断像素是否接近白色/浅色
      const isLight = (idx: number): boolean => {
        const r = data[idx]
        const g = data[idx + 1]
        const b = data[idx + 2]
        const a = data[idx + 3]
        // alpha过低的不算
        if (a < 128) return false
        // 判断是否浅色：RGB都>230且彼此接近（避免浅蓝/浅粉等被误判）
        if (r > 230 && g > 230 && b > 230) {
          const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b))
          return maxDiff < 15
        }
        return false
      }

      // 将边缘浅色像素加入队列
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
            const idx = (y * width + x) * 4
            if (isLight(idx) && !visited[y * width + x]) {
              visited[y * width + x] = 1
              queue.push(y * width + x)
            }
          }
        }
      }

      // BFS从四边向内扩散
      let head = 0
      while (head < queue.length) {
        const pixel = queue[head++]
        const py = Math.floor(pixel / width)
        const px = pixel % width

        // 检查四个邻接像素
        const neighbors: [number, number][] = [[px - 1, py], [px + 1, py], [px, py - 1], [px, py + 1]]
        for (const [nx, ny] of neighbors) {
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
          const nIdx = ny * width + nx
          if (visited[nIdx]) continue
          const dIdx = nIdx * 4
          if (isLight(dIdx)) {
            visited[nIdx] = 1
            queue.push(nIdx)
          }
        }
      }

      // 将访问到的边缘连通像素设为透明
      for (let i = 0; i < totalPixels; i++) {
        if (visited[i]) {
          data[i * 4 + 3] = 0
        }
      }

      ctx.putImageData(imageData, 0, 0)
      resolve(canvas.toDataURL('image/png'))
      } catch (err) {
        reject(err instanceof Error ? err : new Error('去白底处理异常'))
      }
    }
    img.onerror = () => {
      clearTimeout(timeout)
      reject(new Error('去白底：图片加载失败'))
    }
    img.src = dataUrl
  })
}
