import * as THREE from "three";

export type SkelParams = {
  stiffness: number;
  damping: number;
  jiggle: number;
  gravity: number;
  wind: number;
  time: number;
  breathing: boolean;
  rebound: number;
  inflate: number;
  fistDepth: number;
  fistTx: number;
  fistTy: number;
  fistTz: number;
  fistLx: number;
  fistLz: number;
  fistBulge: number;
  fistSpread: number;
  fistLever: number;
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
  softness: Float32Array;
  delta: Float32Array;
  dprev: Float32Array;
};

type Hold =
  | { kind: "pose"; bone: number; gx: number; gy: number; gz: number; tx: number; ty: number; tz: number }
  | { kind: "tissue"; gx: number; gy: number; gz: number; tx: number; ty: number; tz: number; radius: number };

const _q = new THREE.Quaternion();
const _from = new THREE.Vector3();
const _to = new THREE.Vector3();
const _axis = new THREE.Vector3();
const _v = new THREE.Vector3();
const _e = new THREE.Euler();
const IDENTITY = new THREE.Quaternion();
const _c = new THREE.Color();

type Group = "body" | "face" | "hair" | "foot";

type BoneDef = {
  name: string;
  parent: string | null;
  x: number;
  y: number;
  z: number;
  radius: number;
  maxAng: number;
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

function smoother(d: number, r: number) {
  const t = d / Math.max(r, 1e-4);
  if (t >= 1) return 0;
  const u = 1 - t;
  return u * u * u * (u * (u * 6 - 15) + 10);
}

function hueColor(i: number, out: THREE.Color) {
  return out.setHSL((i * 0.17) % 1, 0.62, 0.55);
}

function pt(lm: Record<string, THREE.Vector3>, name: string, fb: THREE.Vector3) {
  return lm[name] ?? fb;
}

export class SoftSkeleton {
  readonly names: string[] = [];
  readonly parent: Int16Array;
  readonly rest: Float32Array;
  readonly radius: Float32Array;
  readonly maxAng: Float32Array;
  readonly group: Group[] = [];
  readonly count: number;
  energy = 0;
  expression: ExpressionId = "rest";
  pose: PoseId = "idle";

  private readonly q: THREE.Quaternion[] = [];
  private readonly qv: THREE.Vector3[] = [];
  private readonly wpos: THREE.Vector3[] = [];
  private readonly wrot: THREE.Quaternion[] = [];
  private readonly poseQ: THREE.Quaternion[] = [];
  private readonly exprQ: THREE.Quaternion[] = [];
  private readonly exprOff: THREE.Vector3[] = [];
  private readonly off: THREE.Vector3[] = [];
  private hold: Hold | null = null;
  private dents: { x: number; y: number; z: number; t: number; force: number; range: number }[] = [];
  private rebound = 0.58;
  private yawVel = 0;
  private pitchVel = 0;
  private yawF = 0;
  private pitchF = 0;
  private readonly brL = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, sx: 0, sy: 0, sz: 0, svx: 0, svy: 0, svz: 0 };
  private readonly brR = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, sx: 0, sy: 0, sz: 0, svx: 0, svy: 0, svz: 0 };
  private readonly bindings: SkinBinding[] = [];
  private readonly headY: number;
  private readonly bustY: number;
  private readonly navelY: number;
  private readonly byName: Record<string, number> = {};

  constructor(lm: Record<string, THREE.Vector3>, height: number) {
    const navel = pt(lm, "navel", new THREE.Vector3(0, height * 0.62, 0.1));
    const ny = navel.y;
    this.navelY = ny;
    this.headY = pt(lm, "head", new THREE.Vector3(0, height * 0.93, 0.02)).y;
    this.bustY = pt(lm, "lBreast", new THREE.Vector3(-0.07, ny + 0.28, 0.08)).y;

    const h = (name: string, x: number, y: number, z: number) => pt(lm, name, new THREE.Vector3(x, y, z));
    const hips = h("hips", 0, ny - 0.12, 0.01);
    const spine1 = h("spine1", 0, ny - 0.01, 0.02);
    const spine2 = h("spine2", 0, ny + 0.11, 0.02);
    const spine3 = h("spine3", 0, ny + 0.27, 0.015);
    const neck = h("neck", 0, ny + 0.41, 0.01);
    const head = h("head", 0, this.headY, 0.02);
    const jaw = h("jaw", 0, this.headY - 0.035, 0.055);
    const eyeL = h("eyeL", -0.03, this.headY + 0.005, 0.07);
    const eyeR = h("eyeR", 0.03, this.headY + 0.005, 0.07);
    const lClav = h("lClav", -0.06, ny + 0.39, 0.01);
    const rClav = h("rClav", 0.06, ny + 0.39, 0.01);
    const lUpper = h("lUpper", -0.16, ny + 0.36, 0.01);
    const rUpper = h("rUpper", 0.16, ny + 0.36, 0.01);
    const lFore = h("lFore", -0.28, ny + 0.08, 0.02);
    const rFore = h("rFore", 0.28, ny + 0.08, 0.02);
    const lHand = h("lHand", -0.42, ny - 0.18, 0.03);
    const rHand = h("rHand", 0.42, ny - 0.18, 0.03);
    const lThigh = h("lThigh", -0.09, ny - 0.22, 0.01);
    const rThigh = h("rThigh", 0.09, ny - 0.22, 0.01);
    const lShin = h("lShin", -0.09, 0.48, 0.02);
    const rShin = h("rShin", 0.09, 0.48, 0.02);
    const lAnkle = h("lAnkle", -0.09, 0.1, 0.03);
    const rAnkle = h("rAnkle", 0.09, 0.1, 0.03);
    const lFoot = h("lFoot", -0.09, 0.035, 0.06);
    const rFoot = h("rFoot", 0.09, 0.035, 0.06);
    const lToe = h("lToe", -0.09, 0.025, 0.13);
    const rToe = h("rToe", 0.09, 0.025, 0.13);
    const hair1 = h("hair1", 0, this.headY + 0.04, -0.03);
    const hair2 = h("hair2", 0, this.headY - 0.12, -0.08);
    const hair3 = h("hair3", 0, this.headY - 0.3, -0.07);
    const hair4 = h("hair4", 0, this.headY - 0.5, -0.04);
    const hair5 = h("hair5", 0, this.headY - 0.7, -0.02);

    const defs: BoneDef[] = [
      { name: "hips", parent: null, x: hips.x, y: hips.y, z: hips.z, radius: 0.16, maxAng: 0.35, group: "body" },
      { name: "spine1", parent: "hips", x: spine1.x, y: spine1.y, z: spine1.z, radius: 0.15, maxAng: 0.55, group: "body" },
      { name: "spine2", parent: "spine1", x: spine2.x, y: spine2.y, z: spine2.z, radius: 0.15, maxAng: 0.5, group: "body" },
      { name: "spine3", parent: "spine2", x: spine3.x, y: spine3.y, z: spine3.z, radius: 0.17, maxAng: 0.45, group: "body" },
      { name: "neck", parent: "spine3", x: neck.x, y: neck.y, z: neck.z, radius: 0.08, maxAng: 0.7, group: "body" },
      { name: "head", parent: "neck", x: head.x, y: head.y, z: head.z, radius: 0.12, maxAng: 0.55, group: "body" },
      { name: "jaw", parent: "head", x: jaw.x, y: jaw.y, z: jaw.z, radius: 0.055, maxAng: 0.7, group: "face" },
      { name: "browL", parent: "head", x: eyeL.x, y: eyeL.y + 0.018, z: eyeL.z - 0.01, radius: 0.04, maxAng: 0.4, group: "face" },
      { name: "browR", parent: "head", x: eyeR.x, y: eyeR.y + 0.018, z: eyeR.z - 0.01, radius: 0.04, maxAng: 0.4, group: "face" },
      { name: "eyeL", parent: "head", x: eyeL.x, y: eyeL.y, z: eyeL.z, radius: 0.032, maxAng: 0.3, group: "face" },
      { name: "eyeR", parent: "head", x: eyeR.x, y: eyeR.y, z: eyeR.z, radius: 0.032, maxAng: 0.3, group: "face" },
      { name: "cheekL", parent: "head", x: jaw.x - 0.038, y: jaw.y + 0.012, z: jaw.z, radius: 0.04, maxAng: 0.3, group: "face" },
      { name: "cheekR", parent: "head", x: jaw.x + 0.038, y: jaw.y + 0.012, z: jaw.z, radius: 0.04, maxAng: 0.3, group: "face" },
      { name: "mouthL", parent: "jaw", x: jaw.x - 0.02, y: jaw.y - 0.002, z: jaw.z + 0.012, radius: 0.03, maxAng: 0.4, group: "face" },
      { name: "mouthR", parent: "jaw", x: jaw.x + 0.02, y: jaw.y - 0.002, z: jaw.z + 0.012, radius: 0.03, maxAng: 0.4, group: "face" },
      { name: "tongue", parent: "jaw", x: jaw.x, y: jaw.y - 0.008, z: jaw.z, radius: 0.024, maxAng: 0.45, group: "face" },
      { name: "hair1", parent: "head", x: hair1.x, y: hair1.y, z: hair1.z, radius: 0.12, maxAng: 0.55, group: "hair" },
      { name: "hair2", parent: "hair1", x: hair2.x, y: hair2.y, z: hair2.z, radius: 0.13, maxAng: 0.75, group: "hair" },
      { name: "hair3", parent: "hair2", x: hair3.x, y: hair3.y, z: hair3.z, radius: 0.13, maxAng: 0.9, group: "hair" },
      { name: "hair4", parent: "hair3", x: hair4.x, y: hair4.y, z: hair4.z, radius: 0.13, maxAng: 1.0, group: "hair" },
      { name: "hair5", parent: "hair4", x: hair5.x, y: hair5.y, z: hair5.z, radius: 0.12, maxAng: 1.1, group: "hair" },
      { name: "belly", parent: "spine1", x: navel.x, y: navel.y, z: navel.z - 0.05, radius: 0.14, maxAng: 0.25, group: "body" },
      { name: "lClav", parent: "spine3", x: lClav.x, y: lClav.y, z: lClav.z, radius: 0.08, maxAng: 0.55, group: "body" },
      { name: "lUpper", parent: "lClav", x: lUpper.x, y: lUpper.y, z: lUpper.z, radius: 0.1, maxAng: 1.2, group: "body" },
      { name: "lFore", parent: "lUpper", x: lFore.x, y: lFore.y, z: lFore.z, radius: 0.08, maxAng: 1.3, group: "body" },
      { name: "lHand", parent: "lFore", x: lHand.x, y: lHand.y, z: lHand.z, radius: 0.06, maxAng: 0.8, group: "body" },
      { name: "rClav", parent: "spine3", x: rClav.x, y: rClav.y, z: rClav.z, radius: 0.08, maxAng: 0.55, group: "body" },
      { name: "rUpper", parent: "rClav", x: rUpper.x, y: rUpper.y, z: rUpper.z, radius: 0.1, maxAng: 1.2, group: "body" },
      { name: "rFore", parent: "rUpper", x: rFore.x, y: rFore.y, z: rFore.z, radius: 0.08, maxAng: 1.3, group: "body" },
      { name: "rHand", parent: "rFore", x: rHand.x, y: rHand.y, z: rHand.z, radius: 0.06, maxAng: 0.8, group: "body" },
      { name: "lThigh", parent: "hips", x: lThigh.x, y: lThigh.y, z: lThigh.z, radius: 0.12, maxAng: 0.9, group: "body" },
      { name: "lShin", parent: "lThigh", x: lShin.x, y: lShin.y, z: lShin.z, radius: 0.1, maxAng: 1.0, group: "body" },
      { name: "lAnkle", parent: "lShin", x: lAnkle.x, y: lAnkle.y, z: lAnkle.z, radius: 0.08, maxAng: 0.8, group: "foot" },
      { name: "lFoot", parent: "lAnkle", x: lFoot.x, y: lFoot.y, z: lFoot.z, radius: 0.08, maxAng: 0.6, group: "foot" },
      { name: "lToe", parent: "lFoot", x: lToe.x, y: lToe.y, z: lToe.z, radius: 0.06, maxAng: 0.45, group: "foot" },
      { name: "rThigh", parent: "hips", x: rThigh.x, y: rThigh.y, z: rThigh.z, radius: 0.12, maxAng: 0.9, group: "body" },
      { name: "rShin", parent: "rThigh", x: rShin.x, y: rShin.y, z: rShin.z, radius: 0.1, maxAng: 1.0, group: "body" },
      { name: "rAnkle", parent: "rShin", x: rAnkle.x, y: rAnkle.y, z: rAnkle.z, radius: 0.08, maxAng: 0.8, group: "foot" },
      { name: "rFoot", parent: "rAnkle", x: rFoot.x, y: rFoot.y, z: rFoot.z, radius: 0.08, maxAng: 0.6, group: "foot" },
      { name: "rToe", parent: "rFoot", x: rToe.x, y: rToe.y, z: rToe.z, radius: 0.06, maxAng: 0.45, group: "foot" },
    ];

    this.count = defs.length;
    this.parent = new Int16Array(this.count);
    this.rest = new Float32Array(this.count * 3);
    this.radius = new Float32Array(this.count);
    this.maxAng = new Float32Array(this.count);

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
      this.q.push(new THREE.Quaternion());
      this.qv.push(new THREE.Vector3());
      this.off.push(new THREE.Vector3());
      this.wpos.push(new THREE.Vector3(b.x, b.y, b.z));
      this.wrot.push(new THREE.Quaternion());
      this.poseQ.push(new THREE.Quaternion());
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
    const softness = new Float32Array(n);
    const delta = new Float32Array(n * 3);
    const dprev = new Float32Array(n * 3);
    const scores = new Float32Array(this.count);
    const allow = this.allowedBones(hint);
    const hy = this.headY;
    const by = this.bustY;
    const ny = this.navelY;

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
        scores[b] = smoother(d, this.radius[b]! * 1.35);
      }
      const bi = [0, 0, 0, 0];
      const bw = [-1, -1, -1, -1];
      for (let b = 0; b < this.count; b++) {
        const s = scores[b]!;
        if (s > bw[0]!) {
          bw[3] = bw[2];
          bi[3] = bi[2];
          bw[2] = bw[1];
          bi[2] = bi[1];
          bw[1] = bw[0];
          bi[1] = bi[0];
          bw[0] = s;
          bi[0] = b;
        } else if (s > bw[1]!) {
          bw[3] = bw[2];
          bi[3] = bi[2];
          bw[2] = bw[1];
          bi[2] = bi[1];
          bw[1] = s;
          bi[1] = b;
        } else if (s > bw[2]!) {
          bw[3] = bw[2];
          bi[3] = bi[2];
          bw[2] = s;
          bi[2] = b;
        } else if (s > bw[3]!) {
          bw[3] = s;
          bi[3] = b;
        }
      }
      let sum = bw[0]! + bw[1]! + bw[2]! + bw[3]!;
      if (sum < 1e-6) {
        bi[0] = allow[0] ?? 0;
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

      const front = THREE.MathUtils.clamp((z + 0.02) / 0.12, 0, 1);
      const belly =
        smoother(Math.abs(y - ny), 0.11) * smoother(Math.abs(x), 0.13) * front;
      const chest =
        smoother(Math.abs(y - by), 0.09) * smoother(Math.abs(Math.abs(x) - 0.07), 0.08) * front;
      const cheek = hint === "face" || hint === "mouth" ? smoother(Math.abs(y - (hy - 0.03)), 0.04) : 0;
      let soft = 0.12;
      if (hint === "dress") soft = 0.22 + belly * 0.7 + chest * 0.78;
      else if (hint === "organs") soft = 0.82;
      else if (hint === "hair") soft = 0.45;
      else if (hint === "legs") soft = y < 0.2 ? 0.2 : 0.35;
      else if (hint === "face" || hint === "mouth" || hint === "eye") soft = 0.2 + cheek * 0.4;
      softness[i] = Math.min(1, soft);
    }

    const binding: SkinBinding = { positions, rest, count: n, index, weight, colors, softness, delta, dprev };
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
      else if (hint === "dress") ok = g === "body";
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
      if (y < 0.2 && g === "foot") s *= 0.4;
      if (s < bestS) {
        bestS = s;
        best = b;
      }
    }
    return best;
  }

  setPoseDrag(bone: number, gx: number, gy: number, gz: number, tx: number, ty: number, tz: number) {
    this.hold = { kind: "pose", bone, gx, gy, gz, tx, ty, tz };
  }

  setTissueDrag(gx: number, gy: number, gz: number, tx: number, ty: number, tz: number, radius = 0.14) {
    this.hold = { kind: "tissue", gx, gy, gz, tx, ty, tz, radius };
  }

  clearHold() {
    this.hold = null;
  }

  pushViewSpin(yawVel: number, pitchVel: number) {
    this.yawVel = THREE.MathUtils.clamp(yawVel, -12, 12);
    this.pitchVel = THREE.MathUtils.clamp(pitchVel, -8, 8);
  }

  commitPose() {
    for (let i = 0; i < this.count; i++) this.poseQ[i]!.copy(this.q[i]!);
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
    } else if (id === "open") {
      set("jaw", 0.72, 0, 0, 0, -0.02, 0.012);
      set("mouthL", 0.14, 0, -0.12, -0.008, -0.006, 0.006);
      set("mouthR", 0.14, 0, 0.12, 0.008, -0.006, 0.006);
      set("tongue", 0.2, 0, 0, 0, -0.008, 0.01);
    }
  }

  setPose(id: PoseId) {
    this.pose = id;
    for (let i = 0; i < this.count; i++) this.poseQ[i]!.identity();
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
      this.poseQ[i]!.identity();
    }
    for (const b of this.bindings) {
      b.delta.fill(0);
      b.dprev.fill(0);
    }
    this.brL.x = this.brL.y = this.brL.z = this.brL.vx = this.brL.vy = this.brL.vz = 0;
    this.brL.sx = this.brL.sy = this.brL.sz = this.brL.svx = this.brL.svy = this.brL.svz = 0;
    this.brR.x = this.brR.y = this.brR.z = this.brR.vx = this.brR.vy = this.brR.vz = 0;
    this.brR.sx = this.brR.sy = this.brR.sz = this.brR.svx = this.brR.svy = this.brR.svz = 0;
    this.yawF = this.pitchF = this.yawVel = this.pitchVel = 0;
    this.hold = null;
    this.dents.length = 0;
    this.setPose(this.pose);
    this.setExpression(this.expression);
    this.updateFK();
    this.applyAll();
  }

  shake(strength = 0.08) {
    for (const b of this.bindings) {
      for (let i = 0; i < b.count; i++) {
        const s = b.softness[i]! * strength;
        if (s < 0.002) continue;
        b.dprev[i * 3]! += (Math.random() - 0.5) * s * 0.8;
        b.dprev[i * 3 + 1]! += (Math.random() - 0.5) * s * 0.5;
        b.dprev[i * 3 + 2]! += (Math.random() - 0.5) * s;
      }
    }
  }

  impulse(x: number, y: number, z: number, force: number, range: number) {
    const f = THREE.MathUtils.clamp(force, 0.08, 1.15);
    const rg = THREE.MathUtils.clamp(range, 0.08, 1);
    const sig = 0.04 + rg * 0.1;
    const sig2 = sig * sig;
    const depth = 0.032 + f * 0.078;
    this.dents.push({ x, y, z, t: 0, force: f, range: rg });
    if (this.dents.length > 3) this.dents.shift();
    for (const bind of this.bindings) {
      const { count, rest, softness, delta, dprev } = bind;
      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const dx = rest[i3]! - x;
        const dy = rest[i3 + 1]! - y;
        const dz = rest[i3 + 2]! - z;
        const r2 = dx * dx + dy * dy;
        const crater = Math.exp(-r2 / sig2);
        if (crater < 0.02) continue;
        const front = THREE.MathUtils.clamp((rest[i3 + 2]! + 0.02) / 0.12, 0.15, 1);
        const wall = THREE.MathUtils.clamp(softness[i]! * 2.8 + 0.4, 0.4, 1);
        const sink = crater * depth * front * wall;
        const inv = 1 / Math.max(1e-4, Math.hypot(dx, dy));
        delta[i3] += dx * inv * sink * 0.35;
        delta[i3 + 1] += dy * inv * sink * 0.28;
        delta[i3 + 2] -= sink;
        dprev[i3] += dx * inv * sink * 1.1;
        dprev[i3 + 1] += dy * inv * sink * 0.85;
        dprev[i3 + 2] -= sink * 2.4;
      }
    }
    for (let b = 0; b < this.count; b++) {
      if (this.names[b] !== "belly" && this.names[b] !== "spine1") continue;
      this.qv[b]!.z += f * (this.names[b] === "belly" ? 2.4 : 0.7);
    }
  }

  step(dt: number, params: SkelParams) {
    const d = Math.min(dt, 0.04);
    this.rebound = THREE.MathUtils.clamp(params.rebound, 0, 1);
    this.applyHoldPose();
    const heldBone = this.hold?.kind === "pose" ? this.hold.bone : -1;
    const heldParent = heldBone >= 0 ? this.parent[heldBone] : -1;
    const stiff = 14 + params.stiffness * 18;
    const damp = 6 + params.damping * 7;
    const jiggle = 0.4 + params.jiggle * 0.85;

    for (let i = 0; i < this.count; i++) {
      const g = this.group[i];
      const locked = i === heldBone || i === heldParent;
      const q = this.q[i]!;
      const qv = this.qv[i]!;
      const isFace = g === "face";
      const targetQ = isFace && this.expression !== "rest" ? this.exprQ[i]! : this.poseQ[i]!;
      if (!locked) {
        _q.copy(q).invert().multiply(targetQ);
        const ang = 2 * Math.acos(Math.min(1, Math.abs(_q.w)));
        if (ang > 1e-5) {
          const s = Math.sqrt(1 - _q.w * _q.w) || 1e-6;
          const sign = _q.w < 0 ? -1 : 1;
          const k = isFace ? stiff * 1.5 : stiff;
          qv.x += sign * (_q.x / s) * ang * k * d;
          qv.y += sign * (_q.y / s) * ang * k * d;
          qv.z += sign * (_q.z / s) * ang * k * d;
        }
      }
      qv.multiplyScalar(Math.exp(-damp * d));
      const spin = qv.length() * d * (g === "hair" ? jiggle * 1.3 : 0.55);
      if (spin > 1e-8) {
        _axis.copy(qv).normalize();
        _q.setFromAxisAngle(_axis, spin);
        q.premultiply(_q);
        q.normalize();
      }
      const maxA = this.maxAng[i]!;
      const aNow = 2 * Math.acos(Math.min(1, Math.abs(q.w)));
      if (aNow > maxA && aNow > 1e-5) q.slerp(IDENTITY, 1 - maxA / aNow);
    }

    this.updateFK();
    this.stepDents(d);
    this.stepTissue(d, params);
    this.stepBreasts(d, params);
    this.applyAll();

    let e = 0;
    for (let i = 0; i < this.count; i++) {
      const a = 2 * Math.acos(Math.min(1, Math.abs(this.q[i]!.w)));
      e += a * a;
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

  private applyHoldPose() {
    const h = this.hold;
    if (!h || h.kind !== "pose") return;
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
      const influence = chain === 0 ? 0.78 : chain === 1 ? 0.4 : 0.16;
      this.q[b]!.slerp(_q, influence);
      const ang = 2 * Math.acos(Math.min(1, Math.abs(this.q[b]!.w)));
      if (ang > this.maxAng[b]!) this.q[b]!.slerp(IDENTITY, 1 - this.maxAng[b]! / ang);
      b = this.parent[b]!;
    }
  }

  get hasDents() {
    return this.dents.length > 0;
  }

  private stepDents(d: number) {
    const rec = 0.5 + (1 - this.rebound) * 3.4;
    const hold = 0.18 + (1 - this.rebound) * 0.28;
    for (const dent of this.dents) dent.t += d;
    this.dents = this.dents.filter((dent) => dent.t < hold + rec + 0.15);
  }

  private dentGain(t: number) {
    const hold = 0.18 + (1 - this.rebound) * 0.28;
    const rec = 0.5 + (1 - this.rebound) * 3.4;
    if (t < 0.055) {
      const u = t / 0.055;
      return u * u;
    }
    if (t < hold) return 1;
    const u = Math.min(1, (t - hold) / rec);
    const s = 1 - u;
    return s * s * (3 - 2 * s);
  }

  private stepTissue(d: number, params: SkelParams) {
    const breath = params.breathing ? Math.sin(params.time * 1.55) * 0.011 : 0;
    const grab = this.hold?.kind === "tissue" ? this.hold : null;
    const k = 18 + params.stiffness * 26;
    const damp = Math.exp(-(4 + params.damping * 6) * d);
    const g = params.gravity * 0.0009;
    const ny = this.navelY;
    const by = this.bustY;

    for (const bind of this.bindings) {
      const { count, rest, softness, delta, dprev } = bind;
      for (let i = 0; i < count; i++) {
        const s = softness[i]!;
        if (s < 0.02) {
          delta[i * 3] = 0;
          delta[i * 3 + 1] = 0;
          delta[i * 3 + 2] = 0;
          continue;
        }
        const i3 = i * 3;
        const x = rest[i3]!;
        const y = rest[i3 + 1]!;
        const z = rest[i3 + 2]!;
        let tx = 0;
        let ty = 0;
        let tz = 0;
        const belly = smoother(Math.abs(y - ny), 0.12) * smoother(Math.abs(x), 0.14);
        const chest = smoother(Math.abs(y - by), 0.1) * smoother(Math.abs(Math.abs(x) - 0.07), 0.09);
        const front = THREE.MathUtils.clamp((z + 0.01) / 0.11, 0, 1);
        tz += breath * (0.55 * belly + 0.4 * chest) * front;
        ty += breath * 0.08 * chest * front;
        if (params.fistDepth > 0.03) {
          const fd = params.fistDepth;
          const bAmp = params.fistBulge;
          const spread = Math.max(0.2, params.fistSpread);
          const dx = x - params.fistTx;
          const dy = y - params.fistTy;
          const bulge = smoother(Math.hypot(dx, dy), 0.16 * spread) * front;
          tz += fd * 0.28 * bAmp * bulge;
          ty += fd * 0.09 * bAmp * bulge;
          tx += params.fistLx * 0.07 * fd * bulge * 6 * params.fistLever;
          tz += params.fistLz * 0.05 * fd * bulge * 6 * params.fistLever;
        }
        const inf = params.inflate;
        if (Math.abs(inf) > 0.004) {
          const yMask = smoother(Math.abs(y - ny), 0.2);
          const xMask = smoother(Math.abs(x), 0.22);
          const zMask = THREE.MathUtils.clamp((z + 0.04) / 0.14, 0, 1);
          const mask = yMask * xMask * (0.28 + 0.72 * zMask);
          if (mask > 0.01) {
            if (inf > 0) {
              tz += inf * 0.24 * mask;
              tx += Math.sign(x) * inf * 0.15 * mask * Math.min(1, Math.abs(x) / 0.035);
              ty -= inf * 0.045 * mask * zMask;
            } else {
              const c = -inf;
              tx += -x * c * 0.9 * yMask * xMask;
              tz -= c * 0.08 * mask;
              ty += c * 0.02 * mask;
            }
          }
        }
        if (this.dents.length) {
          for (const dent of this.dents) {
            const gain = this.dentGain(dent.t);
            if (gain < 0.01) continue;
            const dx = x - dent.x;
            const dy = y - dent.y;
            const r2 = dx * dx + dy * dy;
            const sig = 0.04 + dent.range * 0.1;
            const crater = Math.exp(-r2 / (sig * sig));
            const r = Math.sqrt(r2);
            const rim = Math.exp(-((r - sig * 1.12) / (sig * 0.42)) * ((r - sig * 1.12) / (sig * 0.42)));
            const depth = (0.03 + dent.force * 0.08) * gain;
            const wall = THREE.MathUtils.clamp(s * 2.6 + 0.45, 0.45, 1) * front;
            const sink = crater * depth * wall;
            tz -= sink;
            tz += rim * depth * 0.22 * wall;
            const inv = r < 1e-4 ? 0 : 1 / r;
            tx += dx * inv * sink * 0.32;
            ty += dy * inv * sink * 0.26;
          }
        }
        if (grab) {
          const dx = x - grab.gx;
          const dy = y - grab.gy;
          const dz = z - grab.gz;
          const w = s * Math.exp(-(dx * dx + dy * dy + dz * dz) / (grab.radius * grab.radius));
          tx += (grab.tx - grab.gx) * w;
          ty += (grab.ty - grab.gy) * w;
          tz += (grab.tz - grab.gz) * w;
        }
        let vx = (delta[i3]! - dprev[i3]!) * damp;
        let vy = (delta[i3 + 1]! - dprev[i3 + 1]!) * damp;
        let vz = (delta[i3 + 2]! - dprev[i3 + 2]!) * damp;
        vy += g * s * belly * 0.2;
        const bounce = 0.62 + chest * -0.08;
        vx += (tx - delta[i3]!) * k * d * bounce;
        vy += (ty - delta[i3 + 1]!) * k * d * bounce;
        vz += (tz - delta[i3 + 2]!) * k * d * bounce;
        dprev[i3] = delta[i3]!;
        dprev[i3 + 1] = delta[i3 + 1]!;
        dprev[i3 + 2] = delta[i3 + 2]!;
        delta[i3] = delta[i3]! + vx;
        delta[i3 + 1] = delta[i3 + 1]! + vy;
        delta[i3 + 2] = delta[i3 + 2]! + vz;
        const lim = 0.12 + s * 0.04 + Math.abs(params.inflate) * 0.18 + Math.min(0.2, params.fistDepth * 0.45 * params.fistBulge);
        const len = Math.hypot(delta[i3]!, delta[i3 + 1]!, delta[i3 + 2]!);
        if (len > lim) {
          const m = lim / len;
          delta[i3]! *= m;
          delta[i3 + 1]! *= m;
          delta[i3 + 2]! *= m;
        }
      }
    }
  }

  private stepBreasts(d: number, params: SkelParams) {
    const follow = 1 - Math.exp(-6 * d);
    this.yawF += (this.yawVel - this.yawF) * follow;
    this.pitchF += (this.pitchVel - this.pitchF) * follow;
    const j = 0.5 + params.jiggle * 0.7;
    const tX = -this.yawF * 0.013 * j;
    const tY = this.pitchF * 0.007 * j;
    const tZ = Math.abs(this.yawF) * 0.0028 * j;
    const w1 = 5.1;
    const z1 = 0.62;
    const k1 = w1 * w1;
    const c1 = 2 * z1 * w1;
    const w2 = 10.4;
    const z2 = 0.32;
    const k2 = w2 * w2;
    const c2 = 2 * z2 * w2;
    const lim = 0.042;
    const step = (
      m: {
        x: number; y: number; z: number; vx: number; vy: number; vz: number;
        sx: number; sy: number; sz: number; svx: number; svy: number; svz: number;
      },
      lag: number,
    ) => {
      m.vx += (-k1 * (m.x - tX * lag) - c1 * m.vx) * d;
      m.vy += (-k1 * (m.y - tY * lag) - c1 * m.vy) * d;
      m.vz += (-k1 * (m.z - tZ * lag) - c1 * m.vz) * d;
      m.x += m.vx * d;
      m.y += m.vy * d;
      m.z += m.vz * d;
      m.svx += (-k2 * (m.sx - m.x) - c2 * (m.svx - m.vx)) * d;
      m.svy += (-k2 * (m.sy - m.y) - c2 * (m.svy - m.vy)) * d;
      m.svz += (-k2 * (m.sz - m.z) - c2 * (m.svz - m.vz)) * d;
      m.sx += m.svx * d;
      m.sy += m.svy * d;
      m.sz += m.svz * d;
      const len = Math.hypot(m.sx, m.sy, m.sz);
      if (len > lim) {
        const s = lim / len;
        m.sx *= s;
        m.sy *= s;
        m.sz *= s;
      }
    };
    step(this.brL, 1);
    step(this.brR, 1.08);
  }

  private updateFK() {
    for (let i = 0; i < this.count; i++) {
      const p = this.parent[i];
      const ox = this.exprOff[i]!.x;
      const oy = this.exprOff[i]!.y;
      const oz = this.exprOff[i]!.z;
      if (p < 0) {
        this.wrot[i]!.copy(this.q[i]!);
        this.wpos[i]!.set(this.rest[i * 3]! + ox, this.rest[i * 3 + 1]! + oy, this.rest[i * 3 + 2]! + oz);
        continue;
      }
      this.wrot[i]!.copy(this.wrot[p]!).multiply(this.q[i]!);
      _v.set(
        this.rest[i * 3]! - this.rest[p * 3]! + ox,
        this.rest[i * 3 + 1]! - this.rest[p * 3 + 1]! + oy,
        this.rest[i * 3 + 2]! - this.rest[p * 3 + 2]! + oz,
      );
      _v.applyQuaternion(this.wrot[p]!);
      this.wpos[i]!.copy(this.wpos[p]!).add(_v);
    }
  }

  private applyAll() {
    for (const b of this.bindings) this.apply(b);
  }

  apply(binding: SkinBinding) {
    const { positions, rest, count, index, weight, delta } = binding;
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
      positions[i3] = ox + delta[i3]!;
      positions[i3 + 1] = oy + delta[i3 + 1]!;
      positions[i3 + 2] = oz + delta[i3 + 2]!;
      const chest =
        smoother(Math.abs(ry - this.bustY), 0.13) *
        smoother(Math.abs(Math.abs(rx) - 0.075), 0.11) *
        THREE.MathUtils.clamp((rz + 0.02) / 0.12, 0, 1);
      if (chest > 0.04) {
        const br = rx < 0 ? this.brL : this.brR;
        const hang = THREE.MathUtils.clamp((this.bustY + 0.04 - ry) / 0.14, 0.15, 1);
        const w = chest * (0.4 + 0.6 * hang);
        positions[i3] += br.sx * w;
        positions[i3 + 1] += br.sy * w;
        positions[i3 + 2] += br.sz * w;
      }
    }
  }
}
