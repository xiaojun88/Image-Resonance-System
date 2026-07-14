import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { useUIStore } from '../../stores/uiStore'
import { useMaterialStore } from '../../stores/materialStore'
import { useCanvasStore } from '../../stores/canvasStore'
import { SearchInput } from '../common/SearchInput'
import { TagFilter } from '../common/TagFilter'
import { EmptyState } from '../common/EmptyState'

export function LeftPanel() {
  const leftPanelVisible = useUIStore(s => s.leftPanelVisible)
  const toggleLeftPanel = useUIStore(s => s.toggleLeftPanel)

  const groups = useMaterialStore(s => s.groups)
  const images = useMaterialStore(s => s.images)
  const searchQuery = useMaterialStore(s => s.searchQuery)
  const setSearchQuery = useMaterialStore(s => s.setSearchQuery)
  const characterListExpanded = useMaterialStore(s => s.characterListExpanded)
  const toggleGroupExpand = useMaterialStore(s => s.toggleGroupExpand)
  const getFilteredCharacters = useMaterialStore(s => s.getFilteredCharacters)

  const addLayer = useCanvasStore(s => s.addLayer)

  const filteredChars = getFilteredCharacters()

  if (!leftPanelVisible) {
    return (
      <button
        className="panel-toggle left-0 rounded-r-lg"
        onClick={toggleLeftPanel}
        title="展开人物库"
        style={{ left: 0 }}
      >
        <ChevronRight size={16} style={{ color: 'var(--color-text-secondary)' }} />
      </button>
    )
  }

  return (
    <div
      className="ocean-sidebar w-72 flex flex-col shrink-0 relative overflow-hidden panel-enter"
      style={{
        borderRight: '1px solid rgba(255,255,255,0.05)',
        background: 'rgba(20, 22, 28, 0.7)',
        backdropFilter: 'blur(16px) saturate(120%)',
        WebkitBackdropFilter: 'blur(16px) saturate(120%)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
      }}
    >
      {/* 面板头部 */}
      <div className="flex items-center justify-between px-3 py-3 border-b relative z-10" style={{ borderBottomColor: 'var(--color-border)' }}>
        <span style={{ fontSize: 15, fontWeight: 600, fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}>人物库</span>
        <button className="btn-icon" onClick={toggleLeftPanel} title="收起面板">
          <ChevronLeft size={16} />
        </button>
      </div>

      {/* 搜索和筛选 */}
      <div className="p-3 space-y-2 border-b relative z-10" style={{ borderBottomColor: 'var(--color-border)' }}>
        <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="搜索人物..." />
        <TagFilter />
      </div>

      {/* 分组和人物列表 */}
      <div className="flex-1 overflow-y-auto">
        {groups.length === 0 ? (
          <EmptyState icon="users" title="暂无人物" description="请先在素材库中创建人物和分组" />
        ) : (
          groups.map(group => {
            const groupChars = filteredChars.filter(c => c.groupIds.includes(group.id))
            if (groupChars.length === 0) return null
            // 空 Set = 全部展开；显式在 Set 中的也展开
            const expanded = characterListExpanded.has(group.id) || characterListExpanded.size === 0

            // 处理点击：空 Set 时默认全展开，点击某个分组应折叠它
            const handleToggle = () => {
              if (characterListExpanded.size === 0) {
                // 先把所有分组加入 Set，再移除当前分组 → 其他保持展开，当前折叠
                const allIds = new Set(groups.map(g => g.id))
                allIds.delete(group.id)
                useMaterialStore.setState({ characterListExpanded: allIds })
              } else {
                toggleGroupExpand(group.id)
              }
            }

            return (
              <div key={group.id}>
                {/* 分组标题 — 复用 group-row 样式 */}
                <div
                  className="group-row"
                  style={{ cursor: 'pointer' }}
                  onClick={handleToggle}
                >
                  <span className={`group-chevron ${expanded ? 'expanded' : ''}`}>
                    <ChevronRight size={14} />
                  </span>
                  <span className="group-name">{group.name}</span>
                  <span className="group-count">{groupChars.length}</span>
                </div>

                {/* 人物列表 — 复用 character-row 样式 */}
                {expanded && groupChars.map(char => {
                  const charImages = images.filter(im => im.characterId === char.id)

                  return (
                    <div key={char.id}>
                      <div className="character-row" style={{ cursor: 'default' }}>
                        <span className="character-name">{char.name}</span>
                      </div>
                      {/* 图片缩略图网格（全部显示，每行3个） */}
                      <div className="grid grid-cols-3 gap-1 px-3 pb-2 ml-4">
                        {charImages.map(img => (
                          <div
                            key={img.id}
                            className="aspect-square rounded-md overflow-hidden cursor-grab active:cursor-grabbing transition-all"
                            style={{
                              border: '1px solid var(--color-border)',
                              background: 'var(--color-elevated)',
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.borderColor = 'var(--color-primary)'
                              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)'
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.borderColor = 'var(--color-border)'
                              e.currentTarget.style.boxShadow = 'none'
                            }}
                            draggable
                            onDragStart={e => {
                              e.dataTransfer.setData('application/image-resonance', JSON.stringify({
                                imageId: img.id,
                                characterId: char.id,
                                dataUrl: img.processedDataUrl || img.dataUrl,
                                width: img.width,
                                height: img.height,
                              }))
                              e.dataTransfer.effectAllowed = 'copy'
                            }}
                            title={`拖拽到画布: ${char.name} - ${img.fileName}`}
                          >
                            <img src={img.thumbnailDataUrl} alt="" className="w-full h-full object-cover pointer-events-none" />
                          </div>
                        ))}
                        {charImages.length === 0 && (
                          <div className="col-span-3 text-xs px-1 py-1" style={{ color: 'var(--color-text-secondary)' }}>
                            暂无图片
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
