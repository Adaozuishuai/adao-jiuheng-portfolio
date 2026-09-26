import { isAbsolute, resolve } from 'node:path';

export class ConfigurationError extends Error {}

export function getDatabaseUrl() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new ConfigurationError('DATABASE_URL 尚未配置');
  return url;
}

export function getUploadDir() {
  const configured = process.env.UPLOAD_DIR?.trim();
  if (!configured) {
    if (process.env.NODE_ENV === 'production') throw new ConfigurationError('UPLOAD_DIR 尚未配置');
    return resolve(process.cwd(), 'data/uploads');
  }
  if (process.env.NODE_ENV === 'production' && !isAbsolute(configured)) throw new ConfigurationError('生产环境的 UPLOAD_DIR 必须是绝对路径');
  return resolve(configured);
}
