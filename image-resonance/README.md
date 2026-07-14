# 宝藏共鸣台 (Image Resonance)

图片素材管理 + 无限画布场景拼贴编辑器。专为动漫/游戏角色图片整理与场景创作设计。

## 功能

- **素材库** — 分组 → 人物 → 图片三级管理，支持标签、全文搜索、感知哈希去重、一键去白底
- **共鸣画布** — 无限画布，图层自由拖拽/缩放/旋转，编组、对齐吸附、撤销重做
- **场景管理** — 多场景保存与切换，模板复用
- **数据备份** — ZIP 格式导出/导入，支持流式处理大文件

## 技术栈

| 层 | 技术 |
|---|------|
| 前端框架 | React 19 + TypeScript |
| 构建工具 | Vite 8 |
| 样式 | Tailwind CSS v4（暗色主题） |
| 状态管理 | Zustand |
| 画布引擎 | Konva.js (react-konva) |
| HTTP 客户端 | Axios |
| 本地备份 | Dexie.js (IndexedDB) |

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器（需要后端运行在 localhost:3001）
npm run dev

# 构建生产版本
npm run build
```

开发服务器运行在 `http://localhost:5173`，`/api` 请求自动代理到后端 `http://localhost:3001`。

## 项目结构

```
src/
├── api/              # REST API 封装（axios）
├── stores/           # Zustand 状态管理
│   ├── materialStore.ts   # 素材数据
│   ├── canvasStore.ts     # 画布/场景
│   └── uiStore.ts         # UI 状态
├── db/               # IndexedDB 备份导出/导入
├── components/
│   ├── layout/       # 顶部工具栏
│   ├── material/     # 素材库视图
│   ├── canvas/       # 画布编辑器（惰性加载）
│   ├── panels/       # 侧边面板（惰性加载）
│   └── common/       # 通用组件
├── hooks/            # 自定义 Hook（键盘快捷键等）
├── utils/            # 工具函数（图像处理、导出等）
└── types/            # TypeScript 类型定义
```

## 后端

后端为 Express 5 + Drizzle ORM + MySQL，代码在 `../server/`。详见根目录 `CLAUDE.md`。
