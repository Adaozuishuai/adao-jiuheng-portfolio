import { checkOrigin, login, readJson } from '@/lib/server/auth';
import { apiError } from '@/lib/server/http';
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const input = await readJson(request);
    if (
      typeof input?.username !== 'string' ||
      typeof input?.password !== 'string' ||
      input.username.length > 80
    )
      throw new Response('账号或密码格式无效', { status: 400 });
    await login(input.username.trim(), input.password);
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
