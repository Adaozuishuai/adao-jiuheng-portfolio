'use client';
import { useState } from 'react';
import Link from 'next/link';
export function DashboardActions() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function act(action: 'new' | 'logout') {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(
        action === 'new' ? '/api/admin/posts' : '/api/admin/logout',
        { method: 'POST' },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      window.location.assign(
        action === 'new' ? `/admin/posts/${data.id}` : '/admin/login',
      );
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <div>
      <div className="admin-actions">
        <Link className="admin-button" href="/admin/security">
          账号安全
        </Link>
        <button
          className="admin-button"
          disabled={busy}
          onClick={() => act('logout')}
        >
          退出
        </button>
        <button
          className="admin-button primary"
          disabled={busy}
          onClick={() => act('new')}
        >
          ＋ 新建文章
        </button>
      </div>
      <p role="alert" className="form-message error">
        {error}
      </p>
    </div>
  );
}
