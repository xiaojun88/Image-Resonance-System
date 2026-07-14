import { useEffect } from 'react'
import { X, User, Users, FileText, Tag, Swords, Anchor, Ruler, Cake, Image } from 'lucide-react'
import { useMaterialStore } from '../../stores/materialStore'
import { useUIStore } from '../../stores/uiStore'
import type { Character, CharacterImage } from '../../types'

interface Props {
  character: Character
  onClose: () => void
}

export function CharacterDetailModal({ character, onClose }: Props) {
  const images = useMaterialStore(s => s.images)
  const groups = useMaterialStore(s => s.groups)
  const setSelectedCharacter = useMaterialStore(s => s.setSelectedCharacter)
  const setViewMode = useMaterialStore(s => useMaterialStore.getState().setViewMode)
  const { setViewMode: switchMode } = useMaterialStore.getState

  const charImages = images
    .filter(im => im.characterId === character.id)
    .sort((a, b) => (b.sortOrder ?? b.createdAt) - (a.sortOrder ?? a.createdAt))

  const groupNames = character.groupIds
    .map(gid => groups.find(g => g.id === gid)?.name ?? '')
    .filter(Boolean)

  // ESC 关闭
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const attrs: { label: string; value: string; icon: React.ReactNode }[] = [
    { label: '职位', value: character.position, icon: <Anchor size={12} /> },
    { label: '种族', value: character.race, icon: <User size={12} /> },
    { label: '果实', value: character.devilFruit, icon: <Swords size={12} /> },
    { label: '霸气', value: character.haki, icon: <Swords size={12} /> },
    { label: '身高', value: character.height, icon: <Ruler size={12} /> },
    { label: '生日', value: character.birthday, icon: <Cake size={12} /> },
  ].filter(a => a.value)

  const customAttrs = (character.customFields || []).filter(f => f.key && f.value)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="char-detail-modal"
        onClick={e => e.stopPropagation()}
      >
        {/* 关闭按钮 */}
        <button className="char-detail-close" onClick={onClose}>
          <X size={18} />
        </button>

        <div className="char-detail-body">
          {/* 左侧：信息面板 */}
          <div className="char-detail-sidebar">
            {/* 头像 */}
            <div className="char-detail-avatar">
              {character.avatarDataUrl ? (
                <img src={character.avatarDataUrl} alt="" />
              ) : (
                <span className="char-detail-avatar-text">
                  {character.name.charAt(0)}
                </span>
              )}
            </div>

            {/* 名称 */}
            <h2 className="char-detail-name">{character.name}</h2>

            {/* 组织标签 */}
            {groupNames.length > 0 && (
              <div className="char-detail-groups">
                {groupNames.map(name => (
                  <span key={name} className="char-detail-group-tag">{name}</span>
                ))}
              </div>
            )}

            {/* 简介 */}
            {character.description && (
              <div className="char-detail-section">
                <div className="char-detail-section-title">
                  <FileText size={13} />
                  简介
                </div>
                <p className="char-detail-desc">{character.description}</p>
              </div>
            )}

            {/* 属性 */}
            {(attrs.length > 0 || customAttrs.length > 0) && (
              <div className="char-detail-section">
                <div className="char-detail-section-title">
                  <Tag size={13} />
                  属性
                </div>
                <div className="char-detail-attrs">
                  {attrs.map(a => (
                    <div key={a.label} className="char-detail-attr-row">
                      <span className="char-detail-attr-icon">{a.icon}</span>
                      <span className="char-detail-attr-label">{a.label}</span>
                      <span className="char-detail-attr-value">{a.value}</span>
                    </div>
                  ))}
                  {customAttrs.map(f => (
                    <div key={f.key} className="char-detail-attr-row">
                      <span className="char-detail-attr-label">{f.key}</span>
                      <span className="char-detail-attr-value">{f.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 跳转素材库 */}
            <button
              className="char-detail-goto"
              onClick={() => {
                useMaterialStore.getState().setSelectedCharacter(character.id)
                useUIStore.getState().setViewMode('material')
                onClose()
              }}
            >
              在素材库中查看
            </button>
          </div>

          {/* 右侧：图片网格 */}
          <div className="char-detail-images">
            <div className="char-detail-images-header">
              <Image size={14} />
              <span>全部图片</span>
              <span className="char-detail-images-count">{charImages.length}</span>
            </div>

            {charImages.length === 0 ? (
              <div className="char-detail-images-empty">
                <Image size={32} style={{ opacity: 0.3 }} />
                <p>暂无图片</p>
              </div>
            ) : (
              <div className="char-detail-images-grid">
                {charImages.map(img => (
                  <div key={img.id} className="char-detail-image-card">
                    <img
                      src={img.thumbnailDataUrl || img.dataUrl}
                      alt={img.fileName || ''}
                      loading="lazy"
                    />
                    {img.tags.length > 0 && (
                      <div className="char-detail-image-tags">
                        {img.tags.map(t => (
                          <span key={t} className="char-detail-image-tag">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
