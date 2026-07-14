import 'dotenv/config'

export const config = {
  db: {
    host: process.env.DB_HOST || '192.168.43.45',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'xiaojun00',
    database: process.env.DB_NAME || 'image_resonance',
  },
  port: parseInt(process.env.PORT || '3001', 10),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  uploadDir: process.env.UPLOAD_DIR || './uploads',
}
