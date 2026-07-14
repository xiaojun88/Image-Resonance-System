import { apiClient } from './client'
import type { Scene } from '../types'

export async function getScenes(): Promise<Scene[]> {
  const { data } = await apiClient.get('/scenes')
  return data.map(mapScene)
}

export async function getScene(id: string): Promise<Scene | undefined> {
  try {
    const { data } = await apiClient.get(`/scenes/${id}`)
    return mapScene(data)
  } catch {
    return undefined
  }
}

export async function createScene(name: string): Promise<Scene> {
  const { data } = await apiClient.post('/scenes', { name })
  return mapScene(data)
}

export async function updateScene(id: string, updates: Partial<Scene>): Promise<void> {
  const body: Record<string, unknown> = {}
  const fieldMap: Record<string, string> = {
    name: 'name',
    backgroundColor: 'backgroundColor',
    backgroundImage: 'backgroundImagePath',
    layers: 'layers',
    groups: 'groups',
  }
  for (const [key, apiKey] of Object.entries(fieldMap)) {
    if (updates[key as keyof Scene] !== undefined) {
      body[apiKey] = updates[key as keyof Scene]
    }
  }
  await apiClient.patch(`/scenes/${id}`, body)
}

export async function deleteScene(id: string): Promise<void> {
  await apiClient.delete(`/scenes/${id}`)
}

export async function duplicateScene(id: string): Promise<Scene> {
  const { data } = await apiClient.post(`/scenes/${id}/duplicate`)
  return mapScene(data)
}

function mapScene(data: any): Scene {
  return {
    id: data.id,
    name: data.name,
    backgroundColor: data.backgroundColor ?? data.background_color ?? '#FFFFFF',
    backgroundImage: data.backgroundImagePath
      ? `/api/files/backgrounds/${data.id}`
      : null,
    layers: data.layers || [],
    groups: data.groupsJson ?? data.groups ?? [],
    createdAt: data.createdAt ?? data.created_at ?? 0,
    updatedAt: data.updatedAt ?? data.updated_at ?? 0,
  }
}
