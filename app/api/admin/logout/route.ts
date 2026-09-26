import { checkOrigin, logout } from '@/lib/server/auth';
import { apiError } from '@/lib/server/http';
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    await logout();
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
