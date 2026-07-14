import { apiClient } from './client'
import type { Group } from '../types'

export async function getGroups(): Promise<Group[]> {
  const { data } = await apiClient.get('/groups')
  return data.map(mapGroup)
}

export async function createGroup(name: string): Promise<Group> {
  const { data } = await apiClient.post('/groups', { name })
  return mapGroup(data)
}

export async function updateGroup(id: string, updates: Partial<Pick<Group, 'name' | 'description' | 'resonanceImageDataUrls'>>): Promise<void> {
  const body: Record<string, unknown> = {}
  if (updates.name !== undefined) body.name = updates.name
  if (updates.description !== undefined) body.description = updates.description
  if (updates.resonanceImageDataUrls !== undefined) body.resonanceImagePaths = updates.resonanceImageDataUrls
  await apiClient.patch(`/groups/${id}`, body)
}

export async function deleteGroup(id: string): Promise<void> {
  await apiClient.delete(`/groups/${id}`)
}

export async function pinGroupToTop(id: string): Promise<void> {
  await apiClient.patch(`/groups/${id}/pin`)
}

export async function swapGroupOrder(id1: string, id2: string): Promise<void> {
  await apiClient.post('/groups/swap-order', { id1, id2 })
}

// Map API snake_case response to frontend camelCase type
function mapGroup(data: any): Group {
  return {
    id: data.id,
    name: data.name,
    description: data.description || '',
    resonanceImageDataUrls: data.resonanceImagePaths || data.resonance_image_paths || [],
    characterCount: data.characterCount ?? data.character_count ?? 0,
    sortOrder: data.sortOrder ?? data.sort_order ?? 0,
    createdAt: data.createdAt ?? data.created_at ?? 0,
  }
}
