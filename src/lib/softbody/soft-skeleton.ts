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

export type SkinBinding = {
  positions: Float32Array;
  rest: Float32Array;
  count: number;
  index: Uint8Array;
  weight: Float32Array;
};

type Hold =
  | { mode: "drag"; bone: number; gx: number; gy: number; gz: number; tx: number; ty: number; tz: number }
  | { mode: "press"; bone: number; nx: number; ny: number; nz: number; depth: number };

const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _qa: THREE.Quaternion[] = [];
const _from = new THREE.Vector3();
const _to = new THREE.Vector3();
const _axis = new THREE.Vector3();
const _v = new THREE.Vector3();
const _wpos: THREE.Vector3[] = [];
const IDENTITY = new THREE.Quaternion();

type BoneInit = {
  name: string;
  parent: number;
  x: number;
  y: number;
  z: number;
  radius: number;
  maxAng: number;
  slide: number;
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

export class SoftSkeleton {
  readonly names: string[] = [];
  readonly parent: Int16Array;
  readonly rest: Float32Array;
  readonly radius: Float32Array;
  readonly maxAng: Float32Array;
  readonly slide: Float32Array;
  readonly count: number;
  energy = 0;

  private readonly q: THREE.Quaternion[] = [];
  private readonly qv: THREE.Vector3[] = [];
  private readonly off: THREE.Vector3[] = [];
  private readonly ov: THREE.Vector3[] = [];
  private readonly wpos: THREE.Vector3[] = [];
  private readonly wrot: THREE.Quaternion[] = [];
  private hold: Hold | null = null;
  private readonly bindings: SkinBinding[] = [];

  constructor(navel: THREE.Vector3, height: number, armSpan: number) {
    const ny = navel.y;
    const nz = navel.z * 0.15;
    const as = Math.min(0.5, Math.max(0.34, armSpan));
    const bones: BoneInit[] = [
      { name: "hips", parent: -1, x: 0, y: ny - 0.13, z: nz, radius: 0.13, maxAng: 0.18, slide: 0 },
      { name: "spine1", parent: 0, x: 0, y: ny - 0.02, z: nz + 0.01, radius: 0.11, maxAng: 0.55, slide: 0.02 },
      { name: "spine2", parent: 1, x: 0, y: ny + 0.12, z: nz + 0.012, radius: 0.1, maxAng: 0.5, slide: 0.015 },
      { name: "spine3", parent: 2, x: 0, y: ny + 0.26, z: nz + 0.008, radius: 0.12, maxAng: 0.45, slide: 0.01 },
      { name: "neck", parent: 3, x: 0, y: ny + 0.42, z: nz, radius: 0.055, maxAng: 0.6, slide: 0 },
      { name: "head", parent: 4, x: 0, y: height * 0.95, z: nz + 0.02, radius: 0.1, maxAng: 0.5, slide: 0 },
      { name: "belly", parent: 1, x: 0, y: ny, z: navel.z - 0.05, radius: 0.12, maxAng: 0.35, slide: 0.08 },
      { name: "lClav", parent: 3, x: -0.07, y: ny + 0.38, z: nz, radius: 0.06, maxAng: 0.5, slide: 0 },
      { name: "lUpper", parent: 7, x: -as * 0.42, y: ny + 0.32, z: nz, radius: 0.07, maxAng: 1.1, slide: 0 },
      { name: "lFore", parent: 8, x: -as * 0.72, y: ny - 0.02, z: nz + 0.02, radius: 0.055, maxAng: 1.3, slide: 0 },
      { name: "rClav", parent: 3, x: 0.07, y: ny + 0.38, z: nz, radius: 0.06, maxAng: 0.5, slide: 0 },
      { name: "rUpper", parent: 10, x: as * 0.42, y: ny + 0.32, z: nz, radius: 0.07, maxAng: 1.1, slide: 0 },
      { name: "rFore", parent: 11, x: as * 0.72, y: ny - 0.02, z: nz + 0.02, radius: 0.055, maxAng: 1.3, slide: 0 },
      { name: "lThigh", parent: 0, x: -0.085, y: ny - 0.22, z: nz, radius: 0.09, maxAng: 0.7, slide: 0 },
      { name: "lShin", parent: 13, x: -0.09, y: 0.46, z: nz + 0.01, radius: 0.07, maxAng: 0.9, slide: 0 },
      { name: "rThigh", parent: 0, x: 0.085, y: ny - 0.22, z: nz, radius: 0.09, maxAng: 0.7, slide: 0 },
      { name: "rShin", parent: 15, x: 0.09, y: 0.46, z: nz + 0.01, radius: 0.07, maxAng: 0.9, slide: 0 },
    ];

    this.count = bones.length;
    this.parent = new Int16Array(this.count);
    this.rest = new Float32Array(this.count * 3);
    this.radius = new Float32Array(this.count);
    this.maxAng = new Float32Array(this.count);
    this.slide = new Float32Array(this.count);

    for (let i = 0; i < this.count; i++) {
      const b = bones[i]!;
      this.names.push(b.name);
      this.parent[i] = b.parent;
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
      if (!_qa[i]) _qa[i] = new THREE.Quaternion();
      if (!_wpos[i]) _wpos[i] = new THREE.Vector3();
    }
    this.updateFK();
  }

  bind(positions: Float32Array): SkinBinding {
    const n = positions.length / 3;
    const index = new Uint8Array(n * 4);
    const weight = new Float32Array(n * 4);
    const rest = new Float32Array(positions);
    const scores = new Float32Array(this.count);

    for (let i = 0; i < n; i++) {
      const x = positions[i * 3]!;
      const y = positions[i * 3 + 1]!;
      const z = positions[i * 3 + 2]!;
      for (let b = 0; b < this.count; b++) {
        const p = this.parent[b];
        const bx = this.rest[b * 3]!;
        const by = this.rest[b * 3 + 1]!;
        const bz = this.rest[b * 3 + 2]!;
        let d: number;
        if (p < 0) {
          const dx = x - bx;
          const dy = y - by;
          const dz = z - bz;
          d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        } else {
          d = distToSeg(x, y, z, this.rest[p * 3]!, this.rest[p * 3 + 1]!, this.rest[p * 3 + 2]!, bx, by, bz);
        }
        const r = this.radius[b]!;
        const s = Math.exp(-((d / r) * (d / r)));
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
        bi[0] = 0; bw[0] = 1; bw[1] = 0; bw[2] = 0; bw[3] = 0; sum = 1;
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
    }

    const binding: SkinBinding = { positions, rest, count: n, index, weight };
    this.bindings.push(binding);
    return binding;
  }

  pickBone(x: number, y: number, z: number) {
    let best = 1;
    let bestS = Infinity;
    for (let b = 0; b < this.count; b++) {
      if (this.names[b] === "hips") continue;
      const p = this.parent[b];
      const bx = this.rest[b * 3]!;
      const by = this.rest[b * 3 + 1]!;
      const bz = this.rest[b * 3 + 2]!;
      let d: number;
      if (p < 0) {
        d = Math.hypot(x - bx, y - by, z - bz);
      } else {
        d = distToSeg(x, y, z, this.rest[p * 3]!, this.rest[p * 3 + 1]!, this.rest[p * 3 + 2]!, bx, by, bz);
      }
      const s = d / this.radius[b]!;
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

  reset() {
    for (let i = 0; i < this.count; i++) {
      this.q[i]!.identity();
      this.qv[i]!.set(0, 0, 0);
      this.off[i]!.set(0, 0, 0);
      this.ov[i]!.set(0, 0, 0);
    }
    this.hold = null;
    this.updateFK();
    this.applyAll();
  }

  shake(strength = 0.08) {
    for (let i = 1; i < this.count; i++) {
      this.qv[i]!.x += (Math.random() - 0.5) * strength * 8;
      this.qv[i]!.y += (Math.random() - 0.5) * strength * 6;
      this.qv[i]!.z += (Math.random() - 0.5) * strength * 8;
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

    for (let i = 0; i < this.count; i++) {
      const locked = i === held || i === heldParent;
      const q = this.q[i]!;
      const qv = this.qv[i]!;
      const off = this.off[i]!;
      const ov = this.ov[i]!;

      if (!locked) {
        const ang = 2 * Math.acos(Math.min(1, Math.abs(q.w)));
        if (ang > 1e-5) {
          const s = Math.sqrt(1 - q.w * q.w) || 1e-6;
          const sign = q.w < 0 ? -1 : 1;
          qv.x -= sign * (q.x / s) * ang * stiff * d;
          qv.y -= sign * (q.y / s) * ang * stiff * d;
          qv.z -= sign * (q.z / s) * ang * stiff * d;
        }
        ov.x -= off.x * stiff * 1.2 * d;
        ov.y -= off.y * stiff * 1.2 * d;
        ov.z -= off.z * stiff * 1.2 * d;
        if (i > 0) ov.y += params.gravity * 0.002 * this.slide[i]! * d;
      }

      qv.multiplyScalar(Math.exp(-damp * d));
      ov.multiplyScalar(Math.exp(-damp * d));

      const spin = qv.length() * d * jiggle;
      if (spin > 1e-8) {
        _axis.copy(qv).normalize();
        _q.setFromAxisAngle(_axis, spin);
        q.premultiply(_q);
        q.normalize();
      }
      off.x += ov.x * d * jiggle;
      off.y += ov.y * d * jiggle;
      off.z += ov.z * d * jiggle;

      const maxA = this.maxAng[i]!;
      const aNow = 2 * Math.acos(Math.min(1, Math.abs(q.w)));
      if (aNow > maxA && aNow > 1e-5) {
        q.slerp(IDENTITY, 1 - maxA / aNow);
      }
      const sl = this.slide[i]!;
      const olen = off.length();
      if (olen > sl && sl > 0) off.multiplyScalar(sl / olen);
      else if (sl === 0) off.set(0, 0, 0);
    }

    const belly = this.names.indexOf("belly");
    const spine2 = this.names.indexOf("spine2");
    if (belly >= 0 && !this.hold) {
      this.off[belly]!.z += (breath * 1.1 - this.off[belly]!.z) * 0.15;
    }
    if (spine2 >= 0 && !this.hold) {
      _q.setFromAxisAngle(_axis.set(1, 0, 0), breath * 0.25 + wind);
      this.q[spine2]!.slerp(_q, 0.08);
    }

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

  private applyHold() {
    const h = this.hold;
    if (!h) return;
    if (h.mode === "press") {
      const belly = this.names.indexOf("belly");
      const spine1 = this.names.indexOf("spine1");
      const b = belly >= 0 ? belly : h.bone;
      this.off[b]!.set(-h.nx * h.depth, -h.ny * h.depth * 0.35, -h.nz * h.depth);
      if (spine1 >= 0) {
        _axis.set(1, 0, 0);
        this.q[spine1]!.slerp(_q.setFromAxisAngle(_axis, h.depth * 1.6), 0.45);
      }
      return;
    }

    let b = h.bone;
    for (let chain = 0; chain < 3 && b >= 0; chain++) {
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
      if (ang > this.maxAng[b]!) {
        this.q[b]!.slerp(IDENTITY, 1 - this.maxAng[b]! / ang);
      }
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
