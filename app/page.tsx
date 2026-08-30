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
    type: 'Desktop · AI learning',
    title: 'Simple Physics',
    description: 'A mechanics learning workspace that checks formulas, units and reasoning — not just final answers.',
    accent: 'coral',
    mark: 'F=ma',
    image: '/og.png',
  },
  {
    id: '02',
    type: 'Desktop · Agent platform',
    title: 'DeepDesk',
    description: 'A local-first agent desktop where tools, model runs and human decisions stay in one visible flow.',
    accent: 'acid',
    mark: '↳AI',
    image: null,
  },
  {
    id: '03',
    type: 'Research · Product strategy',
    title: 'Agent Evaluation',
    description: 'A practical framework linking benchmark results to business completion, compliance, latency and cost.',
    accent: 'ink',
    mark: '94%',
    image: null,
  },
  {
    id: '04',
    type: 'Data · Executive dashboard',
    title: 'WorkBuddy Signals',
    description: 'An evidence-backed dashboard turning product adoption, market signals and company filings into decisions.',
    accent: 'blue',
    mark: '16.3',
    image: null,
  },
];

const playground = ['Product teardown', 'Interface systems', 'Agent memory', 'Market maps'];

export default function Home() {
  const [motion, setMotion] = useState(true);

  return (
    <main className="portfolio-shell" data-motion={motion ? 'on' : 'off'}>
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="Adao Zhou, home">
          A/Z<sup>®</sup>
        </a>
        <div className="header-status" aria-label="Availability">
          <span className="status-dot" />
          Independent product builder
        </div>
        <Sheet>
          <SheetTrigger
            render={
              <Button variant="ghost" className="menu-button" aria-label="Open menu" />
            }
          >
            Menu <Plus aria-hidden="true" />
          </SheetTrigger>
          <SheetContent side="top" showCloseButton={false} className="menu-sheet">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SheetDescription className="sr-only">
              Navigate through the portfolio.
            </SheetDescription>
            <div className="menu-topline">
              <span>Adao Zhou</span>
              <SheetClose
                render={
                  <Button variant="ghost" className="menu-button menu-close" aria-label="Close menu" />
                }
              >
                Close <Minus aria-hidden="true" />
              </SheetClose>
            </div>
            <nav className="menu-nav" aria-label="Main navigation">
              {['work', 'about', 'playground', 'contact'].map((item, index) => (
                <SheetClose key={item} render={<a href={`#${item}`} className="menu-item" />}>
                  <span>0{index + 1}</span>
                  {item}
                  <ArrowUpRight aria-hidden="true" />
                </SheetClose>
              ))}
            </nav>
            <div className="menu-footer">
              <span>Shanghai · Working globally</span>
              <a href="mailto:hello@example.com">hello@example.com</a>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      <section className="hero" id="top" aria-labelledby="hero-title">
        <p className="hero-role hero-role-left">AI PRODUCT</p>
        <h1 id="hero-title" className="hero-title" aria-label="Adao Zhou">
          <span>ADAO</span>
          <span>ZHOU</span>
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

        <p className="hero-role hero-role-right">TECH STRATEGY</p>

        <div className="hero-meta">
          <div>
            <span className="meta-label">Launch</span>
            <strong>2026</strong>
          </div>
          <div>
            <span className="meta-label">Focus</span>
            <strong>Product · AI · Systems</strong>
          </div>
        </div>

        <a className="scroll-cue" href="#work">
          <span>Scroll to explore</span>
          <ArrowDown size={16} strokeWidth={1.5} />
        </a>
      </section>

      <section className="work-section" id="work" aria-labelledby="work-heading">
        <div className="section-heading">
          <p className="eyebrow">Selected work · 2024—26</p>
          <h2 id="work-heading">Useful systems,<br />made memorable.</h2>
          <p className="section-note">Drag or scroll the track</p>
        </div>
        <div className="project-track" aria-label="Selected projects">
          {projects.map((project) => (
            <article className="project-card" key={project.id}>
              <div className={`project-visual visual-${project.accent}`}>
                {project.image ? (
                  <img
                    className="project-image"
                    src={project.image}
                    alt="Adao Zhou AI Product Builder editorial identity"
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
        <p className="eyebrow">About · Product × Technology</p>
        <div className="about-grid">
          <h2 id="about-heading">
            I turn ambiguous AI ideas into products that people can understand, trust and use.
          </h2>
          <div className="about-copy">
            <p>
              My work sits between product strategy, interaction design and engineering. I care about the whole path: the business question, the system boundary, the interface and the evidence that it works.
            </p>
            <dl>
              <div><dt>01</dt><dd>Product direction</dd></div>
              <div><dt>02</dt><dd>Agent architecture</dd></div>
              <div><dt>03</dt><dd>Prototyping & delivery</dd></div>
              <div><dt>04</dt><dd>Evaluation systems</dd></div>
            </dl>
          </div>
        </div>
      </section>

      <section className="playground-section" id="playground" aria-labelledby="playground-heading">
        <div className="section-heading compact-heading">
          <p className="eyebrow">Playground · Ongoing</p>
          <h2 id="playground-heading">Things I keep pulling apart.</h2>
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
          <span className="status-dot" /> Available for thoughtful work
        </div>
        <p>Have a hard product problem?</p>
        <a className="contact-link" href="mailto:hello@example.com">
          LET’S TALK<span>↗</span>
        </a>
        <div className="contact-meta">
          <span>© 2026 Adao Zhou</span>
          <Button
            type="button"
            variant="ghost"
            className="motion-toggle"
            onClick={() => setMotion((value) => !value)}
            aria-pressed={!motion}
          >
            Motion {motion ? 'on' : 'off'}
          </Button>
          <a href="#top">Back to top ↑</a>
        </div>
      </footer>
    </main>
  );
}
