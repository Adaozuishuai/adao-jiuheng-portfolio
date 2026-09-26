'use client';

import { useEffect, useRef, useState } from 'react';
import type { createBallRenderer } from './ball-renderer';
import { BALL_RADIUS, projectedSeams } from './ball-geometry';

type Stage =
  | 'loading'
  | 'entering'
  | 'idle'
  | 'armed'
  | 'shooting'
  | 'scoring'
  | 'falling'
  | 'bouncing'
  | 'rest';
type Point = { x: number; y: number };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const curve = (a: Point, control: Point, b: Point, t: number): Point => ({
  x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * control.x + t * t * b.x,
  y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * control.y + t * t * b.y,
});

function Hoop({ front }: { front?: boolean }) {
  return (
    <svg
      className={`court-hoop court-hoop-${front ? 'front' : 'back'}`}
      viewBox="0 0 200 200"
      aria-hidden="true"
    >
      {!front ? (
        <>
          <path d="M178 30L197 35V63L178 58Z" fill="#666057" />
          <path d="M157 39L188 43V52L157 47Z" fill="#743c29" />
          <path
            d="M26 45C26 17 174 17 174 45"
            fill="none"
            stroke="#763c27"
            strokeWidth="7"
          />
          <path
            d="M26 42C26 16 174 16 174 42"
            fill="none"
            stroke="#bd7250"
            strokeWidth="3"
          />
        </>
      ) : (
        <>
          <g
            className="court-net"
            stroke="#fdf9e9"
            strokeWidth="1.7"
            fill="none"
            strokeLinecap="round"
            style={{ filter: 'drop-shadow(1px 1px 1px #544e4940)' }}
          >
            <path d="M28 45L57 137Q100 152 143 137L172 45" />
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <path
                key={i}
                d={`M${28 + i * 28.8} ${45 + 18 * Math.sin((i / 5) * Math.PI)} Q${45 + i * 19} 90 ${57 + i * 17.2} 137`}
              />
            ))}
            <path d="M32 60L148 123M40 86L132 142M50 116L98 146M56 61L157 97M89 64L165 80M169 60L52 123M160 86L68 142M150 116L102 146M144 61L43 97M111 64L35 80" />
            <path
              d="M40 86Q100 107 160 86M50 116Q100 138 150 116M57 137Q100 152 143 137"
              opacity=".85"
            />
          </g>
          <path
            d="M25 43C25 68 175 68 175 43"
            fill="none"
            stroke="#783a25"
            strokeWidth="7"
          />
          <path
            d="M25 40C25 65 175 65 175 40"
            fill="none"
            stroke="#c17651"
            strokeWidth="3"
          />
        </>
      )}
    </svg>
  );
}

export function BasketballScene() {
  const court = useRef<HTMLDivElement>(null);
  const ball = useRef<HTMLButtonElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const shadow = useRef<HTMLDivElement>(null);
  const path = useRef<SVGPathElement>(null);
  const shoot = useRef<() => void>(() => {});
  const repaint = useRef<() => void>(() => {});
  const hover = useRef(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const root = court.current!,
      button = ball.current!,
      shadowElement = shadow.current!;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let size = { w: 0, h: 0, d: 64 };
    let renderer: Awaited<ReturnType<typeof createBallRenderer>> | undefined;
    let renderReady = false;
    let loadTimer: ReturnType<typeof setTimeout> | undefined;
    const fallbackPaths =
      button.querySelectorAll<SVGPathElement>('.ball-seams path');
    let entered = reduced.matches,
      entranceTime = 0,
      entranceFrom = 0;
    let disposed = false,
      visible = false,
      loading = false;
    let frame = 0,
      elapsed = 0,
      previous = 0,
      idleTime = 0,
      rotation = 0;
    let active = false,
      stage: Stage = 'loading',
      reducedTimer: ReturnType<typeof setTimeout> | undefined;
    let celebrationTimer: ReturnType<typeof setTimeout> | undefined;
    let start: Point = { x: 0, y: 0 },
      origin = start,
      rim = start,
      rest = start,
      position = start;
    const stageTo = (next: Stage) => {
      if (next === stage) return;
      stage = next;
      root.dataset.state = next;
      if (next === 'scoring') {
        root.dataset.celebrate = 'true';
        clearTimeout(celebrationTimer);
        celebrationTimer = setTimeout(() => {
          delete root.dataset.celebrate;
        }, 700);
      }
    };
    const draw = (point: Point, squash = 1) => {
      position = point;
      const scale = !active && hover.current && !reduced.matches ? 1.03 : 1;
      button.style.transform = `translate3d(${point.x}px,${point.y}px,0) translate(-50%,-50%) scale(${scale / squash},${scale * squash})`;
      const height = Math.min(1, Math.max(0, rest.y - point.y) / size.h);
      shadowElement.style.transform = `translate3d(${point.x}px,${rest.y + size.d * 0.47}px,0) translate(-50%,-50%) scaleX(${0.95 - height * 0.6})`;
      shadowElement.style.opacity = `${Math.max(0.025, 0.23 - height * 0.35)}`;
      if (active) shadowElement.style.filter = `blur(${3 + height * 9}px)`;
      if (!renderer?.draw(rotation)) {
        projectedSeams(rotation).forEach((d, i) =>
          fallbackPaths[i]?.setAttribute('d', d),
        );
      }
    };
    repaint.current = () => {
      if (!active && stage !== 'entering') draw(position);
    };
    const resize = () => {
      const bounds = root.getBoundingClientRect();
      const mobile = window.innerWidth <= 700;
      const diameter = mobile
        ? 48
        : Math.max(48, Math.min(72, bounds.width * 0.055));
      if (
        size.w === bounds.width &&
        size.h === bounds.height &&
        size.d === diameter
      )
        return;
      size = {
        w: bounds.width,
        h: bounds.height,
        d: mobile ? 48 : Math.max(48, Math.min(72, bounds.width * 0.055)),
      };
      origin = {
        x: size.w * (mobile ? 0.2 : 0.66),
        y: size.h * (mobile ? 0.7 : 0.14),
      };
      rim = {
        x: size.w * (mobile ? 0.78 : 0.9),
        y: size.h * (mobile ? 0.63 : 0.28),
      };
      rest = {
        x: size.w * (mobile ? 0.64 : 0.78),
        y: size.h - size.d * 0.57 - 4,
      };
      root.querySelectorAll<SVGElement>('.court-hoop').forEach((el) => {
        el.style.left = `${rim.x}px`;
        el.style.top = `${rim.y}px`;
        el.style.width = `${size.d * 2.6}px`;
        el.style.height = `${size.d * 2.6}px`;
      });
      const heart = root.querySelector<HTMLElement>('.court-heart');
      if (heart) {
        heart.style.left = `${rim.x + size.d}px`;
        heart.style.top = `${rim.y}px`;
      }
      button.style.width = `${size.d}px`;
      button.style.height = `${size.d}px`;
      button.style.left = '0';
      button.style.top = '0';
      shadowElement.style.left = '0';
      shadowElement.style.top = '0';
      shadowElement.style.width = `${size.d}px`;
      renderer?.resize(size.d);
      active = false;
      elapsed = 0;
      start = origin;
      button.setAttribute('aria-disabled', entered ? 'false' : 'true');
      stageTo(entered ? 'idle' : 'loading');
      if (reducedTimer) clearTimeout(reducedTimer);
      clearTimeout(celebrationTimer);
      delete root.dataset.celebrate;
      const control = {
        x: mix(origin.x, rim.x, 0.55),
        y: Math.min(origin.y, rim.y) - size.h * 0.32,
      };
      path.current?.setAttribute(
        'd',
        `M${origin.x} ${origin.y}Q${control.x} ${control.y} ${rim.x} ${rim.y}`,
      );
      draw(origin);
    };
    const load = async () => {
      if (loading || renderer || reduced.matches) return;
      loading = true;
      try {
        const { createBallRenderer } = await import('./ball-renderer');
        if (disposed || reduced.matches) return;
        const prepared = await createBallRenderer(canvas.current!, size.d);
        if (disposed || reduced.matches) {
          prepared.dispose();
          return;
        }
        renderer = prepared;
        renderer.resize(size.d);
        renderer.draw(rotation);
        button.dataset.webgl = 'true';
      } catch {
        /* The visible SVG remains usable when WebGL is unavailable. */
      } finally {
        loading = false;
        if (!disposed) {
          renderReady = true;
          previous = 0;
          if (!entered && !reduced.matches) {
            entered = true;
            entranceTime = 0;
            entranceFrom =
              -Math.max(0, root.getBoundingClientRect().top) - size.d;
            draw({ x: origin.x, y: entranceFrom });
            stageTo('entering');
          }
          resume();
        }
      }
    };
    // Let the existing 1.4s logo reveal finish; don't initialize during a shot.
    const scheduleLoad = () => {
      if (disposed || loading || renderer || reduced.matches || loadTimer)
        return;
      loadTimer = setTimeout(() => {
        loadTimer = undefined;
        if (!visible || document.hidden) return;
        if (active) {
          scheduleLoad();
          return;
        }
        void load();
      }, 1500);
    };
    const tick = (now: number) => {
      frame = 0;
      if (disposed || !visible || document.hidden || reduced.matches) {
        previous = 0;
        return;
      }
      const dt = previous ? Math.min((now - previous) / 1000, 0.05) : 0;
      previous = now;
      idleTime += dt;
      let p = position,
        squash = 1;
      if (stage === 'entering') {
        entranceTime += dt;
        rotation += dt * 0.8;
        if (entranceTime < 0.7) {
          const u = entranceTime / 0.7;
          p = { x: origin.x, y: mix(entranceFrom, origin.y, u * u) };
        } else if (entranceTime < 1.06) {
          const u = (entranceTime - 0.7) / 0.36;
          p = {
            x: origin.x,
            y: origin.y - size.d * 0.2 * Math.sin(Math.PI * u),
          };
          squash = 1 - 0.035 * Math.sin(Math.PI * u);
        } else {
          p = origin;
          idleTime = 0;
          stageTo('idle');
          button.setAttribute('aria-disabled', 'false');
        }
      } else if (active) {
        elapsed += dt;
        const t = elapsed;
        rotation += dt * 7;
        if (t < 0.14) {
          stageTo('armed');
          squash = 1 - 0.09 * Math.sin((t / 0.14) * Math.PI);
          p = start;
        } else if (t < 1.0) {
          stageTo('shooting');
          const u = (t - 0.14) / 0.86;
          p = curve(
            start,
            {
              x: mix(start.x, rim.x, 0.58),
              y: Math.min(start.y, rim.y) - size.h * 0.32,
            },
            rim,
            u,
          );
          path.current!.style.strokeDashoffset = `${1 - u}`;
        } else if (t < 1.22) {
          if (stage !== 'scoring') setStatus('投中了。点击篮球可再投一次。');
          stageTo('scoring');
          p = { x: rim.x, y: mix(rim.y, rim.y + size.d * 1.3, (t - 1) / 0.22) };
        } else if (t < 1.57) {
          stageTo('falling');
          const u = (t - 1.22) / 0.35;
          p = {
            x: mix(rim.x, rest.x + 0.06 * size.w, u),
            y: mix(rim.y + size.d * 1.3, rest.y, u * u),
          };
        } else if (t < 1.94) {
          stageTo('bouncing');
          const u = (t - 1.57) / 0.37;
          p = {
            x: mix(rest.x + 0.06 * size.w, rest.x + 0.025 * size.w, u),
            y: rest.y - size.d * 1.3 * 4 * u * (1 - u),
          };
        } else if (t < 2.18) {
          const u = (t - 1.94) / 0.24;
          p = {
            x: mix(rest.x + 0.025 * size.w, rest.x + 0.01 * size.w, u),
            y: rest.y - size.d * 0.38 * 4 * u * (1 - u),
          };
        } else if (t < 2.34) {
          const u = (t - 2.18) / 0.16;
          p = {
            x: mix(rest.x + 0.01 * size.w, rest.x, 1 - (1 - u) ** 2),
            y: rest.y,
          };
        } else {
          p = rest;
          active = false;
          stageTo('rest');
          button.setAttribute('aria-disabled', 'false');
          const control = {
            x: mix(rest.x, rim.x, 0.58),
            y: Math.min(rest.y, rim.y) - size.h * 0.32,
          };
          path.current!.setAttribute(
            'd',
            `M${rest.x} ${rest.y}Q${control.x} ${control.y} ${rim.x} ${rim.y}`,
          );
        }
      } else if (stage === 'idle') {
        rotation += dt * (hover.current ? 0.17 : 0.065);
        p = { x: origin.x, y: origin.y + Math.sin(idleTime * 1.3) * 1.6 };
      }
      draw(p, squash);
      if (active || stage === 'idle' || stage === 'entering')
        frame = requestAnimationFrame(tick);
    };
    const resume = () => {
      if (
        !frame &&
        (active || renderReady) &&
        visible &&
        !document.hidden &&
        !reduced.matches
      )
        frame = requestAnimationFrame(tick);
    };
    shoot.current = () => {
      if (active || stage === 'loading' || stage === 'entering') return;
      root.dataset.hint = 'false';
      hover.current = false;
      setStatus('');
      if (reduced.matches) {
        active = true;
        stageTo('scoring');
        setStatus('投中了。点击篮球可再投一次。');
        button.setAttribute('aria-disabled', 'true');
        reducedTimer = setTimeout(() => {
          active = false;
          stageTo('rest');
          button.setAttribute('aria-disabled', 'false');
        }, 700);
        return;
      }
      start = position;
      active = true;
      elapsed = 0;
      previous = 0;
      button.setAttribute('aria-disabled', 'true');
      const control = {
        x: mix(start.x, rim.x, 0.58),
        y: Math.min(start.y, rim.y) - size.h * 0.32,
      };
      path.current!.setAttribute(
        'd',
        `M${start.x} ${start.y}Q${control.x} ${control.y} ${rim.x} ${rim.y}`,
      );
      path.current!.style.strokeDasharray = '1';
      path.current!.style.strokeDashoffset = '1';
      stageTo('armed');
      resume();
    };
    const motionChange = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      resize();
      if (reduced.matches) {
        entered = true;
        active = false;
        stageTo('idle');
        button.setAttribute('aria-disabled', 'false');
        draw(origin);
      }
      if (!reduced.matches) {
        scheduleLoad();
        resume();
      }
    };
    const visibilityChange = () => {
      previous = 0;
      if (document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else {
        scheduleLoad();
        resume();
      }
    };
    resize();
    const ro = new ResizeObserver(() => {
      resize();
      resume();
    });
    ro.observe(root);
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) {
        scheduleLoad();
        resume();
      } else {
        cancelAnimationFrame(frame);
        frame = 0;
        previous = 0;
      }
    });
    io.observe(root);
    reduced.addEventListener('change', motionChange);
    document.addEventListener('visibilitychange', visibilityChange);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      clearTimeout(reducedTimer);
      clearTimeout(celebrationTimer);
      clearTimeout(loadTimer);
      ro.disconnect();
      io.disconnect();
      renderer?.dispose();
      reduced.removeEventListener('change', motionChange);
      document.removeEventListener('visibilitychange', visibilityChange);
    };
  }, []);
  const hint = (value: boolean) => {
    hover.current = value;
    if (court.current) court.current.dataset.hint = String(value);
    repaint.current();
  };
  return (
    <div ref={court} className="home-court" data-state="loading">
      <noscript>
        <style>{`.home-court[data-state="loading"] .court-ball { visibility: visible; }`}</style>
      </noscript>
      <svg className="court-trajectory" aria-hidden="true">
        <path ref={path} pathLength={1} />
      </svg>
      <Hoop />
      <div ref={shadow} className="court-shadow" />
      <button
        ref={ball}
        type="button"
        className="court-ball"
        aria-label="投篮。点击或按回车、空格，将篮球投进篮筐。"
        onClick={() => shoot.current()}
        onPointerEnter={() => hint(true)}
        onPointerLeave={() => hint(false)}
        onFocus={() => hint(true)}
        onBlur={() => hint(false)}
      >
        <svg
          className="court-ball-fallback"
          viewBox="0 0 100 100"
          aria-hidden="true"
        >
          <defs>
            <radialGradient id="home-ball-light" cx="30%" cy="24%" r="80%">
              <stop stopColor="#d38a52" />
              <stop offset=".65" stopColor="#a75c31" />
              <stop offset="1" stopColor="#583522" />
            </radialGradient>
            <pattern
              id="home-ball-grain"
              width="3"
              height="3"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="1" cy="1" r=".65" fill="#402b1d" opacity=".24" />
            </pattern>
          </defs>
          <circle
            cx="50"
            cy="50"
            r={BALL_RADIUS}
            fill="url(#home-ball-light)"
          />
          <circle
            cx="50"
            cy="50"
            r={BALL_RADIUS}
            fill="url(#home-ball-grain)"
          />
          <g
            className="ball-seams"
            fill="none"
            stroke="#30231c"
            strokeWidth="1.27"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {projectedSeams(0).map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>
        </svg>
        <canvas ref={canvas} aria-hidden="true" />
      </button>
      <Hoop front />
      <span className="court-heart" aria-hidden="true">
        ♥
      </span>
      <span className="court-instruction" aria-hidden="true">
        点击，投个篮。
      </span>
      <output className="sr-only" aria-live="polite">
        {status}
      </output>
    </div>
  );
}
