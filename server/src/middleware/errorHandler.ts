import type { Request, Response, NextFunction } from 'express'

export class AppError extends Error {
  statusCode: number
  details: unknown

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
    this.details = details
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  console.error(`[Error] ${err.message}`, err instanceof AppError ? err.details : '')

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      details: err.details,
    })
    return
  }

  // MySQL duplicate entry
  if ((err as any).code === 'ER_DUP_ENTRY') {
    res.status(409).json({ error: '数据重复，已存在相同记录' })
    return
  }

  // Multer file size error
  if ((err as any).code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ error: '文件大小超出限制（最大 50MB）' })
    return
  }

  res.status(500).json({ error: '服务器内部错误' })
}
