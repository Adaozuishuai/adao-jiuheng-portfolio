'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUpRight, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

const projects = [
  {
    id: '01',
    type: '桌面端 · AI 学习产品',
    title: '简单物理',
    description: '面向力学学习的专业工作台，同时检查公式、单位与推理过程，而不只给出最终答案。',
    accent: 'coral',
    mark: 'F=ma',
    image: '/og.png',
  },
  {
    id: '02',
    type: '桌面端 · 智能体平台',
    title: '深度桌面',
    description: '本地优先的智能体桌面，让工具调用、模型执行与人工决策始终处于可见、可控的工作流中。',
    accent: 'acid',
    mark: '↳AI',
    image: null,
  },
  {
    id: '03',
    type: '研究 · 产品战略',
    title: '智能体评测体系',
    description: '把基准测试与真实业务完成率、合规性、延迟和成本连接起来的实用评测框架。',
    accent: 'ink',
    mark: '94%',
    image: null,
  },
  {
    id: '04',
    type: '数据 · 管理决策看板',
    title: '企业智能体信号台',
    description: '将产品采用率、市场信号和公司披露转化为可追溯决策依据的管理看板。',
    accent: 'blue',
    mark: '16.3',
    image: null,
  },
];

const playground = ['产品逆向拆解', '界面系统设计', '智能体记忆机制', '市场竞争地图'];

const navItems = [
  { href: 'work', label: '作品' },
  { href: 'about', label: '关于' },
  { href: 'playground', label: '实验场' },
  { href: 'contact', label: '联系' },
];

export default function Home() {
  const [motion, setMotion] = useState(true);

  return (
    <main className="portfolio-shell" data-motion={motion ? 'on' : 'off'}>
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="Adao Jiuheng，返回首页">
          A/J<sup>®</sup>
        </a>
        <div className="header-status" aria-label="当前状态">
          <span className="status-dot" />
          独立 AI 产品构建者
        </div>
        <Sheet>
          <SheetTrigger
            render={
              <Button variant="ghost" className="menu-button" aria-label="打开菜单" />
            }
          >
            菜单 <Plus aria-hidden="true" />
          </SheetTrigger>
          <SheetContent side="top" showCloseButton={false} className="menu-sheet">
            <SheetTitle className="sr-only">网站导航</SheetTitle>
            <SheetDescription className="sr-only">
              浏览作品、关于、实验场与联系信息。
            </SheetDescription>
            <div className="menu-topline">
              <span>Adao Jiuheng</span>
              <SheetClose
                render={
                  <Button variant="ghost" className="menu-button menu-close" aria-label="关闭菜单" />
                }
              >
                关闭 <Minus aria-hidden="true" />
              </SheetClose>
            </div>
            <nav className="menu-nav" aria-label="主导航">
              {navItems.map((item, index) => (
                <SheetClose key={item.href} render={<a href={`#${item.href}`} className="menu-item" />}>
                  <span>0{index + 1}</span>
                  {item.label}
                  <ArrowUpRight aria-hidden="true" />
                </SheetClose>
              ))}
            </nav>
            <div className="menu-footer">
              <span>上海 · 面向全球协作</span>
              <a href="mailto:hello@example.com">发送邮件</a>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      <section className="hero" id="top" aria-labelledby="hero-title">
        <p className="hero-role hero-role-left">AI 产品</p>
        <h1 id="hero-title" className="hero-title" aria-label="Adao Jiuheng">
          <span>ADAO</span>
          <span>JIUHENG</span>
        </h1>

        <div className="hero-emblem" aria-hidden="true">
          <span className="orbit orbit-one" />
          <span className="orbit orbit-two" />
          <span className="orbit orbit-three" />
          <span className="emblem-core">A</span>
          <span className="emblem-chip chip-one">01</span>
          <span className="emblem-chip chip-two">AI</span>
          <span className="emblem-chip chip-three">↗</span>
        </div>

        <p className="hero-role hero-role-right">技术战略</p>

        <div className="hero-meta">
          <div>
            <span className="meta-label">上线时间</span>
            <strong>2026</strong>
          </div>
          <div>
            <span className="meta-label">关注领域</span>
            <strong>产品 · AI · 系统</strong>
          </div>
        </div>

        <a className="scroll-cue" href="#work">
          <span>向下探索</span>
          <ArrowDown size={16} strokeWidth={1.5} />
        </a>
      </section>

      <section className="work-section" id="work" aria-labelledby="work-heading">
        <div className="section-heading">
          <p className="eyebrow">代表作品 · 2024—26</p>
          <h2 id="work-heading">让有用的系统，<br />也令人难忘。</h2>
          <p className="section-note">拖动或滚动浏览</p>
        </div>
        <div className="project-track" aria-label="代表项目">
          {projects.map((project) => (
            <article className="project-card" key={project.id}>
              <div className={`project-visual visual-${project.accent}`}>
                {project.image ? (
                  <img
                    className="project-image"
                    src={project.image}
                    alt="Adao Jiuheng AI 产品构建者视觉形象"
                  />
                ) : (
                  <>
                    <span className="visual-grid" aria-hidden="true" />
                    <span className="visual-mark">{project.mark}</span>
                  </>
                )}
                <span className="visual-index">{project.id}</span>
              </div>
              <div className="project-copy">
                <p>{project.type}</p>
                <h3>{project.title}</h3>
                <span>{project.description}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="about-section" id="about" aria-labelledby="about-heading">
        <p className="eyebrow">关于我 · 产品 × 技术</p>
        <div className="about-grid">
          <h2 id="about-heading">
            我把模糊的 AI 想法，变成用户能理解、信任并真正使用的产品。
          </h2>
          <div className="about-copy">
            <p>
              我的工作横跨产品战略、交互设计与工程实现。我关注完整链路：商业问题是否成立、系统边界是否清晰、界面是否好用，以及结果是否有证据支撑。
            </p>
            <dl>
              <div><dt>01</dt><dd>产品方向与战略</dd></div>
              <div><dt>02</dt><dd>智能体架构设计</dd></div>
              <div><dt>03</dt><dd>原型开发与交付</dd></div>
              <div><dt>04</dt><dd>评测与验证体系</dd></div>
            </dl>
          </div>
        </div>
      </section>

      <section className="playground-section" id="playground" aria-labelledby="playground-heading">
        <div className="section-heading compact-heading">
          <p className="eyebrow">实验场 · 持续更新</p>
          <h2 id="playground-heading">那些我反复拆解的问题。</h2>
        </div>
        <div className="play-list">
          {playground.map((item, index) => (
            <a href="#contact" key={item} className="play-row">
              <span>0{index + 1}</span>
              <strong>{item}</strong>
              <ArrowUpRight aria-hidden="true" />
            </a>
          ))}
        </div>
      </section>

      <footer className="contact-section" id="contact">
        <div className="contact-kicker">
          <span className="status-dot" /> 接受有价值的合作
        </div>
        <p>有一个难解的产品问题？</p>
        <a className="contact-link" href="mailto:hello@example.com">
          来聊聊<span>↗</span>
        </a>
        <div className="contact-meta">
          <span>© 2026 Adao Jiuheng</span>
          <Button
            type="button"
            variant="ghost"
            className="motion-toggle"
            onClick={() => setMotion((value) => !value)}
            aria-pressed={!motion}
          >
            动效{motion ? '开启' : '关闭'}
          </Button>
          <a href="#top">返回顶部 ↑</a>
        </div>
      </footer>
    </main>
  );
}
