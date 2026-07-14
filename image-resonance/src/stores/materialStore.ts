import { create } from 'zustand'
import type { Group, Character, CharacterImage, Tag } from '../types'
import * as api from '../api'
import { useUIStore } from './uiStore'

function showError(msg: string) {
  useUIStore.getState().showToast(msg, 'error')
}

interface MaterialState {
  // 数据
  groups: Group[]
  characters: Character[]
  images: CharacterImage[]
  tags: Tag[]

  // UI状态
  selectedGroupId: string | null
  selectedCharacterId: string | null
  selectedImageIds: Set<string>
  searchQuery: string
  selectedTagIds: Set<string>
  characterListExpanded: Set<string> // 展开的分组ID集合

  // 加载
  loadAll: () => Promise<void>
  loadGroupCharacters: (groupId: string) => Promise<void>
  loadAllCharacters: () => Promise<void>

  // 分组
  addGroup: (name: string) => Promise<Group>
  renameGroup: (id: string, name: string) => Promise<void>
  updateGroupInfo: (id: string, data: Partial<Pick<Group, 'description' | 'resonanceImageDataUrls'>>) => Promise<void>
  removeGroup: (id: string) => Promise<void>
  swapGroupOrder: (id1: string, id2: string) => Promise<void>
  pinGroupToTop: (id: string) => Promise<void>
  setSelectedGroup: (id: string | null) => void
  detailGroupId: string | null
  setDetailGroupId: (id: string | null) => void

  // 人物
  addCharacter: (name: string, groupIds: string[]) => Promise<Character>
  renameCharacter: (id: string, name: string) => Promise<void>
  removeCharacter: (id: string) => Promise<void>
  moveCharacter: (charId: string, fromGroupId: string, toGroupId: string) => Promise<void>
  copyCharacterToGroup: (charId: string, groupId: string) => Promise<void>
  removeCharacterFromGroup: (charId: string, groupId: string) => Promise<void>
  swapCharacterOrder: (id1: string, id2: string) => Promise<void>
  pinCharacterToTop: (id: string) => Promise<void>
  updateCharacterInfo: (id: string, data: Partial<Character>) => Promise<void>
  uploadAvatar: (id: string, file: File) => Promise<string | undefined>
  deleteAvatar: (id: string) => Promise<void>
  setSelectedCharacter: (id: string | null) => void

  // 图片
  addImages: (images: CharacterImage[]) => Promise<void>
  uploadFiles: (files: File[], characterId: string, hashFn: (f: File) => Promise<string>, removeBg?: boolean) => Promise<void>
  removeImage: (id: string) => Promise<void>
  updateImageTags: (id: string, tags: string[]) => Promise<void>
  updateImageWhiteBgRemoved: (id: string, processedDataUrl: string) => Promise<void>
  swapImageOrder: (id1: string, id2: string) => Promise<void>
  toggleImageSelection: (id: string) => void
  selectAllImages: () => void
  clearImageSelection: () => void

  // 标签
  addTag: (name: string) => Promise<Tag>
  removeTag: (id: string) => Promise<void>
  toggleTagFilter: (id: string) => void

  // 搜索和筛选
  setSearchQuery: (query: string) => void
  toggleGroupExpand: (groupId: string) => void

  // 计算属性
  getFilteredImages: () => CharacterImage[]
  getFilteredCharacters: () => Character[]
}

export const useMaterialStore = create<MaterialState>((set, get) => ({
  groups: [],
  characters: [],
  images: [],
  tags: [],
  selectedGroupId: null,
  selectedCharacterId: null,
  selectedImageIds: new Set(),
  searchQuery: '',
  selectedTagIds: new Set(),
  characterListExpanded: new Set(),
  detailGroupId: null,

  loadAll: async () => {
    try {
      const [groups, tags] = await Promise.all([
        api.getGroups(),
        api.getAllTags(),
      ])
      set({ groups, tags, characters: [], images: [] })
    } catch (err) {
      showError('加载数据失败: ' + (err instanceof Error ? err.message : '未知错误'))
    }
  },

  // 展开分组时按需加载人物及其图片
  loadGroupCharacters: async (groupId: string) => {
    try {
      const chars = await api.getCharactersByGroup(groupId)
      set(s => {
        // 合并已有人物（去重）
        const existing = new Map(s.characters.map(c => [c.id, c]))
        for (const c of chars) existing.set(c.id, c)
        return { characters: [...existing.values()] }
      })
      // 加载这些人物的图片
      for (const c of chars) {
        try {
          const imgs = await api.getImagesByCharacter(c.id)
          if (imgs.length > 0) {
            set(s => {
              const existing = new Map(s.images.map(i => [i.id, i]))
              for (const img of imgs) existing.set(img.id, img)
              return { images: [...existing.values()] }
            })
          }
        } catch { /* 单个人物图片加载失败不影响整体 */ }
      }
    } catch (err) {
      showError('加载人物失败: ' + (err instanceof Error ? err.message : ''))
    }
  },

  // 搜索时加载全部人物
  loadAllCharacters: async () => {
    try {
      const chars = await api.getAllCharacters()
      set(s => {
        const existing = new Map(s.characters.map(c => [c.id, c]))
        for (const c of chars) existing.set(c.id, c)
        return { characters: [...existing.values()] }
      })
      // 后台加载图片
      api.getAllImages().then(imgs => {
        set(s => {
          const existing = new Map(s.images.map(i => [i.id, i]))
          for (const img of imgs) existing.set(img.id, img)
          return { images: [...existing.values()] }
        })
      }).catch(() => {})
    } catch (err) {
      showError('加载人物失败: ' + (err instanceof Error ? err.message : ''))
    }
  },

  addGroup: async (name) => {
    try {
      const group = await api.createGroup(name)
      set(s => ({ groups: [...s.groups, group] }))
      return group
    } catch (err) {
      showError('创建分组失败: ' + (err instanceof Error ? err.message : ''))
      throw err
    }
  },
  renameGroup: async (id, name) => {
    try {
      await api.updateGroup(id, { name })
      set(s => ({ groups: s.groups.map(g => g.id === id ? { ...g, name } : g) }))
    } catch (err) {
      showError('重命名失败: ' + (err instanceof Error ? err.message : ''))
    }
  },
  updateGroupInfo: async (id, data) => {
    try {
      await api.updateGroup(id, data)
      set(s => ({ groups: s.groups.map(g => g.id === id ? { ...g, ...data } : g) }))
    } catch (err) {
      showError('更新分组失败: ' + (err instanceof Error ? err.message : ''))
    }
  },
  removeGroup: async (id) => {
    try {
      await api.deleteGroup(id)
      const [groups, characters, images] = await Promise.all([
        api.getGroups(),
        api.getAllCharacters(),
        api.getAllImages(),
      ])
      set(s => ({
        groups,
        characters,
        images,
        selectedGroupId: s.selectedGroupId === id ? null : s.selectedGroupId,
      }))
    } catch (err) {
      showError('删除分组失败: ' + (err instanceof Error ? err.message : ''))
    }
  },
  setSelectedGroup: (id) => set({ selectedGroupId: id }),
  setDetailGroupId: (id) => set({ detailGroupId: id }),

  swapGroupOrder: async (id1, id2) => {
    try {
      await api.swapGroupOrder(id1, id2)
      const groups = await api.getGroups()
      set({ groups })
    } catch (err) {
      showError('排序失败: ' + (err instanceof Error ? err.message : ''))
    }
  },
  pinGroupToTop: async (id) => {
    try {
      await api.pinGroupToTop(id)
      const groups = await api.getGroups()
      set({ groups })
    } catch (err) {
      showError('置顶失败: ' + (err instanceof Error ? err.message : ''))
    }
  },

  addCharacter: async (name, groupIds) => {
    try {
      const char = await api.createCharacter(name, groupIds)
      set(s => ({
        characters: [...s.characters, char],
        groups: s.groups.map(g =>
          groupIds.includes(g.id)
            ? { ...g, characterCount: (g.characterCount || 0) + 1 }
            : g
        ),
      }))
      return char
    } catch (err) {
      showError('创建人物失败: ' + (err instanceof Error ? err.message : ''))
      throw err
    }
  },
  renameCharacter: async (id, name) => {
    try {
      await api.updateCharacter(id, { name })
      set(s => ({ characters: s.characters.map(c => c.id === id ? { ...c, name } : c) }))
    } catch (err) {
      showError('重命名失败: ' + (err instanceof Error ? err.message : ''))
    }
  },
  removeCharacter: async (id) => {
    try {
      const char = get().characters.find(c => c.id === id)
      const affectedGroups = char?.groupIds || []
      await api.deleteCharacter(id)
      set(s => ({
        characters: s.characters.filter(c => c.id !== id),
        images: s.images.filter(im => im.characterId !== id),
        selectedCharacterId: s.selectedCharacterId === id ? null : s.selectedCharacterId,
        groups: s.groups.map(g =>
          affectedGroups.includes(g.id)
            ? { ...g, characterCount: Math.max(0, (g.characterCount || 0) - 1) }
            : g
        ),
      }))
    } catch (err) {
      showError('删除人物失败: ' + (err instanceof Error ? err.message : ''))
    }
  },
  moveCharacter: async (charId, fromGroupId, toGroupId) => {
    try {
      await api.removeCharacterFromGroup(charId, fromGroupId)
      await api.addCharacterToGroup(charId, toGroupId)
      set(s => ({
        characters: s.characters.map(c =>
          c.id === charId
            ? { ...c, groupIds: c.groupIds.filter(g => g !== fromGroupId).concat(toGroupId) }
            : c
        ),
        groups: s.groups.map(g => {
          if (g.id === fromGroupId) return { ...g, characterCount: Math.max(0, (g.characterCount || 0) - 1) }
          if (g.id === toGroupId) return { ...g, characterCount: (g.characterCount || 0) + 1 }
          return g
        }),
      }))
    } catch (err) {
      showError('移动人物失败: ' + (err instanceof Error ? err.message : ''))
    }
  },
  copyCharacterToGroup: async (charId, groupId) => {
    try {
      await api.addCharacterToGroup(charId, groupId)
      set(s => ({
        characters: s.characters.map(c =>
          c.id === charId && !c.groupIds.includes(groupId)
            ? { ...c, groupIds: [...c.groupIds, groupId] }
            : c
        ),
        groups: s.groups.map(g =>
          g.id === groupId
            ? { ...g, characterCount: (g.characterCount || 0) + 1 }
            : g
        ),
      }))
    } catch (err) {
      showError('复制人物失败: ' + (err instanceof Error ? err.message : ''))
    }
  },
  removeCharacterFromGroup: async (charId, groupId) => {
    try {
      await api.removeCharacterFromGroup(charId, groupId)
      set(s => ({
        characters: s.characters.map(c =>
          c.id === charId
            ? { ...c, groupIds: c.groupIds.filter(g => g !== groupId) }
            : c
        ),
        groups: s.groups.map(g =>
          g.id === groupId
            ? { ...g, characterCount: Math.max(0, (g.characterCount || 0) - 1) }
            : g
        ),
      }))
    } catch (err) {
      showError('移除人物失败: ' + (err instanceof Error ? err.message : ''))
    }
  },
  swapCharacterOrder: async (id1, id2) => {
    try {
      await api.swapCharacterOrder(id1, id2)
      const chars = await api.getAllCharacters()
      set({ characters: chars })
    } catch (err) {
      showError('排序失败: ' + (err instanceof Error ? err.message : ''))
    }
  },
  pinCharacterToTop: async (id) => {
    try {
      await api.pinCharacterToTop(id)
      const chars = await api.getAllCharacters()
      set({ characters: chars })
    } catch (err) {
      showError('置顶失败: ' + (err instanceof Error ? err.message : ''))
    }
  },
  updateCharacterInfo: async (id, data) => {
    try {
      await api.updateCharacter(id, data)
      set(s => ({ characters: s.characters.map(c => c.id === id ? { ...c, ...data } : c) }))
    } catch (err) {
      showError('更新人物信息失败: ' + (err instanceof Error ? err.message : ''))
    }
  },
  uploadAvatar: async (id, file) => {
    try {
      const url = await api.uploadAvatar(id, file)
      set(s => ({ characters: s.characters.map(c => c.id === id ? { ...c, avatarDataUrl: url } : c) }))
      return url
    } catch (err) {
      showError('更新头像失败: ' + (err instanceof Error ? err.message : ''))
    }
  },
  deleteAvatar: async (id) => {
    try {
      await api.deleteAvatar(id)
      set(s => ({ characters: s.characters.map(c => c.id === id ? { ...c, avatarDataUrl: undefined } : c) }))
    } catch (err) {
      showError('删除头像失败: ' + (err instanceof Error ? err.message : ''))
    }
  },
  setSelectedCharacter: (id) => set({ selectedCharacterId: id, selectedImageIds: new Set(), detailGroupId: null }),

  addImages: async (imageRecords) => {
    // Legacy API: receives pre-built CharacterImage objects with base64 data
    // Upload each image to the server
    try {
      const uploaded: CharacterImage[] = []
      for (const img of imageRecords) {
        try {
          if (img.dataUrl.startsWith('data:')) {
            const res = await fetch(img.dataUrl)
            const blob = await res.blob()
            const file = new File([blob], img.fileName || 'image.jpg', { type: blob.type })
            const result = await api.uploadImage(file, img.characterId, img.hash, img.fileName)
            uploaded.push(result)
          }
        } catch (e) {
          console.error('[上传] 失败:', e)
        }
      }
      if (uploaded.length > 0) {
        set(s => ({ images: [...s.images, ...uploaded] }))
      }
    } catch (err) {
      showError('上传图片失败: ' + (err instanceof Error ? err.message : ''))
    }
  },

  uploadFiles: async (files, characterId, hashFn, removeBg) => {
    try {
      const showToast = useUIStore.getState().showToast
      const uploaded: CharacterImage[] = []
      let skipped = 0

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        try {
          const hash = await hashFn(file)
          // Check for duplicates via API
          const dup = await api.getImageByHash(hash)
          if (dup) {
            skipped++
            continue
          }
          const result = await api.uploadImage(file, characterId, hash, file.name)
          uploaded.push(result)
        } catch (e) {
          console.error('[上传] 失败:', file.name, e)
        }
      }

      if (uploaded.length > 0) {
        set(s => ({ images: [...s.images, ...uploaded] }))
        const parts = [`成功上传 ${uploaded.length} 张`]
        if (skipped > 0) parts.push(`跳过 ${skipped} 张重复`)
        showToast(parts.join('，'), 'success')

        if (removeBg) {
          const { removeWhiteBackground } = await import('../utils/imageProcessing')
          showToast('正在后台处理去白底...', 'info')
          let bgDone = 0
          for (const img of uploaded) {
            try {
              const dataUrl = await fetch(img.dataUrl).then(r => r.blob()).then(b => {
                return new Promise<string>((resolve) => {
                  const reader = new FileReader()
                  reader.onload = () => resolve(reader.result as string)
                  reader.readAsDataURL(b)
                })
              })
              const processed = await removeWhiteBackground(dataUrl)
              await api.updateImageWhiteBgRemoved(img.id, processed)
              bgDone++
            } catch (e) { console.error('[去白底] 失败:', e) }
          }
          if (bgDone > 0) showToast(`去白底完成 (${bgDone}/${uploaded.length})`, 'success')
        }
      } else if (skipped > 0) {
        showToast(`${skipped} 张图片已存在，无需重复上传`, 'info')
      } else {
        showToast('上传失败，请检查图片格式', 'error')
      }
    } catch (err) {
      showError('上传失败: ' + (err instanceof Error ? err.message : ''))
    }
  },

  removeImage: async (id) => {
    try {
      await api.deleteImage(id)
      set(s => ({
        images: s.images.filter(im => im.id !== id),
        selectedImageIds: new Set([...s.selectedImageIds].filter(iid => iid !== id)),
      }))
    } catch (err) {
      showError('删除图片失败: ' + (err instanceof Error ? err.message : ''))
    }
  },
  updateImageTags: async (id, tags) => {
    try {
      await api.updateImageTags(id, tags)
      set(s => ({ images: s.images.map(im => im.id === id ? { ...im, tags } : im) }))
    } catch (err) {
      showError('更新标签失败: ' + (err instanceof Error ? err.message : ''))
    }
  },
  updateImageWhiteBgRemoved: async (id, processedDataUrl) => {
    try {
      await api.updateImageWhiteBgRemoved(id, processedDataUrl)
      set(s => ({
        images: s.images.map(im =>
          im.id === id
            ? { ...im, processedDataUrl: `/api/files/images/${id}/processed`, whiteBgRemoved: true }
            : im
        ),
      }))
    } catch (err) {
      showError('去白底失败: ' + (err instanceof Error ? err.message : ''))
    }
  },
  swapImageOrder: async (id1, id2) => {
    try {
      await api.swapImageOrder(id1, id2)
      set(s => {
        const im1 = s.images.find(im => im.id === id1)
        const im2 = s.images.find(im => im.id === id2)
        if (!im1 || !im2) return s
        const so1 = im2.sortOrder ?? im2.createdAt
        const so2 = im1.sortOrder ?? im1.createdAt
        return {
          images: s.images.map(im =>
            im.id === id1 ? { ...im, sortOrder: so1 } :
            im.id === id2 ? { ...im, sortOrder: so2 } : im
          ),
        }
      })
    } catch (err) {
      showError('排序失败: ' + (err instanceof Error ? err.message : ''))
    }
  },
  toggleImageSelection: (id) => {
    set(s => {
      const next = new Set(s.selectedImageIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { selectedImageIds: next }
    })
  },
  selectAllImages: () => {
    const { selectedCharacterId, images } = get()
    const ids = images.filter(im => im.characterId === selectedCharacterId).map(im => im.id)
    set({ selectedImageIds: new Set(ids) })
  },
  clearImageSelection: () => set({ selectedImageIds: new Set() }),

  addTag: async (name) => {
    try {
      const tag = await api.createTag(name)
      set(s => ({ tags: [...s.tags, tag] }))
      return tag
    } catch (err) {
      showError('创建标签失败: ' + (err instanceof Error ? err.message : ''))
      throw err
    }
  },
  removeTag: async (id) => {
    try {
      await api.deleteTag(id)
      set(s => ({ tags: s.tags.filter(t => t.id !== id) }))
    } catch (err) {
      showError('删除标签失败: ' + (err instanceof Error ? err.message : ''))
    }
  },
  toggleTagFilter: (id) => {
    set(s => {
      const next = new Set(s.selectedTagIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { selectedTagIds: next }
    })
  },

  setSearchQuery: (query) => {
    const wasEmpty = !get().searchQuery
    set({ searchQuery: query })
    if (wasEmpty && query.trim()) {
      get().loadAllCharacters()
    }
  },
  toggleGroupExpand: (groupId) => {
    const store = get()
    const isExpanding = !store.characterListExpanded.has(groupId)
    // 展开时按需加载人物
    if (isExpanding) {
      store.loadGroupCharacters(groupId)
    }
    set(s => {
      const next = new Set(s.characterListExpanded)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return { characterListExpanded: next }
    })
  },

  getFilteredImages: () => {
    const { images, selectedCharacterId, selectedTagIds } = get()
    let filtered = images
    if (selectedCharacterId) {
      filtered = filtered.filter(im => im.characterId === selectedCharacterId)
    }
    if (selectedTagIds.size > 0) {
      filtered = filtered.filter(im => {
        return [...selectedTagIds].every(tagId => {
          const tag = get().tags.find(t => t.id === tagId)
          return tag ? im.tags.includes(tag.name) : false
        })
      })
    }
    return filtered.sort((a, b) => (b.sortOrder ?? b.createdAt) - (a.sortOrder ?? a.createdAt))
  },

  getFilteredCharacters: () => {
    const { characters, searchQuery, selectedTagIds, images, selectedGroupId } = get()
    let filtered = characters

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      // 预计算匹配的分组 ID
      const matchedGroupIds = new Set(
        get().groups.filter(g => g.name.toLowerCase().includes(q)).map(g => g.id)
      )
      filtered = filtered.filter(c => {
        // 人物名匹配
        if (c.name.toLowerCase().includes(q)) return true
        // 分组名匹配
        if (c.groupIds.some(gid => matchedGroupIds.has(gid))) return true
        // 标签匹配：该人物旗下的图片标签包含搜索词
        const charImages = images.filter(im => im.characterId === c.id)
        if (charImages.some(im => im.tags.some(t => t.toLowerCase().includes(q)))) return true
        return false
      })
    }

    if (selectedTagIds.size > 0) {
      // 筛选出拥有带选中标签图片的人物
      const tagNames = [...selectedTagIds].map(tid => get().tags.find(t => t.id === tid)?.name).filter(Boolean) as string[]
      const charIdsWithTags = new Set(
        images.filter(im => tagNames.every(tn => im.tags.includes(tn))).map(im => im.characterId)
      )
      filtered = filtered.filter(c => charIdsWithTags.has(c.id))
    }

    return filtered
  },
}))
