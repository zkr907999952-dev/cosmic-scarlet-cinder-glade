import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { SoftSkeleton } from "@/lib/softbody/soft-skeleton";
import { useStudio } from "@/lib/studio-store";

const _hit = new THREE.Vector3();
const _normal = new THREE.Vector3();
const _target = new THREE.Vector3();
const _camDir = new THREE.Vector3();
const _plane = new THREE.Plane();
const _ray = new THREE.Ray();
const _ndc = new THREE.Vector2();
const _box = new THREE.Box3();
const _size = new THREE.Vector3();
const _center = new THREE.Vector3();
const _local = new THREE.Vector3();

const TORSO_RE = /skin|dress|body|torso|outfit|cloth|top|bottom|nude|mesh/i;
const SKIP_BIND_RE = /charm|wing/i;

type FigureProps = {
  controlsRef: RefObject<OrbitControlsImpl | null>;
  character: THREE.Object3D;
  intestines: THREE.Object3D;
  pelvis: THREE.Object3D;
};

function meshKey(mesh: THREE.Object3D) {
  const mat = (mesh as THREE.Mesh).material;
  const matName = mat && !Array.isArray(mat) ? (mat as THREE.Material).name : "";
  return `${mesh.name} ${mesh.parent?.name ?? ""} ${matName}`.toLowerCase();
}

function isTorsoMesh(mesh: THREE.Object3D) {
  const k = meshKey(mesh);
  if (/hair|eye|mouth|charm|wing|lash|\.001/.test(k) && !/skin|dress|body/.test(k)) return false;
  const m = mesh as THREE.Mesh;
  const n = (m.geometry?.getAttribute("position") as THREE.BufferAttribute | undefined)?.count ?? 0;
  if (n > 35000) return false;
  return TORSO_RE.test(k);
}

function bindHint(mesh: THREE.Object3D) {
  const k = meshKey(mesh);
  if (/hair|\.001/.test(k) && !/skin|dress|head|eye|mouth/.test(k)) return "hair";
  if (/eye/.test(k)) return "eye";
  if (/mouth/.test(k)) return "mouth";
  if (/head/.test(k)) return "face";
  if (/skin/.test(k)) return "legs";
  if (/dress/.test(k)) return "dress";
  if (/gut|intestin/.test(k)) return "organs";
  if (/pelvis|uterus|ovary/.test(k)) return "organs";
  return "body";
}

function shouldBind(mesh: THREE.Object3D) {
  const k = meshKey(mesh);
  if (SKIP_BIND_RE.test(k)) return false;
  const m = mesh as THREE.Mesh;
  const n = (m.geometry?.getAttribute("position") as THREE.BufferAttribute | undefined)?.count ?? 0;
  return n >= 12;
}

function findCrotch(body: THREE.Object3D, height: number) {
  const y0 = height * 0.49;
  const y1 = height * 0.545;
  const best = new THREE.Vector3(0, height * 0.515, 0.05);
  let bestScore = -Infinity;
  body.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (!isTorsoMesh(mesh) && !/skin|dress/.test(meshKey(mesh))) return;
    const pos = mesh.geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
    if (!pos) return;
    const step = Math.max(1, Math.floor(pos.count / 9000));
    for (let i = 0; i < pos.count; i += step) {
      _local.fromBufferAttribute(pos, i);
      mesh.localToWorld(_local);
      if (_local.y < y0 || _local.y > y1) continue;
      if (Math.abs(_local.x) > 0.03) continue;
      const score = _local.z * 6 - Math.abs(_local.x) * 10 - (_local.y - y0) * 1.8;
      if (score > bestScore) {
        bestScore = score;
        best.copy(_local);
      }
    }
  });
  return best;
}

function liftGutsOffUterus(gut: THREE.Object3D, uterusBox: THREE.Box3) {
  const ucx = (uterusBox.min.x + uterusBox.max.x) * 0.5;
  const ucy = (uterusBox.min.y + uterusBox.max.y) * 0.5;
  const ucz = (uterusBox.min.z + uterusBox.max.z) * 0.5;
  const hx = Math.max(0.02, (uterusBox.max.x - uterusBox.min.x) * 0.5 + 0.012);
  const hy = Math.max(0.02, (uterusBox.max.y - uterusBox.min.y) * 0.5 + 0.01);
  const hz = Math.max(0.02, (uterusBox.max.z - uterusBox.min.z) * 0.5 + 0.01);
  const ySurf = uterusBox.max.y + 0.006;
  gut.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const pos = mesh.geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
    if (!pos || !(pos.array instanceof Float32Array)) return;
    const arr = pos.array;
    for (let i = 0; i < pos.count; i++) {
      const i3 = i * 3;
      const nx = (arr[i3]! - ucx) / hx;
      const ny = (arr[i3 + 1]! - ucy) / hy;
      const nz = (arr[i3 + 2]! - ucz) / hz;
      const d2 = nx * nx + ny * ny + nz * nz;
      if (d2 >= 1) continue;
      const d = Math.sqrt(Math.max(d2, 1e-6));
      const s = 1.08 / d;
      arr[i3] = ucx + nx * hx * s;
      arr[i3 + 1] = Math.max(ucy + ny * hy * s, ySurf);
      arr[i3 + 2] = ucz + nz * hz * s;
    }
    pos.needsUpdate = true;
    mesh.geometry.computeBoundingBox();
  });
}

function findNavel(body: THREE.Object3D, height: number) {
  const y0 = height * 0.56;
  const y1 = height * 0.63;
  const best = new THREE.Vector3(0, height * 0.59, 0.06);
  let bestScore = -Infinity;
  body.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (!isTorsoMesh(mesh)) return;
    const pos = mesh.geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
    if (!pos) return;
    const step = Math.max(1, Math.floor(pos.count / 8000));
    for (let i = 0; i < pos.count; i += step) {
      _local.fromBufferAttribute(pos, i);
      mesh.localToWorld(_local);
      if (_local.y < y0 || _local.y > y1) continue;
      if (Math.abs(_local.x) > 0.04) continue;
      const score = _local.z * 4 - Math.abs(_local.x) * 8;
      if (score > bestScore) {
        bestScore = score;
        best.copy(_local);
      }
    }
  });
  return best;
}

function collectSample(root: THREE.Object3D, test: (m: THREE.Mesh) => boolean, cap = 8000) {
  const pts: THREE.Vector3[] = [];
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (!test(mesh)) return;
    const pos = mesh.geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
    if (!pos) return;
    const step = Math.max(1, Math.floor(pos.count / cap));
    for (let i = 0; i < pos.count; i += step) {
      const v = new THREE.Vector3().fromBufferAttribute(pos, i);
      mesh.localToWorld(v);
      pts.push(v);
    }
  });
  return pts;
}

function pickBest(pts: THREE.Vector3[], pred: (p: THREE.Vector3) => boolean, score: (p: THREE.Vector3) => number, fallback: THREE.Vector3) {
  let best = fallback.clone();
  let bestS = -Infinity;
  for (const p of pts) {
    if (!pred(p)) continue;
    const s = score(p);
    if (s > bestS) {
      bestS = s;
      best.copy(p);
    }
  }
  return best;
}

function sampleLandmarks(body: THREE.Object3D, navel: THREE.Vector3, height: number) {
  const lm: Record<string, THREE.Vector3> = { navel: navel.clone() };
  const dress = collectSample(body, (m) => /dress/.test(meshKey(m)));
  const skin = collectSample(body, (m) => /skin/.test(meshKey(m)));
  const headM = collectSample(body, (m) => /head/.test(meshKey(m)) && !/hair/.test(meshKey(m)));
  const hair = collectSample(body, (m) => bindHint(m) === "hair");
  const eyes = collectSample(body, (m) => /eye/.test(meshKey(m)));
  const mouth = collectSample(body, (m) => /mouth/.test(meshKey(m)));
  const ny = navel.y;

  const avg = (pts: THREE.Vector3[], pred: (p: THREE.Vector3) => boolean, fb: THREE.Vector3) => {
    let x = 0;
    let y = 0;
    let z = 0;
    let n = 0;
    for (const p of pts) {
      if (!pred(p)) continue;
      x += p.x;
      y += p.y;
      z += p.z;
      n++;
    }
    return n ? new THREE.Vector3(x / n, y / n, z / n) : fb;
  };

  lm.head = avg(headM, () => true, new THREE.Vector3(0, height * 0.93, 0.03));
  lm.jaw = avg(mouth, () => true, new THREE.Vector3(0, lm.head.y - 0.04, 0.06));
  lm.eyeL = avg(eyes, (p) => p.x < 0, new THREE.Vector3(-0.03, lm.head.y + 0.005, 0.07));
  lm.eyeR = avg(eyes, (p) => p.x >= 0, new THREE.Vector3(0.03, lm.head.y + 0.005, 0.07));
  lm.neck = avg(headM, (p) => p.y < lm.head.y - 0.04, new THREE.Vector3(0, ny + 0.4, 0.02));
  lm.hips = avg(skin, (p) => p.y > ny - 0.18 && p.y < ny - 0.06 && Math.abs(p.x) < 0.12, new THREE.Vector3(0, ny - 0.12, 0.01));
  lm.spine1 = new THREE.Vector3(0, ny - 0.01, 0.02);
  lm.spine2 = new THREE.Vector3(0, ny + 0.1, 0.02);
  lm.spine3 = avg(dress, (p) => p.y > ny + 0.22 && p.y < ny + 0.32 && Math.abs(p.x) < 0.08, new THREE.Vector3(0, ny + 0.27, 0.02));
  lm.lBreast = pickBest(dress, (p) => p.x < -0.03 && p.x > -0.14 && p.y > ny + 0.22 && p.y < ny + 0.36 && p.z > 0.03, (p) => p.z, new THREE.Vector3(-0.07, ny + 0.28, 0.09));
  lm.rBreast = pickBest(dress, (p) => p.x > 0.03 && p.x < 0.14 && p.y > ny + 0.22 && p.y < ny + 0.36 && p.z > 0.03, (p) => p.z, new THREE.Vector3(0.07, ny + 0.28, 0.09));
  lm.lClav = pickBest(dress, (p) => p.x < -0.04 && p.x > -0.12 && p.y > ny + 0.35 && p.y < ny + 0.44, (p) => -Math.abs(p.z), new THREE.Vector3(-0.07, ny + 0.39, 0.01));
  lm.rClav = pickBest(dress, (p) => p.x > 0.04 && p.x < 0.12 && p.y > ny + 0.35 && p.y < ny + 0.44, (p) => -Math.abs(p.z), new THREE.Vector3(0.07, ny + 0.39, 0.01));
  lm.lUpper = pickBest(dress, (p) => p.x < -0.12 && p.y > ny + 0.3 && p.y < ny + 0.42, (p) => -p.x, new THREE.Vector3(-0.16, ny + 0.36, 0.01));
  lm.rUpper = pickBest(dress, (p) => p.x > 0.12 && p.y > ny + 0.3 && p.y < ny + 0.42, (p) => p.x, new THREE.Vector3(0.16, ny + 0.36, 0.01));
  lm.lFore = pickBest(dress, (p) => p.x < -0.18 && p.y > ny - 0.05 && p.y < ny + 0.18, (p) => -p.x - Math.abs(p.y - (ny + 0.06)), new THREE.Vector3(-0.3, ny + 0.06, 0.02));
  lm.rFore = pickBest(dress, (p) => p.x > 0.18 && p.y > ny - 0.05 && p.y < ny + 0.18, (p) => p.x - Math.abs(p.y - (ny + 0.06)), new THREE.Vector3(0.3, ny + 0.06, 0.02));
  lm.lHand = pickBest(dress, (p) => p.x < -0.25 && p.y < ny - 0.05, (p) => -p.y - p.x * 0.3, new THREE.Vector3(-0.42, ny - 0.18, 0.03));
  lm.rHand = pickBest(dress, (p) => p.x > 0.25 && p.y < ny - 0.05, (p) => -p.y + p.x * 0.3, new THREE.Vector3(0.42, ny - 0.18, 0.03));
  lm.lThigh = avg(skin, (p) => p.x < -0.04 && p.y > ny - 0.28 && p.y < ny - 0.12, new THREE.Vector3(-0.09, ny - 0.2, 0.01));
  lm.rThigh = avg(skin, (p) => p.x > 0.04 && p.y > ny - 0.28 && p.y < ny - 0.12, new THREE.Vector3(0.09, ny - 0.2, 0.01));
  lm.lShin = avg(skin, (p) => p.x < -0.04 && p.y > 0.42 && p.y < 0.55, new THREE.Vector3(-0.09, 0.48, 0.02));
  lm.rShin = avg(skin, (p) => p.x > 0.04 && p.y > 0.42 && p.y < 0.55, new THREE.Vector3(0.09, 0.48, 0.02));
  lm.lAnkle = avg(skin, (p) => p.x < -0.04 && p.y > 0.07 && p.y < 0.16, new THREE.Vector3(-0.09, 0.1, 0.03));
  lm.rAnkle = avg(skin, (p) => p.x > 0.04 && p.y > 0.07 && p.y < 0.16, new THREE.Vector3(0.09, 0.1, 0.03));
  lm.lFoot = avg(skin, (p) => p.x < -0.04 && p.y < 0.07, new THREE.Vector3(-0.09, 0.035, 0.05));
  lm.rFoot = avg(skin, (p) => p.x > 0.04 && p.y < 0.07, new THREE.Vector3(0.09, 0.035, 0.05));
  lm.lToe = pickBest(skin, (p) => p.x < -0.03 && p.y < 0.06, (p) => p.z, new THREE.Vector3(-0.09, 0.025, 0.12));
  lm.rToe = pickBest(skin, (p) => p.x > 0.03 && p.y < 0.06, (p) => p.z, new THREE.Vector3(0.09, 0.025, 0.12));

  const hairTop = pickBest(hair, () => true, (p) => p.y, new THREE.Vector3(0, lm.head.y + 0.04, -0.02));
  const hairBot = pickBest(hair, () => true, (p) => -p.y, new THREE.Vector3(0, lm.head.y - 0.7, -0.02));
  lm.hair1 = hairTop;
  lm.hair5 = hairBot;
  lm.hair2 = new THREE.Vector3(0, hairTop.y * 0.75 + hairBot.y * 0.25, hairTop.z * 0.7 + hairBot.z * 0.3);
  lm.hair3 = new THREE.Vector3(0, hairTop.y * 0.5 + hairBot.y * 0.5, hairTop.z * 0.45 + hairBot.z * 0.55);
  lm.hair4 = new THREE.Vector3(0, hairTop.y * 0.25 + hairBot.y * 0.75, hairTop.z * 0.25 + hairBot.z * 0.75);
  return lm;
}

function stripPelvicVulva(root: THREE.Object3D) {
  const kill: THREE.Object3D[] = [];
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (/vulve|clitoris|corpsetracines|materialcorps|materialbulbes/.test(meshKey(mesh))) {
      kill.push(mesh);
    }
  });
  for (const m of kill) {
    const mesh = m as THREE.Mesh;
    mesh.removeFromParent();
    mesh.geometry?.dispose();
  }
}

function stubVagina(root: THREE.Object3D) {
  const uterus = collectNamedBox(root, /uterus/);
  const ucx = 0;
  const ucy = uterus ? (uterus.min.y + uterus.max.y) * 0.5 - 0.02 : 0.92;
  const ucz = uterus ? (uterus.min.z + uterus.max.z) * 0.5 + 0.008 : 0.05;
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (!/vagin/.test(meshKey(mesh))) return;
    const pos = mesh.geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
    if (!pos || !(pos.array instanceof Float32Array)) return;
    const arr = pos.array;
    for (let i = 0; i < pos.count; i++) {
      const i3 = i * 3;
      const x = arr[i3]!;
      const y = arr[i3 + 1]!;
      const z = arr[i3 + 2]!;
      const d = Math.hypot(x - ucx, y - ucy, z - ucz);
      const w = THREE.MathUtils.clamp((d - 0.028) / 0.05, 0, 1);
      if (w <= 0) continue;
      arr[i3] = x + (ucx - x) * w;
      arr[i3 + 1] = y + (ucy - y) * w;
      arr[i3 + 2] = z + (ucz - z) * w;
    }
    pos.needsUpdate = true;
    mesh.geometry.computeBoundingBox();
    mesh.geometry.computeBoundingSphere();
  });
}

function bakeIntoVertices(group: THREE.Object3D) {
  group.updateMatrixWorld(true);
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    mesh.updateWorldMatrix(true, false);
    const geo = mesh.geometry.clone();
    geo.applyMatrix4(mesh.matrixWorld);
    mesh.geometry = geo;
    mesh.position.set(0, 0, 0);
    mesh.quaternion.identity();
    mesh.scale.set(1, 1, 1);
    mesh.matrix.identity();
    mesh.matrixWorld.identity();
  });
  group.position.set(0, 0, 0);
  group.quaternion.identity();
  group.scale.set(1, 1, 1);
  group.matrix.identity();
  group.updateMatrixWorld(true);
}

function cloneGraph(source: THREE.Object3D) {
  return SkeletonUtils.clone(source) as THREE.Group;
}

function fitStanding(source: THREE.Object3D, targetHeight: number) {
  const root = cloneGraph(source);
  root.updateMatrixWorld(true);
  _box.setFromObject(root);
  _box.getSize(_size);
  _box.getCenter(_center);

  if (_size.z > _size.x * 1.2) {
    const facePlusX = _center.x < 0.2;
    root.rotation.y += facePlusX ? -Math.PI / 2 : Math.PI / 2;
    root.updateMatrixWorld(true);
    _box.setFromObject(root);
    _box.getSize(_size);
    _box.getCenter(_center);
  }
  if (_size.z > _size.y * 1.25) {
    root.rotation.x += -Math.PI / 2;
    root.updateMatrixWorld(true);
    _box.setFromObject(root);
    _box.getSize(_size);
    _box.getCenter(_center);
  }

  const s = targetHeight / Math.max(_size.y, 0.001);
  root.scale.multiplyScalar(s);
  root.updateMatrixWorld(true);
  _box.setFromObject(root);
  _box.getSize(_size);
  _box.getCenter(_center);
  root.position.x -= _center.x;
  root.position.z -= _center.z;
  root.position.y -= _box.min.y;
  root.updateMatrixWorld(true);
  return root;
}

function flattenToWorld(source: THREE.Object3D) {
  const baked = new THREE.Group();
  source.updateMatrixWorld(true);
  source.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.visible || !mesh.geometry) return;
    const geo0 = mesh.geometry.clone();
    geo0.applyMatrix4(mesh.matrixWorld);
    if (geo0.attributes.skinIndex) geo0.deleteAttribute("skinIndex");
    if (geo0.attributes.skinWeight) geo0.deleteAttribute("skinWeight");
    const mat = mesh.material;
    const out = new THREE.Mesh(geo0, mat);
    out.name = mesh.name;
    out.userData.parentName = mesh.parent?.name ?? "";
    out.userData.matName = !Array.isArray(mat) ? (mat as THREE.Material).name : "";
    out.frustumCulled = false;
    baked.add(out);
  });
  return baked;
}

function sampleBand(character: THREE.Object3D, y0: number, y1: number, maxAbsX = 0.22) {
  const box = new THREE.Box3();
  box.makeEmpty();
  let count = 0;
  character.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (!isTorsoMesh(mesh)) return;
    const pos = mesh.geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
    if (!pos) return;
    const step = Math.max(1, Math.floor(pos.count / 6000));
    for (let i = 0; i < pos.count; i += step) {
      _local.fromBufferAttribute(pos, i);
      mesh.localToWorld(_local);
      if (_local.y < y0 || _local.y > y1) continue;
      if (Math.abs(_local.x) > maxAbsX) continue;
      box.expandByPoint(_local);
      count++;
    }
  });
  return { box, count };
}

function sliceWidths(root: THREE.Object3D, y0: number, y1: number, bands = 8) {
  const dy = (y1 - y0) / bands;
  const out = Array.from({ length: bands }, (_, i) => ({ y: y0 + (i + 0.5) * dy, halfX: 0, zF: -1, zB: 1 }));
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const pos = mesh.geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
    if (!pos) return;
    for (let i = 0; i < pos.count; i += Math.max(1, Math.floor(pos.count / 12000))) {
      _local.fromBufferAttribute(pos, i);
      mesh.localToWorld(_local);
      if (_local.y < y0 || _local.y > y1) continue;
      const b = Math.min(bands - 1, Math.max(0, Math.floor((_local.y - y0) / dy)));
      const s = out[b]!;
      s.halfX = Math.max(s.halfX, Math.abs(_local.x));
      s.zF = Math.max(s.zF, _local.z);
      s.zB = Math.min(s.zB, _local.z);
    }
  });
  return out.map((s) => ({ y: +s.y.toFixed(3), halfX: +s.halfX.toFixed(3), zF: +s.zF.toFixed(3) }));
}

function collectNamedBox(root: THREE.Object3D, re: RegExp) {
  const box = new THREE.Box3();
  box.makeEmpty();
  let n = 0;
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.visible) return;
    if (!re.test(meshKey(mesh))) return;
    box.expandByObject(mesh);
    n++;
  });
  return n > 0 ? box : null;
}

function clampGroupToBox(group: THREE.Object3D, box: THREE.Box3, zPad = 0.012) {
  group.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(group);
  const zLimit = box.max.z - zPad;
  if (b.max.z > zLimit) group.position.z -= b.max.z - zLimit;
  const xMid = (b.min.x + b.max.x) * 0.5;
  const xWant = (box.min.x + box.max.x) * 0.5;
  group.position.x += xWant - xMid;
  group.updateMatrixWorld(true);
}

type TorsoSlice = { y: number; halfX: number; zFront: number; zBack: number };

function sampleTorsoProfile(body: THREE.Object3D, y0: number, y1: number, bands = 20): TorsoSlice[] {
  const dy = (y1 - y0) / bands;
  const slots: TorsoSlice[] = [];
  const n = new Int16Array(bands);
  for (let i = 0; i < bands; i++) {
    slots.push({ y: y0 + (i + 0.5) * dy, halfX: 0.04, zFront: -1, zBack: 1 });
  }
  body.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (!isTorsoMesh(mesh)) return;
    const pos = mesh.geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
    if (!pos) return;
    const step = Math.max(1, Math.floor(pos.count / 10000));
    for (let i = 0; i < pos.count; i += step) {
      _local.fromBufferAttribute(pos, i);
      mesh.localToWorld(_local);
      if (_local.y < y0 || _local.y > y1) continue;
      if (Math.abs(_local.x) > 0.16) continue;
      if (_local.z < -0.02) continue;
      const b = Math.min(bands - 1, Math.max(0, Math.floor((_local.y - y0) / dy)));
      const s = slots[b]!;
      s.halfX = Math.max(s.halfX, Math.abs(_local.x));
      if (n[b] === 0) {
        s.zFront = _local.z;
        s.zBack = _local.z;
      } else {
        s.zFront = Math.max(s.zFront, _local.z);
        s.zBack = Math.min(s.zBack, _local.z);
      }
      n[b]!++;
    }
  });
  for (let i = 0; i < bands; i++) {
    if (n[i]! > 4) continue;
    const src = slots[i > 0 && n[i - 1]! > 4 ? i - 1 : Math.min(bands - 1, i + 1)]!;
    slots[i]!.halfX = src.halfX;
    slots[i]!.zFront = src.zFront;
    slots[i]!.zBack = src.zBack;
  }
  return slots;
}

function profileAt(profile: TorsoSlice[], y: number): TorsoSlice {
  if (y <= profile[0]!.y) return profile[0]!;
  const last = profile[profile.length - 1]!;
  if (y >= last.y) return last;
  for (let i = 0; i < profile.length - 1; i++) {
    const a = profile[i]!;
    const b = profile[i + 1]!;
    if (y > b.y) continue;
    const t = (y - a.y) / Math.max(1e-5, b.y - a.y);
    return {
      y,
      halfX: a.halfX + (b.halfX - a.halfX) * t,
      zFront: a.zFront + (b.zFront - a.zFront) * t,
      zBack: a.zBack + (b.zBack - a.zBack) * t,
    };
  }
  return last;
}

function placeGuts(source: THREE.Object3D, cavity: THREE.Box3, navel: THREE.Vector3, profile: TorsoSlice[]) {
  const root = cloneGraph(source);
  root.updateMatrixWorld(true);
  const src = new THREE.Box3().setFromObject(root);
  const ss = src.getSize(new THREE.Vector3());
  const ts = cavity.getSize(new THREE.Vector3());
  const s = Math.min(ts.x / Math.max(ss.x, 1e-4), ts.y / Math.max(ss.y, 1e-4)) * 0.96;
  root.scale.set(s, s, s * 1.12);
  root.updateMatrixWorld(true);
  const after = new THREE.Box3().setFromObject(root);
  const ac = after.getCenter(new THREE.Vector3());
  root.position.x += navel.x - ac.x;
  root.position.y += navel.y - ac.y;
  root.updateMatrixWorld(true);
  const after2 = new THREE.Box3().setFromObject(root);
  root.position.z += cavity.max.z - after2.max.z;
  root.updateMatrixWorld(true);
  const baked = flattenToWorld(root);
  bakeIntoVertices(baked);
  fitGutEnvelope(baked, cavity, profile);
  return baked;
}

function fitGutEnvelope(group: THREE.Object3D, cavity: THREE.Box3, profile: TorsoSlice[]) {
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const pos = mesh.geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
    if (!pos || !(pos.array instanceof Float32Array)) return;
    const arr = pos.array;
    for (let i = 0; i < pos.count; i++) {
      const i3 = i * 3;
      let x = arr[i3]!;
      const y = arr[i3 + 1]!;
      let z = arr[i3 + 2]!;
      const p = profileAt(profile, y);
      const maxX = Math.max(0.05, p.halfX * 0.82);
      const ax = Math.abs(x);
      if (ax > maxX) x = Math.sign(x) * (maxX + (ax - maxX) * 0.2);
      const zFront = Math.min(cavity.max.z, p.zFront - 0.01);
      const zBack = cavity.min.z;
      if (z > zFront) z = zFront + (z - zFront) * 0.15;
      if (z < zBack) z = zBack + (z - zBack) * 0.2;
      arr[i3] = x;
      arr[i3 + 2] = z;
    }
    pos.needsUpdate = true;
    mesh.geometry.computeBoundingBox();
    mesh.geometry.computeBoundingSphere();
  });
}

function shiftNamedMeshes(root: THREE.Object3D, re: RegExp, dx: number, dy: number, dz: number) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (!re.test(meshKey(mesh))) return;
    const pos = mesh.geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
    if (!pos || !(pos.array instanceof Float32Array)) return;
    const arr = pos.array;
    for (let i = 0; i < pos.count; i++) {
      arr[i * 3] += dx;
      arr[i * 3 + 1] += dy;
      arr[i * 3 + 2] += dz;
    }
    pos.needsUpdate = true;
    mesh.geometry.computeBoundingBox();
    mesh.geometry.computeBoundingSphere();
  });
}

function scaleNamedMeshes(root: THREE.Object3D, re: RegExp, factor: number) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (!re.test(meshKey(mesh))) return;
    const pos = mesh.geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
    if (!pos || !(pos.array instanceof Float32Array)) return;
    const arr = pos.array;
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (let i = 0; i < pos.count; i++) {
      cx += arr[i * 3]!;
      cy += arr[i * 3 + 1]!;
      cz += arr[i * 3 + 2]!;
    }
    const inv = 1 / Math.max(1, pos.count);
    cx *= inv;
    cy *= inv;
    cz *= inv;
    for (let i = 0; i < pos.count; i++) {
      arr[i * 3] = cx + (arr[i * 3]! - cx) * factor;
      arr[i * 3 + 1] = cy + (arr[i * 3 + 1]! - cy) * factor;
      arr[i * 3 + 2] = cz + (arr[i * 3 + 2]! - cz) * factor;
    }
    pos.needsUpdate = true;
    mesh.geometry.computeBoundingBox();
    mesh.geometry.computeBoundingSphere();
  });
}

function placePelvisPack(source: THREE.Object3D, crotch: THREE.Vector3, navel: THREE.Vector3, frontZ: number) {
  const root = cloneGraph(source);
  stripPelvicVulva(root);
  root.updateMatrixWorld(true);
  const uterusBox = collectNamedBox(root, /uterus/) ?? new THREE.Box3().setFromObject(root);
  const uSize = uterusBox.getSize(new THREE.Vector3());
  root.scale.multiplyScalar(0.058 / Math.max(uSize.y, 1e-4));
  root.updateMatrixWorld(true);
  const u2 = collectNamedBox(root, /uterus/) ?? new THREE.Box3().setFromObject(root);
  const uc = u2.getCenter(new THREE.Vector3());
  root.position.add(new THREE.Vector3(0, navel.y - 0.1, navel.z - 0.055).sub(uc));
  root.updateMatrixWorld(true);
  const baked = flattenToWorld(root);
  bakeIntoVertices(baked);
  stripPelvicVulva(baked);
  scaleNamedMeshes(baked, /uterus/, 1.02);
  scaleNamedMeshes(baked, /vessie|bladder/, 0.7);
  bakeIntoVertices(baked);

  const internals = /uterus|vessie|bladder|ovaire|trompe|ligament|vagin/;
  const ub = collectNamedBox(baked, /uterus/);
  if (ub) {
    const cz = (ub.min.z + ub.max.z) * 0.5;
    const dy = navel.y - 0.08 - ub.max.y;
    const dz = navel.z - 0.07 - cz;
    shiftNamedMeshes(baked, internals, 0, dy, dz);
  }
  stubVagina(baked);
  stripPelvicVulva(baked);
  return baked;
}

function polishOrgans(root: THREE.Object3D, kind: "gut" | "pelvis") {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const next = mats.map((raw) => {
      const m = (raw ? raw.clone() : new THREE.MeshStandardMaterial()) as THREE.MeshStandardMaterial;
      m.side = THREE.DoubleSide;
      m.roughness = kind === "gut" ? 0.48 : 0.42;
      m.metalness = 0;
      if (!m.map) {
        m.color.lerp(new THREE.Color(kind === "gut" ? "#b85a4a" : "#c4786a"), 0.12);
      }
      m.emissive = new THREE.Color("#000000");
      m.emissiveIntensity = 0;
      m.transparent = false;
      m.depthWrite = true;
      m.needsUpdate = true;
      return m;
    });
    mesh.material = next.length === 1 ? next[0] : next;
    mesh.renderOrder = 0;
    mesh.frustumCulled = false;
    mesh.raycast = () => {};
  });
}

function attachXray(mesh: THREE.Mesh, y0: number, y1: number, xMax: number, zFront: number, list: THREE.Material[]) {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const next = mats.map((mat) => {
    if (!mat) return mat;
    const cloned = mat.clone();
    cloned.transparent = true;
    cloned.side = THREE.FrontSide;
    cloned.depthWrite = true;
    cloned.onBeforeCompile = (shader) => {
      shader.uniforms.uXray = { value: 0 };
      shader.uniforms.uY0 = { value: y0 };
      shader.uniforms.uY1 = { value: y1 };
      shader.uniforms.uXMax = { value: xMax };
      shader.uniforms.uZFront = { value: zFront };
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vBodyW;")
        .replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvBodyW = (modelMatrix * vec4(transformed, 1.0)).xyz;",
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          "#include <common>\nuniform float uXray; uniform float uY0; uniform float uY1; uniform float uXMax; uniform float uZFront; varying vec3 vBodyW;",
        )
        .replace(
          "#include <dithering_fragment>",
          `float band = smoothstep(uY0, uY0 + 0.05, vBodyW.y) * (1.0 - smoothstep(uY1 - 0.05, uY1, vBodyW.y));
           float torso = 1.0 - smoothstep(uXMax, uXMax + 0.05, abs(vBodyW.x));
           float front = smoothstep(uZFront - 0.07, uZFront - 0.02, vBodyW.z);
           float win = clamp(band * torso * uXray, 0.0, 1.0);
           float hole = win * front;
           if (win > 0.25 && !gl_FrontFacing) {
             gl_FragColor.rgb = vec3(0.16, 0.07, 0.06);
             gl_FragColor.a = 1.0;
           } else {
             gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * 0.8, hole);
             gl_FragColor.a = mix(gl_FragColor.a, 0.11, hole);
           }
           #include <dithering_fragment>`,
        );
      cloned.userData.shader = shader;
    };
    cloned.needsUpdate = true;
    list.push(cloned);
    return cloned;
  });
  mesh.material = next.length === 1 ? next[0] : next;
}

export function Figure({ controlsRef, character, intestines, pelvis }: FigureProps) {
  return (
    <FittedFigure
      character={character}
      intestines={intestines}
      pelvis={pelvis}
      controlsRef={controlsRef}
    />
  );
}

function FittedFigure({
  character,
  intestines,
  pelvis,
  controlsRef,
}: {
  character: THREE.Object3D;
  intestines: THREE.Object3D;
  pelvis: THREE.Object3D;
  controlsRef: RefObject<OrbitControlsImpl | null>;
}) {
  const pokeRef = useRef<THREE.Mesh>(null);
  const latticeRef = useRef<THREE.Points>(null);
  const bonesRef = useRef<THREE.LineSegments>(null);
  const exprRef = useRef(useStudio.getState().expression);
  const poseRef = useRef(useStudio.getState().pose);
  const grab = useRef<{
    active: boolean;
    mode: "pose" | "drag";
    origin: THREE.Vector3;
    planePoint: THREE.Vector3;
    normal: THREE.Vector3;
    bone: number;
  } | null>(null);
  const lastShake = useRef(0);
  const lastReset = useRef(0);
  const energyTick = useRef(0);
  const lastAz = useRef<number | null>(null);
  const lastPol = useRef<number | null>(null);
  const { camera, gl, raycaster, pointer } = useThree();

  const setup = useMemo(() => {
    const xrayList: THREE.Material[] = [];
    const root = new THREE.Group();
    const fitted = fitStanding(character, 1.66);
    const body = flattenToWorld(fitted);
    root.add(body);

    _box.setFromObject(body);
    _box.getSize(_size);
    const height = _size.y;
    const charBox = new THREE.Box3().setFromObject(body);
    const navel = findNavel(body, height);
    const yNavel = navel.y;
    const yAb0 = yNavel - 0.08;
    const yAb1 = yNavel + 0.11;
    const yX0 = yNavel - 0.2;
    const yX1 = yNavel + 0.24;

    const abSample = sampleBand(body, yAb0, yAb1, 0.12);
    const abdomen =
      abSample.count > 40
        ? abSample.box.clone()
        : new THREE.Box3(new THREE.Vector3(-0.11, yAb0, -0.04), new THREE.Vector3(0.11, yAb1, 0.1));
    const abx = Math.max(0.11, Math.min(0.13, (abdomen.max.x - abdomen.min.x) * 0.42));
    const acx = (abdomen.min.x + abdomen.max.x) * 0.5;
    abdomen.min.x = acx - abx;
    abdomen.max.x = acx + abx;
    const skinZ = navel.z;
    abdomen.max.z = skinZ - 0.01;
    abdomen.min.z = skinZ - 0.105;

    const crotch = findCrotch(body, height);
    const pelvic = placePelvisPack(pelvis, crotch, navel, skinZ - 0.028);
    polishOrgans(pelvic, "pelvis");
    pelvic.visible = false;
    root.add(pelvic);
    const uterusNow = collectNamedBox(pelvic, /uterus/);

    const gutBox = new THREE.Box3(
      new THREE.Vector3(acx - 0.12, yNavel - 0.17, abdomen.min.z),
      new THREE.Vector3(acx + 0.12, yNavel + 0.17, abdomen.max.z),
    );
    const waistProfile = sampleTorsoProfile(body, gutBox.min.y - 0.02, gutBox.max.y + 0.05);
    const gut = placeGuts(intestines, gutBox, navel, waistProfile);
    polishOrgans(gut, "gut");
    if (uterusNow) liftGutsOffUterus(gut, uterusNow);
    gut.visible = false;
    root.add(gut);

    const bellyLight = new THREE.PointLight("#a07060", 0, 0.48);
    bellyLight.position.set(0, yNavel, abdomen.max.z - 0.04);
    root.add(bellyLight);

    const armSpan = Math.max(charBox.max.x, -charBox.min.x);
    const landmarks = sampleLandmarks(body, navel, height);
    landmarks.lHand ??= new THREE.Vector3(-armSpan * 0.85, yNavel - 0.2, 0.03);
    landmarks.rHand ??= new THREE.Vector3(armSpan * 0.85, yNavel - 0.2, 0.03);
    const skeleton = new SoftSkeleton(landmarks, height);
    const boundGeos: THREE.BufferGeometry[] = [];
    const weightViews: { mesh: THREE.Mesh; orig: THREE.Material | THREE.Material[]; weight: THREE.Material }[] = [];

    const bindMesh = (mesh: THREE.Mesh, hint?: string) => {
      let geo = mesh.geometry as THREE.BufferGeometry;
      const pos0 = geo.getAttribute("position") as THREE.BufferAttribute | undefined;
      if (!pos0 || pos0.itemSize !== 3) return;
      mesh.geometry = geo.clone();
      geo = mesh.geometry as THREE.BufferGeometry;
      const pos = geo.getAttribute("position") as THREE.BufferAttribute;
      if (!(pos.array instanceof Float32Array)) return;
      mesh.updateWorldMatrix(true, false);
      const n = pos.count;
      const world = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        _local.fromBufferAttribute(pos, i);
        mesh.localToWorld(_local);
        world[i * 3] = _local.x;
        world[i * 3 + 1] = _local.y;
        world[i * 3 + 2] = _local.z;
      }
      pos.array.set(world);
      pos.needsUpdate = true;
      const binding = skeleton.bind(pos.array, hint ?? bindHint(mesh));
      geo.setAttribute("color", new THREE.BufferAttribute(binding.colors, 3));
      boundGeos.push(geo);
      const weightMat = new THREE.MeshLambertMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
      });
      weightViews.push({ mesh, orig: mesh.material, weight: weightMat });
    };

    body.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      if (!shouldBind(mesh)) {
        mesh.raycast = () => {};
        return;
      }
      bindMesh(mesh);
      if (isTorsoMesh(mesh)) attachXray(mesh, yX0, yX1, 0.12, skinZ - 0.01, xrayList);
    });

    gut.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) bindMesh(mesh, "organs");
    });
    pelvic.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) bindMesh(mesh, "organs");
    });
    const jointBuf = new Float32Array(skeleton.count * 3);
    const boneVis = new THREE.Group();
    boneVis.visible = false;
    const jointGeo = new THREE.SphereGeometry(0.014, 8, 8);
    const jointMat = new THREE.MeshBasicMaterial({ color: "#d4b5a0", depthTest: false, transparent: true, opacity: 0.95 });
    const joints: THREE.Mesh[] = [];
    for (let i = 0; i < skeleton.count; i++) {
      const m = new THREE.Mesh(jointGeo, jointMat);
      m.frustumCulled = false;
      m.renderOrder = 30;
      boneVis.add(m);
      joints.push(m);
    }
    const linePos = new Float32Array(skeleton.boneLineCount() * 6);
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.BufferAttribute(linePos, 3));
    const boneLines = new THREE.LineSegments(
      lineGeo,
      new THREE.LineBasicMaterial({ color: "#f2efe9", depthTest: false, transparent: true, opacity: 0.85 }),
    );
    boneLines.frustumCulled = false;
    boneLines.renderOrder = 29;
    boneVis.add(boneLines);
    root.add(boneVis);
    for (const v of weightViews) v.orig = v.mesh.material;

    const gutBoxNow = new THREE.Box3().setFromObject(gut);
    const pelBoxNow = new THREE.Box3().setFromObject(pelvic);
    if (typeof window !== "undefined") {
      (window as unknown as { __vela?: unknown }).__vela = {
        char: { min: charBox.min.toArray(), max: charBox.max.toArray() },
        abdomen: { min: abdomen.min.toArray(), max: abdomen.max.toArray() },
        pelvis: { min: pelBoxNow.min.toArray(), max: pelBoxNow.max.toArray() },
        uterusBox: (() => {
          const b = collectNamedBox(pelvic, /uterus/);
          return b ? { min: b.min.toArray(), max: b.max.toArray() } : null;
        })(),
        bladderBox: (() => {
          const b = collectNamedBox(pelvic, /vessie|bladder/);
          return b ? { min: b.min.toArray(), max: b.max.toArray() } : null;
        })(),
        vulvaBox: (() => {
          const b = collectNamedBox(pelvic, /vulve|clitoris/);
          return b ? { min: b.min.toArray(), max: b.max.toArray() } : null;
        })(),
        guts: { min: gutBoxNow.min.toArray(), max: gutBoxNow.max.toArray() },
        navel: navel.toArray(),
        crotch: crotch.toArray(),
        uterus: uterusNow
          ? [(uterusNow.min.x + uterusNow.max.x) * 0.5, (uterusNow.min.y + uterusNow.max.y) * 0.5, (uterusNow.min.z + uterusNow.max.z) * 0.5]
          : [0, yNavel - 0.1, 0],
        waist: waistProfile.map((s) => ({
          y: +s.y.toFixed(3),
          halfX: +s.halfX.toFixed(3),
          zF: +s.zFront.toFixed(3),
        })),
        gutBands: sliceWidths(gut, gutBoxNow.min.y, gutBoxNow.max.y, 8),
        bones: skeleton.names,
        bound: boundGeos.length,
      };
    }

    return {
      root,
      skeleton,
      y0: yAb0,
      y1: yAb1,
      abdomen,
      xrayList,
      gutRoot: gut,
      pelvisRoot: pelvic,
      boundGeos,
      bellyLight,
      weightViews,
      boneVis,
      joints,
      boneLines,
      jointBuf,
    };
  }, [character, intestines, pelvis]);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      useStudio.setState({
        loading: false,
        loadProgress: 100,
        loadHint: "就绪",
        loadError: null,
      });
    });
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (controlsRef.current) {
      const c = setup.abdomen.getCenter(new THREE.Vector3());
      controlsRef.current.target.set(c.x, c.y, c.z);
      controlsRef.current.update();
    }
  }, [setup, controlsRef]);

  useEffect(() => {
    const onUp = () => {
      if (grab.current?.mode === "pose") setup.skeleton.commitPose();
      grab.current = null;
      setup.skeleton.clearHold();
      useStudio.getState().setGrabbing(false);
      gl.domElement.style.cursor = "default";
      if (pokeRef.current) pokeRef.current.visible = false;
    };
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [gl, setup]);

  const writeBindings = () => {
    for (const geo of setup.boundGeos) {
      const pos = geo.getAttribute("position");
      if (pos) pos.needsUpdate = true;
    }
  };

  useFrame((state, delta) => {
    const d = Math.min(delta, 0.05);
    const s = useStudio.getState();
    const dt = s.slowMo ? d * 0.38 : d;
    if (s.shakeNonce !== lastShake.current) {
      lastShake.current = s.shakeNonce;
      setup.skeleton.shake(0.08);
    }
    if (s.resetNonce !== lastReset.current) {
      lastReset.current = s.resetNonce;
      setup.skeleton.reset();
    }
    if (s.expression !== exprRef.current) {
      exprRef.current = s.expression;
      setup.skeleton.setExpression(s.expression);
    }
    if (s.pose !== poseRef.current) {
      poseRef.current = s.pose;
      setup.skeleton.setPose(s.pose);
    }

    const ctrl = controlsRef.current;
    camera.getWorldDirection(_camDir);
    const az = ctrl ? ctrl.getAzimuthalAngle() : Math.atan2(_camDir.x, _camDir.z);
    const pol = ctrl ? ctrl.getPolarAngle() : Math.acos(THREE.MathUtils.clamp(_camDir.y, -1, 1));
    if (lastAz.current === null) {
      lastAz.current = az;
      lastPol.current = pol;
    }
    const invDt = 1 / Math.max(dt, 1e-4);
    setup.skeleton.pushViewSpin(
      THREE.MathUtils.clamp((az - lastAz.current) * invDt, -14, 14),
      THREE.MathUtils.clamp((pol - (lastPol.current ?? pol)) * invDt, -10, 10),
    );
    lastAz.current = az;
    lastPol.current = pol;

    if (grab.current?.active) {
      camera.getWorldDirection(_camDir);
      _plane.setFromNormalAndCoplanarPoint(_camDir, grab.current.planePoint);
      _ndc.copy(pointer);
      raycaster.setFromCamera(_ndc, camera);
      _ray.copy(raycaster.ray);
      const o = grab.current.origin;
      const bone = grab.current.bone;
      if (_ray.intersectPlane(_plane, _target)) {
        if (grab.current.mode === "pose") {
          setup.skeleton.setPoseDrag(bone, o.x, o.y, o.z, _target.x, _target.y, _target.z);
        } else {
          setup.skeleton.setTissueDrag(o.x, o.y, o.z, _target.x, _target.y, _target.z, 0.16);
        }
        if (pokeRef.current) {
          pokeRef.current.position.copy(_target);
          pokeRef.current.visible = true;
        }
      }
    }

    setup.skeleton.step(dt, {
      stiffness: s.stiffness,
      damping: s.damping,
      jiggle: s.jiggle,
      gravity: s.gravity,
      wind: s.wind,
      time: state.clock.elapsedTime,
      breathing: s.breathing,
    });

    energyTick.current += 1;
    writeBindings();
    if (energyTick.current % 8 === 0) s.setEnergy(setup.skeleton.energy);
    if (!grab.current?.active && energyTick.current % 20 === 0) {
      for (const geo of setup.boundGeos) {
        if (geo.getAttribute("position").count < 18000) geo.computeVertexNormals();
      }
    }

    const xray = s.abdomenXray;
    for (const mat of setup.xrayList) {
      const shader = mat.userData.shader as { uniforms?: { uXray?: { value: number } } } | undefined;
      if (shader?.uniforms?.uXray) shader.uniforms.uXray.value = xray;
      mat.depthWrite = xray < 0.2;
      mat.side = xray > 0.2 ? THREE.DoubleSide : THREE.FrontSide;
      mat.transparent = xray > 0.05;
    }
    const show = s.showOrgans && xray > 0.08;
    setup.gutRoot.visible = show;
    setup.pelvisRoot.visible = show;
    setup.bellyLight.intensity = show ? 0.18 + xray * 0.22 : 0;

    setup.boneVis.visible = s.showLattice;
    if (s.showLattice) {
      const jp = setup.skeleton.jointPositions(setup.jointBuf);
      for (let i = 0; i < setup.joints.length; i++) {
        setup.joints[i]!.position.set(jp[i * 3]!, jp[i * 3 + 1]!, jp[i * 3 + 2]!);
      }
      const lp = setup.boneLines.geometry.getAttribute("position") as THREE.BufferAttribute;
      setup.skeleton.writeBoneLines(lp.array as Float32Array);
      lp.needsUpdate = true;
    }
    for (const v of setup.weightViews) {
      v.mesh.material = s.showWeights ? v.weight : v.orig;
    }
  });

  const latticeGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(setup.skeleton.count * 3), 3));
    return g;
  }, [setup]);

  const boneGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(setup.skeleton.boneLineCount() * 2 * 3), 3),
    );
    return g;
  }, [setup]);

  const beginGrab = (point: THREE.Vector3, normal: THREE.Vector3, mode: "pose" | "drag") => {
    grab.current = {
      active: true,
      mode,
      origin: point.clone(),
      planePoint: point.clone(),
      normal: normal.clone().normalize(),
      bone: setup.skeleton.pickBone(point.x, point.y, point.z),
    };
    useStudio.getState().setGrabbing(true);
    gl.domElement.style.cursor = "grabbing";
    if (pokeRef.current) {
      pokeRef.current.position.copy(point);
      pokeRef.current.lookAt(point.clone().add(normal));
      pokeRef.current.visible = true;
    }
  };

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0 && e.nativeEvent.button !== 0) return;
    e.stopPropagation();
    _hit.copy(e.point);
    if (e.face) {
      _normal.copy(e.face.normal).transformDirection(e.object.matrixWorld).normalize();
    } else {
      _normal.set(0, 0, 1);
    }
    beginGrab(_hit, _normal, useStudio.getState().interactMode);
  };

  const midY = (setup.y0 + setup.y1) * 0.5;
  const ab = setup.abdomen;

  return (
    <group>
      <primitive
        object={setup.root}
        onPointerDown={onPointerDown}
        onPointerOver={() => {
          gl.domElement.style.cursor = "grab";
        }}
        onPointerOut={() => {
          if (!grab.current) gl.domElement.style.cursor = "default";
        }}
      />
      <mesh
        position={[0, midY, ab.max.z + 0.01]}
        onPointerDown={onPointerDown}
        onPointerOver={() => {
          gl.domElement.style.cursor = "grab";
        }}
        onPointerOut={() => {
          if (!grab.current) gl.domElement.style.cursor = "default";
        }}
      >
        <boxGeometry args={[Math.max(0.28, ab.max.x - ab.min.x + 0.12), Math.max(0.55, setup.y1 - setup.y0 + 0.35), 0.14]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <points ref={latticeRef} geometry={latticeGeo} visible={false} renderOrder={20}>
        <pointsMaterial color="#f2efe9" size={0.018} sizeAttenuation depthTest={false} />
      </points>
      <lineSegments ref={bonesRef} geometry={boneGeo} visible={false} renderOrder={19}>
        <lineBasicMaterial color="#d4b5a0" depthTest={false} />
      </lineSegments>
      <mesh ref={pokeRef} visible={false} renderOrder={10}>
        <ringGeometry args={[0.024, 0.036, 28]} />
        <meshBasicMaterial color="#d4b5a0" transparent opacity={0.8} side={THREE.DoubleSide} depthTest={false} />
      </mesh>
    </group>
  );
}
