import { apiClient } from './client'
import type { Character } from '../types'

export async function getAllCharacters(): Promise<Character[]> {
  const { data } = await apiClient.get('/characters')
  return data.map(mapCharacter)
}

export async function createCharacter(name: string, groupIds: string[]): Promise<Character> {
  const { data } = await apiClient.post('/characters', { name, groupIds })
  return mapCharacter(data)
}

export async function updateCharacter(id: string, updates: Partial<Character>): Promise<void> {
  const body: Record<string, unknown> = {}
  const fieldMap: Record<string, string> = {
    name: 'name',
    description: 'description',
    position: 'position',
    race: 'race',
    devilFruit: 'devilFruit',
    haki: 'haki',
    height: 'height',
    birthday: 'birthday',
    customFields: 'customFields',
    avatarDataUrl: 'avatarPath',
    sortOrder: 'sortOrder',
  }
  for (const [key, apiKey] of Object.entries(fieldMap)) {
    if (updates[key as keyof Character] !== undefined) {
      body[apiKey] = updates[key as keyof Character]
    }
  }
  if (updates.groupIds !== undefined) {
    body.groupIds = updates.groupIds
  }
  await apiClient.patch(`/characters/${id}`, body)
}

export async function deleteCharacter(id: string): Promise<void> {
  await apiClient.delete(`/characters/${id}`)
}

export async function isCharacterNameTaken(name: string, excludeId?: string): Promise<boolean> {
  const chars = await getAllCharacters()
  const trimmed = name.trim()
  return chars.some(c => c.name === trimmed && c.id !== excludeId)
}

/**
 * 上传头像 — 直接传原始 File，服务端生成缩略图
 */
export async function uploadAvatar(id: string, file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await apiClient.post(`/characters/${id}/avatar`, formData)
  // 服务端返回 { url: '/api/files/avatars/xxx_123.jpg' }
  return data.url
}

export async function swapCharacterOrder(id1: string, id2: string): Promise<void> {
  await apiClient.post('/characters/swap-order', { id1, id2 })
}

export async function deleteAvatar(id: string): Promise<void> {
  // Use PATCH to set avatarPath=null — the backend handles file deletion
  await apiClient.patch(`/characters/${id}`, { avatarPath: null })
}

export async function pinCharacterToTop(id: string): Promise<void> {
  await apiClient.patch(`/characters/${id}/pin`)
}

function mapCharacter(data: any): Character {
  return {
    id: data.id,
    name: data.name,
    groupIds: data.groupIds || [],
    description: data.description || '',
    position: data.position || '',
    race: data.race || '',
    devilFruit: data.devilFruit || data.devil_fruit || '',
    haki: data.haki || '',
    height: data.height || '',
    birthday: data.birthday || '',
    customFields: data.customFields || data.custom_fields || [],
    avatarDataUrl: data.avatarPath ? `/api/files/avatars/${data.id}` : undefined,
    sortOrder: data.sortOrder ?? data.sort_order ?? 0,
    createdAt: data.createdAt ?? data.created_at ?? 0,
  }
}
