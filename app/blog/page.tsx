import { ArrowUpRight } from 'lucide-react';
import { SiteHeader } from '@/components/site-header';

const posts = [
  { no:'01', date:'2026.08.21', category:'设计笔记', title:'一个作品什么时候才算真正完成？', excerpt:'完成不只是交付文件，也意味着知道哪些问题已经解决，哪些问题被有意识地留到下一次。', featured:true },
  { no:'02', date:'2026.07.09', category:'过程记录', title:'从模糊想法到可以使用的产品', excerpt:'记录一次个人项目从草图、取舍到原型的完整过程。' },
  { no:'03', date:'2026.05.16', category:'随笔', title:'我如何整理视觉参考', excerpt:'收藏不是终点。只有建立分类、写下判断，参考才会真正进入自己的工作方法。' },
  { no:'04', date:'2026.03.02', category:'复盘', title:'重新设计自己的作品集', excerpt:'关于选择、删减和如何让作品自己说话。' },
  { no:'05', date:'2025.12.18', category:'工具', title:'我的轻量创作工作流', excerpt:'用尽可能少的工具保持稳定输出。' },
];

export default function BlogPage(){return <main><SiteHeader label="02 / BLOG" />
  <section className="page-intro blog-intro"><p>02 / NOTES & ESSAYS</p><h1>博客</h1><span>项目过程、设计判断和阶段性的个人思考。</span></section>
  <section className="blog-index">
    {posts.map((post)=><article className={`post-row ${post.featured?'featured-post':''}`} key={post.no}>
      <span className="post-no">{post.no}</span>
      <div className="post-body"><p>{post.category} · <time>{post.date}</time></p><h2>{post.title}</h2><span>{post.excerpt}</span></div>
      <ArrowUpRight aria-hidden="true" />
    </article>)}
  </section>
  <footer className="blog-footer"><strong>JIUHENG</strong><p>持续记录，持续更新。<br/>© 2026</p></footer>
  </main>}
