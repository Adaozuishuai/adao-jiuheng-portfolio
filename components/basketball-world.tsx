'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Matter from 'matter-js';
import * as THREE from 'three';

const STEP = 1000 / 60;
const MAX_THROW = 2400 / 60;
const HIDDEN_KEY = 'jiuheng-basketball-hidden';

// Text ranges follow each rendered line, without turning block whitespace into walls.
function collectColliderRects(): DOMRect[] {
  const rects: DOMRect[] = [];
  const excluded = '.basketball-world, script, style, noscript, [hidden], [data-basketball-ignore], .project-cover';
  const visible = (element: Element) => {
    const style = getComputedStyle(element);
    return !element.closest(excluded) && style.display !== 'none' && style.visibility === 'visible' && style.opacity !== '0';
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const parent = node.parentElement;
    if (!parent || !node.textContent?.trim() || !visible(parent) || parent.closest('svg')) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    rects.push(...Array.from(range.getClientRects()));
  }
  document.querySelectorAll('img, video, canvas, svg, .project-cover').forEach(element => {
    if (!visible(element)) return;
    if (element.matches('svg') && element.querySelector('.hero-fill')) {
      element.querySelectorAll('.hero-fill path').forEach(path => rects.push(path.getBoundingClientRect()));
    } else {
      rects.push(element.getBoundingClientRect());
    }
  });
  const unique = new Map<string, DOMRect>();
  for (const rect of rects) {
    if (rect.width < 2 || rect.height < 2) continue;
    const documentRect = new DOMRect(rect.x + window.scrollX, rect.y + window.scrollY, rect.width, rect.height);
    const key = [documentRect.x, documentRect.y, rect.width, rect.height].map(value => Math.round(value)).join(',');
    unique.set(key, documentRect);
  }
  return [...unique.values()];
}

type PointerSample = { x: number; y: number; time: number };
type Controls = {
  grab: (event: React.PointerEvent<HTMLButtonElement>) => void;
  key: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
  reset: () => void;
};

function clampVelocity(body: Matter.Body) {
  const speed = Matter.Body.getSpeed(body);
  if (speed > MAX_THROW) {
    const velocity = Matter.Body.getVelocity(body);
    Matter.Body.setVelocity(body, {
      x: velocity.x * MAX_THROW / speed,
      y: velocity.y * MAX_THROW / speed,
    });
  }
}

function createBallTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  if (!context) return null;

  context.fillStyle = '#bb602f';
  context.fillRect(0, 0, canvas.width, canvas.height);
  for (let row = 0; row < 128; row += 1) {
    for (let col = 0; col < 256; col += 1) {
      const jitter = Math.sin(row * 127.1 + col * 311.7);
      const x = col * 4 + (row % 2) * 2 + jitter * 0.6;
      const y = row * 4 + jitter * 0.5;
      context.fillStyle = '#914723';
      context.beginPath();
      context.ellipse(x, y, 1.65, 1.5, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#d18049';
      context.beginPath();
      context.ellipse(x - 0.3, y - 0.4, 1.15, 1, 0, 0, Math.PI * 2);
      context.fill();
    }
  }
  context.globalAlpha = 1;
  context.strokeStyle = '#282620';
  context.lineWidth = 9;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(0, 256);
  context.lineTo(1024, 256);
  context.moveTo(512, 0);
  context.lineTo(512, 512);
  context.moveTo(0, 0);
  context.lineTo(0, 512);
  context.moveTo(1024, 0);
  context.lineTo(1024, 512);
  for (const direction of [-1, 1]) {
    for (let x = 0; x <= 1024; x += 2) {
      const y = 256 + direction * Math.atan(1.65 * Math.sin(x / 1024 * Math.PI * 2)) / Math.PI * 512;
      if (x === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
  }
  context.stroke();
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  for (const center of [256, 768]) {
    context.font = 'italic bold 57px Georgia, serif';
    context.lineWidth = 1.6;
    context.strokeStyle = '#dcaa78';
    context.strokeText('Wilson', center, 209);
    context.fillStyle = '#24251f';
    context.fillText('Wilson', center, 209);
    context.font = 'bold 10px Arial, sans-serif';
    context.fillText('OFFICIAL GAME BALL', center, 292);
    context.font = '8px Arial, sans-serif';
    context.fillText('GENUINE LEATHER', center, 305);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function BasketballFallback() {
  return (
    <svg className="basketball-fallback" viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <radialGradient id="basketball-light" cx="32%" cy="25%" r="76%">
          <stop offset="0" stopColor="#eea05d" />
          <stop offset="0.55" stopColor="#ca6c32" />
          <stop offset="1" stopColor="#8e421f" />
        </radialGradient>
        <pattern id="basketball-pebbles" width="3" height="3" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="0.9" fill="#482515" opacity=".24" />
          <circle cx="1.3" cy="1.2" r="0.55" fill="#efb777" opacity=".3" />
        </pattern>
      </defs>
      <circle cx="50" cy="50" r="46" fill="url(#basketball-light)" stroke="#34211a" strokeWidth="3" />
      <circle cx="50" cy="50" r="45" fill="url(#basketball-pebbles)" />
      <path d="M4 50h92M8 32Q50 9 92 32M8 69Q50 95 92 69" fill="none" stroke="#282620" strokeWidth="2" strokeLinecap="round" />
      <text x="50" y="43" textAnchor="middle" fill="#24251f" fontFamily="Georgia, serif" fontWeight="bold" fontStyle="italic" fontSize="18">Wilson</text>
      <text x="50" y="65" textAnchor="middle" fill="#24251f" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="4">OFFICIAL GAME BALL</text>
    </svg>
  );
}

export function BasketballWorld() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return mounted ? <BasketballSimulation /> : null;
}

function BasketballSimulation() {
  const pathname = usePathname();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hitRef = useRef<HTMLButtonElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const hoopLayerRef = useRef<SVGSVGElement>(null);
  const hiddenRef = useRef(false);
  const rebuildRef = useRef<() => void>(() => {});
  const controlsRef = useRef<Controls>({ grab: () => {}, key: () => {}, reset: () => {} });
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    rebuildRef.current();
  }, [pathname]);

  useEffect(() => {
    const stored = sessionStorage.getItem(HIDDEN_KEY) === '1';
    hiddenRef.current = stored;
    const timer = window.setTimeout(() => setHidden(stored), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    hiddenRef.current = hidden;
    sessionStorage.setItem(HIDDEN_KEY, hidden ? '1' : '0');
    if (!hidden) controlsRef.current.reset();
  }, [hidden]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const hit = hitRef.current;
    const shadow = shadowRef.current;
    if (!canvas || !hit || !shadow) return;

    const engine = Matter.Engine.create({ enableSleeping: true, positionIterations: 12, velocityIterations: 10 });
    engine.gravity.y = 1;
    engine.gravity.scale = 0.0015;
    const world = engine.world;
    let radius = window.innerWidth <= 700 ? 21 : 27;
    const ball = Matter.Bodies.circle(window.innerWidth - radius - 64, Math.min(120, window.innerHeight * 0.18), radius, {
      label: 'basketball',
      restitution: 0.68,
      friction: 0.09,
      frictionAir: 0.012,
      density: 0.0022,
      sleepThreshold: 75,
    });
    Matter.Composite.add(world, ball);

    let renderer: THREE.WebGLRenderer | null = null;
    let mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial> | null = null;
    let scene: THREE.Scene | null = null;
    let camera: THREE.OrthographicCamera | null = null;
    let texture: THREE.CanvasTexture | null = null;
    let spinY = 0;
    const fallback = hit.querySelector<SVGElement>('.basketball-fallback')!;
    const showFallback = () => {
      canvas.style.visibility = 'hidden';
      fallback.style.display = 'block';
    };
    showFallback();
    const contextLost = (event: Event) => {
      event.preventDefault();
      showFallback();
    };
    canvas.addEventListener('webglcontextlost', contextLost);
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);
      scene = new THREE.Scene();
      camera = new THREE.OrthographicCamera(-window.innerWidth / 2, window.innerWidth / 2, window.innerHeight / 2, -window.innerHeight / 2, 0.1, 2000);
      camera.position.z = 1000;
      texture = createBallTexture();
      mesh = new THREE.Mesh(
        new THREE.SphereGeometry(1, 48, 32),
        new THREE.MeshStandardMaterial({ color: 0xffffff, map: texture, bumpMap: texture, bumpScale: 0.3, roughness: 0.92, metalness: 0 }),
      );
      mesh.scale.setScalar(radius);
      scene.add(mesh);
      scene.add(new THREE.HemisphereLight(0xfff5e8, 0x4a3026, 1.5));
      const light = new THREE.DirectionalLight(0xffffff, 2.2);
      light.position.set(-240, 360, 700);
      scene.add(light);
    } catch {
      renderer?.dispose();
      renderer = null;
    }

    type Hoop = { id: string; x: number; y: number; width: number; depth: number; entered: boolean; locked: boolean; hitAt: number };
    let hoops: Hoop[] = [];
    let rims: Matter.Body[] = [];
    let shotActive = false;
    const clearShots = () => { shotActive = false; hoops.forEach(h => { h.entered = false; h.locked = false; }); };
    let boundaries: Matter.Body[] = [];
    let obstacles: Matter.Body[] = [];
    let obstacleRects: DOMRect[] = [];
    let rebuildFrame = 0;
    let resizeObserver: ResizeObserver | null = null;

    const positionOutsideRects = () => {
      let x = ball.position.x;
      let y = ball.position.y;
      for (let pass = 0; pass < 3; pass += 1) {
        for (const rect of obstacleRects) {
          const nearestX = Math.max(rect.left, Math.min(x, rect.right));
          const nearestY = Math.max(rect.top, Math.min(y, rect.bottom));
          let dx = x - nearestX;
          let dy = y - nearestY;
          if (dx * dx + dy * dy >= radius * radius) continue;
          if (dx === 0 && dy === 0) {
            const choices = [
              { distance: Math.abs(x - rect.left), x: rect.left - radius - 2, y },
              { distance: Math.abs(rect.right - x), x: rect.right + radius + 2, y },
              { distance: Math.abs(y - rect.top), x, y: rect.top - radius - 2 },
              { distance: Math.abs(rect.bottom - y), x, y: rect.bottom + radius + 2 },
            ].sort((a, b) => a.distance - b.distance);
            x = choices[0].x;
            y = choices[0].y;
          } else {
            const distance = Math.max(Math.hypot(dx, dy), 0.001);
            dx /= distance;
            dy /= distance;
            x = nearestX + dx * (radius + 2);
            y = nearestY + dy * (radius + 2);
          }
        }
      }
      x = Math.max(radius, Math.min(window.innerWidth - radius, x));
      y = Math.max(radius, Math.min(document.documentElement.scrollHeight - radius, y));
      if (x !== ball.position.x || y !== ball.position.y) {
        Matter.Body.setPosition(ball, { x, y });
        Matter.Body.setVelocity(ball, { x: ball.velocity.x * 0.35, y: ball.velocity.y * 0.35 });
      }
    };

    const rebuild = () => {
      if (rebuildFrame) cancelAnimationFrame(rebuildFrame);
      rebuildFrame = requestAnimationFrame(() => {
        rebuildFrame = 0;
        Matter.Composite.remove(world, [...boundaries, ...obstacles, ...rims]);
        const oldHoops = hoops;
        hoops = Array.from(document.querySelectorAll<SVGSVGElement>('[data-project-hoop]')).map(element => {
          element.style.width = `${(radius * 2 * 1.8 + 6) * 1.2}px`;
          const r = element.getBoundingClientRect();
          const id = element.dataset.projectHoop!;
          const previous = oldHoops.find(h => h.id === id);
          const x = r.left + window.scrollX + r.width / 2, y = r.top + window.scrollY + r.width / 6;
          const stable = previous && Math.abs(previous.x-x) < .5 && Math.abs(previous.y-y) < .5 && Math.abs(previous.width-r.width*5/6) < .5;
          return { id, x, y, width: r.width * 5/6, depth: r.width * .5, entered: stable ? previous.entered : false, locked: stable ? previous.locked : false, hitAt: previous?.hitAt ?? 0 };
        });
        rims = hoops.flatMap(h => [-1,1].map(side => Matter.Bodies.circle(h.x + side*h.width/2, h.y, 3, { isStatic: true, restitution: .65, friction: .05, label: 'hoop-rim' })));
        Matter.Composite.add(world, rims);
        const layer = hoopLayerRef.current;
        if (layer) layer.innerHTML = hoops.map(() => '<g><g class="physical-net" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M12 24L28 76Q60 85 92 76L108 24M23 27L85 79M40 29L97 60M58 29L103 43M97 27L35 79M80 29L23 60M62 29L17 43M17 42Q60 60 103 42M23 60Q60 78 97 60M28 76Q60 85 92 76" stroke="#534536" stroke-opacity=".24" stroke-width="2.8" transform="translate(0 1)"/><path d="M12 24L28 76Q60 85 92 76L108 24M23 27L85 79M40 29L97 60M58 29L103 43M97 27L35 79M80 29L23 60M62 29L17 43M17 42Q60 60 103 42M23 60Q60 78 97 60M28 76Q60 85 92 76" stroke="#fff9e9" stroke-width="1.5"/></g><path d="M10 21C10 34 110 34 110 21" fill="none" stroke="#783d2b" stroke-width="5"/><path d="M10 19.5C10 32.5 110 32.5 110 19.5" fill="none" stroke="#c97650" stroke-width="3.5"/><path d="M15 24Q60 37 105 24" fill="none" stroke="#edb48b" stroke-width="1" stroke-linecap="round"/></g>').join('');
        const width = window.innerWidth;
        const height = Math.max(window.innerHeight, document.documentElement.scrollHeight);
        const wall = 120;
        boundaries = [
          Matter.Bodies.rectangle(width / 2, -wall / 2, width + wall * 2, wall, { isStatic: true, label: 'viewport-top' }),
          Matter.Bodies.rectangle(width / 2, height + wall / 2, width + wall * 2, wall, { isStatic: true, label: 'viewport-floor', friction: 0.22 }),
          Matter.Bodies.rectangle(-wall / 2, height / 2, wall, height + wall * 2, { isStatic: true, label: 'viewport-left' }),
          Matter.Bodies.rectangle(width + wall / 2, height / 2, wall, height + wall * 2, { isStatic: true, label: 'viewport-right' }),
        ];
        obstacleRects = collectColliderRects();
        obstacles = obstacleRects.map((rect, index) => Matter.Bodies.rectangle(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
          rect.width,
          rect.height,
          { isStatic: true, label: `page-obstacle-${index}`, friction: 0.16, restitution: 0.36 },
        ));
        Matter.Composite.add(world, [...boundaries, ...obstacles]);
        positionOutsideRects();
      });
    };
    rebuildRef.current = rebuild;

    const resize = () => {
      const nextRadius = window.innerWidth <= 700 ? 21 : 27;
      if (nextRadius !== radius) {
        const scale = nextRadius / radius;
        Matter.Body.scale(ball, scale, scale);
        radius = nextRadius;
        mesh?.scale.setScalar(radius);
      }
      if (renderer && camera) {
        renderer.setSize(window.innerWidth, window.innerHeight, false);
        camera.left = -window.innerWidth / 2;
        camera.right = window.innerWidth / 2;
        camera.top = window.innerHeight / 2;
        camera.bottom = -window.innerHeight / 2;
        camera.updateProjectionMatrix();
      }
      rebuild();
    };

    const reset = () => {
      clearShots();
      const x = Math.max(radius + 20, window.innerWidth - radius - 64);
      const y = window.scrollY + Math.max(radius + 20, Math.min(120, window.innerHeight * 0.18));
      Matter.Body.setPosition(ball, { x, y });
      Matter.Body.setVelocity(ball, { x: -3.1, y: 0 });
      Matter.Body.setAngularVelocity(ball, -0.045);
      Matter.Body.setAngle(ball, 0);
      Matter.Sleeping.set(ball, false);
      positionOutsideRects();
    };

    let dragging = false;
    let dragTarget: Matter.Vector | null = null;
    let dragOffset = { x: 0, y: 0 };
    let grabbedPointer: number | null = null;
    let pointerHistory: PointerSample[] = [];

    const grab = (event: React.PointerEvent<HTMLButtonElement>) => {
      if (hiddenRef.current || dragging || !event.isPrimary || event.button !== 0) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      dragging = true;
      clearShots();
      grabbedPointer = event.pointerId;
      pointerHistory = [{ x: event.pageX, y: event.pageY, time: performance.now() }];
      Matter.Sleeping.set(ball, false);
      dragOffset = { x: event.pageX - ball.position.x, y: event.pageY - ball.position.y };
      dragTarget = { x: ball.position.x, y: ball.position.y };
    };

    const release = () => {
      if (!dragging) return;
      dragging = false;
      shotActive = true;
      if (grabbedPointer !== null && hit.hasPointerCapture(grabbedPointer)) hit.releasePointerCapture(grabbedPointer);
      grabbedPointer = null;
      dragTarget = null;
      const now = performance.now();
      const recent = pointerHistory.filter(sample => now - sample.time <= 100);
      if (recent.length > 1) {
        const first = recent[0];
        const last = recent.at(-1)!;
        const elapsed = Math.max(last.time - first.time, 16);
        Matter.Body.setVelocity(ball, {
          x: (last.x - first.x) / elapsed * STEP,
          y: (last.y - first.y) / elapsed * STEP,
        });
        clampVelocity(ball);
      }
      pointerHistory = [];
    };

    const pointerMove = (event: PointerEvent) => {
      const now = performance.now();
      const sample = { x: event.pageX, y: event.pageY, time: now };
      if (dragging && dragTarget && event.pointerId === grabbedPointer) {
        dragTarget.x = event.pageX - dragOffset.x;
        dragTarget.y = event.pageY - dragOffset.y;
        pointerHistory.push(sample);
        pointerHistory = pointerHistory.filter(item => now - item.time <= 130);
      }
    };

    const key = (event: React.KeyboardEvent<HTMLButtonElement>) => {
      let x = ball.velocity.x;
      let y = ball.velocity.y;
      if (event.key === 'ArrowLeft') x -= 5;
      else if (event.key === 'ArrowRight') x += 5;
      else if (event.key === 'ArrowUp') y -= 5;
      else if (event.key === 'ArrowDown') y += 5;
      else if (event.key === ' ') y = Math.min(y, -13);
      else return;
      event.preventDefault();
      shotActive = true;
      Matter.Sleeping.set(ball, false);
      Matter.Body.setVelocity(ball, { x, y });
      clampVelocity(ball);
    };

    controlsRef.current = { grab, key, reset };
    window.addEventListener('pointermove', pointerMove, { passive: true });
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    window.addEventListener('blur', release);
    hit.addEventListener('lostpointercapture', release);
    window.addEventListener('resize', resize);
    resizeObserver = new ResizeObserver(rebuild);
    resizeObserver.observe(document.documentElement);
    const observeContent = () => {
      resizeObserver?.disconnect();
      resizeObserver?.observe(document.documentElement);
      document.querySelectorAll('main, header, footer, img, svg, p, h1, h2, h3, a, .project-cover').forEach(element => {
        if (!element.closest('.basketball-world')) resizeObserver?.observe(element);
      });
      rebuild();
    };
    const contentObserver = new MutationObserver(records => {
      if (records.some(record => !(record.target instanceof Element ? record.target : record.target.parentElement)?.closest('.basketball-world'))) observeContent();
    });
    contentObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
    document.addEventListener('load', rebuild, true);
    document.fonts.addEventListener('loadingdone', rebuild);
    observeContent();

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    resize();
    reset();
    if (reducedMotion.matches) Matter.Sleeping.set(ball, true);

    let frame = 0;
    let previous = performance.now();
    let accumulator = 0;
    const render = (now: number) => {
      frame = requestAnimationFrame(render);
      if (document.visibilityState === 'hidden') {
        if (hiddenRef.current && canvas.parentElement) canvas.parentElement.style.visibility = 'visible';
        previous = now;
        return;
      }
      accumulator += hiddenRef.current ? 0 : Math.min(now - previous, 50);
      previous = now;
      const speed = Matter.Body.getSpeed(ball) * 60;
      const substeps = dragging ? 12 : Math.max(4, Math.ceil(speed / 240));
      while (accumulator >= STEP) {
        for (let step = 0; step < substeps; step += 1) {
          if (dragging && dragTarget) {
            // Apply force before collision solving. Constraints can teleport a body
            // through a thin collider when the pointer jumps to the opposite side.
            const dx = dragTarget.x - ball.position.x;
            const dy = dragTarget.y - ball.position.y;
            let ax = dx * 0.00012 - Matter.Body.getVelocity(ball).x * 0.0018;
            let ay = dy * 0.00012 - Matter.Body.getVelocity(ball).y * 0.0018 - engine.gravity.scale;
            const magnitude = Math.hypot(ax, ay);
            if (magnitude > 0.025) { ax *= 0.025 / magnitude; ay *= 0.025 / magnitude; }
            Matter.Sleeping.set(ball, false);
            Matter.Body.applyForce(ball, ball.position, { x: ax * ball.mass, y: ay * ball.mass });
          }
          clampVelocity(ball);
          const before = { ...ball.position };
          Matter.Engine.update(engine, STEP / substeps);
          for (const h of hoops) {
            const p = ball.position;
            if (h.locked) { if (p.y > h.y+h.depth+radius*2 || Math.abs(p.x-h.x)>h.width) h.locked=false; continue; }
            if (!shotActive || dragging) { h.entered=false; continue; }
            const downward = p.y > before.y;
            const crossX = (line: number) => before.x+(p.x-before.x)*(line-before.y)/(p.y-before.y);
            if (!h.entered && downward && before.y < h.y && p.y >= h.y && Math.abs(crossX(h.y)-h.x) <= h.width/2-radius-3) h.entered=true;
            if (h.entered && (p.y < h.y-radius || Math.abs(p.x-h.x)>h.width/2-radius+3)) h.entered=false;
            if (h.entered && downward && before.y < h.y+h.depth && p.y >= h.y+h.depth) {
              h.entered=false; h.locked=true; h.hitAt=performance.now();
              window.dispatchEvent(new CustomEvent('jiuheng:score', { detail: h.id }));
            }
          }
          clampVelocity(ball);
        }
        spinY += ball.velocity.x / Math.max(radius, 1) * 0.27;
        accumulator -= STEP;
      }
      if (!Number.isFinite(ball.position.x) || !Number.isFinite(ball.position.y) || Matter.Body.getSpeed(ball) > MAX_THROW * 1.35) reset();

      const layer = hoopLayerRef.current;
      if (layer) {
        layer.setAttribute('viewBox', `0 0 ${window.innerWidth} ${window.innerHeight}`);
        hoops.forEach((h,i) => {
          const group = layer.children[i];
          const scale = h.width/100;
          group?.setAttribute('transform', `translate(${h.x-window.scrollX-60*scale} ${h.y-window.scrollY-20*scale}) scale(${scale})`);
          const t = (now-h.hitAt)/400;
          const stretch = !reducedMotion.matches && t>=0 && t<1 ? 1+.16*Math.sin(t*Math.PI) : 1;
          group?.firstElementChild?.setAttribute('transform', `translate(0 20) scale(1 ${stretch}) translate(0 -20)`);
        });
      }
      const x = ball.position.x - window.scrollX;
      const y = ball.position.y - window.scrollY;
      hit.style.width = `${radius * 2}px`;
      hit.style.height = `${radius * 2}px`;
      hit.style.transform = `translate3d(${x - radius}px, ${y - radius}px, 0)`;
      hit.style.visibility = 'visible';
      hit.style.setProperty('--basketball-angle', `${-ball.angle}rad`);
      shadow.style.width = `${radius * 1.75}px`;
      shadow.style.height = `${radius * 0.42}px`;
      shadow.style.transform = `translate3d(${x - radius * 0.875}px, ${y + radius * 0.72}px, 0)`;
      shadow.style.opacity = `${Math.max(0.08, 0.3 - Math.abs(window.innerHeight - radius - y) / 620)}`;
      if (renderer && scene && camera && mesh) {
        mesh.position.set(x - window.innerWidth / 2, window.innerHeight / 2 - y, 0);
        mesh.rotation.set(-ball.angle * 0.55, spinY, -ball.angle);
        if (!renderer.getContext().isContextLost()) {
          try {
            renderer.render(scene, camera);
            canvas.style.visibility = 'visible';
            fallback.style.display = 'none';
          } catch {
            showFallback();
          }
        }
      }
      // Reveal only after dimensions, projection and position are ready.
      const canvasLayer = canvas.parentElement;
      if (canvasLayer) canvasLayer.style.visibility = 'visible';
    };
    frame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frame);
      if (rebuildFrame) cancelAnimationFrame(rebuildFrame);
      window.removeEventListener('pointermove', pointerMove);
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      window.removeEventListener('blur', release);
      hit.removeEventListener('lostpointercapture', release);
      window.removeEventListener('resize', resize);
      resizeObserver?.disconnect();
      contentObserver.disconnect();
      document.removeEventListener('load', rebuild, true);
      document.fonts.removeEventListener('loadingdone', rebuild);
      canvas.removeEventListener('webglcontextlost', contextLost);
      texture?.dispose();
      mesh?.geometry.dispose();
      mesh?.material.dispose();
      renderer?.dispose();
      Matter.Engine.clear(engine);
      rebuildRef.current = () => {};
    };
  }, []);

  return (
    <div
      className={`basketball-world${hidden ? ' is-hidden' : ''}`}
      aria-label="互动篮球"
      style={{ visibility: 'hidden' }}
    >
      <div className="basketball-shadow" ref={shadowRef} aria-hidden="true" />
      <canvas className="basketball-canvas" ref={canvasRef} aria-hidden="true" />
      <button
        ref={hitRef}
        className="basketball-hit-target"
        style={{ width: 54, height: 54, visibility: 'hidden' }}
        type="button"
        aria-label="互动篮球。按住拖动后松开可以投掷，方向键可以推动，空格键可以向上抛球。从上方投进作品封面的篮筐可以表示喜欢。"
        aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Space"
        onPointerDown={event => controlsRef.current.grab(event)}
        onKeyDown={event => controlsRef.current.key(event)}
      >
        <BasketballFallback />
      </button>
      <svg ref={hoopLayerRef} className="basketball-hoop-front" aria-hidden="true" />
      <div className="basketball-controls" aria-label="篮球控制">
        <button type="button" onClick={() => setHidden(value => !value)} aria-pressed={hidden}>{hidden ? '显示篮球' : '收起篮球'}</button>
        {!hidden && <button type="button" onClick={() => controlsRef.current.reset()}>重置</button>}
      </div>
    </div>
  );
}
