import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { setAdministrator } from './account.mjs';
import nextEnv from '@next/env';
const { loadEnvConfig } = nextEnv;
import postgres from 'postgres';

loadEnvConfig(process.cwd());
if (!process.stdin.isTTY) throw new Error('请在交互式终端运行管理员设置。');
let hidden = false;
const output = new Writable({
  write(chunk, encoding, callback) {
    if (!hidden) process.stdout.write(chunk, encoding);
    callback();
  },
});
const rl = createInterface({ input: process.stdin, output, terminal: true });
const username = (await rl.question('管理员账号：')).trim();
process.stdout.write('设置密码（不能为空，不回显）：');
hidden = true;
const password = await rl.question('');
hidden = false;
process.stdout.write('\n再次输入密码：');
hidden = true;
const confirm = await rl.question('');
hidden = false;
process.stdout.write('\n');
rl.close();
if (
  !username ||
  username.length > 80 ||
  password.length === 0 ||
  password !== confirm
)
  throw new Error('账号无效、密码为空，或两次密码不一致。');
const sql = postgres(process.env.DATABASE_URL);
try {
  await setAdministrator(sql, username, password);
  console.log('管理员已设置，旧登录会话已退出。');
  if (process.argv.includes('--verify-local-login')) {
    const origin = new URL(process.env.SITE_URL).origin;
    if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) throw new Error('验证仅允许本地地址。');
    const response = await fetch(`${origin}/api/admin/login`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
    if (response.status !== 200) throw new Error('本地登录验证失败。');
    const cookie = response.headers.get('set-cookie')?.split(';')[0];
    if (!cookie) throw new Error('未收到登录会话。');
    const authenticated = await fetch(`${origin}/admin/security`, { headers: { Cookie: cookie }, redirect: 'manual' });
    if (authenticated.status !== 200) throw new Error('后台访问验证失败。');
    const loggedOut = await fetch(`${origin}/api/admin/logout`, { method: 'POST', headers: { Origin: origin, Cookie: cookie } });
    if (loggedOut.status !== 200) throw new Error('测试会话退出失败。');
    console.log('本地登录与后台访问验证通过，测试会话已退出。');
  }
} finally { await sql.end(); }
