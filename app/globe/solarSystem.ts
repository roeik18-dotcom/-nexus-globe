/**
 * Philos · Solar System — ambient spatial atmosphere around the globe.
 *
 * VISUAL ONLY. This adds a subtle solar-system environment (sun glow, tilted
 * orbital rings, slow-moving glowing bodies, a faint starfield) into the existing
 * react-globe.gl THREE scene. It expresses the Philos origin — Space → Base
 * Oppositions → Earth / Human Network → Value Flow — without competing with the
 * globe, which remains the focus.
 *
 * No data, no calculations, no app state, no interactivity. It only adds
 * decorative objects to the scene and animates their transforms. Call the
 * returned function to remove everything and dispose resources.
 */

import * as THREE from "three";

// three-globe renders the globe at radius 100; everything is sized relative to it.
const GLOBE_RADIUS = 100;

/** A soft radial-gradient sprite texture for additive glows. Client-only. */
function makeGlowTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,0.55)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

interface RingDef {
  radius: number;
  tiltX: number;
  tiltZ: number;
  ringColor: number;
  body: { size: number; color: number; speed: number; phase: number };
}

const RINGS: RingDef[] = [
  { radius: 150, tiltX: 0.55, tiltZ: 0.18, ringColor: 0x2f5d7c, body: { size: 4, color: 0x6cc6ff, speed: 0.16, phase: 0.0 } },
  { radius: 195, tiltX: -0.30, tiltZ: -0.22, ringColor: 0x3a4d7a, body: { size: 6, color: 0xa78bfa, speed: 0.12, phase: 1.3 } },
  { radius: 250, tiltX: 0.80, tiltZ: 0.10, ringColor: 0x2c6b63, body: { size: 3, color: 0x00f5d4, speed: 0.09, phase: 2.7 } },
  { radius: 305, tiltX: -0.55, tiltZ: 0.30, ringColor: 0x6b4a6e, body: { size: 7, color: 0xf472b6, speed: 0.065, phase: 4.0 } },
  { radius: 360, tiltX: 0.22, tiltZ: -0.14, ringColor: 0x5a4b2f, body: { size: 5, color: 0xfb923c, speed: 0.05, phase: 5.2 } },
];

/**
 * Create the ambient solar system inside the given THREE scene.
 * Returns a cleanup function that removes the group, stops the animation loop,
 * and disposes all geometries / materials / textures.
 */
export function createSolarSystem(scene: THREE.Scene): () => void {
  const group = new THREE.Group();
  group.name = "philos-solar-system";

  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(x: T): T => {
    disposables.push(x);
    return x;
  };

  const glowTex = track(makeGlowTexture());

  // ── Faint starfield (kept within the camera far plane to avoid clipping) ──
  const STAR_COUNT = 1100;
  const starGeo = track(new THREE.BufferGeometry());
  const positions = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i++) {
    const r = 720 + Math.random() * 430;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const starMat = track(new THREE.PointsMaterial({
    color: 0x9fc7ff, size: 2.0, sizeAttenuation: true,
    transparent: true, opacity: 0.45, depthWrite: false,
  }));
  const stars = new THREE.Points(starGeo, starMat);
  group.add(stars);

  // ── Sun glow on one side (no light added — the globe's own lighting is kept) ──
  const sunGroup = new THREE.Group();
  sunGroup.position.set(-560, 200, -320);
  const sunCore = new THREE.Mesh(
    track(new THREE.SphereGeometry(42, 32, 32)),
    track(new THREE.MeshBasicMaterial({ color: 0xfff1c2, transparent: true, opacity: 0.85, depthWrite: false })),
  );
  sunGroup.add(sunCore);
  const sunGlow = new THREE.Sprite(track(new THREE.SpriteMaterial({
    map: glowTex, color: 0xffd27a, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false,
  })));
  sunGlow.scale.set(380, 380, 1);
  sunGroup.add(sunGlow);
  group.add(sunGroup);

  // ── Orbital rings + slow-moving glowing bodies ──
  const orbits: Array<{ pivot: THREE.Object3D; speed: number }> = [];
  for (const def of RINGS) {
    const plane = new THREE.Group();      // tilts the orbital plane in space
    plane.rotation.x = Math.PI / 2 + def.tiltX;
    plane.rotation.z = def.tiltZ;

    const ringGeo = track(new THREE.RingGeometry(def.radius - 0.7, def.radius + 0.7, 128));
    const ringMat = track(new THREE.MeshBasicMaterial({
      color: def.ringColor, transparent: true, opacity: 0.12,
      side: THREE.DoubleSide, depthWrite: false,
    }));
    plane.add(new THREE.Mesh(ringGeo, ringMat));

    const orbit = new THREE.Group();      // rotates the body around the plane
    orbit.rotation.z = def.body.phase;
    const bodyMesh = new THREE.Mesh(
      track(new THREE.SphereGeometry(def.body.size, 16, 16)),
      track(new THREE.MeshBasicMaterial({ color: def.body.color, transparent: true, opacity: 0.85 })),
    );
    bodyMesh.position.set(def.radius, 0, 0);
    const bodyGlow = new THREE.Sprite(track(new THREE.SpriteMaterial({
      map: glowTex, color: def.body.color, transparent: true, opacity: 0.4,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })));
    bodyGlow.scale.set(def.body.size * 6, def.body.size * 6, 1);
    bodyMesh.add(bodyGlow);
    orbit.add(bodyMesh);
    plane.add(orbit);

    group.add(plane);
    orbits.push({ pivot: orbit, speed: def.body.speed });
  }

  // Render behind/around the globe so the globe stays the focus.
  group.position.set(0, 0, 0);
  void GLOBE_RADIUS; // documents the scale the radii are relative to
  scene.add(group);

  // ── Slow, ambient animation (paused when the tab is hidden) ──
  const clock = new THREE.Clock();
  let raf = 0;
  let running = true;
  const tick = () => {
    if (!running) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    group.rotation.y += dt * 0.02; // very slow overall drift
    for (const o of orbits) o.pivot.rotation.z += dt * o.speed;
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  const onVisibility = () => {
    if (document.hidden) {
      running = false;
      if (raf) cancelAnimationFrame(raf);
    } else if (!running) {
      running = true;
      clock.getDelta(); // discard the long hidden gap
      raf = requestAnimationFrame(tick);
    }
  };
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    document.removeEventListener("visibilitychange", onVisibility);
    scene.remove(group);
    for (const d of disposables) {
      try { d.dispose(); } catch { /* ignore */ }
    }
  };
}
