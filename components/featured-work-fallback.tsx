'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import useEmblaCarousel from 'embla-carousel-react';
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import type { projects as projectData, ProjectVisual } from '@/lib/content';

export function FeaturedWorkFallback({
  projects,
  visuals,
}: {
  projects: typeof projectData;
  visuals: Record<string, ProjectVisual>;
}) {
  const [viewportRef, api] = useEmblaCarousel({
    align: 'center',
    containScroll: false,
    loop: false,
    skipSnaps: false,
    watchFocus: false,
  });
  const viewport = useRef<HTMLDivElement>(null);
  const reduced = useRef(false);
  const pointer = useRef({ x: 0, y: 0, moved: false, down: false });
  const [selected, setSelected] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!api || !viewport.current) return;
    const element = viewport.current;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let settled = true;
    let lastWheel = 0;
    let consumed = false;
    let accumulated = 0;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    const paint = () => {
      frame = 0;
      const progress = api.scrollProgress();
      const snaps = api.scrollSnapList();
      api.slideNodes().forEach((slide, index) => {
        const distance = (snaps[index] - progress) / (snaps[1] - snaps[0] || 1);
        const offset = Math.max(-1, Math.min(1, distance));
        slide.style.setProperty(
          '--work-origin',
          distance > 0.01
            ? 'left center'
            : distance < -0.01
              ? 'right center'
              : 'center',
        );
        slide.style.setProperty(
          '--work-scale',
          String(reduced.current ? 1 : 1 - Math.abs(offset) * 0.06),
        );
        slide.style.setProperty(
          '--work-parallax',
          `${reduced.current ? 0 : offset * -16}px`,
        );
      });
    };
    const onScroll = () => {
      settled = false;
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const onPointerUp = () => {
      if (reduced.current) api.scrollTo(api.selectedScrollSnap(), true);
    };
    const onSelect = () => setSelected(api.selectedScrollSnap());
    const onSettle = () => {
      settled = true;
    };
    const onMotion = () => {
      reduced.current = media.matches;
      paint();
    };
    const onInit = () => {
      onSelect();
      paint();
      settled = true;
    };
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey || event.defaultPrevented) return;
      const rect = element.getBoundingClientRect();
      const center = rect.top + rect.height / 2;
      if (center <= 0 || center >= window.innerHeight) return;
      const delta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? event.deltaX
          : event.deltaY;
      if (!delta) return;
      const now = performance.now();
      if (now - lastWheel >= 180 && settled) {
        consumed = false;
        accumulated = 0;
      }
      lastWheel = now;
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (settled) {
          consumed = false;
          accumulated = 0;
        }
      }, 180);
      // Keep the remainder of a captured gesture from leaking into page scroll,
      // including the gesture that just arrived at the first or last project.
      if (consumed) {
        event.preventDefault();
        return;
      }
      const canMove = delta > 0 ? api.canScrollNext() : api.canScrollPrev();
      if (!canMove) return;
      event.preventDefault();
      if (!settled) return;
      const multiplier =
        event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1;
      if (Math.sign(accumulated) !== Math.sign(delta)) accumulated = 0;
      accumulated += delta * multiplier;
      if (Math.abs(accumulated) < 40) return;
      consumed = true;
      settled = reduced.current;
      api.scrollTo(
        api.selectedScrollSnap() + Math.sign(accumulated),
        reduced.current,
      );
    };
    onMotion();
    onInit();
    setReady(true);
    element.addEventListener('wheel', onWheel, { passive: false });
    media.addEventListener('change', onMotion);
    api
      .on('scroll', onScroll)
      .on('select', onSelect)
      .on('settle', onSettle)
      .on('reInit', onInit)
      .on('pointerUp', onPointerUp);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(idleTimer);
      element.removeEventListener('wheel', onWheel);
      media.removeEventListener('change', onMotion);
      api
        .off('scroll', onScroll)
        .off('select', onSelect)
        .off('settle', onSettle)
        .off('reInit', onInit)
        .off('pointerUp', onPointerUp);
    };
  }, [api]);

  useEffect(() => {
    if (ready) api?.reInit();
  }, [ready, api]);

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (
      !api ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey
    )
      return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    api.scrollTo(
      api.selectedScrollSnap() + (event.key === 'ArrowRight' ? 1 : -1),
      reduced.current,
    );
  };

  if (!projects.length) return null;
  return (
    <section
      className="work-gallery"
      aria-roledescription="轮播"
      aria-label="精选作品画廊"
      data-ready={ready}
      data-basketball-ignore
    >
      <div
        className="work-gallery-viewport"
        ref={(node) => {
          viewport.current = node;
          viewportRef(node);
        }}
        onPointerDownCapture={(event) => {
          pointer.current = {
            x: event.clientX,
            y: event.clientY,
            moved: false,
            down: true,
          };
        }}
        onPointerMoveCapture={(event) => {
          const start = pointer.current;
          if (
            start.down &&
            Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8
          )
            start.moved = true;
        }}
        onPointerUpCapture={() => {
          pointer.current.down = false;
        }}
        onPointerCancel={() => {
          pointer.current.down = false;
          pointer.current.moved = true;
        }}
      >
        <div className="work-gallery-track">
          {projects.map((project, index) => {
            const visual = visuals[project.id];
            return (
              <article
                className="work-gallery-slide"
                key={project.id}
                aria-roledescription="幻灯片"
                aria-label={`${index + 1} / ${projects.length}`}
              >
                <Link
                  href={`/work/${project.id}`}
                  className="work-gallery-card"
                  onKeyDown={onKeyDown}
                  draggable={false}
                  aria-label={`查看作品：${project.title}`}
                  aria-current={selected === index ? 'true' : undefined}
                  style={
                    {
                      '--work-position': visual.position ?? '50% 50%',
                      '--work-position-mobile':
                        visual.mobilePosition ?? visual.position ?? '50% 50%',
                    } as CSSProperties
                  }
                  onFocus={(event) => {
                    // Pointer focus must not turn a side-card click into navigation.
                    if (event.currentTarget.matches(':focus-visible'))
                      api?.scrollTo(index, reduced.current);
                  }}
                  onClick={(event) => {
                    if (event.detail !== 0 && pointer.current.moved) {
                      event.preventDefault();
                      return;
                    }
                    if (
                      event.metaKey ||
                      event.ctrlKey ||
                      event.shiftKey ||
                      event.altKey
                    )
                      return;
                    if (
                      api &&
                      event.detail !== 0 &&
                      index !== api.selectedScrollSnap()
                    ) {
                      event.preventDefault();
                      api.scrollTo(index, reduced.current);
                    }
                  }}
                >
                  <div className="work-gallery-art">
                    {visual.src ? (
                      <Image
                        src={visual.src}
                        alt={visual.alt}
                        fill
                        draggable={false}
                        loading={index === 0 ? 'eager' : 'lazy'}
                        sizes="(max-width: 700px) 88vw, (max-width: 1500px) 72vw, 1040px"
                      />
                    ) : (
                      <div className="project-system-art" aria-hidden="true">
                        {project.mark}
                      </div>
                    )}
                  </div>
                  <div className="work-gallery-copy">
                    <span className="work-gallery-index">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div>
                      <h3>{project.title}</h3>
                      <p>{project.category}</p>
                    </div>
                    <p className="work-gallery-meta">
                      {visual.label}
                      <br />
                      {visual.detail}
                    </p>
                  </div>
                </Link>
              </article>
            );
          })}
        </div>
      </div>
      <div className="work-gallery-controls">
        <span className="work-gallery-hint">
          滑动浏览 <span aria-hidden="true">↔</span>
        </span>
        <output aria-live="polite" aria-atomic="true">
          {String(selected + 1).padStart(2, '0')}{' '}
          <span>/ {String(projects.length).padStart(2, '0')}</span>
        </output>
        <div className="work-gallery-buttons">
          <button
            onKeyDown={onKeyDown}
            type="button"
            aria-label="上一项作品"
            disabled={!ready || selected === 0}
            onClick={() => api?.scrollPrev(reduced.current)}
          >
            <ArrowLeft size={20} aria-hidden="true" />
          </button>
          <button
            onKeyDown={onKeyDown}
            type="button"
            aria-label="下一项作品"
            disabled={!ready || selected === projects.length - 1}
            onClick={() => api?.scrollNext(reduced.current)}
          >
            <ArrowRight size={20} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}
