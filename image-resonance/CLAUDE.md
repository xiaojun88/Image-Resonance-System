# CLAUDE.md

这份文件为 Claude Code (claude.ai/code) 在此仓库中工作时提供指导。

## 常用命令

```bash
npm run dev       # 启动开发服务器 (http://localhost:5173, 监听 0.0.0.0)
npm run build     # 类型检查 (tsc -b) 后构建到 dist/
npm run lint      # 对所有文件运行 ESLint
npm run preview   # 预览生产构建
npx tsc --noEmit  # 仅类型检查，不产出文件
```

## 项目架构

**宝藏共鸣台 (Image Resonance)** — 图片素材管理 + 无限画布场景拼贴编辑器。前端 React SPA，后端 Express + MySQL。

```
React SPA (Vite) ←→ REST API (Express) ←→ MySQL + Filesystem
        ↓                    ↓
 Zustand stores           Drizzle ORM
 src/api/* (axios)        server/src/routes/
```

### 技术栈
- **React 19** + **TypeScript**（`erasableSyntaxOnly`，`verbatimModuleSyntax`）
- **Vite 8**，使用 `@vitejs/plugin-react` 和 `@tailwindcss/vite`
- **Tailwind CSS v4**，主题变量定义在 `src/index.css`（暗色主题：`--color-bg: #0B0D13`，`--color-primary: #7B9BFF`，`--color-accent/gold: #C9A050`）
- **Zustand** — 3 个独立 Store（materialStore、canvasStore、uiStore）
- **Axios** — HTTP 客户端，Vite 开发服务器将 `/api` 代理到 `http://localhost:3001`
- **Dexie.js** — IndexedDB 封装，用于数据备份的导出/导入（非主数据存储）
- **Konva.js**（`react-konva`）— Canvas 渲染引擎（体积大，惰性加载）

### 双模式应用

`uiStore.viewMode` 切换三种视图：
1. **`material`**（素材库）— 管理分组 → 人物 → 图片，支持标签、搜索、感知哈希去重、去白底
2. **`canvas`**（共鸣界面）— 场景编辑器：无限画布，图层拖拽/缩放/旋转、编组、撤销重做、导出 PNG/JPG
3. **`showcase`** — 展示模式

### 数据流

```
MySQL ←→ Drizzle ORM ←→ Express Routes ←→ HTTP ←→ Axios (src/api/*) ←→ Zustand Store ←→ React 组件
```

- **`src/api/client.ts`**：Axios 实例，baseURL = `/api`，30 秒超时，统一错误拦截
- **`src/api/*.ts`**：各资源的 API 封装（groups、characters、characterGroups、images、tags、scenes、templates），将后端 `snake_case` 响应映射为前端 `camelCase` 类型
- **`src/stores/materialStore.ts`**：素材数据（分组、人物、图片、标签）+ 选中/筛选状态。所有写操作通过 API → 后端 → MySQL。`getFilteredImages()` 和 `getFilteredCharacters()` 是计算型 getter。
- **`src/stores/canvasStore.ts`**：当前场景、图层、编组、视图状态、选中、剪贴板、撤销重做历史。历史记录是深拷贝快照栈（上限 50 步）；所有可撤销的变更操作必须先调 `pushHistory()`。场景数据通过 API 持久化。
- **`src/stores/uiStore.ts`**：视图模式、面板显隐、模态框调度、Toast 消息、右键菜单位置、`isLoading` 状态。
- **`src/db/index.ts`**：基于 Dexie 的 IndexedDB 操作层（7 张表），仅用于**数据备份的导出/导入**（`exportAllData()` / `importAllData()`）。主数据流程不经过 IndexedDB。

### Vite 代理配置

开发环境下，Vite 将 `/api` 请求代理到后端：
```
localhost:5173/api/* → http://localhost:3001/api/*
```

图片通过 HTTP URL 提供（如 `/api/files/images/{id}/thumbnail`），不再使用 base64 data URL 内联存储。

### 核心算法（`src/utils/`）

- **`imageProcessing.ts`**：
  - `computePerceptualHash()` — 缩放到 16×16，转灰度，按均值二值化 → 64 位十六进制哈希
  - `hammingDistance()` — 比对两个哈希值，用于上传时的相似度检测
  - `removeWhiteBackground()` — 从图片四边出发 BFS，标记连通的浅色像素（RGB 均 > 230 且通道间最大差异 < 15），将其 alpha 设为 0。内部浅色区域（牙齿、白衣）因为不与边缘连通而保留。60 秒超时保护，拒绝超过 6400 万像素的图片。
  - `createThumbnail()` — 生成 JPEG 缩略图，默认最大 200px
- **`exportUtils.ts`**：离屏 Canvas 按 zIndex 排序渲染所有可见图层，2 倍分辨率 → 触发 PNG/JPEG Blob 下载
- **`alignment.ts`**：图层拖拽时的对齐吸附辅助线计算

### 组件结构

```
src/components/
├── layout/TopToolbar.tsx       # 顶部工具栏，始终可见，模式切换、保存按钮
├── material/
│   ├── MaterialLibrary.tsx     # 素材库主视图（分组侧栏 + 图片网格）
│   ├── ImageGrid.tsx           # 图片卡片，支持批量选择/标签操作
│   └── UploadModal.tsx         # 上传流程：选文件 → 哈希查重 → 可选去白底
├── canvas/
│   ├── CanvasView.tsx          # Konva Stage + 图层渲染（惰性加载）
│   ├── ContextMenu.tsx         # 图层右键菜单
│   ├── ExportModal.tsx         # 导出格式/范围选项
│   ├── SceneManagerModal.tsx   # 多场景管理（CRUD）
│   └── TemplateManagerModal.tsx # 模板管理
├── panels/
│   ├── LeftPanel.tsx           # 左侧人物库面板，点击缩略图添加到画布（惰性加载）
│   ├── RightPanel.tsx          # 右侧面板，属性 + 图层列表标签页（惰性加载）
│   ├── PropertyPanel.tsx       # 图层属性编辑（位置/尺寸/旋转/透明度）
│   └── LayerList.tsx           # 可排序的图层树，含编组
└── common/                     # 通用组件：ConfirmDialog, Toast, SearchInput, TagFilter, EmptyState, BackupModal
```

画布相关组件在 `App.tsx` 中通过 **`React.lazy` 惰性加载**，因为 Konva 体积较大。应用外层包裹了自定义 `ErrorBoundary` 类组件以防白屏。

### 状态管理模式

- Zustand action 写操作遵循模式：**先调 API → 成功后更新 Store 状态**。对于画布可撤销操作：**先 `pushHistory()` → 再变更图层**。
- `materialStore.loadAll()` 和 `canvasStore.loadScenes()`/`loadTemplates()` 在 `App.tsx` 的 `useEffect` 中挂载时调用一次。
- 剪贴板目前仅支持单个图层（复制选中图层的第一个，以 JSON 深拷贝存储）。

### IndexedDB 表结构（Dexie，仅用于备份导出/导入）

| 表名 | 索引字段 |
|------|---------|
| `groups` | `id, name, createdAt` |
| `characters` | `id, name, createdAt` |
| `characterGroups` | `id, characterId, groupId, [characterId+groupId]` |
| `images` | `id, characterId, hash, createdAt` |
| `tags` | `id, name` |
| `scenes` | `id, name, createdAt, updatedAt` |
| `sceneTemplates` | `id, name, createdAt` |

备份格式为 JSON（v2），支持向后兼容 v1 数据（自动迁移 `groupId` → `characterGroups`）。备份文件中的图片以 base64 存储，主应用中的图片以 HTTP URL 提供。

### 设计系统

暗色主题，CSS 自定义属性定义在 `index.css`。可复用类名：`.btn`（变体：`-primary`、`-secondary`、`-danger`、`-ghost`、`-sm`、`-icon`）、`.input`、`.card`、`.tag`、`.modal-overlay`/`.modal-content`、`.toast`、`.context-menu`。动画：`fadeIn`、`slideUp`、`modalIn`。Tailwind 颜色工具类已被覆盖以适配暗色主题。

### 快捷键（全局，输入框聚焦时跳过）

定义在 `src/hooks/useKeyboard.ts`：Ctrl+Z（撤销）、Ctrl+Y / Ctrl+Shift+Z（重做）、Ctrl+C/V（复制/粘贴图层）、Delete/Backspace（删除选中图层，跳过锁定图层）、方向键（微调 1px，Shift+方向键 = 10px）。
