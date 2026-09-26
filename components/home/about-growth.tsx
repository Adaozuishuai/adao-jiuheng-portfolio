'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';

// Native return links perform document navigation too. Session storage bridges those
// links; an explicit home reload resets it. Memory remains a fallback if storage is blocked.
let hasPresented = false;
let sessionInitialized = false;
const SESSION_KEY = 'about-growth-presented-v1';

function initializeSession() {
  if (sessionInitialized) return;
  sessionInitialized = true;
  try {
    const navigation = performance.getEntriesByType('navigation')[0] as
      | PerformanceNavigationTiming
      | undefined;
    if (navigation?.type === 'reload') sessionStorage.removeItem(SESSION_KEY);
    hasPresented = sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {
    // Storage can be unavailable in privacy modes; client navigation still works.
  }
}

function consumePresentation() {
  hasPresented = true;
  try {
    sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    /* Memory fallback. */
  }
}

const DURATION = 6000;
const ROOT = '/images/home/journey/';
const DESCRIPTION =
  '从孩童到少年再到成人，背着行囊沿蜿蜒道路向前成长，留下每个阶段的自己，走向远山与日出';
const anchors = {
  child: [604 / 2172, 568 / 724],
  teen: [809 / 2172, 536 / 724],
  adult: [1026 / 2172, 510 / 724],
} as const;
type Age = keyof typeof anchors;
const layers: { id: string; age: Age }[] = [
  { id: 'child-still', age: 'child' },
  { id: 'child-travel', age: 'child' },
  { id: 'teen-still', age: 'teen' },
  { id: 'teen-travel', age: 'teen' },
  { id: 'adult-still', age: 'adult' },
];

// Every sprite occupies the same 2172 × 724 canvas. Percent translations therefore
// scale with the road; scaling around the planted shoe cannot lift the feet.
function pose(age: Age, at: Age, scale = 1) {
  const [x, y] = anchors[age];
  const [toX, toY] = anchors[at];
  return `translate(${(toX - x) * 100}%, ${(toY - y) * 100}%) scale(${scale})`;
}

function travel(
  age: Age,
  from: Age,
  to: Age,
  start: number,
  end: number,
  incoming: boolean,
  size: number,
): Keyframe[] {
  const begin = pose(age, from, incoming ? 1 / size : 1);
  const finish = pose(age, to, incoming ? 1 : size);
  return [
    { offset: 0, opacity: 0, transform: begin },
    {
      offset: start / DURATION,
      opacity: incoming ? 0 : 1,
      transform: begin,
      easing: 'ease-in-out',
    },
    { offset: end / DURATION, opacity: incoming ? 1 : 0, transform: finish },
    { offset: 1, opacity: incoming ? 1 : 0, transform: finish },
  ];
}

const keyframes: Record<string, Keyframe[]> = {
  'child-still': [
    { opacity: 0, offset: 0 },
    { opacity: 1, offset: 0.1 },
    { opacity: 1, offset: 1 },
  ],
  'child-travel': travel('child', 'child', 'teen', 600, 2800, false, 1.35),
  'teen-still': travel('teen', 'child', 'teen', 600, 2800, true, 1.35),
  'teen-travel': travel('teen', 'teen', 'adult', 3300, 5500, false, 1.27),
  'adult-still': travel('adult', 'teen', 'adult', 3300, 5500, true, 1.27),
};

// Outgoing copies appear only at departure, never fade in over an existing still.
keyframes['child-travel'][0].easing = 'steps(1, end)';
keyframes['teen-travel'][0].easing = 'steps(1, end)';

export function AboutGrowth() {
  const frame = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = frame.current;
    if (!node) return;
    initializeSession();
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let disposed = false;
    let ready = false;
    let failed = false;
    let visible = false;
    let started = false;
    let finished = hasPresented;
    let animations: Animation[] = [];
    let observer: IntersectionObserver | undefined;

    const setState = (value: string) => {
      node.dataset.state = value;
    };
    const cancel = () => {
      for (const animation of animations) {
        animation.onfinish = null;
        animation.cancel();
      }
      animations = [];
    };
    const fallback = () => {
      if (disposed) return;
      failed = true;
      cancel();
      setState('fallback');
      observer?.disconnect();
    };
    const sync = () => {
      if (disposed || failed) return;
      if (media.matches) {
        // Changing the OS setting during playback immediately cancels all motion.
        if (started) finished = true;
        cancel();
        setState('fallback');
        return;
      }
      if (!ready) return;
      if (finished) {
        setState('complete');
        return;
      }
      if (!visible || document.visibilityState !== 'visible') {
        if (started) {
          // Pin all effects to one timestamp before pausing, avoiding frame drift.
          const time = animations[0]?.currentTime ?? 0;
          for (const animation of animations) {
            animation.pause();
            animation.currentTime = time;
          }
          setState('paused');
        }
        return;
      }
      try {
        if (!started) {
          animations = layers.map(({ id }) => {
            const target = node.querySelector<HTMLElement>(
              `[data-layer="${id}"]`,
            )!;
            const animation = target.animate(keyframes[id], {
              duration: DURATION,
              fill: 'both',
            });
            animation.pause();
            animation.currentTime = 0;
            return animation;
          });
          animations[0].onfinish = () => {
            if (disposed) return;
            finished = true;
            // Static final styles replace the finished effects, releasing animation resources.
            setState('complete');
            cancel();
          };
          started = true;
          consumePresentation();
        }
        const time = Number(animations[0].currentTime ?? 0);
        const startTime = Number(document.timeline.currentTime) - time;
        for (const animation of animations) {
          animation.play();
          animation.startTime = startTime;
        }
        setState('playing');
      } catch {
        fallback();
      }
    };

    const pageHide = () => {
      if (started) {
        finished = true;
        cancel();
        setState(media.matches || failed ? 'fallback' : 'complete');
      }
    };
    media.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('pagehide', pageHide);
    window.addEventListener('pageshow', sync);
    const images = Array.from(
      node.querySelectorAll<HTMLImageElement>('[data-growth-asset]'),
    );
    images.forEach((image) => image.addEventListener('error', fallback));
    if (
      !('IntersectionObserver' in window) ||
      !('animate' in Element.prototype)
    ) {
      fallback();
    } else {
      observer = new IntersectionObserver(
        ([entry]) => {
          visible = entry.isIntersecting && entry.intersectionRatio >= 0.3;
          sync();
        },
        { threshold: [0, 0.3] },
      );
      observer.observe(node);
      // Decode the actual rendered elements, including both copies of each sprite.
      // The original image remains visible until every layer can be painted together.
      Promise.all(images.map((image) => image.decode()))
        .then(() => {
          if (disposed) return;
          ready = true;
          sync();
        })
        .catch(fallback);
    }
    return () => {
      disposed = true;
      cancel();
      observer?.disconnect();
      media.removeEventListener('change', sync);
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('pagehide', pageHide);
      window.removeEventListener('pageshow', sync);
      images.forEach((image) => image.removeEventListener('error', fallback));
    };
  }, []);

  return (
    <div
      ref={frame}
      className="about-journey about-growth"
      data-state="fallback"
    >
      {/* This remains the single accessible image even when visually transparent. */}
      <Image
        unoptimized
        className="about-growth-original"
        src="/images/home/about-journey.png"
        width={2172}
        height={724}
        alt={DESCRIPTION}
        loading="lazy"
      />
      <div className="about-growth-layers" aria-hidden="true">
        <Image
          unoptimized
          loading="eager"
          data-growth-asset
          src={`${ROOT}background.png`}
          width={2172}
          height={724}
          alt=""
        />
        {layers.map(({ id, age }) => (
          <Image
            unoptimized
            loading="eager"
            key={id}
            data-growth-asset
            data-layer={id}
            src={`${ROOT}${age}.png`}
            width={2172}
            height={724}
            alt=""
            style={{
              transformOrigin: `${anchors[age][0] * 100}% ${anchors[age][1] * 100}%`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
