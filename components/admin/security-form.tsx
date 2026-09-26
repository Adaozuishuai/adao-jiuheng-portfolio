'use client';
import { useState } from 'react';
export function SecurityForm() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function submit(
    path: string,
    data?: Record<string, FormDataEntryValue>,
  ) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        ...(data ? { body: JSON.stringify(data) } : {}),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '操作失败，请重试');
      window.location.assign('/admin/login');
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <>
      <section>
        <h2>修改密码</h2>
        <p>修改后，所有设备都需要重新登录。</p>
        <form
          className="admin-form"
          onSubmit={(event) => {
            event.preventDefault();
            const data = Object.fromEntries(new FormData(event.currentTarget));
            if (data.newPassword !== data.confirmPassword) {
              setError('两次新密码不一致');
              return;
            }
            void submit('/api/admin/password', data);
          }}
        >
          <label>
            当前密码
            <input
              name="currentPassword"
              type="password"
              required
              autoComplete="current-password"
              disabled={busy}
            />
          </label>
          <label>
            新密码
            <input
              name="newPassword"
              type="password"
              required
              autoComplete="new-password"
              disabled={busy}
            />
          </label>
          <label>
            确认新密码
            <input
              name="confirmPassword"
              type="password"
              required
              autoComplete="new-password"
              disabled={busy}
            />
          </label>
          <p className="field-hint">密码不能为空，空格会按原样保留。</p>
          <button className="admin-button primary" disabled={busy}>
            {busy ? '处理中…' : '保存新密码并重新登录'}
          </button>
        </form>
      </section>
      <section className="security-sessions">
        <h2>登录设备</h2>
        <p>退出包括当前浏览器在内的全部登录会话。</p>
        <button
          className="admin-button"
          disabled={busy}
          onClick={() => {
            if (window.confirm('确认退出所有设备？当前浏览器也将退出登录。'))
              void submit('/api/admin/logout-all');
          }}
        >
          退出所有设备
        </button>
      </section>
      <p className="form-message error" role="alert">
        {error}
      </p>
    </>
  );
}
