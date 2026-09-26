import {
  requireAdmin,
  readJson,
  nonemptyPassword,
  secureAccount,
} from '@/lib/server/auth';
import { apiError } from '@/lib/server/http';
export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const input = await readJson(request);
    if (
      !nonemptyPassword(input?.currentPassword) ||
      !nonemptyPassword(input?.newPassword)
    )
      throw new Response('密码不能为空', { status: 400 });
    if (input.newPassword !== input.confirmPassword)
      throw new Response('两次新密码不一致', { status: 400 });
    await secureAccount('password', input.currentPassword, input.newPassword);
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
