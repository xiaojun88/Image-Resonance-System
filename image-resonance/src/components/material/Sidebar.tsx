import { useState, useRef } from 'react'
import { useMaterialStore } from '../../stores/materialStore'
import { useUIStore } from '../../stores/uiStore'
import { SearchInput } from '../common/SearchInput'
import { TagFilter } from '../common/TagFilter'
import { EmptyState } from '../common/EmptyState'
import { FolderPlus, Image, FileUp, Download } from 'lucide-react'
import { GroupItem } from './GroupItem'
import type { Character } from '../../types'

interface SidebarProps {
  filteredChars: Character[]
  onContextMenu: (charId: string, groupId: string, x: number, y: number) => void
  onGroupContextMenu: (groupId: string, x: number, y: number) => void
}

export function Sidebar({ filteredChars, onContextMenu, onGroupContextMenu }: SidebarProps) {
  const groups = useMaterialStore(s => s.groups)
  const searchQuery = useMaterialStore(s => s.searchQuery)
  const setSearchQuery = useMaterialStore(s => s.setSearchQuery)
  const selectedGroupId = useMaterialStore(s => s.selectedGroupId)
  const setSelectedGroup = useMaterialStore(s => s.setSelectedGroup)
  const characterListExpanded = useMaterialStore(s => s.characterListExpanded)
  const toggleGroupExpand = useMaterialStore(s => s.toggleGroupExpand)
  const addGroup = useMaterialStore(s => s.addGroup)

  const showToast = useUIStore(s => s.showToast)
  const sidebarWallpaperDataUrl = useUIStore(s => s.sidebarWallpaperDataUrl)
  const setSidebarWallpaper = useUIStore(s => s.setSidebarWallpaper)

  const wallpaperInputRef = useRef<HTMLInputElement>(null)

  const [newGroupName, setNewGroupName] = useState('')
  const [showNewGroup, setShowNewGroup] = useState(false)

  const handleWallpaperUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setSidebarWallpaper(reader.result as string)
    reader.readAsDataURL(file)
    if (wallpaperInputRef.current) wallpaperInputRef.current.value = ''
  }

  // JSON 批量导入
  const importInputRef = useRef<HTMLInputElement>(null)

  /** 确保分组存在（按名称查找或新建），返回分组 ID */
  const ensureGroup = async (name: string, nameToId: Record<string, string>) => {
    if (nameToId[name]) return nameToId[name]
    // 再查一次最新列表
    const latest = useMaterialStore.getState().groups.find(g => g.name === name)
    if (latest) { nameToId[name] = latest.id; return latest.id }
    const grp = await useMaterialStore.getState().addGroup(name)
    nameToId[name] = grp.id
    return grp.id
  }

  const processImportFile = async (file: File, nameToId: Record<string, string>, groupsCreated: {n: number}, charsCreated: {n: number}, charsUpdated: {n: number}) => {
    const text = await file.text()
    const json = JSON.parse(text)
    const data = json.groups || json.characters ? json : { groups: [], characters: [] }

    // 1. 确保分组存在
    for (const name of (data.groups || [])) {
      if (!nameToId[name]) {
        await ensureGroup(name, nameToId)
        groupsCreated.n++
      }
    }

    // 2. 创建/更新人物（同名人物覆盖属性）
    for (const char of (data.characters || [])) {
      if (!char.name) continue
      const groupNames: string[] = char.group
        ? [char.group]
        : char.groups
          ? char.groups
          : []
      // 自动创建不存在的分组
      const groupIds: string[] = []
      for (const n of groupNames) {
        groupIds.push(await ensureGroup(n, nameToId))
      }

      // 构建属性数据
      const fields: Record<string, string> = {}
      for (const key of ['description', 'birthday', 'position', 'race', 'devilFruit', 'haki', 'height']) {
        if (char[key]) fields[key] = char[key]
      }
      const customFields: { key: string; value: string }[] = []
      if (Array.isArray(char.customFields)) {
        for (const cf of char.customFields) {
          if (cf.key && cf.value) customFields.push({ key: cf.key, value: cf.value })
        }
      }
      const knownKeys = new Set(['name', 'group', 'groups', 'description', 'birthday', 'position', 'race', 'devilFruit', 'haki', 'height', 'customFields'])
      for (const key of Object.keys(char)) {
        if (!knownKeys.has(key) && typeof char[key] === 'string' && char[key]) {
          customFields.push({ key, value: char[key] })
        }
      }

      // 查找同名人物
      const existing = useMaterialStore.getState().characters.find(
        c => c.name === char.name.trim()
      )

      if (existing) {
        // 已存在：覆盖属性 + 添加到新分组
        const updateData: Record<string, unknown> = { ...fields }
        if (customFields.length > 0) updateData.customFields = customFields
        await useMaterialStore.getState().updateCharacterInfo(existing.id, updateData)

        // 将人物添加到导入指定的分组（如果还没在这些分组中）
        for (const gid of groupIds) {
          if (!existing.groupIds.includes(gid)) {
            await useMaterialStore.getState().copyCharacterToGroup(existing.id, gid)
          }
        }
        charsUpdated.n++
      } else {
        // 不存在：新建
        const newChar = await useMaterialStore.getState().addCharacter(char.name.trim(), groupIds)
        charsCreated.n++

        if (Object.keys(fields).length > 0 || customFields.length > 0) {
          await useMaterialStore.getState().updateCharacterInfo(newChar.id, {
            ...fields,
            ...(customFields.length > 0 ? { customFields } : {}),
          })
        }
      }
    }
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const fileList = Array.from(files)
    ;(async () => {
      try {
        const existingGroups = useMaterialStore.getState().groups
        const nameToId: Record<string, string> = {}
        for (const g of existingGroups) nameToId[g.name] = g.id

        const groupsCreated = { n: 0 }
        const charsCreated = { n: 0 }
        const charsUpdated = { n: 0 }

        for (const file of fileList) {
          await processImportFile(file, nameToId, groupsCreated, charsCreated, charsUpdated)
        }

        await useMaterialStore.getState().loadAll()
        const parts: string[] = []
        if (groupsCreated.n > 0) parts.push(`${groupsCreated.n} 个分组`)
        if (charsCreated.n > 0) parts.push(`${charsCreated.n} 个新人`)
        if (charsUpdated.n > 0) parts.push(`${charsUpdated.n} 个更新`)
        showToast(`导入完成：${parts.join('，')}`, 'success')
      } catch (err) {
        console.error('[导入] 失败:', err)
        showToast('导入失败：JSON 格式不正确', 'error')
      }
    })()
    if (importInputRef.current) importInputRef.current.value = ''
  }

  // 下载示例文件
  const downloadSample = () => {
    const sample = {
      groups: ['草帽团', '海军'],
      characters: [
        {
          name: '路飞',
          group: '草帽团',
          description: '草帽海贼团船长，梦想成为海贼王',
          position: '船长',
          race: '人类',
          devilFruit: '橡胶果实',
          haki: '霸王色、武装色、见闻色',
          height: '174cm',
          birthday: '5月5日',
          customFields: [
            { key: '赏金', value: '30亿贝里' },
            { key: '代表动物', value: '猴子' },
          ],
        },
        {
          name: '索隆',
          group: '草帽团',
          description: '草帽海贼团剑士，目标是成为世界第一剑豪',
          position: '剑士',
          race: '人类',
          haki: '武装色、见闻色',
          height: '181cm',
          birthday: '11月11日',
          customFields: [
            { key: '赏金', value: '11亿1100万贝里' },
          ],
        },
        {
          name: '赤犬',
          group: '海军',
          description: '海军元帅',
          position: '元帅',
          race: '人类',
          devilFruit: '岩浆果实',
          haki: '武装色、见闻色',
          height: '306cm',
        },
      ],
    }
    const blob = new Blob([JSON.stringify(sample, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = '人物导入示例.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleAddGroup = async () => {
    if (newGroupName.trim()) {
      await addGroup(newGroupName.trim())
      setNewGroupName('')
      setShowNewGroup(false)
      showToast('分组已创建', 'success')
    }
  }

  return (
    <div
      className="ocean-sidebar w-72 flex flex-col shrink-0 relative overflow-hidden"
      style={{
        borderRight: '1px solid rgba(255,255,255,0.05)',
        ...(sidebarWallpaperDataUrl ? {
          backgroundImage: `url(${sidebarWallpaperDataUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        } : {
          background: 'rgba(20, 22, 28, 0.7)',
          backdropFilter: 'blur(16px) saturate(120%)',
          WebkitBackdropFilter: 'blur(16px) saturate(120%)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
        }),
      }}
    >
      {/* 壁纸暗色遮罩 */}
      {sidebarWallpaperDataUrl && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0, 0, 0, 0.55)', pointerEvents: 'none', zIndex: 0 }} />
      )}

      {/* 搜索 */}
      <div className="p-3 space-y-2 border-b relative z-10" style={{ borderBottomColor: 'var(--color-border)' }}>
        <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="搜索人物..." />
        <TagFilter />
      </div>

      {/* 分组和人物列表 */}
      <div className="flex-1 overflow-y-auto">
        {groups.length === 0 ? (
          <EmptyState
            icon="users"
            title="还没有分组"
            description="创建第一个分组来管理人物"
            action={{ label: '创建分组', onClick: () => setShowNewGroup(true) }}
          />
        ) : (
          <>
            {groups.map(group => {
              const groupChars = filteredChars.filter(c => c.groupIds.includes(group.id))
              // 搜索时隐藏无匹配的分组
              if (searchQuery && groupChars.length === 0) return null
              const expanded = characterListExpanded.has(group.id) || searchQuery !== ''

              return (
                <GroupItem
                  key={group.id}
                  group={group}
                  characters={groupChars}
                  isSelected={selectedGroupId === group.id}
                  isExpanded={expanded}
                  onToggle={() => {
                    toggleGroupExpand(group.id)
                    setSelectedGroup(group.id)
                  }}
                  onContextMenu={onContextMenu}
                  onGroupContextMenu={onGroupContextMenu}
                />
              )
            })}
          </>
        )}

        {/* 新建分组 & 壁纸 */}
        <div className="p-3 space-y-2">
          {showNewGroup ? (
            <div className="new-group-form">
              <input
                className="input"
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleAddGroup()
                  if (e.key === 'Escape') setShowNewGroup(false)
                }}
                placeholder="分组名称"
                autoFocus
              />
              <button className="btn btn-primary btn-sm px-3" onClick={handleAddGroup}>
                确定
              </button>
              <button className="btn-icon" onClick={() => setShowNewGroup(false)}>
                <span style={{ fontSize: 14, lineHeight: 1 }}>✕</span>
              </button>
            </div>
          ) : (
            <button className="new-group-btn" onClick={() => setShowNewGroup(true)}>
              <FolderPlus size={14} /> 新建分组
            </button>
          )}
          <input
            ref={wallpaperInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleWallpaperUpload}
          />
          <button
            className="new-group-btn"
            onClick={() => wallpaperInputRef.current?.click()}
            onContextMenu={e => {
              e.preventDefault()
              if (sidebarWallpaperDataUrl) setSidebarWallpaper(null)
            }}
            title={sidebarWallpaperDataUrl ? '左键更换侧边栏壁纸 | 右键还原默认' : '设置侧边栏壁纸'}
          >
            <Image size={14} /> {sidebarWallpaperDataUrl ? '更换壁纸' : '侧边栏壁纸'}
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".json,application/json"
            multiple
            className="hidden"
            onChange={handleImport}
          />
          <button
            className="new-group-btn"
            onClick={() => importInputRef.current?.click()}
            title="一键导入分组和人物信息（支持多选 JSON 文件）"
          >
            <FileUp size={14} /> 一键导入
          </button>
          <button
            className="new-group-btn"
            onClick={downloadSample}
            title="下载示例文件作为模板"
          >
            <Download size={14} /> 下载示例
          </button>
        </div>
      </div>
    </div>
  )
}
