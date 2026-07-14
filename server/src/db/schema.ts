import { mysqlTable, varchar, text, bigint, json, tinyint, index, uniqueIndex } from 'drizzle-orm/mysql-core'

// NOTE: TEXT and JSON columns have NO default in MySQL strict mode.
// Application code must provide values for these columns on insert.

// ==================== GROUPS ====================
export const groups = mysqlTable('groups', {
  id: varchar('id', { length: 36 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  resonanceImagePaths: json('resonance_image_paths').$type<string[]>(),
  sortOrder: bigint('sort_order', { mode: 'number' }).notNull().default(0),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
}, (table) => [
  index('idx_groups_name').on(table.name),
  index('idx_groups_sort_order').on(table.sortOrder),
])

// ==================== CHARACTERS ====================
export const characters = mysqlTable('characters', {
  id: varchar('id', { length: 36 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  position: varchar('position', { length: 255 }).default('').notNull(),
  race: varchar('race', { length: 255 }).default('').notNull(),
  devilFruit: varchar('devil_fruit', { length: 255 }).default('').notNull(),
  haki: varchar('haki', { length: 255 }).default('').notNull(),
  height: varchar('height', { length: 50 }).default('').notNull(),
  birthday: varchar('birthday', { length: 50 }).default('').notNull(),
  customFields: json('custom_fields').$type<{ key: string; value: string }[]>(),
  avatarPath: varchar('avatar_path', { length: 500 }),
  sortOrder: bigint('sort_order', { mode: 'number' }).notNull().default(0),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
}, (table) => [
  uniqueIndex('uk_characters_name').on(table.name),
  index('idx_characters_sort_order').on(table.sortOrder),
])

// ==================== CHARACTER-GROUP JUNCTION ====================
export const characterGroups = mysqlTable('character_groups', {
  id: varchar('id', { length: 36 }).primaryKey(),
  characterId: varchar('character_id', { length: 36 }).notNull(),
  groupId: varchar('group_id', { length: 36 }).notNull(),
}, (table) => [
  uniqueIndex('uk_character_group').on(table.characterId, table.groupId),
  index('idx_cg_character').on(table.characterId),
  index('idx_cg_group').on(table.groupId),
])

// ==================== IMAGES ====================
export const images = mysqlTable('images', {
  id: varchar('id', { length: 36 }).primaryKey(),
  characterId: varchar('character_id', { length: 36 }).notNull(),
  originalPath: varchar('original_path', { length: 500 }).notNull(),
  processedPath: varchar('processed_path', { length: 500 }),
  thumbnailPath: varchar('thumbnail_path', { length: 500 }),
  hash: varchar('hash', { length: 64 }).notNull(),
  fileName: varchar('file_name', { length: 255 }).default('').notNull(),
  width: bigint('width', { mode: 'number' }).notNull().default(0),
  height: bigint('height', { mode: 'number' }).notNull().default(0),
  tags: json('tags').$type<string[]>(),
  whiteBgRemoved: tinyint('white_bg_removed').notNull().default(0),
  sortOrder: bigint('sort_order', { mode: 'number' }).notNull().default(0),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
}, (table) => [
  index('idx_images_character').on(table.characterId),
  index('idx_images_hash').on(table.hash),
  index('idx_images_sort_order').on(table.sortOrder),
])

// ==================== TAGS ====================
export const tags = mysqlTable('tags', {
  id: varchar('id', { length: 36 }).primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  color: varchar('color', { length: 7 }).default('#6366F1').notNull(),
}, (table) => [
  uniqueIndex('uk_tags_name').on(table.name),
])

// ==================== SCENES ====================
export const scenes = mysqlTable('scenes', {
  id: varchar('id', { length: 36 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  backgroundColor: varchar('background_color', { length: 7 }).notNull().default('#FFFFFF'),
  backgroundImagePath: varchar('background_image_path', { length: 500 }),
  layers: json('layers').notNull(),
  groupsJson: json('groups_json').notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
}, (table) => [
  index('idx_scenes_name').on(table.name),
  index('idx_scenes_updated').on(table.updatedAt),
])

// ==================== SCENE TEMPLATES ====================
export const sceneTemplates = mysqlTable('scene_templates', {
  id: varchar('id', { length: 36 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  sceneData: json('scene_data').notNull(),
  thumbnailPath: varchar('thumbnail_path', { length: 500 }),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
}, (table) => [
  index('idx_templates_name').on(table.name),
])
