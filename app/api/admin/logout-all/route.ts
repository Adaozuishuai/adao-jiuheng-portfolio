import { requireAdmin, secureAccount } from '@/lib/server/auth';
import { apiError } from '@/lib/server/http';
export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    await secureAccount('logout-all');
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
