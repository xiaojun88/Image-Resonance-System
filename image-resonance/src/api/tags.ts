import { apiClient } from './client'
import type { Tag } from '../types'

export async function getAllTags(): Promise<Tag[]> {
  const { data } = await apiClient.get('/tags')
  return data.map(mapTag)
}

export async function createTag(name: string, color?: string): Promise<Tag> {
  const { data } = await apiClient.post('/tags', { name, color })
  return mapTag(data)
}

export async function deleteTag(id: string): Promise<void> {
  await apiClient.delete(`/tags/${id}`)
}

function mapTag(data: any): Tag {
  return {
    id: data.id,
    name: data.name,
    color: data.color || '#6366F1',
  }
}
