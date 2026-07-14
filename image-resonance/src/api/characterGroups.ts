import { apiClient } from './client'
import type { Character } from '../types'

export async function addCharacterToGroup(characterId: string, groupId: string): Promise<void> {
  await apiClient.post('/character-groups', { characterId, groupId })
}

export async function removeCharacterFromGroup(characterId: string, groupId: string): Promise<void> {
  await apiClient.delete(`/character-groups/${characterId}/${groupId}`)
}

export async function getCharacterGroupIds(characterId: string): Promise<string[]> {
  const { data } = await apiClient.get(`/characters/${characterId}/groups`)
  return data
}

export async function getCharactersByGroup(groupId: string): Promise<Character[]> {
  const { data } = await apiClient.get(`/groups/${groupId}/characters`)
  return data.map((c: any) => ({
    id: c.id,
    name: c.name,
    groupIds: c.groupIds || [],
    description: c.description || '',
    position: c.position || '',
    race: c.race || '',
    devilFruit: c.devilFruit || c.devil_fruit || '',
    haki: c.haki || '',
    height: c.height || '',
    birthday: c.birthday || '',
    customFields: c.customFields || c.custom_fields || [],
    avatarDataUrl: c.avatarPath ? `/api/files/avatars/${c.id}` : undefined,
    sortOrder: c.sortOrder ?? c.sort_order ?? 0,
    createdAt: c.createdAt ?? c.created_at ?? 0,
  }))
}
