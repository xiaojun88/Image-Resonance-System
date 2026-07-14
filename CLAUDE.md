# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workspace layout

- `image-resonance/` — Frontend: React 19 + TypeScript + Vite 8, browser image library + infinite canvas editor
- `server/` — Backend: Express 5 + TypeScript + Drizzle ORM, REST API for MySQL data access
- `browser-harness/` — Referenced browser automation skill (CDP-based). See its `SKILL.md` for usage.

## Architecture: Client-Server

```
React SPA (Vite) ←→ REST API (Express) ←→ MySQL + Filesystem
        ↓                    ↓                    ↓
 Zustand stores       Drizzle ORM          uploads/images/
 src/api/* (axios)    server/src/routes/   MySQL @ 192.168.43.45
```

### Data flow
1. **Frontend**: Zustand stores → `src/api/*` modules (axios) → HTTP to Express backend
2. **Backend**: Express routes → Drizzle ORM → MySQL queries
3. **Images**: Stored as files in `server/uploads/`, MySQL holds file paths. Served via `/api/files/...` endpoints

## Common commands

### Frontend (image-resonance/)
```bash
cd image-resonance
npm run dev       # Dev server on http://localhost:5173 (proxies /api to :3001)
npm run build     # Typecheck + build to dist/
npm run lint      # ESLint
npx tsc --noEmit  # Typecheck only
```

### Backend (server/)
```bash
cd server
npm run dev       # Dev server on http://localhost:3001 (tsx watch)
npm run build     # TypeScript compile to dist/
npm run migrate   # Create/update MySQL tables
npm run migrate:backup <path>  # Import backup JSON into MySQL
npx tsc --noEmit  # Typecheck only
```

MySQL connection: `mysql -h 192.168.43.45 -u root -p<password>`

## Frontend architecture (image-resonance/)

### Stack
- **React 19** + **TypeScript** (strict: `erasableSyntaxOnly`, `verbatimModuleSyntax`)
- **Vite 8** with `@vitejs/plugin-react` and `@tailwindcss/vite`
- **Tailwind CSS v4** — dark theme via `@theme` block in `src/index.css`
- **Zustand** — 3 stores (`materialStore`, `canvasStore`, `uiStore`)
- **Axios** — HTTP client (`src/api/client.ts`) with `/api` proxy in vite.config.ts
- **Konva.js** (`react-konva`) — Canvas rendering, lazy-loaded

### View modes
`uiStore.viewMode`: `material` (素材库) | `canvas` (画布编辑器) | `showcase` (展示模式)

### Local backup layer (`src/db/`)
- `db/index.ts` — Dexie.js IndexedDB wrapper (7 tables), used for JSON backup export/import only
- `db/streamingImport.ts` — Streaming backup importer for large files
- Main data flow goes through API → MySQL, NOT through IndexedDB

### API client layer (`src/api/`)
- `client.ts` — Axios instance (baseURL=/api, timeout=30s)
- `groups.ts`, `characters.ts`, `characterGroups.ts`, `images.ts`, `tags.ts`, `scenes.ts`, `templates.ts`
- `index.ts` — Barrel exports
- Each module maps `snake_case` API responses to `camelCase` frontend types
- Images now served as HTTP URLs (`/api/files/images/{id}/thumbnail`) instead of base64 data URLs

### Zustand stores
- `materialStore.ts` — Uses `import * as api from '../api'`; all writes go through API
- `canvasStore.ts` — Same API pattern; canvas layer ops are in-memory, `saveScene()` pushes to API
- `uiStore.ts` — View mode, modals, toast, `isLoading` state

### Key algorithms (`src/utils/`)
- `imageProcessing.ts` — Perceptual hashing, white bg removal (client-side), thumbnails
- `exportUtils.ts` — Offscreen canvas render → PNG/JPG download
- `alignment.ts` — Snap-to-guide alignment

### Component structure
See `image-resonance/CLAUDE.md` for the full component tree and design system details.

## Backend architecture (server/)

### Stack
- **Express 5** + **TypeScript**
- **Drizzle ORM** + **mysql2** — MySQL data access
- **Multer** — File upload middleware (50MB limit)
- **Sharp** — Server-side thumbnail generation

### MySQL schema (7 tables)
| Table | Key columns |
|---|---|
| `groups` | id, name, description, resonance_image_paths(JSON), sort_order, created_at |
| `characters` | id, name, ..., custom_fields(JSON), avatar_path, sort_order, created_at |
| `character_groups` | id, character_id(FK), group_id(FK), unique(character_id, group_id) |
| `images` | id, character_id(FK), original_path, processed_path, thumbnail_path, hash, ..., tags(JSON) |
| `tags` | id, name, color |
| `scenes` | id, name, background_color, background_image_path, layers(JSON), groups_json(JSON), ... |
| `scene_templates` | id, name, scene_data(JSON), thumbnail_path, created_at |

### API endpoints (~32)
| Prefix | Routes |
|--------|--------|
| `/api/health` | GET — health check |
| `/api/groups` | GET, POST, PATCH/DELETE `/:id`, PATCH `/:id/pin`, POST `/swap-order`, GET `/:id/characters` |
| `/api/characters` | GET, POST, PATCH/DELETE `/:id` (PATCH `/:id` with `avatarPath:null` deletes avatar), PATCH `/:id/pin`, POST `/swap-order`, GET `/:id/groups`, POST `/:id/avatar` |
| `/api/character-groups` | POST, DELETE `/:characterId/:groupId` |
| `/api/images` | GET, POST `/upload` (multipart), DELETE `/:id`, PATCH `/:id/tags`, POST `/swap-order`, POST `/:id/remove-white-bg` |
| `/api/files` | GET `/images/:id/:variant`, GET `/avatars/:charId`, GET `/backgrounds/:sceneId` |
| `/api/tags` | GET, POST, DELETE `/:id` |
| `/api/scenes` | GET, GET `/:id`, POST, PATCH/DELETE `/:id`, POST `/:id/duplicate`, POST `/:id/background` |
| `/api/templates` | GET, POST, DELETE `/:id`, POST `/:id/apply` |
| `/api/backup` | GET `/export` (ZIP download), POST `/import` (multipart ZIP upload) |

### Server structure
```
server/src/
├── index.ts              # Express app entry, route mounting
├── config.ts             # DB creds, port, upload dir (from .env)
├── db/
│   ├── index.ts          # Drizzle client + checkConnection/ensureDatabase
│   ├── schema.ts         # Drizzle ORM table definitions
│   └── migrate.ts        # Run SQL migration to create tables
├── routes/
│   ├── groups.ts, characters.ts, characterGroups.ts
│   ├── images.ts (includes filesRouter), tags.ts
│   ├── scenes.ts, sceneTemplates.ts
│   └── backup.ts           # ZIP export/import
├── services/
│   └── imageStorage.ts   # File save/delete/serve helpers using sharp
├── middleware/
│   └── errorHandler.ts   # AppError class + global error handler
scripts/
└── migrate-backup.ts     # Streaming JSON → MySQL + filesystem migration
```

### Zustand write pattern (unchanged)
Always: **write API first → then update Store state**. For canvas: **`pushHistory()` → then mutate layers**.

### Keyboard shortcuts (unchanged)
Ctrl+Z (undo), Ctrl+Y (redo), Ctrl+C/V (copy/paste), Delete, Arrow keys.

## Data migration

To import the backup JSON:
```bash
cd server
npm run migrate:backup "D:\资源\海贼王图片\图片共鸣系统_备份_2026-06-19.json"
```

This streams the 623MB JSON, decodes base64 images to `uploads/`, and inserts all records into MySQL.
