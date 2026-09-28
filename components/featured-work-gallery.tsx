'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { FeaturedWorkFallback } from './featured-work-fallback';
import { dampPaper, createPaperWheelGate } from './home/work-paper-motion';
import type { projects as projectData, ProjectVisual } from '@/lib/content';
import type { WorkPaperRenderer } from './home/work-paper-renderer';

type Props = {
  projects: typeof projectData;
  visuals: Record<string, ProjectVisual>;
};

export function FeaturedWorkGallery({ projects, visuals }: Props) {
  const router = useRouter();
  const host = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const links = useRef<(HTMLAnchorElement | null)[]>([]);
  const copy = useRef<HTMLDivElement>(null);
  const command = useRef<(index: number) => void>(() => {});
  const selectedRef = useRef(0);
  const [active, setActive] = useState(false);
  const [selected, setSelected] = useState(0);
  const [previousSelected, setPreviousSelected] = useState<number | null>(null);

  useEffect(() => {
    const root = host.current,
      surface = stage.current,
      output = canvas.current;
    if (!root || !surface || !output || !projects.length) return;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const abort = new AbortController();
    let renderer: WorkPaperRenderer | undefined;
    let disposed = false,
      failed = false,
      loading = false,
      visible = false,
      near = false;
    let frame = 0,
      previous = 0,
      intro = 0,
      entered = false;
    let position = 0,
      target = 0,
      velocity = 0,
      hover = -1,
      step = 1,
      cardWidth = 1,
      cardHeight = 1,
      lastPick = -Infinity;
    setSelected(0);
    setPreviousSelected(null);
    selectedRef.current = 0;
    let selectedIndex = 0,
      pointerX = -1,
      pointerY = -1,
      pickDirty = false;
    const wheelGate = createPaperWheelGate(projects.length);
    let drag: {
      id: number;
      x: number;
      y: number;
      start: number;
      moved: boolean;
      axis: 'pending' | 'x' | 'y';
    } | null = null;
    let suppressClick = false;
    const clamp = (value: number) =>
      Math.max(0, Math.min(projects.length - 1, value));
    const settled = () =>
      Math.abs(position - target) < 0.001 && Math.abs(velocity) < 0.01;
    const updateSelection = (index: number) => {
      if (index === selectedIndex) return;
      setPreviousSelected(selectedIndex);
      selectedIndex = index;
      selectedRef.current = index;
      setSelected(index);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      previous = 0;
    };
    const wake = () => {
      if (
        !frame &&
        renderer &&
        visible &&
        !document.hidden &&
        !media.matches &&
        !disposed
      )
        frame = requestAnimationFrame(tick);
    };
    const finishIntro = () => {
      entered = true;
      intro = 1.2 + projects.length * 0.08;
    };
    command.current = (index) => {
      if (!renderer) return;
      finishIntro();
      target = clamp(index);
      hover = -1;
      pickDirty = true;
      wake();
    };
    const resize = () => {
      if (!renderer) return;
      const result = renderer.resize(
        root.clientWidth,
        window.innerWidth <= 700,
      );
      surface.style.height = `${result.height}px`;
      step = result.step;
      cardWidth = result.cardWidth;
      cardHeight = result.cardHeight;
      [...links.current, copy.current].forEach((element) => {
        if (!element) return;
        element.style.width = `${cardWidth}px`;
        element.style.height = `${cardHeight}px`;
        element.style.transformOrigin = '0 0';
      });
      pickDirty = true;
      wake();
    };
    function tick(now: number) {
      if (!surface) return;
      frame = 0;
      if (
        !renderer ||
        disposed ||
        !visible ||
        document.hidden ||
        media.matches
      ) {
        previous = 0;
        return;
      }
      const dt = previous ? Math.min((now - previous) / 1000, 0.05) : 1 / 60;
      previous = now;
      if (!entered) {
        intro += dt;
        if (intro >= 1.2 + projects.length * 0.08) entered = true;
      }
      const before = position;
      position = dampPaper(position, target, drag?.axis === 'x' ? 30 : 9, dt);
      if (Math.abs(target - position) < 0.0001) position = target;
      const measuredSpeed = (position - before) / dt;
      velocity = dampPaper(velocity, measuredSpeed, 14, dt);
      if (!settled() && pointerX >= 0) pickDirty = true;
      updateSelection(Math.round(clamp(position)));
      let result: ReturnType<WorkPaperRenderer['draw']>;
      try {
        result = renderer.draw({ position, velocity, intro, hover }, dt);
      } catch {
        failed = true;
        disable();
        return;
      }
      result.layouts.forEach((layout, index) => {
        const link = links.current[index];
        if (!link) return;
        link.style.transform = `translate3d(${layout.x}px,${layout.y}px,0) scale(${layout.width / cardWidth},${layout.height / cardHeight})`;
      });
      // HTML type follows the active sheet's unbent frame, not the shader deformation.
      const layout = result.layouts[selectedIndex];
      if (layout && copy.current) {
        copy.current.style.transform = `translate3d(${layout.x}px,${layout.y}px,0) scale(${layout.width / cardWidth},${layout.height / cardHeight})`;
        copy.current.style.opacity = entered
          ? '1'
          : String(Math.min(1, intro / 0.8));
      }
      // Synchronous GPU readback must not interrupt the slide animation.
      // Clicks still pick the exact deformed geometry immediately.
      if (pickDirty && !drag && entered && settled() && now - lastPick >= 50) {
        lastPick = now;
        const picked = renderer.pick(pointerX, pointerY);
        pickDirty = false;
        if (hover !== picked) {
          hover = picked;
          wake();
        }
        surface.style.cursor = hover >= 0 ? 'grab' : 'default';
      }
      surface.dataset.motion = !entered
        ? 'intro'
        : settled()
          ? 'idle'
          : 'moving';
      if (
        !entered ||
        !settled() ||
        result.hoverMoving ||
        (pickDirty && !drag)
      ) {
        wake();
      } else previous = 0;
    }
    const disable = () => {
      stop();
      renderer?.dispose();
      renderer = undefined;
      setActive(false);
      // A hidden focused WebGL link should never trap keyboard navigation.
      if (surface.contains(document.activeElement))
        root.querySelector<HTMLElement>('.work-gallery-card')?.focus();
    };
    const load = async () => {
      if (renderer || loading || failed || disposed || media.matches || !near)
        return;
      loading = true;
      let pending: WorkPaperRenderer | undefined;
      try {
        const { createWorkPaperRenderer } =
          await import('./home/work-paper-renderer');
        if (disposed || media.matches) return;
        pending = await createWorkPaperRenderer(
          output,
          projects.map((project) => ({
            ...project,
            visual: visuals[project.id],
          })),
          abort.signal,
        );
        if (disposed || media.matches) {
          pending.dispose();
          return;
        }
        renderer = pending;
        resize();
        // Warm both rendering and placement before hiding the usable HTML gallery.
        renderer.draw({ position, velocity: 0, intro, hover: -1 }, 1 / 60);
        setActive(true);
        wake();
      } catch {
        pending?.dispose();
        renderer = undefined;
        if (!disposed) {
          failed = true;
          setActive(false);
        }
      } finally {
        loading = false;
      }
    };
    const onMotion = () => {
      if (media.matches) disable();
      else void load();
    };
    const onVisibility = () => {
      if (document.hidden) stop();
      else wake();
    };
    const onLost = (event: Event) => {
      event.preventDefault();
      failed = true;
      disable();
    };
    const onWheel = (event: WheelEvent) => {
      if (!renderer || media.matches || event.ctrlKey || event.metaKey || drag)
        return;
      const rect = surface.getBoundingClientRect();
      if (
        rect.top + rect.height / 2 <= 0 ||
        rect.top + rect.height / 2 >= innerHeight
      )
        return;
      const delta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? event.deltaX
          : event.deltaY;
      if (!delta) return;
      const pixels =
        delta *
        (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1);
      const decision = wheelGate(pixels, performance.now(), target, settled());
      if (decision.prevent) event.preventDefault();
      if (decision.step) command.current(Math.round(target) + decision.step);
    };
    const coordinates = (event: PointerEvent | MouseEvent) => {
      const rect = surface.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    const onDown = (event: PointerEvent) => {
      if (!renderer || media.matches || event.button !== 0) return;
      suppressClick = false;
      drag = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        start: position,
        moved: false,
        axis: 'pending',
      };
      hover = -1;
      pointerX = pointerY = -1;
      finishIntro();
      wake();
    };
    const onMove = (event: PointerEvent) => {
      if (!renderer) return;
      if (!drag) {
        if (event.pointerType === 'touch') return;
        const point = coordinates(event);
        pointerX = point.x;
        pointerY = point.y;
        pickDirty = true;
        wake();
        return;
      }
      if (drag.id !== event.pointerId) return;
      const dx = event.clientX - drag.x,
        dy = event.clientY - drag.y;
      if (Math.hypot(dx, dy) > 8) {
        drag.moved = true;
        suppressClick = true;
      }
      if (drag.axis === 'pending' && drag.moved) {
        drag.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        if (drag.axis === 'x') surface.setPointerCapture(event.pointerId);
      }
      if (drag.axis !== 'x') return;
      event.preventDefault();
      surface.style.cursor = 'grabbing';
      target = clamp(drag.start - dx / step);
      wake();
    };
    const onUp = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id) return;
      const horizontal = drag.axis === 'x';
      if (surface.hasPointerCapture(event.pointerId))
        surface.releasePointerCapture(event.pointerId);
      drag = null;
      surface.style.cursor = 'grab';
      if (horizontal) {
        target = clamp(
          Math.round(target + Math.max(-0.4, Math.min(0.4, velocity * 0.08))),
        );
        wake();
      }
    };
    const onCancel = (event: PointerEvent) => {
      suppressClick = true;
      onUp(event);
    };
    const onLeave = () => {
      if (!drag) {
        pointerX = pointerY = -1;
        hover = -1;
        wake();
      }
    };
    const onClick = (event: MouseEvent) => {
      // Keyboard activation belongs to the real links; canvas clicks use GPU IDs.
      if (
        !renderer ||
        event.detail === 0 ||
        (event.target instanceof Element && event.target.closest('a'))
      )
        return;
      if (suppressClick) {
        event.preventDefault();
        suppressClick = false;
        return;
      }
      const point = coordinates(event);
      const index = renderer.pick(point.x, point.y);
      if (index < 0 || index >= projects.length) return;
      finishIntro();
      if (index !== selectedIndex || !settled()) {
        command.current(index);
        return;
      }
      const href = `/work/${projects[index].id}`;
      if (event.metaKey || event.ctrlKey || event.shiftKey)
        window.open(href, '_blank', 'noopener');
      else router.push(href);
    };
    const observer = new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      if (visible) wake();
      else stop();
    });
    const preloader = new IntersectionObserver(
      (entries) => {
        near = entries[0].isIntersecting;
        if (near) void load();
      },
      { rootMargin: '350px' },
    );
    const resizer = new ResizeObserver(resize);
    observer.observe(surface);
    preloader.observe(root);
    resizer.observe(root);
    media.addEventListener('change', onMotion);
    document.addEventListener('visibilitychange', onVisibility);
    output.addEventListener('webglcontextlost', onLost);
    surface.addEventListener('wheel', onWheel, { passive: false });
    surface.addEventListener('pointerdown', onDown);
    surface.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    surface.addEventListener('pointercancel', onCancel);
    surface.addEventListener('pointerleave', onLeave);
    surface.addEventListener('click', onClick);
    return () => {
      disposed = true;
      abort.abort();
      stop();
      renderer?.dispose();
      command.current = () => {};
      observer.disconnect();
      preloader.disconnect();
      resizer.disconnect();
      media.removeEventListener('change', onMotion);
      document.removeEventListener('visibilitychange', onVisibility);
      output.removeEventListener('webglcontextlost', onLost);
      surface.removeEventListener('wheel', onWheel);
      surface.removeEventListener('pointerdown', onDown);
      surface.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      surface.removeEventListener('pointercancel', onCancel);
      surface.removeEventListener('pointerleave', onLeave);
      surface.removeEventListener('click', onClick);
    };
  }, [projects, visuals, router]);

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
      return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    command.current(
      selectedRef.current + (event.key === 'ArrowRight' ? 1 : -1),
    );
  };
  const project = projects[selected];
  if (!project) return null;
  return (
    <div
      ref={host}
      className="paper-host"
      data-webgl={active}
      data-basketball-ignore
    >
      {!active && (
        <FeaturedWorkFallback projects={projects} visuals={visuals} />
      )}
      <section
        className="paper-gallery"
        aria-label="精选作品纸片画廊"
        aria-roledescription="轮播"
        aria-hidden={!active}
        inert={!active}
      >
        <div ref={stage} className="paper-stage">
          <canvas ref={canvas} aria-hidden="true" />
          {projects.map((item, index) => (
            <Link
              key={item.id}
              href={`/work/${item.id}`}
              className="paper-link"
              ref={(node) => {
                links.current[index] = node;
              }}
              aria-label={`查看作品：${item.title}`}
              aria-current={selected === index ? 'true' : undefined}
              onKeyDown={onKeyDown}
              onFocus={() => command.current(index)}
            >
              <span className="paper-sr-only">{item.title}</span>
            </Link>
          ))}
          <div ref={copy} className="paper-copy-frame" aria-hidden="true">
            {[previousSelected, selected].map((index, layer) => {
              if (index === null) return null;
              const item = projects[index];
              return (
                <div
                  className={`work-gallery-copy ${layer === 0 ? 'paper-copy-out' : 'paper-copy'}`}
                  key={`${layer}-${item.id}`}
                >
                  <span className="work-gallery-index">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.category}</p>
                  </div>
                  <p className="work-gallery-meta">
                    {visuals[item.id].label}
                    <br />
                    {visuals[item.id].detail}
                  </p>
                </div>
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
              type="button"
              aria-label="上一项作品"
              disabled={selected === 0}
              onKeyDown={onKeyDown}
              onClick={() => command.current(selectedRef.current - 1)}
            >
              <ArrowLeft size={20} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="下一项作品"
              disabled={selected === projects.length - 1}
              onKeyDown={onKeyDown}
              onClick={() => command.current(selectedRef.current + 1)}
            >
              <ArrowRight size={20} aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
