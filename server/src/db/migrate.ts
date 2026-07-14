import mysql from 'mysql2/promise'
import { config } from '../config'

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS \`groups\` (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    resonance_image_paths JSON,
    sort_order BIGINT NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL,
    INDEX idx_groups_name (name),
    INDEX idx_groups_sort_order (sort_order)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS characters (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    \`position\` VARCHAR(255) DEFAULT '',
    race VARCHAR(255) DEFAULT '',
    devil_fruit VARCHAR(255) DEFAULT '',
    haki VARCHAR(255) DEFAULT '',
    height VARCHAR(50) DEFAULT '',
    birthday VARCHAR(50) DEFAULT '',
    custom_fields JSON,
    avatar_path VARCHAR(500) DEFAULT NULL,
    sort_order BIGINT NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL,
    UNIQUE INDEX uk_characters_name (name),
    INDEX idx_characters_sort_order (sort_order)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS character_groups (
    id VARCHAR(36) PRIMARY KEY,
    character_id VARCHAR(36) NOT NULL,
    group_id VARCHAR(36) NOT NULL,
    UNIQUE INDEX uk_character_group (character_id, group_id),
    INDEX idx_cg_character (character_id),
    INDEX idx_cg_group (group_id),
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES \`groups\`(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS images (
    id VARCHAR(36) PRIMARY KEY,
    character_id VARCHAR(36) NOT NULL,
    original_path VARCHAR(500) NOT NULL,
    processed_path VARCHAR(500) DEFAULT NULL,
    thumbnail_path VARCHAR(500) DEFAULT NULL,
    hash VARCHAR(64) NOT NULL,
    file_name VARCHAR(255) DEFAULT '',
    width BIGINT NOT NULL DEFAULT 0,
    height BIGINT NOT NULL DEFAULT 0,
    tags JSON,
    white_bg_removed TINYINT(1) NOT NULL DEFAULT 0,
    sort_order BIGINT NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL,
    INDEX idx_images_character (character_id),
    INDEX idx_images_hash (hash),
    INDEX idx_images_sort_order (sort_order),
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS tags (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) DEFAULT '#6366F1',
    UNIQUE INDEX uk_tags_name (name)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS scenes (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    background_color VARCHAR(7) NOT NULL DEFAULT '#FFFFFF',
    background_image_path VARCHAR(500) DEFAULT NULL,
    layers JSON NOT NULL,
    groups_json JSON NOT NULL,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    INDEX idx_scenes_name (name),
    INDEX idx_scenes_updated (updated_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS scene_templates (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    scene_data JSON NOT NULL,
    thumbnail_path VARCHAR(500) DEFAULT NULL,
    created_at BIGINT NOT NULL,
    INDEX idx_templates_name (name)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
]

async function migrate() {
  console.log('[Migration] Connecting to MySQL...')

  const conn = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    multipleStatements: true,
  })

  console.log(`[Migration] Ensuring database '${config.db.database}' exists...`)
  await conn.query(
    `CREATE DATABASE IF NOT EXISTS \`${config.db.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  )
  await conn.query(`USE \`${config.db.database}\``)

  console.log('[Migration] Creating tables...')
  for (const sql of STATEMENTS) {
    try {
      await conn.query(sql)
      const match = sql.match(/CREATE TABLE IF NOT EXISTS \`?(\w+)\`?/)
      const tableName = match?.[1] || 'unknown'
      console.log(`  OK ${tableName}`)
    } catch (err: any) {
      if (err.code === 'ER_TABLE_EXISTS_ERROR') {
        console.log(`  -- ${sql.match(/CREATE TABLE IF NOT EXISTS \`?(\w+)\`?/)?.[1] || 'unknown'} (exists)`)
      } else {
        console.error(`  FAIL ${err.message}`)
        throw err
      }
    }
  }

  console.log('[Migration] All tables created successfully!')
  await conn.end()
}

migrate().catch(err => {
  console.error('[Migration] Failed:', err)
  process.exit(1)
})
