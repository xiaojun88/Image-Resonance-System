import { apiClient } from './client'
import type { Scene, SceneTemplate } from '../types'

export async function getTemplates(): Promise<SceneTemplate[]> {
  const { data } = await apiClient.get('/templates')
  return data.map(mapTemplate)
}

export async function saveAsTemplate(name: string, scene: Scene, thumbnailDataUrl: string): Promise<SceneTemplate> {
  const { id: _id, name: _name, createdAt: _ca, updatedAt: _ua, ...sceneData } = scene
  const body: Record<string, unknown> = {
    name,
    sceneData,
    thumbnailPath: null,
  }
  // Upload thumbnail if it's a data URL
  if (thumbnailDataUrl && thumbnailDataUrl.startsWith('data:')) {
    // For simplicity, just pass the path
    body.thumbnailPath = thumbnailDataUrl
  }
  const { data } = await apiClient.post('/templates', body)
  return mapTemplate(data)
}

export async function deleteTemplate(id: string): Promise<void> {
  await apiClient.delete(`/templates/${id}`)
}

export async function createSceneFromTemplate(templateId: string, name: string): Promise<Scene> {
  const { data } = await apiClient.post(`/templates/${templateId}/apply`, { name })
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

function mapTemplate(data: any): SceneTemplate {
  return {
    id: data.id,
    name: data.name,
    sceneData: data.sceneData ?? data.scene_data ?? {},
    thumbnailDataUrl: data.thumbnailPath
      ? `/api/files/images/misc/${data.id}/thumbnail`
      : '',
    createdAt: data.createdAt ?? data.created_at ?? 0,
  }
}
