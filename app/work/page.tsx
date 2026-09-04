import { ArrowUpRight } from 'lucide-react';
import { SiteHeader } from '@/components/site-header';

const projects = [
  { no:'01', title:'人与智能体', kind:'交互实验', year:'2026', tone:'red', mark:'AI', size:'wide' },
  { no:'02', title:'一件数字产品', kind:'产品设计', year:'2025', tone:'ink', mark:'UX', size:'small' },
  { no:'03', title:'信息与秩序', kind:'视觉研究', year:'2025', tone:'blue', mark:'SYS', size:'small' },
  { no:'04', title:'未命名练习', kind:'个人项目', year:'2024', tone:'acid', mark:'LAB', size:'wide' },
];

export default function WorkPage() {
  return <main><SiteHeader label="01 / WORK" />
    <section className="page-intro work-intro"><p>01 / SELECTED WORK</p><h1>作品</h1><span>这是项目索引。下一版可替换为你的真实作品、过程与职责。</span></section>
    <section className="work-index">
      {projects.map((p)=><article className={`index-card ${p.size}`} key={p.no}>
        <div className={`index-art art-${p.tone}`}><span>({p.no})</span><strong>{p.mark}</strong><ArrowUpRight /></div>
        <div className="index-copy"><h2>{p.title}</h2><p>{p.kind}</p><p>{p.year}</p></div>
      </article>)}
    </section>
  </main>;
}
