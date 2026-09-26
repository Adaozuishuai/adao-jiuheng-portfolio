import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCallback);
export async function setAdministrator(sql, username, password) {
  if (typeof username !== 'string' || !username.trim() || username.trim().length > 80 || typeof password !== 'string' || password.length === 0) throw new Error('账号无效或密码为空。');
  const salt = randomBytes(16).toString('hex');
  const hash = `${salt}:${(await scrypt(password, salt, 64)).toString('hex')}`;
  await sql.begin(async tx => {
    await tx`SELECT pg_advisory_xact_lock(714002)`;
    const unexpected = await tx`SELECT id FROM administrators WHERE id <> 1`;
    if (unexpected.length) throw new Error('发现额外管理员账号，已停止；未删除任何记录。');
    await tx`INSERT INTO administrators (id, username, password_hash) VALUES (1, ${username.trim()}, ${hash}) ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, password_hash = EXCLUDED.password_hash`;
    await tx`DELETE FROM admin_sessions`;
    await tx`DELETE FROM login_limits`;
  });
}
