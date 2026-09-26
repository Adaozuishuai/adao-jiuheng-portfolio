'use client';
export default function BlogError({ reset }: { reset: () => void }) {
  return (
    <main className="blog-index container">
      <h1>文章暂时无法加载</h1>
      <p>服务暂时不可用，请稍后重试。</p>
      <button className="admin-button" onClick={reset}>
        重试
      </button>
    </main>
  );
}
