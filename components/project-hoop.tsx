'use client';
import { useEffect, useState } from 'react';

export function ProjectHoop({ id, title }: { id: string; title: string }) {
  const [hearts, setHearts] = useState<number[]>([]);
  useEffect(() => {
    let sequence = 0;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const score = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== id) return;
      const heart = ++sequence;
      setHearts(current => [...current, heart]);
      const timer = setTimeout(() => { setHearts(current => current.filter(item => item !== heart)); timers.delete(timer); }, 1500);
      timers.add(timer);
    };
    window.addEventListener('jiuheng:score', score);
    return () => { window.removeEventListener('jiuheng:score', score); timers.forEach(clearTimeout); };
  }, [id]);
  return <div className="project-hoop" data-basketball-ignore>
    <svg className="physical-hoop" data-project-hoop={id} viewBox="0 0 120 88" aria-hidden="true">
      <ellipse cx="60" cy="28" rx="48" ry="10" fill="#342a23" opacity=".09" />
      <rect x="49" y="0" width="22" height="10" rx="2" fill="#625b52" />
      <path d="M53 3H67" stroke="#a39a8d" strokeWidth="1.5" />
      <circle cx="53" cy="6" r="1.2" fill="#d7cfc1" />
      <circle cx="67" cy="6" r="1.2" fill="#d7cfc1" />
      <path d="M56 9L53 17M64 9L67 17" stroke="#716356" strokeWidth="3" />
      <ellipse cx="60" cy="21" rx="50" ry="9" fill="none" stroke="#713a2c" strokeWidth="5" />
      <ellipse cx="60" cy="19.5" rx="50" ry="9" fill="none" stroke="#bd674a" strokeWidth="3" />
      <path d="M15 16C28 7 89 7 105 16" fill="none" stroke="#e3a47d" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
    {hearts.map(heart => <div className="hoop-heart" key={heart} role="status" aria-label={`投中了，喜欢作品${title}`}><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 27S3 19 3 10a7 7 0 0 1 13-3 7 7 0 0 1 13 3c0 9-13 17-13 17Z" fill="currentColor" /></svg></div>)}
  </div>;
}
