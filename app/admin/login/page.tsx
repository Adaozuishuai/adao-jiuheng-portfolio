import { redirect } from 'next/navigation';
import { isAdmin, hasAdministrator } from '@/lib/server/auth';
import { LoginForm } from '@/components/admin/login-form';
export default async function LoginPage() {
  if (await isAdmin()) redirect('/admin');
  return (
    <main className="admin-login">
      <p className="blog-eyebrow">YOUR WRITING SPACE</p>
      <h1>把想法，写下来。</h1>
      <p>登录后，继续你的记录。</p>
      {(await hasAdministrator()) ? (
        <LoginForm />
      ) : (
        <p role="alert">管理员尚未配置，请联系站点所有者。</p>
      )}
    </main>
  );
}
