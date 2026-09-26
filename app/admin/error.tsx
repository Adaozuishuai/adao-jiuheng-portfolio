'use client';
export default function AdminError({ reset }: { reset: () => void }) {
  return (
    <main className="admin-main">
      <h1>写作台暂时无法加载</h1>
      <p>请检查数据库连接后重试。</p>
      <button className="admin-button" onClick={reset}>
        重试
      </button>
    </main>
  );
}
