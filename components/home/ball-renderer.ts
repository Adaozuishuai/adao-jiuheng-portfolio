import * as THREE from 'three';
import { BALL_SEAMS, ballAngles } from './ball-geometry';

// Decode a baked local texture and warm shaders before exposing the canvas.
export async function createBallRenderer(
  canvas: HTMLCanvasElement,
  diameter: number,
) {
  const texture = await new THREE.TextureLoader().loadAsync(
    '/images/home/basketball-leather-plain.webp',
  );
  texture.colorSpace = THREE.SRGBColorSpace;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'low-power',
    });
  } catch (error) {
    texture.dispose();
    throw error;
  }
  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, window.innerWidth <= 700 ? 1.25 : 1.75),
  );
  renderer.setSize(diameter, diameter, false);
  let currentSize = diameter;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1.1, 1.1, 1.1, -1.1, 0.1, 20);
  camera.position.z = 5;
  scene.add(new THREE.HemisphereLight('#fff8e9', '#463426', 2.2));
  const light = new THREE.DirectionalLight('#fff4df', 3.2);
  light.position.set(-3, 4, 5);
  scene.add(light);
  const geometry = new THREE.SphereGeometry(
    1,
    window.innerWidth <= 700 ? 32 : 48,
    32,
  );
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    bumpMap: texture,
    bumpScale: 0.022,
    roughness: 0.88,
    metalness: 0,
  });
  const ball = new THREE.Mesh(geometry, material);
  const seamMaterial = new THREE.MeshStandardMaterial({
    color: '#30231c',
    roughness: 1,
  });
  const seamGeometry = BALL_SEAMS.map((points) => {
    const curve = new THREE.CatmullRomCurve3(
      points
        .slice(0, -1)
        .map((p) => new THREE.Vector3(...p).multiplyScalar(0.997)),
      true,
    );
    const geometry = new THREE.TubeGeometry(curve, 160, 0.014, 4, true);
    ball.add(new THREE.Mesh(geometry, seamMaterial));
    return geometry;
  });
  ball.rotation.set(...ballAngles(0));
  scene.add(ball);
  let lost = false;
  const onLost = (event: Event) => {
    event.preventDefault();
    lost = true;
    canvas.parentElement?.removeAttribute('data-webgl');
  };
  canvas.addEventListener('webglcontextlost', onLost);
  const dispose = () => {
    canvas.removeEventListener('webglcontextlost', onLost);
    texture.dispose();
    geometry.dispose();
    material.dispose();
    seamGeometry.forEach((g) => g.dispose());
    seamMaterial.dispose();
    renderer.dispose();
  };
  try {
    // compileAsync uses parallel shader compilation when the driver supports it.
    renderer.initTexture(texture);
    await renderer.compileAsync(scene, camera);
    renderer.render(scene, camera);
  } catch (error) {
    dispose();
    throw error;
  }
  return {
    draw(rotation: number) {
      if (lost) return false;
      ball.rotation.set(...ballAngles(rotation));
      renderer.render(scene, camera);
      return true;
    },
    resize(size: number) {
      if (size === currentSize) return;
      currentSize = size;
      renderer.setSize(size, size, false);
    },
    dispose,
  };
}
