import Link from 'next/link';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { administrators } from '@/db/schema';
import { getDb } from '@/lib/server/db';
import { isAdmin } from '@/lib/server/auth';
import { SecurityForm } from '@/components/admin/security-form';
export default async function SecurityPage() {
  if (!(await isAdmin())) redirect('/admin/login');
  const [admin] = await getDb()
    .select({ username: administrators.username })
    .from(administrators)
    .where(eq(administrators.id, 1));
  if (!admin) redirect('/admin/login');
  return (
    <main className="admin-main account-security">
      <Link href="/admin">← 我的文章</Link>
      <div className="admin-heading">
        <div>
          <p className="blog-eyebrow">ACCOUNT SECURITY</p>
          <h1>账号安全</h1>
          <p>管理员：{admin.username}</p>
        </div>
      </div>
      <SecurityForm />
    </main>
  );
}
