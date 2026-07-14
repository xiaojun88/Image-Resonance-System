import { useState } from 'react'
import { useMaterialStore } from '../../stores/materialStore'
import { EmptyState } from '../common/EmptyState'
import { ImageGrid } from './ImageGrid'
import { Sidebar } from './Sidebar'
import { CharacterHeader } from './CharacterHeader'
import { CharacterContextMenu } from './CharacterContextMenu'
import { GroupContextMenu } from './GroupContextMenu'
import { GroupDetailPanel } from './GroupDetailPanel'

/**
 * 素材库主视图 — 编排两侧布局和上下文菜单。
 * 所有分组/人物/属性/上传逻辑已下沉到子组件中。
 */
export function MaterialLibrary() {
  const characters = useMaterialStore(s => s.characters)
  const groups = useMaterialStore(s => s.groups)
  const selectedCharacterId = useMaterialStore(s => s.selectedCharacterId)
  const detailGroupId = useMaterialStore(s => s.detailGroupId)
  // 订阅搜索和标签筛选状态 — 这些变化需要触发重渲染以更新 filteredChars
  /* eslint-disable @typescript-eslint/no-unused-vars */
  const _sq = useMaterialStore(s => s.searchQuery)
  const _st = useMaterialStore(s => s.selectedTagIds)
  /* eslint-enable @typescript-eslint/no-unused-vars */
  const getFilteredCharacters = useMaterialStore(s => s.getFilteredCharacters)

  const filteredChars = getFilteredCharacters()
  const currentCharacter = selectedCharacterId
    ? characters.find(c => c.id === selectedCharacterId) ?? null
    : null
  const detailGroup = detailGroupId
    ? groups.find(g => g.id === detailGroupId) ?? null
    : null

  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    charId: string
    groupId: string
  } | null>(null)

  const [groupContextMenu, setGroupContextMenu] = useState<{
    x: number
    y: number
    groupId: string
  } | null>(null)

  return (
    <div className="flex h-full w-full">
      {/* 左侧：分组 & 人物侧边栏 */}
      <Sidebar
        filteredChars={filteredChars}
        onContextMenu={(charId, groupId, x, y) =>
          setContextMenu({ charId, groupId, x, y })
        }
        onGroupContextMenu={(groupId, x, y) =>
          setGroupContextMenu({ groupId, x, y })
        }
      />

      {/* 右侧：分组详情 / 人物信息 + 图片网格 */}
      {detailGroup ? (
        <GroupDetailPanel group={detailGroup} />
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          <CharacterHeader
            currentCharacter={currentCharacter}
            groups={groups}
          />

          <div className="flex-1 overflow-y-auto p-4" style={{ background: '#FFFFFF' }}>
            {selectedCharacterId ? (
              <ImageGrid />
            ) : (
              <EmptyState
                icon="image"
                title="选择一个人物"
                description="从左侧列表选择人物来查看其图片"
              />
            )}
          </div>
        </div>
      )}

      {/* 右键菜单 */}
      <CharacterContextMenu
        contextMenu={contextMenu}
        onClose={() => setContextMenu(null)}
      />
      {groupContextMenu && (
        <GroupContextMenu
          x={groupContextMenu.x}
          y={groupContextMenu.y}
          groupId={groupContextMenu.groupId}
          onClose={() => setGroupContextMenu(null)}
        />
      )}
    </div>
  )
}
