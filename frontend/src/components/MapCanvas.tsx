"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";

interface Node {
  id: string;
  cur: string;
  color: THREE.Color;
  pos: THREE.Vector3;
  core?: THREE.Mesh;
  glow?: THREE.Sprite;
  rings?: { mesh: THREE.Mesh; offset: number }[];
  targetOp: number;
  op: number;
}

interface Flight {
  active: boolean;
  si?: number;
  di?: number;
  src?: THREE.Vector3;
  dst?: THREE.Vector3;
  mid?: THREE.Vector3;
  t0?: number;
  popped?: boolean;
}

function glowTex(color: THREE.Color) {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const x = c.getContext("2d")!;
  const col = "#" + color.getHexString();
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, col);
  g.addColorStop(0.3, col);
  g.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function labelTex(text: string) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const x = c.getContext("2d")!;
  x.fillStyle = "#0A0A0A";
  x.fillRect(6, 38, 500, 52);
  x.strokeStyle = "#00F5FF";
  x.lineWidth = 4;
  x.strokeRect(6, 38, 500, 52);
  x.fillStyle = "#00F5FF";
  x.font = 'bold 30px "JetBrains Mono", monospace';
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.fillText(text, 256, 65);
  return new THREE.CanvasTexture(c);
}

function lockTex() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const x = c.getContext("2d")!;
  x.imageSmoothingEnabled = false;
  const P = (px: number, py: number, w: number, h: number, col: string) => {
    x.fillStyle = col;
    x.fillRect(px, py, w, h);
  };
  P(20, 30, 24, 22, "#FFE600");
  x.strokeStyle = "#0A0A0A";
  x.lineWidth = 4;
  x.strokeRect(20, 30, 24, 22);
  P(30, 38, 4, 8, "#0A0A0A");
  x.lineWidth = 5;
  x.strokeStyle = "#0A0A0A";
  x.beginPath();
  x.arc(44, 24, 9, Math.PI, Math.PI * 1.9);
  x.stroke();
  return new THREE.CanvasTexture(c);
}

function bez(p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, t: number) {
  const u = 1 - t;
  return new THREE.Vector3(
    u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
    u * u * p0.z + 2 * u * t * p1.z + t * t * p2.z
  );
}

export default function MapCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

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
      return;
    }

    let W = wrap.clientWidth;
    let H = wrap.clientHeight;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W, H, false);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 100);
    const tilt = (18 * Math.PI) / 180;
    const camR = 7.4;
    camera.position.set(0, camR * Math.sin(tilt) + 3.4, camR * Math.cos(tilt));
    camera.lookAt(0, 0, 0);

    const Y = new THREE.Color("#FFE600");
    const M = new THREE.Color("#FF3BFF");
    const C = new THREE.Color("#00F5FF");

    // Dot grid "Asia map"
    const GX = 46, GZ = 34, SX = 6.4, SZ = 4.8;
    const pts: number[] = [], cols: number[] = [];
    for (let i = 0; i < GX; i++) {
      for (let j = 0; j < GZ; j++) {
        const x = ((i / (GX - 1)) - 0.5) * SX;
        const z = ((j / (GZ - 1)) - 0.5) * SZ;
        const land = Math.sin(i * 0.5) * Math.cos(j * 0.6) + Math.sin(i * 0.2 + j * 0.3) > 0.25;
        pts.push(x, 0, z);
        if (land) { cols.push(C.r * 0.5, C.g * 0.5, C.b * 0.5); }
        else { cols.push(0.12, 0.12, 0.12); }
      }
    }
    const mGeo = new THREE.BufferGeometry();
    mGeo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    mGeo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
    scene.add(new THREE.Points(mGeo, new THREE.PointsMaterial({ size: 0.05, vertexColors: true, transparent: true, opacity: 0.6 })));

    // Nodes
    const nodes: Node[] = [
      { id: "ID", cur: "IDR", color: Y, pos: new THREE.Vector3(0.4, 0, 1.0), targetOp: 1, op: 1 },
      { id: "PH", cur: "PHP", color: M, pos: new THREE.Vector3(1.9, 0, -0.2), targetOp: 1, op: 1 },
      { id: "VN", cur: "VND", color: C, pos: new THREE.Vector3(-1.0, 0, -1.1), targetOp: 1, op: 1 },
    ];

    nodes.forEach((n) => {
      const core = new THREE.Mesh(
        new THREE.CircleGeometry(0.13, 16),
        new THREE.MeshBasicMaterial({ color: n.color, transparent: true })
      );
      core.rotation.x = -Math.PI / 2;
      core.position.copy(n.pos);
      core.position.y = 0.02;
      scene.add(core);
      n.core = core;

      const glow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowTex(n.color),
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          opacity: 0.8,
        })
      );
      glow.scale.set(0.9, 0.9, 0.9);
      glow.position.copy(n.pos);
      glow.position.y = 0.05;
      scene.add(glow);
      n.glow = glow;

      n.rings = [];
      for (let r = 0; r < 3; r++) {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.14, 0.18, 20),
          new THREE.MeshBasicMaterial({ color: n.color, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.copy(n.pos);
        ring.position.y = 0.03;
        scene.add(ring);
        n.rings.push({ mesh: ring, offset: r / 3 });
      }
    });

    // Package
    const pkg = new THREE.Group();
    const boxMesh = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 0.34), new THREE.MeshBasicMaterial({ color: Y }));
    const boxEdges = new THREE.LineSegments(new THREE.EdgesGeometry(boxMesh.geometry), new THREE.LineBasicMaterial({ color: 0x0A0A0A }));
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.27, 0.07), new THREE.MeshBasicMaterial({ color: 0x0A0A0A }));
    pkg.add(boxMesh, boxEdges, band);
    pkg.visible = false;
    scene.add(pkg);

    // Path line
    const pathGeo = new THREE.BufferGeometry();
    pathGeo.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(32 * 3), 3));
    const pathLine = new THREE.Line(
      pathGeo,
      new THREE.LineDashedMaterial({
        color: 0xFFE600, transparent: true, opacity: 0,
        dashSize: 0.12, gapSize: 0.1, blending: THREE.AdditiveBlending, depthWrite: false,
      })
    );
    pathLine.computeLineDistances();
    scene.add(pathLine);

    // Trail
    const TN = 22;
    const trailGeo = new THREE.BufferGeometry();
    const tArr = new Float32Array(TN * 3);
    const tCol = new Float32Array(TN * 3);
    for (let i = 0; i < TN; i++) {
      const col = i % 2 ? Y : C;
      tCol[i * 3] = col.r; tCol[i * 3 + 1] = col.g; tCol[i * 3 + 2] = col.b;
    }
    trailGeo.setAttribute("position", new THREE.BufferAttribute(tArr, 3));
    trailGeo.setAttribute("color", new THREE.BufferAttribute(tCol, 3));
    const trailPts = new THREE.Points(trailGeo, new THREE.PointsMaterial({
      size: 0.09, vertexColors: true, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    scene.add(trailPts);

    // Currency label
    const curLabel = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, opacity: 0 }));
    curLabel.scale.set(1.7, 0.42, 1);
    scene.add(curLabel);

    const lock = new THREE.Sprite(new THREE.SpriteMaterial({ map: lockTex(), transparent: true, depthWrite: false, opacity: 0 }));
    lock.scale.set(0.4, 0.4, 0.4);
    scene.add(lock);

    // Burst particles
    const bursts: { update: (dt: number) => boolean }[] = [];
    function burst(pos: THREE.Vector3) {
      const cnt = 8;
      const bGeo = new THREE.BufferGeometry();
      const arr = new Float32Array(cnt * 3);
      const vel: THREE.Vector3[] = [];
      for (let i = 0; i < cnt; i++) {
        arr[i * 3] = pos.x; arr[i * 3 + 1] = 0.25; arr[i * 3 + 2] = pos.z;
        const a = (i / cnt) * Math.PI * 2;
        vel.push(new THREE.Vector3(Math.cos(a) * 0.07, 0.04 + Math.random() * 0.03, Math.sin(a) * 0.07));
      }
      bGeo.setAttribute("position", new THREE.BufferAttribute(arr, 3));
      const mat = new THREE.PointsMaterial({ size: 0.16, color: 0xFFE600, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
      const bPts = new THREE.Points(bGeo, mat);
      scene.add(bPts);
      let life = 0;
      bursts.push({
        update: (dt: number) => {
          life += dt;
          const arr2 = bGeo.attributes.position.array as Float32Array;
          for (let i = 0; i < cnt; i++) {
            arr2[i * 3] += vel[i].x; arr2[i * 3 + 1] += vel[i].y; arr2[i * 3 + 2] += vel[i].z;
            vel[i].y -= 0.004;
          }
          bGeo.attributes.position.needsUpdate = true;
          mat.opacity = Math.max(0, 1 - life / 0.8);
          if (life > 0.8) { scene.remove(bPts); bGeo.dispose(); mat.dispose(); return false; }
          return true;
        },
      });
    }

    // Flight state
    const flight: Flight = { active: false };
    const flightPairs = [[0, 1], [2, 0], [1, 2]];
    let flightIdx = 0;

    function startFlight(si: number, di: number) {
      if (flight.active) return;
      const src = nodes[si].pos;
      const dst = nodes[di].pos;
      const mid = new THREE.Vector3().addVectors(src, dst).multiplyScalar(0.5);
      mid.y = 1.9;
      Object.assign(flight, { active: true, si, di, src, dst, mid, t0: performance.now() / 1000, popped: false });
      nodes.forEach((n, i) => { n.targetOp = i === si || i === di ? 1 : 0.4; });

      const N = 32;
      const arr = pathGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < N; i++) {
        const tt = i / (N - 1);
        const p = bez(src, mid, dst, tt);
        arr[i * 3] = p.x; arr[i * 3 + 1] = p.y; arr[i * 3 + 2] = p.z;
      }
      pathGeo.attributes.position.needsUpdate = true;
      pathLine.computeLineDistances();
      (pathLine.material as THREE.LineDashedMaterial).opacity = 0.9;

      const buyerCur = nodes[di].cur;
      const creatorCur = nodes[si].cur;
      curLabel.material.map = labelTex(`${buyerCur} → USDC → ${creatorCur}`);
      curLabel.material.needsUpdate = true;
      curLabel.material.opacity = 0;
      const lp = bez(src, mid, dst, 0.5);
      curLabel.position.set(lp.x, lp.y + 0.5, lp.z);
      lock.material.opacity = 0;
    }

    function updateFlight(elapsed: number, dt: number) {
      if (!flight.active || !flight.src || !flight.dst || !flight.mid || flight.t0 === undefined) return;
      const LIFT = 0.35, TRAVEL = 1.7, POP = 0.45;
      const lt = performance.now() / 1000 - flight.t0;

      if (lt < LIFT) {
        pkg.visible = true;
        const b = Math.sin((lt / LIFT) * Math.PI) * 0.18;
        pkg.position.set(flight.src.x, 0.18 + b, flight.src.z);
        pkg.rotation.y += dt * 3;
      } else if (lt < LIFT + TRAVEL) {
        const raw = (lt - LIFT) / TRAVEL;
        const tt = raw * raw * (3 - 2 * raw);
        const p = bez(flight.src, flight.mid, flight.dst, tt);
        pkg.visible = true;
        pkg.position.set(p.x, p.y + 0.18, p.z);
        pkg.rotation.y += dt * 3.2;
        pkg.rotation.x = Math.sin(elapsed * 4) * 0.15;

        for (let i = TN - 1; i > 0; i--) {
          tArr[i * 3] = tArr[(i - 1) * 3];
          tArr[i * 3 + 1] = tArr[(i - 1) * 3 + 1];
          tArr[i * 3 + 2] = tArr[(i - 1) * 3 + 2];
        }
        tArr[0] = p.x; tArr[1] = p.y + 0.18; tArr[2] = p.z;
        trailGeo.attributes.position.needsUpdate = true;
        trailPts.material.opacity = 0.9;

        const lo = Math.sin(Math.max(0, Math.min(1, (raw - 0.2) / 0.6)) * Math.PI);
        curLabel.material.opacity = lo * 0.95;
        (pathLine.material as THREE.LineDashedMaterial).opacity = 0.7 + Math.sin(elapsed * 6) * 0.3;
      } else if (lt < LIFT + TRAVEL + POP) {
        if (!flight.popped) {
          flight.popped = true;
          pkg.visible = false;
          burst(flight.dst);
          lock.position.set(flight.dst.x, 0.4, flight.dst.z);
          lock.material.opacity = 1;
          trailPts.material.opacity = 0;
          curLabel.material.opacity = 0;
          (pathLine.material as THREE.LineDashedMaterial).opacity = 0.4;
        }
      } else {
        lock.material.opacity = Math.max(0, lock.material.opacity - dt * 1.2);
        (pathLine.material as THREE.LineDashedMaterial).opacity = Math.max(0, (pathLine.material as THREE.LineDashedMaterial).opacity - dt * 1.5);
        if (lt > LIFT + TRAVEL + POP + 1.4) {
          flight.active = false;
          nodes.forEach((n) => (n.targetOp = 1));
          setTimeout(() => {
            flightIdx = (flightIdx + 1) % flightPairs.length;
            startFlight(flightPairs[flightIdx][0], flightPairs[flightIdx][1]);
          }, Math.max(200, 5000 - (LIFT + TRAVEL + POP + 1.4) * 1000));
        }
      }
    }

    // Click handler
    const ray = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const coreMeshes = nodes.map((n) => n.core!);
    const handlePointer = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      ray.setFromCamera(mouse, camera);
      const hits = ray.intersectObjects(coreMeshes, false);
      if (hits.length) {
        const si = coreMeshes.indexOf(hits[0].object as THREE.Mesh);
        const di = (si + 1 + Math.floor(Math.random() * 2)) % nodes.length;
        startFlight(si, di);
      }
    };
    canvas.addEventListener("pointerdown", handlePointer);

    // Resize handler
    const onResize = () => {
      W = wrap.clientWidth;
      H = wrap.clientHeight;
      if (!W || !H) return;
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
      renderer.setSize(W, H, false);
    };
    window.addEventListener("resize", onResize);

    // Animation loop
    const clock = new THREE.Clock();
    let raf = 0;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const dt = clock.getDelta();
      const t = clock.elapsedTime;

      camera.position.x = Math.sin(t * 0.25) * 1.1;
      camera.lookAt(0, 0, 0);

      nodes.forEach((n) => {
        n.op += (n.targetOp - n.op) * 0.08;
        if (n.core) (n.core.material as THREE.MeshBasicMaterial).opacity = n.op;
        if (n.glow) {
          (n.glow.material as THREE.SpriteMaterial).opacity = 0.8 * n.op;
          const gs = 0.85 + Math.sin(t * 2.2 + n.pos.x) * 0.12;
          n.glow.scale.setScalar(gs);
        }
        n.rings?.forEach((r) => {
          const p = ((t * 0.4 + r.offset) % 1);
          r.mesh.scale.setScalar(1 + p * 3.2);
          (r.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - p) * 0.5 * n.op;
        });
      });

      updateFlight(t, dt);

      for (let i = bursts.length - 1; i >= 0; i--) {
        if (!bursts[i].update(dt)) bursts.splice(i, 1);
      }

      renderer.render(scene, camera);
    };

    tick();

    // Start first flight after delay
    const flightTimer = setTimeout(() => startFlight(0, 1), 2200);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(flightTimer);
      canvas.removeEventListener("pointerdown", handlePointer);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      style={{ position: "relative", width: "100%", height: 560 }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
      {/* Scanline overlay */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: "repeating-linear-gradient(0deg,rgba(0,0,0,0.05) 0 1px,transparent 1px 3px)",
          opacity: 0.5,
        }}
      />
      {/* Fallback */}
      <div
        data-fallback
        style={{
          display: "none",
          position: "absolute",
          inset: 0,
          alignItems: "center",
          justifyContent: "center",
          background: "#0A0A0A",
          border: "3px solid #0A0A0A",
        }}
      >
        <svg width="320" height="240" viewBox="0 0 320 240">
          <path d="M40 180 Q160 20 280 120" fill="none" stroke="#FFE600" strokeWidth="3" strokeDasharray="8 8">
            <animate attributeName="strokeDashoffset" from="32" to="0" dur="1s" repeatCount="indefinite" />
          </path>
          <rect x="34" y="174" width="14" height="14" fill="#FFE600" />
          <rect x="272" y="112" width="14" height="14" fill="#FF3BFF" />
        </svg>
      </div>
    </div>
  );
}
