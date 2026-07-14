import { useState, useMemo } from 'react'
import { Search, Sparkles } from 'lucide-react'
import { useMaterialStore } from '../../stores/materialStore'
import type { Character } from '../../types'
import { CharacterDetailModal } from './CharacterDetailModal'

export function ShowcaseView() {
  const characters = useMaterialStore(s => s.characters)
  const images = useMaterialStore(s => s.images)
  const groups = useMaterialStore(s => s.groups)

  const [localSearch, setLocalSearch] = useState('')
  const [hasSearched, setHasSearched] = useState(false)
  const [selectedChar, setSelectedChar] = useState<Character | null>(null)

  // 过滤角色 — 只有搜索后才显示结果
  const filteredCharacters = useMemo(() => {
    if (!localSearch.trim()) return []
    const q = localSearch.toLowerCase()
    const matchedGroupIds = new Set(
      groups.filter(g => g.name.toLowerCase().includes(q)).map(g => g.id)
    )
    return characters.filter(c => {
      if (c.name.toLowerCase().includes(q)) return true
      if (c.groupIds.some(gid => matchedGroupIds.has(gid))) return true
      const charImages = images.filter(im => im.characterId === c.id)
      if (charImages.some(im => im.tags.some(t => t.toLowerCase().includes(q)))) return true
      // 属性搜索（不含简介）
      const attrs = [c.position, c.race, c.devilFruit, c.haki]
      if (attrs.some(a => a && a.toLowerCase().includes(q))) return true
      return false
    })
  }, [characters, groups, images, localSearch])

  // 有图片的角色数
  const charactersWithImages = useMemo(
    () => new Set(images.map(i => i.characterId)).size,
    [images]
  )

  // 动态生成快捷搜索关键词
  const quickHints = useMemo(() => {
    const hints: string[] = []
    // 热门人物（图片最多的前 3 个角色）
    const imgCountByChar = new Map<string, number>()
    images.forEach(i => imgCountByChar.set(i.characterId, (imgCountByChar.get(i.characterId) || 0) + 1))
    const topChars = [...imgCountByChar.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cid]) => characters.find(c => c.id === cid)?.name)
      .filter(Boolean) as string[]
    hints.push(...topChars)
    // 热门组织（角色最多的前 2 个组织）
    const charCountByGroup = new Map<string, number>()
    characters.forEach(c => c.groupIds.forEach(gid => charCountByGroup.set(gid, (charCountByGroup.get(gid) || 0) + 1)))
    const topGroups = [...charCountByGroup.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([gid]) => groups.find(g => g.id === gid)?.name)
      .filter(Boolean) as string[]
    hints.push(...topGroups)
    return [...new Set(hints)]
  }, [characters, groups, images])

  const getGroupName = (groupId: string) => groups.find(g => g.id === groupId)?.name ?? ''

  const getCharImage = (charId: string) => {
    const charImgs = images
      .filter(im => im.characterId === charId)
      .sort((a, b) => (b.sortOrder ?? b.createdAt) - (a.sortOrder ?? a.createdAt))
    return charImgs[0]?.dataUrl ?? null
  }

  const handleCardClick = (char: Character) => {
    setSelectedChar(char)
  }

  const handleSearch = (value: string) => {
    setLocalSearch(value)
    if (value.trim()) setHasSearched(true)
  }

  const handleClear = () => {
    setLocalSearch('')
    setHasSearched(false)
  }

  const showingResults = hasSearched && localSearch.trim()

  return (
    <div className="showcase-view">
      {/* Hero */}
      <div className="showcase-hero">
        <div className="showcase-hero-badge">
          <Sparkles size={14} />
          Treasure Resonance
        </div>
        <h1 className="showcase-hero-title">
          ONE <span className="gradient-text">PIECE</span>
        </h1>

        {/* 统计 — 始终显示 */}
        <div className="showcase-hero-stats">
          <div className="showcase-stat">
            <div className="showcase-stat-value">{characters.length}</div>
            <div className="showcase-stat-label">角色</div>
          </div>
          <div className="showcase-stat-divider" />
          <div className="showcase-stat">
            <div className="showcase-stat-value">{charactersWithImages}</div>
            <div className="showcase-stat-label">有图角色</div>
          </div>
          <div className="showcase-stat-divider" />
          <div className="showcase-stat">
            <div className="showcase-stat-value">{images.length}</div>
            <div className="showcase-stat-label">图片</div>
          </div>
          <div className="showcase-stat-divider" />
          <div className="showcase-stat">
            <div className="showcase-stat-value">{groups.length}</div>
            <div className="showcase-stat-label">组织</div>
          </div>
        </div>

        <div className="showcase-hero-accent" />

        {/* 搜索栏 */}
        <div className="showcase-hero-search">
          <Search size={16} style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
          <input
            className="showcase-search-input"
            placeholder="搜索角色名称、属性、果实能力..."
            value={localSearch}
            onChange={e => handleSearch(e.target.value)}
            autoFocus
          />
          {localSearch && (
            <button className="showcase-search-clear" onClick={handleClear}>
              清除
            </button>
          )}
        </div>
      </div>

      {/* 结果区域 */}
      {showingResults ? (
        <>
          {/* 结果统计 */}
          <div className="showcase-results-header">
            <span className="showcase-results-count">
              找到 <strong>{filteredCharacters.length}</strong> 个角色
            </span>
            {localSearch && (
              <span className="showcase-results-keyword">
                关键词：{localSearch}
              </span>
            )}
          </div>

          {filteredCharacters.length === 0 ? (
            <div className="showcase-empty">
              <div className="showcase-empty-icon">
                <Search size={36} style={{ color: 'var(--color-text-secondary)', opacity: 0.5 }} />
              </div>
              <h3>未找到匹配角色</h3>
              <p>尝试其他关键词，或检查拼写</p>
            </div>
          ) : (
            <div className="showcase-grid">
              {filteredCharacters.map((char, index) => (
                <ShowcaseCard
                  key={char.id}
                  character={char}
                  imageUrl={getCharImage(char.id)}
                  groupNames={char.groupIds.map(getGroupName).filter(Boolean)}
                  index={index}
                  onClick={() => handleCardClick(char)}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        /* 初始状态 — 搜索引导 */
        <div className="showcase-prompt">
          <div className="showcase-prompt-icon">
            <div className="showcase-prompt-ring" />
            <Search size={40} style={{ color: 'var(--color-text-secondary)', opacity: 0.6 }} />
          </div>
          <h2 className="showcase-prompt-title">探索角色宝藏</h2>
          <p className="showcase-prompt-desc">
            输入角色名称、所属分组、恶魔果实能力<br />
            或标签来发现你收藏的角色图片
          </p>
          <div className="showcase-prompt-hints">
            <span>试试搜索：</span>
            {quickHints.map(hint => (
              <button
                key={hint}
                className="showcase-prompt-hint"
                onClick={() => handleSearch(hint)}
              >
                {hint}
              </button>
            ))}
            <button className="showcase-prompt-hint showcase-prompt-hint-more" onClick={() => handleSearch('能力')}>
              能力
            </button>
          </div>

        </div>
      )}

      {/* 角色详情弹窗 */}
      {selectedChar && (
        <CharacterDetailModal
          character={selectedChar}
          onClose={() => setSelectedChar(null)}
        />
      )}
    </div>
  )
}

// ====== 卡片组件 ======

interface ShowcaseCardProps {
  character: Character
  imageUrl: string | null
  groupNames: string[]
  index: number
  onClick: () => void
}

function ShowcaseCard({ character, imageUrl, groupNames, index, onClick }: ShowcaseCardProps) {
  const initial = character.name.charAt(0).toUpperCase()
  const [loaded, setLoaded] = useState(false)

  return (
    <div
      className="showcase-card"
      style={{ animationDelay: `${index * 60}ms` }}
      onClick={onClick}
      title={`查看 ${character.name} 的图片`}
    >
      {/* 图片 */}
      {imageUrl ? (
        <img
          className={`showcase-card-bg-img ${loaded ? 'loaded' : ''}`}
          src={imageUrl}
          alt={character.name}
          loading="lazy"
          onLoad={() => setLoaded(true)}
        />
      ) : (
        <div className="showcase-card-placeholder">
          <span className="showcase-card-initial">{initial}</span>
        </div>
      )}

      {/* 加载骨架 */}
      {imageUrl && !loaded && (
        <div className="showcase-card-placeholder">
          <span className="showcase-card-initial">{initial}</span>
        </div>
      )}

      {/* 渐变遮罩 */}
      <div className="showcase-card-overlay" />

      {/* 信息 */}
      <div className="showcase-card-info">
        <h3 className="showcase-card-name">{character.name}</h3>

        <div className="showcase-card-bottom">
          {groupNames.length > 0 && (
            <div className="showcase-card-groups">
              {groupNames.slice(0, 3).map(name => (
                <span key={name} className="showcase-card-group-badge">{name}</span>
              ))}
              {groupNames.length > 3 && (
                <span className="showcase-card-group-badge">+{groupNames.length - 3}</span>
              )}
            </div>
          )}

          {/* 属性标签行 */}
          <div className="showcase-card-attrs">
            {character.devilFruit && (
              <span className="showcase-card-attr">{character.devilFruit}</span>
            )}
            {character.race && (
              <span className="showcase-card-attr">{character.race}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
