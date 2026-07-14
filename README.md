# 🏴‍☠️ 宝藏共鸣台 (Image Resonance)

图片素材管理 + 无限画布场景拼贴编辑器。专为动漫/游戏角色图片整理与场景创作设计。

<p align="center">
  <img src="image-resonance/src/assets/hero.png" alt="hero" width="600" />
</p>

## ✨ 功能

- **📦 素材库** — 分组 → 人物 → 图片三级管理体系，支持标签分类、全文搜索、感知哈希去重、一键去白底
- **🎨 共鸣画布** — 无限画布，图层自由拖拽/缩放/旋转，编组、对齐吸附、撤销重做（50步）
- **📋 场景管理** — 多场景保存与切换，模板复用，一键导出 PNG/JPG
- **💾 数据安全** — 服务端 MySQL 存储 + 完整备份导出/导入

## 🏗️ 技术架构

```
React 19 SPA (Vite 8)  ←→  REST API (Express 5)  ←→  MySQL + 文件存储
         ↓                           ↓
   Zustand 状态管理             Drizzle ORM
   Konva.js 画布引擎            Sharp 图片处理
   Tailwind CSS v4              Multer 文件上传
```

| 层 | 技术栈 |
|---|--------|
| **前端** | React 19, TypeScript, Vite 8, Tailwind CSS v4, Zustand, Konva.js, Axios |
| **后端** | Express 5, TypeScript, Drizzle ORM, MySQL, Sharp, Multer |
| **存储** | MySQL (元数据) + 文件系统 (图片) + IndexedDB (备份导出) |

## 🚀 快速开始

### 环境要求

- Node.js 20+
- MySQL 8.0+
- npm 10+

### 1. 配置数据库

```bash
# 创建数据库
mysql -h localhost -u root -p -e "CREATE DATABASE IF NOT EXISTS image_resonance CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

### 2. 启动后端

```bash
cd server

# 配置环境变量（复制模板并填入你的数据库密码）
cp .env.example .env

# 安装依赖
npm install

# 创建数据库表
npm run migrate

# 启动开发服务器 (http://localhost:3001)
npm run dev
```

### 3. 启动前端

```bash
cd image-resonance

# 安装依赖
npm install

# 启动开发服务器 (http://localhost:5173)
npm run dev
```

前端开发服务器将 `/api` 请求自动代理到后端 `http://localhost:3001`。

### 4. 数据迁移（可选）

```bash
cd server
npm run migrate:backup "path/to/backup.json"
```

## 📁 项目结构

```
├── image-resonance/          # 前端 React SPA
│   ├── src/
│   │   ├── api/              # REST API 封装 (axios)
│   │   ├── stores/           # Zustand 状态管理 (material/canvas/ui)
│   │   ├── db/               # IndexedDB 备份导入导出
│   │   ├── components/
│   │   │   ├── layout/       # 顶部工具栏
│   │   │   ├── material/     # 素材库视图
│   │   │   ├── canvas/       # 画布编辑器（惰性加载）
│   │   │   ├── panels/       # 侧边面板（惰性加载）
│   │   │   └── common/       # 通用组件
│   │   ├── utils/            # 图像处理、导出、对齐吸附
│   │   ├── hooks/            # 自定义 Hook
│   │   └── types/            # TypeScript 类型定义
│   └── CLAUDE.md             # 前端开发指南
├── server/                   # 后端 Express API
│   ├── src/
│   │   ├── routes/           # REST API 路由 (32 个端点)
│   │   ├── db/               # Drizzle ORM Schema + 迁移
│   │   ├── services/         # 图片存储服务 (Sharp)
│   │   └── middleware/       # 错误处理
│   ├── scripts/              # 数据迁移脚本
│   └── uploads/              # 图片文件存储
└── CLAUDE.md                 # 项目开发总指南
```

## 🎮 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl + Z` | 撤销 |
| `Ctrl + Y` / `Ctrl + Shift + Z` | 重做 |
| `Ctrl + C` / `Ctrl + V` | 复制/粘贴图层 |
| `Delete` / `Backspace` | 删除选中图层 |
| `↑` `↓` `←` `→` | 微调位置 (1px) |
| `Shift + 方向键` | 快速移动 (10px) |
| 鼠标滚轮 | 缩放画布 |
| 右键 | 图层上下文菜单 |

## 🎨 设计系统

暗色主题玻璃态设计。主色 `#7B9BFF`，金色强调 `#C9A050`，背景 `#0B0D13`。

详细设计规范见 [说明文档](image-resonance/说明文档.md#八ui-设计规范)。

## 📡 API 端点

| 前缀 | 说明 |
|------|------|
| `/api/groups` | 分组 CRUD + 排序 + 置顶 |
| `/api/characters` | 人物 CRUD + 排序 + 头像上传 |
| `/api/character-groups` | 人物↔分组 关联管理 |
| `/api/images` | 图片上传 + 去白底 + 标签 + 排序 |
| `/api/files` | 图片/头像/背景文件服务 |
| `/api/tags` | 标签管理 |
| `/api/scenes` | 场景 CRUD + 复制 + 背景上传 |
| `/api/templates` | 模板管理 + 应用模板创建场景 |
| `/api/backup` | ZIP 格式完整备份导出/导入 |

## 📄 详细文档

- [前端开发指南](image-resonance/CLAUDE.md) — 组件结构、状态管理、数据流
- [完整说明文档](image-resonance/说明文档.md) — UI 设计规范、核心算法、使用流程
## 📜 License

MIT
"# Image-Resonance-System" 
