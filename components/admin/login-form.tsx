'use client';
import { useState } from 'react';
export function LoginForm() {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="admin-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError('');
        const data = new FormData(event.currentTarget);
        try {
          const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(Object.fromEntries(data)),
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error);
          window.location.assign('/admin');
        } catch (e) {
          setError((e as Error).message || '连接失败，请重试');
          setBusy(false);
        }
      }}
    >
      <label>
        账号
        <input
          name="username"
          autoComplete="username"
          required
          maxLength={80}
        />
      </label>
      <label>
        密码
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>
      <button disabled={busy} className="admin-button primary">
        {busy ? '请稍候…' : '登录写作台'}
      </button>
      <p className="form-message error" role="alert">
        {error}
      </p>
    </form>
  );
}
