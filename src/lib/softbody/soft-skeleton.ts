import * as THREE from "three";

export type SkelParams = {
  stiffness: number;
  damping: number;
  jiggle: number;
  gravity: number;
  wind: number;
  time: number;
  breathing: boolean;
};

export type ExpressionId = "rest" | "smile" | "surprise" | "open";
export type PoseId = "idle" | "armsUp" | "bow" | "legLift" | "twist" | "sway";

export const EXPRESSIONS: { id: ExpressionId; label: string }[] = [
  { id: "rest", label: "平静" },
  { id: "smile", label: "微笑" },
  { id: "surprise", label: "惊讶" },
  { id: "open", label: "开口" },
];

export const POSES: { id: PoseId; label: string }[] = [
  { id: "idle", label: "站立" },
  { id: "armsUp", label: "举手" },
  { id: "bow", label: "鞠躬" },
  { id: "legLift", label: "抬腿" },
  { id: "twist", label: "扭腰" },
  { id: "sway", label: "摇摆" },
];

export type SkinBinding = {
  positions: Float32Array;
  rest: Float32Array;
  count: number;
  index: Uint8Array;
  weight: Float32Array;
  colors: Float32Array;
};

type Hold =
  | { mode: "drag"; bone: number; gx: number; gy: number; gz: number; tx: number; ty: number; tz: number }
  | { mode: "press"; bone: number; nx: number; ny: number; nz: number; depth: number };

const _q = new THREE.Quaternion();
const _from = new THREE.Vector3();
const _to = new THREE.Vector3();
const _axis = new THREE.Vector3();
const _v = new THREE.Vector3();
const _e = new THREE.Euler();
const IDENTITY = new THREE.Quaternion();
const _c = new THREE.Color();

type Group = "body" | "face" | "hair" | "breast" | "foot";

type BoneDef = {
  name: string;
  parent: string | null;
  x: number;
  y: number;
  z: number;
  radius: number;
  maxAng: number;
  slide: number;
  group: Group;
};

function distToSeg(px: number, py: number, pz: number, ax: number, ay: number, az: number, bx: number, by: number, bz: number) {
  const abx = bx - ax;
  const aby = by - ay;
  const abz = bz - az;
  const apx = px - ax;
  const apy = py - ay;
  const apz = pz - az;
  const ab2 = abx * abx + aby * aby + abz * abz || 1e-8;
  let t = (apx * abx + apy * aby + apz * abz) / ab2;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const dx = apx - abx * t;
  const dy = apy - aby * t;
  const dz = apz - abz * t;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function hueColor(i: number, out: THREE.Color) {
  return out.setHSL((i * 0.17) % 1, 0.72, 0.55);
}

export class SoftSkeleton {
  readonly names: string[] = [];
  readonly parent: Int16Array;
  readonly rest: Float32Array;
  readonly radius: Float32Array;
  readonly maxAng: Float32Array;
  readonly slide: Float32Array;
  readonly group: Group[] = [];
  readonly count: number;
  energy = 0;
  expression: ExpressionId = "rest";
  pose: PoseId = "idle";

  private readonly q: THREE.Quaternion[] = [];
  private readonly qv: THREE.Vector3[] = [];
  private readonly off: THREE.Vector3[] = [];
  private readonly ov: THREE.Vector3[] = [];
  private readonly wpos: THREE.Vector3[] = [];
  private readonly wrot: THREE.Quaternion[] = [];
  private readonly poseQ: THREE.Quaternion[] = [];
  private readonly poseOff: THREE.Vector3[] = [];
  private readonly exprQ: THREE.Quaternion[] = [];
  private readonly exprOff: THREE.Vector3[] = [];
  private hold: Hold | null = null;
  private readonly bindings: SkinBinding[] = [];
  private readonly headY: number;
  private readonly bustY: number;
  private readonly byName: Record<string, number> = {};

  constructor(navel: THREE.Vector3, height: number, armSpan: number) {
    const ny = navel.y;
    const nz = navel.z * 0.12;
    const as = Math.min(0.52, Math.max(0.36, armSpan));
    const hy = height * 0.925;
    const fy = height * 0.895;
    this.headY = hy;
    this.bustY = ny + 0.28;

    const defs: BoneDef[] = [
      { name: "hips", parent: null, x: 0, y: ny - 0.13, z: nz, radius: 0.12, maxAng: 0.22, slide: 0, group: "body" },
      { name: "spine1", parent: "hips", x: 0, y: ny - 0.02, z: nz + 0.01, radius: 0.1, maxAng: 0.55, slide: 0.018, group: "body" },
      { name: "spine2", parent: "spine1", x: 0, y: ny + 0.12, z: nz + 0.012, radius: 0.095, maxAng: 0.5, slide: 0.012, group: "body" },
      { name: "spine3", parent: "spine2", x: 0, y: ny + 0.26, z: nz + 0.01, radius: 0.11, maxAng: 0.45, slide: 0.01, group: "body" },
      { name: "neck", parent: "spine3", x: 0, y: ny + 0.4, z: nz + 0.005, radius: 0.05, maxAng: 0.7, slide: 0, group: "body" },
      { name: "head", parent: "neck", x: 0, y: hy, z: nz + 0.02, radius: 0.09, maxAng: 0.55, slide: 0, group: "body" },
      { name: "jaw", parent: "head", x: 0, y: fy, z: nz + 0.055, radius: 0.045, maxAng: 0.7, slide: 0.012, group: "face" },
      { name: "browL", parent: "head", x: -0.028, y: hy + 0.018, z: nz + 0.06, radius: 0.028, maxAng: 0.4, slide: 0.01, group: "face" },
      { name: "browR", parent: "head", x: 0.028, y: hy + 0.018, z: nz + 0.06, radius: 0.028, maxAng: 0.4, slide: 0.01, group: "face" },
      { name: "eyeL", parent: "head", x: -0.032, y: hy + 0.002, z: nz + 0.07, radius: 0.024, maxAng: 0.35, slide: 0.006, group: "face" },
      { name: "eyeR", parent: "head", x: 0.032, y: hy + 0.002, z: nz + 0.07, radius: 0.024, maxAng: 0.35, slide: 0.006, group: "face" },
      { name: "cheekL", parent: "head", x: -0.042, y: fy + 0.01, z: nz + 0.055, radius: 0.03, maxAng: 0.3, slide: 0.01, group: "face" },
      { name: "cheekR", parent: "head", x: 0.042, y: fy + 0.01, z: nz + 0.055, radius: 0.03, maxAng: 0.3, slide: 0.01, group: "face" },
      { name: "mouthL", parent: "jaw", x: -0.022, y: fy - 0.004, z: nz + 0.068, radius: 0.022, maxAng: 0.45, slide: 0.01, group: "face" },
      { name: "mouthR", parent: "jaw", x: 0.022, y: fy - 0.004, z: nz + 0.068, radius: 0.022, maxAng: 0.45, slide: 0.01, group: "face" },
      { name: "hair1", parent: "head", x: 0, y: hy + 0.04, z: nz - 0.03, radius: 0.09, maxAng: 0.55, slide: 0.02, group: "hair" },
      { name: "hair2", parent: "hair1", x: 0, y: hy - 0.1, z: nz - 0.08, radius: 0.1, maxAng: 0.75, slide: 0.03, group: "hair" },
      { name: "hair3", parent: "hair2", x: 0, y: hy - 0.28, z: nz - 0.07, radius: 0.11, maxAng: 0.95, slide: 0.04, group: "hair" },
      { name: "hair4", parent: "hair3", x: 0, y: hy - 0.48, z: nz - 0.04, radius: 0.11, maxAng: 1.05, slide: 0.045, group: "hair" },
      { name: "hair5", parent: "hair4", x: 0, y: hy - 0.68, z: nz - 0.02, radius: 0.1, maxAng: 1.15, slide: 0.05, group: "hair" },
      { name: "tongue", parent: "jaw", x: 0, y: fy - 0.01, z: nz + 0.05, radius: 0.02, maxAng: 0.5, slide: 0.008, group: "face" },
      { name: "belly", parent: "spine1", x: 0, y: ny, z: navel.z - 0.05, radius: 0.11, maxAng: 0.35, slide: 0.08, group: "body" },
      { name: "lBreast", parent: "spine3", x: -0.078, y: this.bustY, z: 0.09, radius: 0.078, maxAng: 0.42, slide: 0.07, group: "breast" },
      { name: "rBreast", parent: "spine3", x: 0.078, y: this.bustY, z: 0.09, radius: 0.078, maxAng: 0.42, slide: 0.07, group: "breast" },
      { name: "lClav", parent: "spine3", x: -0.07, y: ny + 0.38, z: nz, radius: 0.055, maxAng: 0.55, slide: 0, group: "body" },
      { name: "lUpper", parent: "lClav", x: -as * 0.4, y: ny + 0.32, z: nz, radius: 0.065, maxAng: 1.15, slide: 0, group: "body" },
      { name: "lFore", parent: "lUpper", x: -as * 0.7, y: ny - 0.02, z: nz + 0.02, radius: 0.05, maxAng: 1.3, slide: 0, group: "body" },
      { name: "lHand", parent: "lFore", x: -as * 0.92, y: ny - 0.2, z: nz + 0.03, radius: 0.045, maxAng: 0.8, slide: 0, group: "body" },
      { name: "rClav", parent: "spine3", x: 0.07, y: ny + 0.38, z: nz, radius: 0.055, maxAng: 0.55, slide: 0, group: "body" },
      { name: "rUpper", parent: "rClav", x: as * 0.4, y: ny + 0.32, z: nz, radius: 0.065, maxAng: 1.15, slide: 0, group: "body" },
      { name: "rFore", parent: "rUpper", x: as * 0.7, y: ny - 0.02, z: nz + 0.02, radius: 0.05, maxAng: 1.3, slide: 0, group: "body" },
      { name: "rHand", parent: "rFore", x: as * 0.92, y: ny - 0.2, z: nz + 0.03, radius: 0.045, maxAng: 0.8, slide: 0, group: "body" },
      { name: "lThigh", parent: "hips", x: -0.085, y: ny - 0.24, z: nz, radius: 0.085, maxAng: 0.85, slide: 0, group: "body" },
      { name: "lShin", parent: "lThigh", x: -0.09, y: 0.48, z: nz + 0.01, radius: 0.065, maxAng: 1.0, slide: 0, group: "body" },
      { name: "lAnkle", parent: "lShin", x: -0.09, y: 0.12, z: nz + 0.02, radius: 0.07, maxAng: 0.85, slide: 0, group: "foot" },
      { name: "lFoot", parent: "lAnkle", x: -0.09, y: 0.04, z: 0.06, radius: 0.075, maxAng: 0.65, slide: 0, group: "foot" },
      { name: "lToe", parent: "lFoot", x: -0.09, y: 0.028, z: 0.125, radius: 0.055, maxAng: 0.5, slide: 0, group: "foot" },
      { name: "rThigh", parent: "hips", x: 0.085, y: ny - 0.24, z: nz, radius: 0.085, maxAng: 0.85, slide: 0, group: "body" },
      { name: "rShin", parent: "rThigh", x: 0.09, y: 0.48, z: nz + 0.01, radius: 0.065, maxAng: 1.0, slide: 0, group: "body" },
      { name: "rAnkle", parent: "rShin", x: 0.09, y: 0.12, z: nz + 0.02, radius: 0.07, maxAng: 0.85, slide: 0, group: "foot" },
      { name: "rFoot", parent: "rAnkle", x: 0.09, y: 0.04, z: 0.06, radius: 0.075, maxAng: 0.65, slide: 0, group: "foot" },
      { name: "rToe", parent: "rFoot", x: 0.09, y: 0.028, z: 0.125, radius: 0.055, maxAng: 0.5, slide: 0, group: "foot" },
    ];

    this.count = defs.length;
    this.parent = new Int16Array(this.count);
    this.rest = new Float32Array(this.count * 3);
    this.radius = new Float32Array(this.count);
    this.maxAng = new Float32Array(this.count);
    this.slide = new Float32Array(this.count);

    defs.forEach((d, i) => {
      this.byName[d.name] = i;
    });
    for (let i = 0; i < this.count; i++) {
      const b = defs[i]!;
      this.names.push(b.name);
      this.group.push(b.group);
      this.parent[i] = b.parent ? (this.byName[b.parent] ?? -1) : -1;
      this.rest[i * 3] = b.x;
      this.rest[i * 3 + 1] = b.y;
      this.rest[i * 3 + 2] = b.z;
      this.radius[i] = b.radius;
      this.maxAng[i] = b.maxAng;
      this.slide[i] = b.slide;
      this.q.push(new THREE.Quaternion());
      this.qv.push(new THREE.Vector3());
      this.off.push(new THREE.Vector3());
      this.ov.push(new THREE.Vector3());
      this.wpos.push(new THREE.Vector3(b.x, b.y, b.z));
      this.wrot.push(new THREE.Quaternion());
      this.poseQ.push(new THREE.Quaternion());
      this.poseOff.push(new THREE.Vector3());
      this.exprQ.push(new THREE.Quaternion());
      this.exprOff.push(new THREE.Vector3());
    }
    this.updateFK();
  }

  bind(positions: Float32Array, hint = "body"): SkinBinding {
    const n = positions.length / 3;
    const index = new Uint8Array(n * 4);
    const weight = new Float32Array(n * 4);
    const rest = new Float32Array(positions);
    const colors = new Float32Array(n * 3);
    const scores = new Float32Array(this.count);
    const allow = this.allowedBones(hint);
    const hy = this.headY;
    const by = this.bustY;

    for (let i = 0; i < n; i++) {
      const x = positions[i * 3]!;
      const y = positions[i * 3 + 1]!;
      const z = positions[i * 3 + 2]!;
      scores.fill(0);
      for (let a = 0; a < allow.length; a++) {
        const b = allow[a]!;
        const p = this.parent[b];
        const bx = this.rest[b * 3]!;
        const byy = this.rest[b * 3 + 1]!;
        const bz = this.rest[b * 3 + 2]!;
        const d =
          p < 0
            ? Math.hypot(x - bx, y - byy, z - bz)
            : distToSeg(x, y, z, this.rest[p * 3]!, this.rest[p * 3 + 1]!, this.rest[p * 3 + 2]!, bx, byy, bz);
        let s = Math.exp(-((d / this.radius[b]!) * (d / this.radius[b]!)));
        const g = this.group[b];
        const nm = this.names[b];
        if (hint === "face") {
          if (y > hy + 0.012 && /brow/.test(nm)) s *= 6;
          if (y > hy - 0.01 && y < hy + 0.02 && /eye/.test(nm)) s *= 8;
          if (y < hy - 0.02 && /jaw|mouth|cheek/.test(nm)) s *= 5;
          if (z < 0 && g === "face") s *= 0.15;
        } else if (hint === "mouth") {
          if (/jaw|mouth|tongue/.test(nm)) s *= 4;
        } else if (hint === "eye") {
          if (x < 0 && nm === "eyeL") s *= 8;
          if (x > 0 && nm === "eyeR") s *= 8;
        } else if (hint === "hair") {
          if (g !== "hair" && y < hy - 0.05) s *= 0.08;
        } else if (hint === "legs") {
          if (y < 0.16 && g === "foot") s *= 10;
          if (y < 0.28 && /Ankle|Shin/.test(nm)) s *= 3;
          if (y > 0.22 && g === "foot") s *= 0.2;
        } else if (hint === "dress") {
          if (g === "breast" && Math.abs(y - by) < 0.1 && z > 0.03 && Math.abs(x) > 0.025) s *= 9;
          if (g === "breast" && (z < 0.01 || Math.abs(y - by) > 0.12)) s *= 0.05;
        }
        scores[b] = s;
      }
      const bi = [0, 0, 0, 0];
      const bw = [-1, -1, -1, -1];
      for (let b = 0; b < this.count; b++) {
        const s = scores[b]!;
        if (s > bw[0]!) {
          bw[3] = bw[2]; bi[3] = bi[2];
          bw[2] = bw[1]; bi[2] = bi[1];
          bw[1] = bw[0]; bi[1] = bi[0];
          bw[0] = s; bi[0] = b;
        } else if (s > bw[1]!) {
          bw[3] = bw[2]; bi[3] = bi[2];
          bw[2] = bw[1]; bi[2] = bi[1];
          bw[1] = s; bi[1] = b;
        } else if (s > bw[2]!) {
          bw[3] = bw[2]; bi[3] = bi[2];
          bw[2] = s; bi[2] = b;
        } else if (s > bw[3]!) {
          bw[3] = s; bi[3] = b;
        }
      }
      let sum = bw[0]! + bw[1]! + bw[2]! + bw[3]!;
      if (sum < 1e-6) {
        const fallback = allow[0] ?? 0;
        bi[0] = fallback;
        bw[0] = 1;
        bw[1] = 0;
        bw[2] = 0;
        bw[3] = 0;
        sum = 1;
      }
      const o = i * 4;
      index[o] = bi[0]!;
      index[o + 1] = bi[1]!;
      index[o + 2] = bi[2]!;
      index[o + 3] = bi[3]!;
      weight[o] = bw[0]! / sum;
      weight[o + 1] = bw[1]! / sum;
      weight[o + 2] = bw[2]! / sum;
      weight[o + 3] = bw[3]! / sum;
      hueColor(bi[0]!, _c);
      colors[i * 3] = _c.r;
      colors[i * 3 + 1] = _c.g;
      colors[i * 3 + 2] = _c.b;
    }

    const binding: SkinBinding = { positions, rest, count: n, index, weight, colors };
    this.bindings.push(binding);
    return binding;
  }

  private allowedBones(hint: string) {
    const out: number[] = [];
    for (let i = 0; i < this.count; i++) {
      const g = this.group[i];
      const nm = this.names[i]!;
      let ok = false;
      if (hint === "hair") ok = g === "hair" || nm === "head" || nm === "neck";
      else if (hint === "eye") ok = /eye|head/.test(nm);
      else if (hint === "mouth") ok = /jaw|mouth|tongue|head/.test(nm);
      else if (hint === "face") ok = g === "face" || nm === "head" || nm === "neck";
      else if (hint === "legs") ok = g === "foot" || /hips|Thigh|Shin/.test(nm);
      else if (hint === "dress") ok = g === "body" || g === "breast";
      else if (hint === "organs") ok = /belly|spine/.test(nm);
      else ok = g !== "hair" && g !== "face";
      if (ok) out.push(i);
    }
    return out.length ? out : [0];
  }

  pickBone(x: number, y: number, z: number) {
    let best = 1;
    let bestS = Infinity;
    for (let b = 0; b < this.count; b++) {
      if (this.names[b] === "hips") continue;
      const g = this.group[b];
      if (y < 0.22 && g !== "foot" && !/Shin|Thigh/.test(this.names[b]!)) continue;
      if (y > this.headY - 0.04 && g !== "face" && g !== "hair" && !/head|neck/.test(this.names[b]!)) continue;
      const p = this.parent[b];
      const bx = this.rest[b * 3]!;
      const by = this.rest[b * 3 + 1]!;
      const bz = this.rest[b * 3 + 2]!;
      const d =
        p < 0
          ? Math.hypot(x - bx, y - by, z - bz)
          : distToSeg(x, y, z, this.rest[p * 3]!, this.rest[p * 3 + 1]!, this.rest[p * 3 + 2]!, bx, by, bz);
      let s = d / this.radius[b]!;
      if (y < 0.2 && g === "foot") s *= 0.35;
      if (this.group[b] === "breast" && Math.abs(y - this.bustY) < 0.1) s *= 0.45;
      if (s < bestS) {
        bestS = s;
        best = b;
      }
    }
    return best;
  }

  setDrag(bone: number, gx: number, gy: number, gz: number, tx: number, ty: number, tz: number) {
    this.hold = { mode: "drag", bone, gx, gy, gz, tx, ty, tz };
  }

  setPress(bone: number, nx: number, ny: number, nz: number, depth: number) {
    this.hold = { mode: "press", bone, nx, ny, nz, depth };
  }

  clearHold() {
    this.hold = null;
  }

  setExpression(id: ExpressionId) {
    this.expression = id;
    for (let i = 0; i < this.count; i++) {
      this.exprQ[i]!.identity();
      this.exprOff[i]!.set(0, 0, 0);
    }
    const set = (name: string, ex: number, ey: number, ez: number, ox = 0, oy = 0, oz = 0) => {
      const i = this.byName[name];
      if (i === undefined) return;
      this.exprQ[i]!.setFromEuler(_e.set(ex, ey, ez, "XYZ"));
      this.exprOff[i]!.set(ox, oy, oz);
    };
    if (id === "smile") {
      set("mouthL", 0, 0, -0.32, -0.006, 0.01, 0.006);
      set("mouthR", 0, 0, 0.32, 0.006, 0.01, 0.006);
      set("cheekL", 0, 0.08, 0, -0.008, 0.007, 0.006);
      set("cheekR", 0, -0.08, 0, 0.008, 0.007, 0.006);
      set("eyeL", 0.18, 0, 0, 0, -0.002, 0);
      set("eyeR", 0.18, 0, 0, 0, -0.002, 0);
      set("browL", -0.12, 0, 0, 0, 0.004, 0);
      set("browR", -0.12, 0, 0, 0, 0.004, 0);
      set("jaw", -0.06, 0, 0, 0, 0.003, 0);
    } else if (id === "surprise") {
      set("browL", -0.42, 0.08, 0, -0.004, 0.016, 0);
      set("browR", -0.42, -0.08, 0, 0.004, 0.016, 0);
      set("jaw", 0.58, 0, 0, 0, -0.016, 0.01);
      set("mouthL", 0, 0, 0, -0.01, -0.004, 0.006);
      set("mouthR", 0, 0, 0, 0.01, -0.004, 0.006);
      set("eyeL", -0.18, 0, 0, 0, 0.004, 0.006);
      set("eyeR", -0.18, 0, 0, 0, 0.004, 0.006);
      set("tongue", 0.12, 0, 0, 0, -0.004, 0.008);
    } else if (id === "open") {
      set("jaw", 0.72, 0, 0, 0, -0.02, 0.012);
      set("mouthL", 0.14, 0, -0.12, -0.008, -0.006, 0.006);
      set("mouthR", 0.14, 0, 0.12, 0.008, -0.006, 0.006);
      set("cheekL", 0, 0, 0, -0.005, -0.003, 0);
      set("cheekR", 0, 0, 0, 0.005, -0.003, 0);
      set("tongue", 0.2, 0, 0, 0, -0.008, 0.01);
    }
  }

  setPose(id: PoseId) {
    this.pose = id;
    for (let i = 0; i < this.count; i++) {
      this.poseQ[i]!.identity();
      this.poseOff[i]!.set(0, 0, 0);
    }
    const set = (name: string, ex: number, ey: number, ez: number) => {
      const i = this.byName[name];
      if (i === undefined) return;
      this.poseQ[i]!.setFromEuler(_e.set(ex, ey, ez, "XYZ"));
    };
    if (id === "armsUp") {
      set("lClav", 0, 0, 0.7);
      set("lUpper", -0.25, 0.35, 1.7);
      set("lFore", 0.45, 0, 0.25);
      set("rClav", 0, 0, -0.7);
      set("rUpper", -0.25, -0.35, -1.7);
      set("rFore", 0.45, 0, -0.25);
      set("spine2", -0.1, 0, 0);
    } else if (id === "bow") {
      set("spine1", 0.38, 0, 0);
      set("spine2", 0.42, 0, 0);
      set("spine3", 0.28, 0, 0);
      set("neck", 0.18, 0, 0);
      set("head", 0.12, 0, 0);
    } else if (id === "legLift") {
      set("lThigh", -1.15, 0.05, 0.08);
      set("lShin", 0.85, 0, 0);
      set("lAnkle", 0.2, 0, 0);
      set("spine1", -0.06, 0, 0.04);
    } else if (id === "twist") {
      set("hips", 0, 0.12, 0);
      set("spine1", 0, 0.32, 0);
      set("spine2", 0, 0.38, 0);
      set("spine3", 0, 0.28, 0);
      set("neck", 0, -0.18, 0);
      set("lUpper", 0.15, 0.25, 0.2);
      set("rUpper", 0.15, -0.25, -0.2);
    } else if (id === "sway") {
      set("hips", 0, 0, 0.22);
      set("spine1", 0, 0.18, -0.12);
      set("spine2", 0, 0.22, 0.1);
      set("spine3", 0.08, 0.12, -0.06);
      set("lUpper", 0.2, 0.3, 0.35);
      set("rUpper", 0.2, -0.3, -0.35);
      set("lThigh", 0.08, 0, 0.12);
      set("rThigh", -0.12, 0, -0.08);
    }
  }

  reset() {
    for (let i = 0; i < this.count; i++) {
      this.q[i]!.identity();
      this.qv[i]!.set(0, 0, 0);
      this.off[i]!.set(0, 0, 0);
      this.ov[i]!.set(0, 0, 0);
    }
    this.hold = null;
    this.setPose(this.pose);
    this.setExpression(this.expression);
    this.updateFK();
    this.applyAll();
  }

  shake(strength = 0.08) {
    for (let i = 1; i < this.count; i++) {
      const g = this.group[i];
      const k = g === "breast" ? 18 : g === "hair" ? 10 : 6;
      this.qv[i]!.x += (Math.random() - 0.5) * strength * k;
      this.qv[i]!.y += (Math.random() - 0.5) * strength * k * 0.6;
      this.qv[i]!.z += (Math.random() - 0.5) * strength * k;
      if (g === "breast") {
        this.ov[i]!.x += (Math.random() - 0.5) * strength * 0.4;
        this.ov[i]!.z += (Math.random() - 0.5) * strength * 0.5;
      }
    }
  }

  step(dt: number, params: SkelParams) {
    const d = Math.min(dt, 0.04);
    this.applyHold();
    const held = this.hold?.bone ?? -1;
    const heldParent = held >= 0 ? this.parent[held] : -1;
    const stiff = 10 + params.stiffness * 22;
    const damp = 5 + params.damping * 8;
    const jiggle = 0.35 + params.jiggle * 0.9;
    const breath = params.breathing ? Math.sin(params.time * 1.65) * 0.01 : 0;
    const wind = params.wind * Math.sin(params.time * 1.4) * 0.04;
    const posed = this.pose !== "idle";
    const faced = this.expression !== "rest";
    const spine3 = this.byName.spine3 ?? -1;

    for (let i = 0; i < this.count; i++) {
      const g = this.group[i];
      const locked = i === held || i === heldParent;
      const q = this.q[i]!;
      const qv = this.qv[i]!;
      const off = this.off[i]!;
      const ov = this.ov[i]!;
      const isBreast = g === "breast";
      const isFace = g === "face";
      const isHair = g === "hair";
      const k = isBreast ? stiff * 0.16 : isHair ? stiff * 0.38 : isFace ? stiff * 1.6 : stiff;
      const j = isBreast ? jiggle * 2.1 : isHair ? jiggle * 1.4 : jiggle;

      if (!locked) {
        const targetQ = isFace && faced ? this.exprQ[i]! : posed && g === "body" ? this.poseQ[i]! : IDENTITY;
        _q.copy(q).invert().multiply(targetQ);
        const ang = 2 * Math.acos(Math.min(1, Math.abs(_q.w)));
        if (ang > 1e-5) {
          const s = Math.sqrt(1 - _q.w * _q.w) || 1e-6;
          const sign = _q.w < 0 ? -1 : 1;
          qv.x += sign * (_q.x / s) * ang * k * d;
          qv.y += sign * (_q.y / s) * ang * k * d;
          qv.z += sign * (_q.z / s) * ang * k * d;
        }
        const tOff = isFace && faced ? this.exprOff[i]! : this.poseOff[i]!;
        ov.x += (tOff.x - off.x) * k * 1.1 * d;
        ov.y += (tOff.y - off.y) * k * 1.1 * d;
        ov.z += (tOff.z - off.z) * k * 1.1 * d;
        if (isBreast) {
          ov.y += params.gravity * 0.028 * d;
          if (spine3 >= 0) {
            ov.x += this.qv[spine3]!.y * 0.045;
            ov.z += this.qv[spine3]!.x * 0.04;
            ov.y += this.qv[spine3]!.x * 0.02;
          }
        }
        if (isHair) ov.x += wind * 0.4;
      }

      qv.multiplyScalar(Math.exp(-(isBreast ? damp * 0.45 : damp) * d));
      ov.multiplyScalar(Math.exp(-(isBreast ? damp * 0.4 : damp) * d));

      const spin = qv.length() * d * j;
      if (spin > 1e-8) {
        _axis.copy(qv).normalize();
        _q.setFromAxisAngle(_axis, spin);
        q.premultiply(_q);
        q.normalize();
      }
      off.x += ov.x * d * j;
      off.y += ov.y * d * j;
      off.z += ov.z * d * j;

      const maxA = this.maxAng[i]!;
      const aNow = 2 * Math.acos(Math.min(1, Math.abs(q.w)));
      if (aNow > maxA && aNow > 1e-5) q.slerp(IDENTITY, 1 - maxA / aNow);
      const sl = this.slide[i]!;
      const olen = off.length();
      if (olen > sl && sl > 0) off.multiplyScalar(sl / olen);
      else if (sl === 0 && !isFace) off.set(0, 0, 0);
    }

    const belly = this.byName.belly;
    const spine2 = this.byName.spine2;
    if (belly !== undefined && !this.hold) {
      this.off[belly]!.z += (breath * 1.1 - this.off[belly]!.z) * 0.15;
    }
    if (spine2 !== undefined && !this.hold && this.pose === "idle") {
      _q.setFromAxisAngle(_axis.set(1, 0, 0), breath * 0.25 + wind);
      this.q[spine2]!.slerp(_q, 0.08);
    }
    const lb = this.byName.lBreast;
    const rb = this.byName.rBreast;
    if (lb !== undefined && !this.hold) this.off[lb]!.z += breath * 0.35;
    if (rb !== undefined && !this.hold) this.off[rb]!.z += breath * 0.35;

    this.updateFK();
    this.applyAll();

    let e = 0;
    for (let i = 0; i < this.count; i++) {
      const a = 2 * Math.acos(Math.min(1, Math.abs(this.q[i]!.w)));
      e += a * a + this.off[i]!.lengthSq();
    }
    this.energy = e;
  }

  jointPositions(out: Float32Array) {
    for (let i = 0; i < this.count; i++) {
      out[i * 3] = this.wpos[i]!.x;
      out[i * 3 + 1] = this.wpos[i]!.y;
      out[i * 3 + 2] = this.wpos[i]!.z;
    }
    return out;
  }

  boneLineCount() {
    let n = 0;
    for (let i = 0; i < this.count; i++) if (this.parent[i] >= 0) n++;
    return n;
  }

  writeBoneLines(out: Float32Array) {
    let o = 0;
    for (let i = 0; i < this.count; i++) {
      const p = this.parent[i];
      if (p < 0) continue;
      out[o] = this.wpos[p]!.x;
      out[o + 1] = this.wpos[p]!.y;
      out[o + 2] = this.wpos[p]!.z;
      out[o + 3] = this.wpos[i]!.x;
      out[o + 4] = this.wpos[i]!.y;
      out[o + 5] = this.wpos[i]!.z;
      o += 6;
    }
    return out;
  }

  private applyHold() {
    const h = this.hold;
    if (!h) return;
    if (h.mode === "press") {
      const belly = this.byName.belly ?? h.bone;
      const spine1 = this.byName.spine1;
      this.off[belly]!.set(-h.nx * h.depth, -h.ny * h.depth * 0.35, -h.nz * h.depth);
      if (spine1 !== undefined) {
        _axis.set(1, 0, 0);
        this.q[spine1]!.slerp(_q.setFromAxisAngle(_axis, h.depth * 1.6), 0.45);
      }
      const g = this.group[h.bone];
      if (g === "breast") {
        this.off[h.bone]!.set(-h.nx * h.depth * 1.2, -h.ny * h.depth * 0.5, -h.nz * h.depth * 1.2);
      }
      return;
    }

    let b = h.bone;
    const maxChain = this.group[h.bone] === "foot" ? 4 : 3;
    for (let chain = 0; chain < maxChain && b >= 0; chain++) {
      if (this.names[b] === "hips") break;
      const restx = this.rest[b * 3]!;
      const resty = this.rest[b * 3 + 1]!;
      const restz = this.rest[b * 3 + 2]!;
      _from.set(h.gx - restx, h.gy - resty, h.gz - restz);
      _to.set(h.tx - restx, h.ty - resty, h.tz - restz);
      if (_from.lengthSq() < 1e-8 || _to.lengthSq() < 1e-8) {
        b = this.parent[b]!;
        continue;
      }
      _from.normalize();
      _to.normalize();
      _q.setFromUnitVectors(_from, _to);
      const influence = chain === 0 ? 0.72 : chain === 1 ? 0.38 : 0.16;
      this.q[b]!.slerp(_q, influence);
      const ang = 2 * Math.acos(Math.min(1, Math.abs(this.q[b]!.w)));
      if (ang > this.maxAng[b]!) this.q[b]!.slerp(IDENTITY, 1 - this.maxAng[b]! / ang);
      if (this.slide[b]! > 0 && chain === 0) {
        const pull = _v.set(h.tx - h.gx, h.ty - h.gy, h.tz - h.gz);
        const sl = this.slide[b]!;
        if (pull.length() > sl) pull.setLength(sl);
        this.off[b]!.lerp(pull, 0.4);
      }
      b = this.parent[b]!;
    }
  }

  private updateFK() {
    for (let i = 0; i < this.count; i++) {
      const p = this.parent[i];
      if (p < 0) {
        this.wrot[i]!.copy(this.q[i]!);
        this.wpos[i]!.set(this.rest[i * 3]!, this.rest[i * 3 + 1]!, this.rest[i * 3 + 2]!).add(this.off[i]!);
        continue;
      }
      this.wrot[i]!.copy(this.wrot[p]!).multiply(this.q[i]!);
      _v.set(
        this.rest[i * 3]! - this.rest[p * 3]!,
        this.rest[i * 3 + 1]! - this.rest[p * 3 + 1]!,
        this.rest[i * 3 + 2]! - this.rest[p * 3 + 2]!,
      ).add(this.off[i]!);
      _v.applyQuaternion(this.wrot[p]!);
      this.wpos[i]!.copy(this.wpos[p]!).add(_v);
    }
  }

  private applyAll() {
    for (const b of this.bindings) this.apply(b);
  }

  apply(binding: SkinBinding) {
    const { positions, rest, count, index, weight } = binding;
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const rx = rest[i3]!;
      const ry = rest[i3 + 1]!;
      const rz = rest[i3 + 2]!;
      let ox = 0;
      let oy = 0;
      let oz = 0;
      const o = i * 4;
      for (let k = 0; k < 4; k++) {
        const w = weight[o + k]!;
        if (w < 0.0008) continue;
        const bi = index[o + k]!;
        _v.set(rx - this.rest[bi * 3]!, ry - this.rest[bi * 3 + 1]!, rz - this.rest[bi * 3 + 2]!);
        _v.applyQuaternion(this.wrot[bi]!);
        _v.add(this.wpos[bi]!);
        ox += _v.x * w;
        oy += _v.y * w;
        oz += _v.z * w;
      }
      positions[i3] = ox;
      positions[i3 + 1] = oy;
      positions[i3 + 2] = oz;
    }
  }
}
