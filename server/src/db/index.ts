import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import { config } from '../config'
import * as schema from './schema'

const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  enableKeepAlive: true,
})

export const db = drizzle(pool, { schema, mode: 'default' })

export async function checkConnection(): Promise<boolean> {
  try {
    const conn = await mysql.createConnection({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      connectTimeout: 5000,
    })
    await conn.ping()
    await conn.end()
    return true
  } catch {
    return false
  }
}

export async function ensureDatabase(): Promise<void> {
  const conn = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
  })
  await conn.query(
    `CREATE DATABASE IF NOT EXISTS \`${config.db.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  )
  await conn.end()
}
