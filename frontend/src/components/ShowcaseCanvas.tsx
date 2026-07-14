"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";

type UpdateFn = (t: number, dt: number, hover: boolean) => void;

function mkBox(w: number, h: number, d: number, color: number) {
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshBasicMaterial({ color, transparent: true })
  );
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry),
    new THREE.LineBasicMaterial({ color: 0x0a0a0a, transparent: true })
  );
  g.add(mesh, edges);
  g.userData.mesh = mesh;
  return g;
}

function facePlane(w: number, h: number, tex: THREE.Texture) {
  return new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true })
  );
}

function cv(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const x = c.getContext("2d")!;
  x.imageSmoothingEnabled = false;
  return { c, x };
}

function tex(c: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(c);
  t.generateMipmaps = false;
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

function coverTex() {
  const { c, x } = cv(200, 280);
  x.fillStyle = "#FFE600"; x.fillRect(0, 0, 200, 280);
  x.strokeStyle = "#0A0A0A"; x.lineWidth = 14; x.strokeRect(7, 7, 186, 266);
  x.fillStyle = "#0A0A0A"; x.font = "900 30px monospace"; x.textAlign = "center";
  x.fillText("THE", 100, 118); x.fillText("GUIDE", 100, 154);
  x.fillStyle = "#FF3BFF"; x.fillRect(46, 196, 108, 16);
  x.fillStyle = "#00F5FF"; x.fillRect(46, 222, 74, 12);
  return tex(c);
}

function pageTex() {
  const { c, x } = cv(190, 260);
  x.fillStyle = "#ffffff"; x.fillRect(0, 0, 190, 260);
  x.fillStyle = "#0A0A0A";
  for (let i = 0; i < 9; i++) x.fillRect(24, 30 + i * 26, i % 3 === 0 ? 130 : 150, 6);
  return tex(c);
}

function cardTex() {
  const { c, x } = cv(200, 260);
  x.fillStyle = "#0A0A0A"; x.font = "900 22px monospace"; x.textAlign = "center";
  x.fillText("PRESET", 100, 48); x.fillText("PACK", 100, 76);
  x.strokeStyle = "#0A0A0A"; x.lineWidth = 4; x.strokeRect(40, 110, 120, 90);
  x.fillStyle = "#FF3BFF"; x.fillRect(48, 150, 104, 8);
  x.fillStyle = "#00F5FF"; x.fillRect(48, 170, 70, 8);
  x.fillStyle = "#0A0A0A"; x.fillRect(132, 146, 16, 16);
  return tex(c);
}

function screenTex() {
  const { c, x } = cv(360, 224);
  x.fillStyle = "#0A0A0A"; x.fillRect(0, 0, 360, 224);
  x.fillStyle = "rgba(0,245,255,0.08)"; x.fillRect(0, 0, 360, 224);
  x.fillStyle = "rgba(255,255,255,0.06)";
  for (let y = 0; y < 224; y += 4) x.fillRect(0, y, 360, 2);
  x.fillStyle = "#0A0A0A"; x.fillRect(40, 188, 280, 16);
  x.strokeStyle = "#FFE600"; x.lineWidth = 3; x.strokeRect(40, 188, 280, 16);
  x.fillStyle = "#FFE600"; x.fillRect(43, 191, 168, 10);
  return tex(c);
}

function waveTex() {
  const { c, x } = cv(220, 220);
  x.fillStyle = "#FF3BFF"; x.fillRect(0, 0, 220, 220);
  x.strokeStyle = "#0A0A0A"; x.lineWidth = 12; x.strokeRect(6, 6, 208, 208);
  x.fillStyle = "#0A0A0A";
  const hs = [28, 60, 42, 90, 50, 74, 36, 84, 46, 64, 30];
  hs.forEach((h, i) => x.fillRect(22 + i * 17, 110 - h / 2, 14, h));
  return tex(c);
}

function recordTex() {
  const { c, x } = cv(240, 240);
  x.save(); x.beginPath(); x.arc(120, 120, 118, 0, Math.PI * 2); x.clip();
  x.fillStyle = "#0A0A0A"; x.fillRect(0, 0, 240, 240);
  x.strokeStyle = "rgba(255,255,255,0.08)"; x.lineWidth = 2;
  for (let r = 46; r < 116; r += 8) { x.beginPath(); x.arc(120, 120, r, 0, Math.PI * 2); x.stroke(); }
  x.fillStyle = "#FF3BFF"; x.beginPath(); x.arc(120, 120, 40, 0, Math.PI * 2); x.fill();
  x.strokeStyle = "#0A0A0A"; x.lineWidth = 3; x.beginPath(); x.arc(120, 120, 40, 0, Math.PI * 2); x.stroke();
  x.fillStyle = "#0A0A0A"; x.beginPath(); x.arc(120, 120, 6, 0, Math.PI * 2); x.fill();
  x.restore(); return tex(c);
}

function noteTex() {
  const { c, x } = cv(64, 80);
  x.fillStyle = "#0A0A0A";
  x.fillRect(16, 46, 22, 18); x.fillRect(34, 14, 8, 40); x.fillRect(42, 14, 12, 8);
  return tex(c);
}

function templateTex() {
  const { c, x } = cv(200, 260);
  x.fillStyle = "#ffffff"; x.fillRect(0, 0, 200, 260);
  x.strokeStyle = "#0A0A0A"; x.lineWidth = 6; x.strokeRect(4, 4, 192, 252);
  x.fillStyle = "#FFE600"; x.fillRect(20, 22, 160, 40);
  x.strokeStyle = "#0A0A0A"; x.lineWidth = 4; x.strokeRect(20, 22, 160, 40);
  x.fillStyle = "#0A0A0A";
  for (let i = 0; i < 5; i++) x.fillRect(20, 84 + i * 22, i % 2 ? 120 : 150, 8);
  x.fillStyle = "#00F5FF"; x.fillRect(20, 210, 46, 30);
  x.fillStyle = "#FF3BFF"; x.fillRect(76, 210, 46, 30);
  x.strokeStyle = "#0A0A0A"; x.strokeRect(20, 210, 46, 30); x.strokeRect(76, 210, 46, 30);
  return tex(c);
}

function makeTriangle(size: number, color: number) {
  const s = size;
  const shape = new THREE.Shape();
  shape.moveTo(-s * 0.5, -s * 0.62);
  shape.lineTo(s * 0.62, 0);
  shape.lineTo(-s * 0.5, s * 0.62);
  shape.closePath();
  const geo = new THREE.ShapeGeometry(shape);
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true })));
  g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0x0a0a0a, transparent: true })));
  return g;
}

function buildBook(): { inner: THREE.Group; update: UpdateFn } {
  const inner = new THREE.Group();
  const cw = 1.0, ch = 1.4, cd = 0.07;
  const hingeL = new THREE.Group();
  const hingeR = new THREE.Group();
  inner.add(hingeL, hingeR);
  const front = mkBox(cw, ch, cd, 0xFFE600); front.position.x = cw / 2; hingeL.add(front);
  const face = facePlane(cw * 0.84, ch * 0.84, coverTex()); face.position.set(cw / 2, 0, cd / 2 + 0.01); hingeL.add(face);
  const pages = mkBox(cw * 0.96, ch * 0.92, 0.05, 0xffffff); pages.position.x = cw / 2; hingeR.add(pages);
  const pl = facePlane(cw * 0.8, ch * 0.78, pageTex()); pl.position.set(cw / 2, 0, 0.03); hingeR.add(pl);
  const spine = mkBox(0.1, ch, 0.18, 0x0a0a0a); inner.add(spine);
  const spineMat = (spine.userData.mesh as THREE.Mesh).material as THREE.MeshBasicMaterial;
  let open = 22;
  const update: UpdateFn = (t, _dt, hover) => {
    inner.position.y = Math.sin((t / 3) * Math.PI * 2) * 0.12;
    inner.rotation.y = THREE.MathUtils.degToRad(15) * Math.sin((t / 6) * Math.PI * 2);
    open += ((hover ? 45 : 22) - open) * 0.12;
    hingeL.rotation.y = THREE.MathUtils.degToRad(open);
    hingeR.rotation.y = -THREE.MathUtils.degToRad(open);
    spineMat.color.lerp(new THREE.Color(hover ? 0x00f5ff : 0x0a0a0a), 0.12);
  };
  return { inner, update };
}

function buildPresets(): { inner: THREE.Group; update: UpdateFn } {
  const inner = new THREE.Group();
  const colors = [0xFFE600, 0xFF3BFF, 0x00F5FF, 0xFF4D00, 0x0A0A0A];
  const cards: THREE.Group[] = [];
  colors.forEach((c) => { const card = mkBox(0.92, 1.25, 0.04, c); inner.add(card); cards.push(card); });
  const top = cards[0];
  const lab = facePlane(0.78, 1.05, cardTex()); lab.position.z = 0.03; top.add(lab);
  const baseFan = THREE.MathUtils.degToRad(7);
  const update: UpdateFn = (t, _dt, hover) => {
    inner.position.x = Math.sin((t / 5) * Math.PI * 2) * 0.12;
    inner.position.y = Math.sin((t / 4) * Math.PI * 2) * 0.05;
    const fanMul = hover ? 2.7 : (1 + Math.sin((t / 4) * Math.PI * 2) * 0.3);
    cards.forEach((card, k) => {
      const o = k - 2;
      card.rotation.z += (baseFan * o * fanMul - card.rotation.z) * 0.12;
      card.position.x += ((hover ? o * 0.5 : 0) - card.position.x) * 0.12;
      card.rotation.y += ((hover ? THREE.MathUtils.degToRad(26) * Math.sin(t * 2 + k) : 0) - card.rotation.y) * 0.1;
      card.position.z = k * 0.012;
    });
  };
  return { inner, update };
}

function buildVideo(): { inner: THREE.Group; update: UpdateFn } {
  const inner = new THREE.Group();
  const body = mkBox(2.0, 1.3, 0.16, 0x0a0a0a); inner.add(body);
  const screen = facePlane(1.8, 1.12, screenTex()); screen.position.z = 0.09; inner.add(screen);
  const neck = mkBox(0.2, 0.3, 0.18, 0x0a0a0a); neck.position.y = -0.82; inner.add(neck);
  const base = mkBox(0.92, 0.13, 0.42, 0xFFE600); base.position.y = -1.0; inner.add(base);
  const tri = makeTriangle(0.36, 0xFFE600); tri.position.z = 0.13; inner.add(tri);
  let flk = 0.9, flkNext = 0, spin = 0;
  const update: UpdateFn = (t, dt, hover) => {
    inner.position.y = Math.sin((t / 4) * Math.PI * 2) * 0.08;
    if (t > flkNext) { flk = 0.8 + Math.random() * 0.2; flkNext = t + 0.4 + Math.random() * 0.6; }
    (screen.material as THREE.MeshBasicMaterial).opacity = hover ? 1.0 : flk;
    tri.scale.setScalar(hover ? 1.0 : (1.04 + Math.sin(t * 4) * 0.04));
    spin = hover ? spin + dt * 9 : spin * 0.88;
    tri.rotation.z = spin;
  };
  return { inner, update };
}

function buildMusic(): { inner: THREE.Group; update: UpdateFn } {
  const inner = new THREE.Group();
  const sleeve = mkBox(1.32, 1.32, 0.06, 0xff3bff); sleeve.position.set(-0.18, 0, -0.12); inner.add(sleeve);
  const wave = facePlane(1.06, 1.06, waveTex()); wave.position.set(-0.18, 0, -0.085); inner.add(wave);
  const rec = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.04, 40), new THREE.MeshBasicMaterial({ color: 0x0a0a0a, transparent: true }));
  disc.rotation.x = Math.PI / 2; rec.add(disc);
  const grv = facePlane(1.2, 1.2, recordTex()); grv.position.z = 0.025; rec.add(grv);
  rec.position.set(0.28, 0, 0.2); inner.add(rec);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.76, 40), new THREE.MeshBasicMaterial({ color: 0x00f5ff, transparent: true, opacity: 0, side: THREE.DoubleSide }));
  ring.position.copy(rec.position); inner.add(ring);
  const notes: THREE.Mesh[] = [];
  for (let k = 0; k < 4; k++) { const n = facePlane(0.2, 0.24, noteTex()); inner.add(n); notes.push(n); }
  let spin = 0, ringP = 0;
  const update: UpdateFn = (t, dt, hover) => {
    inner.position.y = Math.sin((t / 6) * Math.PI * 2) * 0.07;
    spin += dt * (hover ? Math.PI : (Math.PI * 2) / 8); rec.rotation.z = spin;
    notes.forEach((n, k) => {
      const ph = ((t * 0.4) + k * 0.25) % 1;
      n.position.set(0.28 + Math.sin(k * 1.7) * 0.12, -0.2 + ph * 1.15, 0.34);
      (n.material as THREE.MeshBasicMaterial).opacity = Math.sin(ph * Math.PI) * (hover ? 1 : 0.75);
      const sc = 0.7 + ph * 0.5; n.scale.set(sc, sc, 1);
    });
    if (hover) {
      ringP = (ringP + dt * 1.6) % 1;
      ring.scale.setScalar(1 + ringP * 1.4);
      (ring.material as THREE.MeshBasicMaterial).opacity = (1 - ringP) * 0.6;
    } else {
      (ring.material as THREE.MeshBasicMaterial).opacity *= 0.8;
      ringP = 0;
    }
  };
  return { inner, update };
}

function buildTemplate(): { inner: THREE.Group; update: UpdateFn } {
  const inner = new THREE.Group();
  const docs: THREE.Group[] = [];
  for (let k = 0; k < 4; k++) {
    const d = mkBox(1.0, 1.3, 0.03, 0xffffff);
    d.userData.baseY = -k * 0.05;
    d.position.set(k * 0.035, -k * 0.05, -k * 0.05);
    docs.push(d); inner.add(d);
  }
  const topFace = facePlane(0.86, 1.12, templateTex()); topFace.position.z = 0.02; docs[0].add(topFace);
  const clip = mkBox(0.16, 0.34, 0.07, 0xFF4D00); clip.position.set(0.42, 0.52, 0.04); docs[0].add(clip);
  const update: UpdateFn = (t, _dt, hover) => {
    inner.position.y = Math.sin((t / 6) * Math.PI * 2) * 0.06;
    inner.rotation.x = -0.22 + Math.sin((t / 6) * Math.PI * 2) * 0.05;
    inner.rotation.z = Math.sin((t / 6) * Math.PI * 2 + 1) * 0.04;
    docs.forEach((d, k) => {
      if (hover) {
        d.position.y += ((d.userData.baseY + k * 0.34) - d.position.y) * 0.12;
        d.rotation.x += (-(k * 0.14) - d.rotation.x) * 0.12;
      } else {
        const phase = ((t / 5) * 4) % 4;
        const lift = Math.floor(phase) === k ? Math.sin((phase % 1) * Math.PI) * 0.18 : 0;
        d.position.y += ((d.userData.baseY + lift) - d.position.y) * 0.15;
        d.rotation.x += (0 - d.rotation.x) * 0.15;
      }
    });
  };
  return { inner, update };
}

interface ShowcaseObj {
  idx: number;
  holder: THREE.Group;
  base: { x: number; y: number; z: number };
  labelDrop: number;
  mats: THREE.Material[];
  update: UpdateFn;
  landed: boolean;
}

export default function ShowcaseCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    // Probe WebGL support on a throwaway canvas so the real canvas stays clean for Three.js
    let webglSupported = false;
    try {
      const probe = document.createElement("canvas");
      webglSupported = !!(probe.getContext("webgl") || probe.getContext("experimental-webgl"));
    } catch {}
    if (!webglSupported) {
      const fb = wrap.querySelector("[data-fallback]") as HTMLElement;
      if (fb) fb.style.display = "flex";
      canvas.style.display = "none";
      labelsRef.current.forEach((l) => { if (l) l.style.display = "none"; });
      return;
    }

    let W = wrap.clientWidth, H = wrap.clientHeight;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W, H, false);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 100);
    camera.position.set(0, 0, 7.4);
    camera.lookAt(0, 0, 0);

    const layout = [
      { pos: [-1.7, -0.7, 0.0], s: 1.0 },
      { pos: [-3.5, 0.95, 0.0], s: 0.92 },
      { pos: [0.0, 0.55, 0.2], s: 1.28 },
      { pos: [2.0, -0.65, 0.0], s: 1.0 },
      { pos: [3.6, 0.3, 0.0], s: 0.95 },
    ];
    const builders = [buildBook, buildPresets, buildVideo, buildMusic, buildTemplate];

    const objs: ShowcaseObj[] = [];
    const allPicks: THREE.Object3D[] = [];

    layout.forEach((L, i) => {
      const holder = new THREE.Group();
      holder.position.set(L.pos[0], L.pos[1], L.pos[2]);
      holder.scale.setScalar(L.s);
      const built = builders[i]();
      holder.add(built.inner);
      scene.add(holder);
      const mats: THREE.Material[] = [];
      holder.traverse((o) => {
        if ((o as THREE.Mesh).material) {
          const mat = (o as THREE.Mesh).material as THREE.Material;
          mat.transparent = true;
          mats.push(mat);
          if ((o as THREE.Mesh).isMesh) { o.userData.objIdx = i; allPicks.push(o); }
        }
      });
      objs.push({ idx: i, holder, base: { x: L.pos[0], y: L.pos[1], z: L.pos[2] }, labelDrop: 1.05 * L.s + 0.2, mats, update: built.update, landed: false });
    });

    // Dashed connecting lines
    const edges: { a: number; b: number; line: THREE.Line; mat: THREE.LineDashedMaterial; len: number; geo: THREE.BufferGeometry }[] = [];
    for (let a = 0; a < 5; a++) {
      for (let b = a + 1; b < 5; b++) {
        const pa = objs[a].base, pb = objs[b].base;
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.Float32BufferAttribute([pa.x, pa.y, pa.z, pb.x, pb.y, pb.z], 3));
        const len = Math.hypot(pb.x - pa.x, pb.y - pa.y, pb.z - pa.z);
        geo.setAttribute("lineDistance", new THREE.Float32BufferAttribute([0, len], 1));
        const mat = new THREE.LineDashedMaterial({ color: 0xFFE600, transparent: true, opacity: 0, dashSize: 0.16, gapSize: 0.12 });
        const line = new THREE.Line(geo, mat);
        line.renderOrder = -1;
        scene.add(line);
        edges.push({ a, b, line, mat, len, geo });
      }
    }

    // Hover picking
    const ray = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let hoverIdx = -1;
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      ray.setFromCamera(mouse, camera);
      const hits = ray.intersectObjects(allPicks, false);
      hoverIdx = hits.length ? (hits[0].object.userData.objIdx as number) : -1;
      canvas.style.cursor = hits.length ? "pointer" : "default";
    };
    const onLeave = () => { hoverIdx = -1; };
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);

    // Entrance animation (triggered by parent via IntersectionObserver)
    let entered = false;
    const startEntrance = () => {
      if (entered) return;
      entered = true;
      objs.forEach((o, i) => {
        const ang = Math.random() * Math.PI * 2;
        const dist = 2.8 + Math.random() * 1.2;
        o.holder.position.set(
          o.base.x + Math.cos(ang) * dist,
          o.base.y - 2.6 - Math.random() * 1.4,
          o.base.z + (Math.random() - 0.5) * 1.5
        );
        o.mats.forEach((m) => { (m as THREE.MeshBasicMaterial).opacity = 0; });

        const delay = i * 0.15 * 1000;
        const duration = 900;
        const startPos = { x: o.holder.position.x, y: o.holder.position.y, z: o.holder.position.z };
        const endPos = { x: o.base.x, y: o.base.y, z: o.base.z };
        const t0 = performance.now() + delay;

        const animate = () => {
          const now = performance.now();
          if (now < t0) { requestAnimationFrame(animate); return; }
          const p = Math.min((now - t0) / duration, 1);
          const ease = 1 - Math.pow(1 - p, 3);
          o.holder.position.set(
            startPos.x + (endPos.x - startPos.x) * ease,
            startPos.y + (endPos.y - startPos.y) * ease,
            startPos.z + (endPos.z - startPos.z) * ease
          );
          o.mats.forEach((m) => { (m as THREE.MeshBasicMaterial).opacity = Math.min(p * 2, 1); });
          if (p < 1) { requestAnimationFrame(animate); }
          else {
            o.landed = true;
            const lab = labelsRef.current[i];
            if (lab) {
              lab.style.transition = "opacity 0.4s, transform 0.4s";
              lab.style.opacity = "1";
              lab.style.transform = "translate(-50%, 0)";
            }
          }
        };
        requestAnimationFrame(animate);
      });
      edges.forEach((e) => {
        setTimeout(() => {
          const t0 = performance.now();
          const animEdge = () => {
            const p = Math.min((performance.now() - t0) / 600, 1);
            e.mat.opacity = p * 0.25;
            if (p < 1) requestAnimationFrame(animEdge);
          };
          requestAnimationFrame(animEdge);
        }, 500);
      });
    };

    if (typeof IntersectionObserver !== "undefined") {
      const io = new IntersectionObserver(
        (entries) => { if (entries[0].isIntersecting) startEntrance(); },
        { threshold: 0.3 }
      );
      io.observe(wrap);
    } else {
      startEntrance();
    }

    // Resize
    const onResize = () => {
      W = wrap.clientWidth; H = wrap.clientHeight;
      if (!W || !H) return;
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
      renderer.setSize(W, H, false);
    };
    window.addEventListener("resize", onResize);

    const clock = new THREE.Clock();
    const tmpV = new THREE.Vector3();
    let linePhase = 0;
    let raf = 0;
    let onScreen = true;

    if (typeof IntersectionObserver !== "undefined") {
      const io2 = new IntersectionObserver((es) => { onScreen = es[0].isIntersecting; }, { threshold: 0.01 });
      io2.observe(wrap);
    }

    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!onScreen) return;
      const dt = clock.getDelta();
      const t = clock.elapsedTime;

      objs.forEach((o, i) => {
        if (o.landed && o.update) o.update(t, dt, hoverIdx === i);
      });

      linePhase = (linePhase + dt * 0.7) % 0.28;
      edges.forEach((e) => {
        const arr = e.geo.attributes.lineDistance.array as Float32Array;
        arr[0] = linePhase; arr[1] = linePhase + e.len;
        e.geo.attributes.lineDistance.needsUpdate = true;
        const conn = e.a === hoverIdx || e.b === hoverIdx;
        const target = conn ? (0.85 + Math.sin(t * 8) * 0.15) : 0.25;
        e.mat.opacity += (target - e.mat.opacity) * 0.2;
      });

      // Project labels
      objs.forEach((o, i) => {
        const lab = labelsRef.current[i];
        if (!lab) return;
        tmpV.set(o.base.x, o.base.y - o.labelDrop, o.base.z);
        tmpV.project(camera);
        lab.style.left = `${(tmpV.x * 0.5 + 0.5) * W}px`;
        lab.style.top = `${(-tmpV.y * 0.5 + 0.5) * H}px`;
      });

      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
    };
  }, []);

  const LABELS = ["Ebooks", "Presets", "Courses", "Music", "Templates"];

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%", height: 560 }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />

      {LABELS.map((label, i) => (
        <div
          key={label}
          ref={(el) => { if (el) labelsRef.current[i] = el; }}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, 10px)",
            pointerEvents: "none",
            zIndex: 3,
            opacity: 0,
            transition: "none",
          }}
        >
          <span
            style={{
              display: "inline-block",
              background: "#FFE600",
              border: "3px solid #0A0A0A",
              boxShadow: "3px 3px 0 #0A0A0A",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              color: "#0A0A0A",
              padding: "5px 9px",
            }}
          >
            {label}
          </span>
        </div>
      ))}

      {/* Fallback */}
      <div
        data-fallback
        style={{
          display: "none",
          position: "absolute",
          inset: 0,
          alignItems: "center",
          justifyContent: "center",
          flexWrap: "wrap",
          gap: 16,
          background: "var(--card)",
          border: "3px solid #0A0A0A",
          boxShadow: "6px 6px 0 #0A0A0A",
          padding: 24,
        }}
      >
        {LABELS.map((l, i) => (
          <div
            key={l}
            style={{
              border: "3px solid #0A0A0A",
              background: ["#FFE600", "#FF3BFF", "#00F5FF", "#FF4D00", "#fff"][i],
              padding: "14px 18px",
              fontFamily: "var(--font-mono)",
              fontWeight: 800,
              textTransform: "uppercase" as const,
              fontSize: 12,
              color: "#0A0A0A",
              boxShadow: "4px 4px 0 #0A0A0A",
            }}
          >
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}
