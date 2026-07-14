import { apiClient } from './client'
import type { CharacterImage } from '../types'

export async function getImagesByCharacter(characterId: string): Promise<CharacterImage[]> {
  const { data } = await apiClient.get('/images', { params: { characterId } })
  return data.map(mapImage)
}

export async function getAllImages(): Promise<CharacterImage[]> {
  const { data } = await apiClient.get('/images')
  return data.map(mapImage)
}

export async function getImageByHash(hash: string): Promise<CharacterImage | undefined> {
  // We check via getAllImages or rely on upload duplicate detection
  const all = await getAllImages()
  return all.find(img => img.hash === hash)
}

export async function addImage(image: CharacterImage): Promise<void> {
  // Legacy: this function receives pre-built CharacterImage with base64 data.
  // We need to upload the file instead.
  // Convert base64 dataUrl to Blob and upload
  if (image.dataUrl.startsWith('data:')) {
    const res = await fetch(image.dataUrl)
    const blob = await res.blob()
    const formData = new FormData()
    formData.append('file', blob, image.fileName || 'image.jpg')
    formData.append('characterId', image.characterId)
    formData.append('hash', image.hash)
    formData.append('fileName', image.fileName || '')
    await apiClient.post('/images/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  }
}

export async function uploadImage(
  file: File, characterId: string, hash: string, fileName: string
): Promise<CharacterImage> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('characterId', characterId)
  formData.append('hash', hash)
  formData.append('fileName', fileName)
  const { data } = await apiClient.post('/images/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return mapImage(data)
}

export async function deleteImage(id: string): Promise<void> {
  await apiClient.delete(`/images/${id}`)
}

export async function updateImageTags(id: string, tags: string[]): Promise<void> {
  await apiClient.patch(`/images/${id}/tags`, { tags })
}

export async function updateImageWhiteBgRemoved(id: string, processedDataUrl: string): Promise<void> {
  // Upload the processed image
  if (processedDataUrl.startsWith('data:')) {
    const res = await fetch(processedDataUrl)
    const blob = await res.blob()
    const formData = new FormData()
    formData.append('file', blob, 'processed.png')
    await apiClient.post(`/images/${id}/remove-white-bg`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  }
}

export async function swapImageOrder(id1: string, id2: string): Promise<void> {
  await apiClient.post('/images/swap-order', { id1, id2 })
}

function mapImage(data: any): CharacterImage {
  const id = data.id
  return {
    id,
    characterId: data.characterId ?? data.character_id ?? '',
    dataUrl: `/api/files/images/${id}/original`,
    processedDataUrl: data.whiteBgRemoved ?? data.white_bg_removed
      ? `/api/files/images/${id}/processed`
      : `/api/files/images/${id}/original`,
    thumbnailDataUrl: `/api/files/images/${id}/thumbnail`,
    hash: data.hash || '',
    fileName: data.fileName ?? data.file_name ?? '',
    width: Number(data.width ?? 0),
    height: Number(data.height ?? 0),
    tags: data.tags || [],
    whiteBgRemoved: !!(data.whiteBgRemoved ?? data.white_bg_removed),
    sortOrder: data.sortOrder ?? data.sort_order ?? 0,
    createdAt: data.createdAt ?? data.created_at ?? 0,
  }
}
