import * as THREE from 'three';
import type { ProjectVisual } from '@/lib/content';

export type PaperItem = {
  id: string;
  title: string;
  mark: string;
  visual: ProjectVisual;
};
export type PaperState = {
  position: number;
  velocity: number;
  intro: number;
  hover: number;
};
export type PaperLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

// Both the visible pass and ID pass use exactly the same deformed vertices.
const vertexShader = `
  varying vec2 vUv;
  varying float vShade;
  uniform float uBend;
  uniform vec2 uSize;
  void main() {
    vUv = uv;
    vec3 p = position;
    float wave = sin(uv.x * 3.14159265);
    p.z += wave * uBend;
    p.y += wave * uBend * 0.24;
    p.x -= wave * uBend * 0.16;
    vShade = 1.0 - abs(cos(uv.x * 3.14159265) * uBend / uSize.x) * 1.5;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const fragmentShader = `
  uniform sampler2D uTexture;
  uniform vec2 uSize;
  uniform float uAspect;
  uniform vec2 uCrop;
  uniform float uHover;
  uniform float uPicking;
  uniform float uId;
  varying vec2 vUv;
  varying float vShade;
  void main() {
    if (uPicking > 0.5) { gl_FragColor = vec4(uId / 255.0, 0.0, 0.0, 1.0); return; }
    vec2 ratio = vec2(1.0);
    float aspect = uSize.x / uSize.y;
    if (aspect < uAspect) ratio.x = aspect / uAspect;
    else ratio.y = uAspect / aspect;
    vec2 coverUv = vUv * ratio + (1.0 - ratio) * uCrop;
    coverUv = (coverUv - 0.5) / (1.0 + uHover * 0.04) + 0.5;
    gl_FragColor = vec4(texture2D(uTexture, coverUv).rgb * vShade, 1.0);
    #include <colorspace_fragment>
  }
`;

function placeholder(item: PaperItem) {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 800;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createLinearGradient(0, 0, 1200, 800);
  gradient.addColorStop(0, '#e2e5e3');
  gradient.addColorStop(1, '#b7bfbe');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1200, 800);
  ctx.fillStyle = '#616d69';
  ctx.font = '500 220px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(item.visual.src ? item.title : item.mark, 1130, 550);
  return new THREE.CanvasTexture(canvas);
}

export async function createWorkPaperRenderer(
  canvas: HTMLCanvasElement,
  items: PaperItem[],
  signal: AbortSignal,
) {
  const textures = await Promise.all(
    items.map(async (item) => {
      if (!item.visual.src) return placeholder(item);
      try {
        const response = await fetch(item.visual.src, { signal });
        if (!response.ok) throw new Error('Cover unavailable');
        const bitmap = await createImageBitmap(await response.blob(), {
          imageOrientation: 'flipY',
        });
        const texture = new THREE.Texture(bitmap);
        texture.needsUpdate = true;
        return texture;
      } catch {
        return placeholder(item);
      }
    }),
  );
  const releaseTextures = () =>
    textures.forEach((texture) => {
      texture.dispose();
      if (texture.image instanceof ImageBitmap) texture.image.close();
    });
  if (signal.aborted) {
    releaseTextures();
    throw new Error('Gallery unmounted');
  }
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'low-power',
    });
  } catch (error) {
    releaseTextures();
    throw error;
  }
  renderer.debug.onShaderError = () => {
    throw new Error('Paper shader compilation failed');
  };
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 1, 10000);
  const picking = new THREE.WebGLRenderTarget(1, 1, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
  });
  const pixel = new Uint8Array(4);
  let geometry = new THREE.PlaneGeometry(1, 1, 48, 32);
  const meshes = textures.map((texture, index) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      side: THREE.DoubleSide,
      uniforms: {
        uTexture: { value: texture },
        uSize: { value: new THREE.Vector2(1, 1) },
        uAspect: { value: texture.image.width / texture.image.height },
        uCrop: { value: new THREE.Vector2(0.5, 0.5) },
        uBend: { value: 0 },
        uHover: { value: 0 },
        uPicking: { value: 0 },
        uId: { value: index + 1 },
      },
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    scene.add(mesh);
    return mesh;
  });
  let width = 1,
    height = 1,
    cardWidth = 1,
    cardHeight = 1,
    mobile = false;
  let disposed = false;
  const hoverValues = items.map(() => 0);
  const topLeft = new THREE.Vector3();
  const bottomRight = new THREE.Vector3();
  const bufferSize = new THREE.Vector2();
  let lastWidth = -1;
  let lastMobile = false;
  let lastDpr = 0;
  const resize = (nextWidth: number, isMobile: boolean) => {
    const nextDpr = Math.min(
      window.devicePixelRatio || 1,
      isMobile ? 1.25 : 1.5,
    );
    if (
      nextWidth === lastWidth &&
      isMobile === lastMobile &&
      nextDpr === lastDpr
    )
      return {
        height,
        cardWidth,
        cardHeight,
        step: cardWidth * (mobile ? 0.94 : 1) + (mobile ? 16 : 28),
      };
    lastWidth = nextWidth;
    lastMobile = isMobile;
    lastDpr = nextDpr;
    width = Math.max(1, nextWidth);
    mobile = isMobile;
    cardWidth = Math.min(width * (mobile ? 0.88 : 0.72), 1040);
    cardHeight = cardWidth * (mobile ? 1.25 : 0.625);
    height = cardHeight + 48;
    geometry.dispose();
    geometry = new THREE.PlaneGeometry(
      cardWidth,
      cardHeight,
      mobile ? 24 : 48,
      mobile ? 16 : 32,
    );
    camera.aspect = width / height;
    camera.position.z = height / (2 * Math.tan(THREE.MathUtils.degToRad(17.5)));
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    renderer.setPixelRatio(nextDpr);
    renderer.setSize(width, height, false);
    meshes.forEach((mesh, index) => {
      mesh.geometry = geometry;
      mesh.material.uniforms.uSize.value.set(cardWidth, cardHeight);
      const visual = items[index].visual;
      const crop =
        (mobile
          ? (visual.mobilePosition ?? visual.position)
          : visual.position) ?? '50% 50%';
      const [x, y] = crop.split(' ').map((value) => parseFloat(value) / 100);
      mesh.material.uniforms.uCrop.value.set(x, 1 - y);
    });
    return {
      height,
      cardWidth,
      cardHeight,
      step: cardWidth * (mobile ? 0.94 : 1) + (mobile ? 16 : 28),
    };
  };
  const draw = (
    state: PaperState,
    dt: number,
  ): { layouts: PaperLayout[]; hoverMoving: boolean } => {
    let hoverMoving = false;
    const step = cardWidth * (mobile ? 0.94 : 1) + (mobile ? 16 : 28);
    const layouts = meshes.map((mesh, index) => {
      const offset = index - state.position;
      const side = Math.max(-1, Math.min(1, offset));
      const focus = 1 - Math.min(1, Math.abs(offset));
      const localIntro = Math.max(
        0,
        Math.min(1, (state.intro - index * 0.08) / 1.2),
      );
      const spread = 1 - (1 - localIntro) ** 3;
      hoverValues[index] +=
        ((state.hover === index ? 1 : 0) - hoverValues[index]) *
        (1 - Math.exp(-12 * dt));
      if (
        Math.abs(hoverValues[index] - (state.hover === index ? 1 : 0)) > 0.001
      )
        hoverMoving = true;
      const hover = hoverValues[index];
      mesh.position.set(
        offset * step * spread,
        (1 - spread) * index * 3,
        -Math.abs(side) * cardWidth * 0.055 -
          (1 - spread) * index * 9 +
          hover * (1 - focus) * 18,
      );
      mesh.rotation.y =
        -side * 0.20944 * spread + (1 - spread) * (index - 1.5) * 0.045;
      mesh.scale.setScalar(1 - 0.08 * Math.abs(side));
      mesh.material.uniforms.uBend.value =
        Math.max(-1, Math.min(1, state.velocity / 4)) *
        cardWidth *
        0.06 *
        spread;
      mesh.material.uniforms.uHover.value = hover * focus;
      mesh.updateMatrixWorld();
      topLeft
        .set(-cardWidth / 2, cardHeight / 2, 0)
        .applyMatrix4(mesh.matrixWorld)
        .project(camera);
      bottomRight
        .set(cardWidth / 2, -cardHeight / 2, 0)
        .applyMatrix4(mesh.matrixWorld)
        .project(camera);
      return {
        x: ((topLeft.x + 1) * width) / 2,
        y: ((1 - topLeft.y) * height) / 2,
        width: ((bottomRight.x - topLeft.x) * width) / 2,
        height: ((topLeft.y - bottomRight.y) * height) / 2,
      };
    });
    renderer.render(scene, camera);
    return { layouts, hoverMoving };
  };
  const pick = (x: number, y: number) => {
    if (disposed || x < 0 || y < 0 || x >= width || y >= height) return -1;
    const size = renderer.getDrawingBufferSize(bufferSize);
    camera.setViewOffset(
      size.x,
      size.y,
      Math.floor((x / width) * size.x),
      Math.floor((y / height) * size.y),
      1,
      1,
    );
    meshes.forEach((mesh) => {
      mesh.material.uniforms.uPicking.value = 1;
    });
    try {
      renderer.setRenderTarget(picking);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.readRenderTargetPixels(picking, 0, 0, 1, 1, pixel);
      return pixel[3] ? pixel[0] - 1 : -1;
    } finally {
      renderer.setRenderTarget(null);
      camera.clearViewOffset();
      meshes.forEach((mesh) => {
        mesh.material.uniforms.uPicking.value = 0;
      });
    }
  };
  return {
    resize,
    draw,
    pick,
    dispose() {
      if (disposed) return;
      disposed = true;
      geometry.dispose();
      meshes.forEach((mesh) => mesh.material.dispose());
      picking.dispose();
      releaseTextures();
      renderer.dispose();
    },
  };
}
export type WorkPaperRenderer = Awaited<
  ReturnType<typeof createWorkPaperRenderer>
>;
