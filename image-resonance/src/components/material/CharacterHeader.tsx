import { useState, useRef, useEffect } from 'react'
import { Plus, Check, X, Upload, Loader2, Camera, Image as ImageIcon, ChevronUp, Trash2 } from 'lucide-react'
import { useMaterialStore } from '../../stores/materialStore'
import { useUIStore } from '../../stores/uiStore'
import { useImageUpload } from '../../hooks/useImageUpload'
import type { Character, Group } from '../../types'

interface CharacterHeaderProps {
  currentCharacter: Character | null
  groups: Group[]
}

const PRESET_FIELDS = [
  { key: 'birthday', label: '生日' },
  { key: 'position', label: '职位' },
  { key: 'race', label: '种族' },
  { key: 'devilFruit', label: '果实能力' },
  { key: 'haki', label: '霸气' },
  { key: 'height', label: '身高' },
] as const

/** 根据字符串生成稳定的颜色 */
function hashColor(str: string): string {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
    '#F8C471', '#82E0AA', '#F1948A', '#85929E', '#AED6F1',
    '#E8DAEF', '#A3E4D7', '#FAD7A0', '#ABEBC6', '#D5D8DC',
  ]
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return colors[Math.abs(hash) % colors.length]
}

export function CharacterHeader({ currentCharacter, groups }: CharacterHeaderProps) {
  const updateCharacterInfo = useMaterialStore(s => s.updateCharacterInfo)
  const uploadAvatar = useMaterialStore(s => s.uploadAvatar)
  const deleteAvatar = useMaterialStore(s => s.deleteAvatar)
  const selectedCharacterId = useMaterialStore(s => s.selectedCharacterId)
  const showToast = useUIStore(s => s.showToast)

  const { uploading, uploadMsg, removeBg, setRemoveBg, fileInputRef, handleUpload } = useImageUpload()

  // 头像上传
  const [avatarUploading, setAvatarUploading] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  // 名片壁纸（全局）
  const headerWallpaperDataUrl = useUIStore(s => s.headerWallpaperDataUrl)
  const setHeaderWallpaper = useUIStore(s => s.setHeaderWallpaper)
  const characterHeaderCollapsed = useUIStore(s => s.characterHeaderCollapsed)
  const toggleCharacterHeaderCollapsed = useUIStore(s => s.toggleCharacterHeaderCollapsed)
  const wallpaperInputRef = useRef<HTMLInputElement>(null)

  const handleWallpaperUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setHeaderWallpaper(reader.result as string)
    reader.readAsDataURL(file)
    if (wallpaperInputRef.current) wallpaperInputRef.current.value = ''
  }

  const handleClearWallpaper = () => setHeaderWallpaper(null)

  // 属性编辑状态
  const [editingField, setEditingField] = useState<string | null>(null)
  const [fieldDraft, setFieldDraft] = useState('')

  // 简介
  const [descriptionDraft, setDescriptionDraft] = useState(currentCharacter?.description || '')
  useEffect(() => {
    setDescriptionDraft(currentCharacter?.description || '')
  }, [currentCharacter?.id])

  // 添加属性状态
  const [addingCustom, setAddingCustom] = useState(false)
  const [newCustomKey, setNewCustomKey] = useState('')
  const [newCustomValue, setNewCustomValue] = useState('')
  const [newValDraft, setNewValDraft] = useState('')

  const wallpaperUrl = headerWallpaperDataUrl

  // 头像 URL 直接从 store 中的 character 派生（store 是唯一数据源）
  const avatarUrl = currentCharacter?.avatarDataUrl || null

  if (!selectedCharacterId) {
    return (
      <div
        className="char-header"
        style={wallpaperUrl ? {
          backgroundImage: `url(${wallpaperUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          position: 'relative',
        } : {}}
      >
        {wallpaperUrl && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0, 0, 0, 0.55)', pointerEvents: 'none', zIndex: 0 }} />
        )}
        <div style={{ position: 'relative', zIndex: 1 }} className="char-header-main">
          <div className="char-header-info">
            <h2 className="char-header-name">全部图片</h2>
            <div className="char-header-subtitle">在左侧选择一个人物来查看其图片</div>
          </div>
        </div>
      </div>
    )
  }

  if (!currentCharacter) return null

  const avatarInitial = currentCharacter.name.charAt(0)

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !currentCharacter) return
    setAvatarUploading(true)
    try {
      const url = await uploadAvatar(currentCharacter.id, file)
      if (url) {
        showToast('头像已更新', 'success')
      } else {
        showToast('头像更新失败：未获取到URL', 'error')
      }
    } catch (err: any) {
      console.error('[头像上传] 失败:', err)
      showToast(err?.message || '头像上传失败', 'error')
    } finally {
      setAvatarUploading(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }

  // 构建属性卡片列表
  const presetCards = PRESET_FIELDS
    .filter(f => currentCharacter[f.key as keyof Character])
    .map(f => ({
      fieldKey: f.key,
      label: f.label,
      value: currentCharacter[f.key as keyof Character] as string,
      isCustom: false,
      customIndex: -1,
    }))

  const customCards = (currentCharacter.customFields || []).map((cf, i) => ({
    fieldKey: `custom-${i}`,
    label: cf.key,
    value: cf.value,
    isCustom: true,
    customIndex: i,
  }))

  const allCards = [...presetCards, ...customCards]
  const isEmpty = allCards.length === 0

  const handleSaveField = (fieldKey: string, isCustom: boolean, customIndex: number) => {
    if (isCustom) {
      const updated = [...(currentCharacter.customFields || [])]
      updated[customIndex] = { ...updated[customIndex], value: fieldDraft }
      updateCharacterInfo(currentCharacter.id, { customFields: updated })
    } else {
      updateCharacterInfo(currentCharacter.id, { [fieldKey]: fieldDraft })
    }
    setEditingField(null)
  }

  const handleDeleteField = (fieldKey: string, isCustom: boolean, customIndex: number) => {
    if (isCustom) {
      const updated = (currentCharacter.customFields || []).filter((_, j) => j !== customIndex)
      updateCharacterInfo(currentCharacter.id, { customFields: updated })
    } else {
      updateCharacterInfo(currentCharacter.id, { [fieldKey]: '' })
    }
    if (editingField === fieldKey) setEditingField(null)
  }

  const handleAddProperty = () => {
    if (newCustomKey === '__custom__') {
      if (newCustomValue.trim()) {
        const updated = [...(currentCharacter.customFields || []), { key: newCustomValue.trim(), value: newValDraft.trim() }]
        updateCharacterInfo(currentCharacter.id, { customFields: updated })
      }
    } else if (newCustomKey) {
      updateCharacterInfo(currentCharacter.id, { [newCustomKey]: newValDraft.trim() })
    }
    setAddingCustom(false)
    setNewCustomKey('')
    setNewCustomValue('')
    setNewValDraft('')
  }

  return (
    <div
      className="char-header"
      style={wallpaperUrl ? {
        backgroundImage: `url(${wallpaperUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        position: 'relative',
      } : {}}
    >
      {/* 壁纸暗色遮罩 */}
      {wallpaperUrl && (
        <div
          style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0, 0, 0, 0.55)',
            pointerEvents: 'none', zIndex: 0,
          }}
        />
      )}
      {/* 内容区（置于遮罩之上） */}
      <div style={{ position: 'relative', zIndex: 1 }}>
      {/* 头部 */}
      <div className="char-header-main">
        {/* 折叠时仅显示名字和按钮 */}
        {characterHeaderCollapsed ? (
          <div className="char-header-info">
            <h2 className="char-header-name">{currentCharacter.name}</h2>
          </div>
        ) : (
          <>
            {/* 头像 — 点击上传 */}
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
            <div
              className="char-avatar cursor-pointer group/avatar"
              onClick={() => avatarInputRef.current?.click()}
              title="点击更换头像"
            >
              {avatarUploading ? (
                <Loader2 size={20} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
              ) : avatarUrl ? (
                <img src={avatarUrl} alt={currentCharacter.name} className="char-avatar-img" />
              ) : (
                <span className="char-avatar-initial">{avatarInitial}</span>
              )}
              <div className="char-avatar-overlay">
                <Camera size={14} />
              </div>
              {/* 删除头像按钮 */}
              {avatarUrl && (
                <button
                  className="char-avatar-remove"
                  onClick={async (e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    await deleteAvatar(currentCharacter.id)
                  }}
                  title="删除头像"
                >
                  <X size={10} />
                </button>
              )}
            </div>
            <div className="char-header-info">
              <h2 className="char-header-name">{currentCharacter.name}</h2>
              <div className="char-group-badges">
                {currentCharacter.groupIds.map(gid => {
                  const g = groups.find(gr => gr.id === gid)
                  return g ? (
                    <span key={gid} className="char-group-badge">{g.name}</span>
                  ) : null
                })}
              </div>
            </div>
          </>
        )}

        <div className="char-header-actions">
          <button
            className="btn-icon"
            onClick={toggleCharacterHeaderCollapsed}
            title={characterHeaderCollapsed ? '展开人物信息' : '收起人物信息'}
            style={characterHeaderCollapsed ? {} : undefined}
          >
            <ChevronUp
              size={16}
              style={{
                transform: characterHeaderCollapsed ? 'rotate(180deg)' : undefined,
                transition: 'transform 0.25s ease',
              }}
            />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleUpload}
          />
          {/* 壁纸按钮 */}
          <input
            ref={wallpaperInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleWallpaperUpload}
          />
          <button
            className="btn-icon"
            onClick={() => wallpaperInputRef.current?.click()}
            onContextMenu={e => {
              e.preventDefault()
              if (wallpaperUrl) handleClearWallpaper()
            }}
            title={wallpaperUrl ? '左键更换名片壁纸 | 右键清除壁纸' : '设置名片壁纸'}
          >
            <ImageIcon size={16} />
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <><Loader2 size={14} className="animate-spin" /> {uploadMsg || '处理中'}</>
            ) : (
              <><Upload size={14} /> 上传图片</>
            )}
          </button>
          <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none" style={{ color: 'var(--color-text-secondary)' }}>
            <input type="checkbox" checked={removeBg} onChange={e => setRemoveBg(e.target.checked)} className="w-3.5 h-3.5 rounded" />
            去白底
          </label>
        </div>
      </div>

      {/* 简介区域 */}
      {!characterHeaderCollapsed && (
      <>
      <div className="px-5 pb-1">
        <textarea
          className="input w-full resize-none text-[13px] leading-relaxed"
          style={{
            minHeight: 36,
            background: 'rgba(255,255,255,0.03)',
            border: '1px dashed var(--color-border)',
            borderRadius: 8,
          }}
          rows={2}
          placeholder="添加简介…"
          value={descriptionDraft}
          onChange={e => setDescriptionDraft(e.target.value)}
          onBlur={() => {
            if (descriptionDraft !== (currentCharacter.description || '')) {
              updateCharacterInfo(currentCharacter.id, { description: descriptionDraft.trim() })
            }
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              (e.target as HTMLTextAreaElement).blur()
            }
          }}
        />
      </div>

      {/* 属性区域 */}
      <div className="property-chips-area">
        {allCards.length > 0 && (
          <div className="property-chips">
            {allCards.map(card => {
              const isEditing = editingField === card.fieldKey
              return (
                <div
                  key={card.fieldKey}
                  className={`property-chip group relative inline-flex items-center gap-1.5 rounded-[10px] border px-3 py-2 text-[13px] leading-tight transition-all ${
                    isEditing
                      ? 'editing border-[var(--color-primary)] min-w-[140px]'
                      : 'border-[var(--color-border)] bg-[var(--color-surface)] cursor-pointer'
                  }`}
                  onClick={() => {
                    if (!isEditing) {
                      setEditingField(card.fieldKey)
                      setFieldDraft(card.value)
                    }
                  }}
                >
                  {isEditing ? (
                    <input
                      className="chip-edit-input"
                      value={fieldDraft}
                      onChange={e => setFieldDraft(e.target.value)}
                      onBlur={() => handleSaveField(card.fieldKey, card.isCustom, card.customIndex)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                        if (e.key === 'Escape') setEditingField(null)
                      }}
                      autoFocus
                    />
                  ) : (
                    <>
                      <span className="chip-label" style={{ color: hashColor(card.fieldKey) }}>{card.label}</span>
                      <span className="chip-separator">·</span>
                      <span className="chip-value" title={card.value} style={{ color: hashColor(card.fieldKey) }}>{card.value}</span>
                    </>
                  )}
                  <button
                    className="chip-remove"
                    onClick={e => {
                      e.stopPropagation()
                      handleDeleteField(card.fieldKey, card.isCustom, card.customIndex)
                    }}
                    title="清除此属性"
                  >
                    <X size={11} />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {isEmpty && (
          <div className="property-empty">
            <p className="property-empty-text">暂无属性</p>
            <p className="property-empty-hint">点击下方按钮添加属性</p>
          </div>
        )}

        {/* 添加属性 */}
        {addingCustom ? (
          <div className="add-property-form">
            <select
              className="property-select"
              value={newCustomKey}
              onChange={e => setNewCustomKey(e.target.value)}
              autoFocus
            >
              <option value="">选择属性…</option>
              {!currentCharacter.birthday && <option value="birthday">生日</option>}
              {!currentCharacter.position && <option value="position">职位</option>}
              {!currentCharacter.race && <option value="race">种族</option>}
              {!currentCharacter.devilFruit && <option value="devilFruit">果实能力</option>}
              {!currentCharacter.haki && <option value="haki">霸气</option>}
              {!currentCharacter.height && <option value="height">身高</option>}
              <option value="__custom__">⚡ 自定义字段</option>
            </select>
            {newCustomKey === '__custom__' && (
              <input
                className="input text-[13px] py-2 px-2 w-20"
                placeholder="字段名"
                value={newCustomValue}
                onChange={e => setNewCustomValue(e.target.value)}
              />
            )}
            <input
              className="input text-[13px] py-2 px-2.5 flex-1 min-w-[120px]"
              placeholder="输入值"
              value={newValDraft}
              onChange={e => setNewValDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleAddProperty()
                if (e.key === 'Escape') {
                  setAddingCustom(false); setNewCustomKey(''); setNewCustomValue(''); setNewValDraft('')
                }
              }}
            />
            <button className="btn-icon" style={{ color: 'var(--color-primary)' }} onClick={handleAddProperty} title="确认">
              <Check size={15} />
            </button>
            <button className="btn-icon" onClick={() => { setAddingCustom(false); setNewCustomKey(''); setNewCustomValue(''); setNewValDraft('') }} title="取消">
              <X size={15} />
            </button>
          </div>
        ) : (
          <button className="add-property-btn" onClick={() => setAddingCustom(true)}>
            <Plus size={13} /> 添加属性
          </button>
        )}
      </div>
      </>
      )}
      </div>{/* 内容区 wrapper 结束 */}
    </div>
  )
}
