import { i as __toESM } from "../_runtime.mjs";
import { a as require_jsx_runtime, o as require_react } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { G as MeshStandardMaterial, H as Mesh, L as LoadingManager, R as MOUSE, _t as TextureLoader, a as useThree, ct as RepeatWrapping, d as BufferAttribute, et as Plane, f as BufferGeometry, ht as TOUCH, i as useLoader, lt as SRGBColorSpace, m as Color, n as Canvas, r as useFrame, st as Ray, t as OrbitControls, tt as PointLight, u as Box3, v as Fog, vt as Vector2, y as Group, yt as Vector3 } from "../_libs/@react-three/drei+[...].mjs";
import { n as useStudio } from "./routes--bddlASq.mjs";
import { n as SkeletonUtils, t as GLTFLoader } from "../_libs/three-stdlib.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/scene-C-StUZg3.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var MAX_OFF = .16;
var SoftCage = class {
	nx;
	ny;
	nz;
	count;
	pos;
	prev;
	rest;
	invMass;
	origin;
	cell;
	springs = [];
	bindings = [];
	energy = 0;
	acc = 0;
	constructor(origin, size, nx = 8, ny = 6, nz = 6) {
		this.nx = nx;
		this.ny = ny;
		this.nz = nz;
		this.count = nx * ny * nz;
		this.origin = origin;
		this.cell = [
			size[0] / (nx - 1),
			size[1] / (ny - 1),
			size[2] / (nz - 1)
		];
		this.pos = new Float32Array(this.count * 3);
		this.prev = new Float32Array(this.count * 3);
		this.rest = new Float32Array(this.count * 3);
		this.invMass = new Float32Array(this.count);
		for (let iz = 0; iz < nz; iz++) for (let iy = 0; iy < ny; iy++) for (let ix = 0; ix < nx; ix++) {
			const i = ix + iy * nx + iz * nx * ny;
			const x = origin[0] + ix * this.cell[0];
			const y = origin[1] + iy * this.cell[1];
			const z = origin[2] + iz * this.cell[2];
			this.rest[i * 3] = x;
			this.rest[i * 3 + 1] = y;
			this.rest[i * 3 + 2] = z;
			const edge = iy === 0 || iy === ny - 1 || ix === 0 || ix === nx - 1 || iz === 0;
			this.invMass[i] = edge ? 0 : 1;
		}
		this.pos.set(this.rest);
		this.prev.set(this.rest);
		const add = (a, b) => {
			if (a === b) return;
			if (this.invMass[a] === 0 && this.invMass[b] === 0) return;
			const dx = this.rest[a * 3] - this.rest[b * 3];
			const dy = this.rest[a * 3 + 1] - this.rest[b * 3 + 1];
			const dz = this.rest[a * 3 + 2] - this.rest[b * 3 + 2];
			this.springs.push({
				a,
				b,
				rest: Math.hypot(dx, dy, dz)
			});
		};
		for (let iz = 0; iz < nz; iz++) for (let iy = 0; iy < ny; iy++) for (let ix = 0; ix < nx; ix++) {
			const i = ix + iy * nx + iz * nx * ny;
			if (ix + 1 < nx) add(i, i + 1);
			if (iy + 1 < ny) add(i, i + nx);
			if (iz + 1 < nz) add(i, i + nx * ny);
			if (ix + 1 < nx && iy + 1 < ny) add(i, i + 1 + nx);
			if (ix + 1 < nx && iz + 1 < nz) add(i, i + 1 + nx * ny);
		}
	}
	bind(positions, weight) {
		const n = weight.length;
		const corners = new Int32Array(n * 8);
		const bweights = new Float32Array(n * 8);
		const rest = new Float32Array(positions);
		const [ox, oy, oz] = this.origin;
		const [cx, cy, cz] = this.cell;
		const nx = this.nx;
		const ny = this.ny;
		const nz = this.nz;
		for (let i = 0; i < n; i++) {
			if (weight[i] <= .001) {
				corners[i * 8] = -1;
				continue;
			}
			const x = positions[i * 3];
			const y = positions[i * 3 + 1];
			const z = positions[i * 3 + 2];
			const fx = (x - ox) / cx;
			const fy = (y - oy) / cy;
			const fz = (z - oz) / cz;
			const ix = Math.max(0, Math.min(nx - 2, Math.floor(fx)));
			const iy = Math.max(0, Math.min(ny - 2, Math.floor(fy)));
			const iz = Math.max(0, Math.min(nz - 2, Math.floor(fz)));
			const tx = Math.max(0, Math.min(1, fx - ix));
			const ty = Math.max(0, Math.min(1, fy - iy));
			const tz = Math.max(0, Math.min(1, fz - iz));
			const base = ix + iy * nx + iz * nx * ny;
			const i000 = base;
			const i100 = base + 1;
			const i010 = base + nx;
			const i110 = base + 1 + nx;
			const i001 = base + nx * ny;
			const i101 = base + 1 + nx * ny;
			const i011 = base + nx + nx * ny;
			const i111 = base + 1 + nx + nx * ny;
			const o = i * 8;
			corners[o] = i000;
			corners[o + 1] = i100;
			corners[o + 2] = i010;
			corners[o + 3] = i110;
			corners[o + 4] = i001;
			corners[o + 5] = i101;
			corners[o + 6] = i011;
			corners[o + 7] = i111;
			const sx = 1 - tx;
			const sy = 1 - ty;
			const sz = 1 - tz;
			bweights[o] = sx * sy * sz;
			bweights[o + 1] = tx * sy * sz;
			bweights[o + 2] = sx * ty * sz;
			bweights[o + 3] = tx * ty * sz;
			bweights[o + 4] = sx * sy * tz;
			bweights[o + 5] = tx * sy * tz;
			bweights[o + 6] = sx * ty * tz;
			bweights[o + 7] = tx * ty * tz;
		}
		this.bindings.push({
			positions,
			rest,
			weight,
			corners,
			bweights
		});
	}
	reset() {
		this.pos.set(this.rest);
		this.prev.set(this.rest);
		this.acc = 0;
		this.apply();
	}
	shake(strength = .04) {
		for (let i = 0; i < this.count; i++) {
			if (this.invMass[i] === 0) continue;
			const i3 = i * 3;
			this.prev[i3] -= (Math.random() - .5) * 2 * strength;
			this.prev[i3 + 1] -= (Math.random() * .5 + .2) * strength;
			this.prev[i3 + 2] -= (Math.random() * .7 + .3) * strength;
		}
	}
	applyImpulse(px, py, pz, dx, dy, dz, radius, strength) {
		const r2 = radius * radius;
		for (let i = 0; i < this.count; i++) {
			if (this.invMass[i] === 0) continue;
			const i3 = i * 3;
			const ox = this.pos[i3] - px;
			const oy = this.pos[i3 + 1] - py;
			const oz = this.pos[i3 + 2] - pz;
			const d2 = ox * ox + oy * oy + oz * oz;
			if (d2 > r2) continue;
			const s = strength * (1 - (Math.sqrt(d2) || 1e-5) / radius) ** 2;
			this.pos[i3] += dx * s;
			this.pos[i3 + 1] += dy * s;
			this.pos[i3 + 2] += dz * s;
		}
	}
	grab(px, py, pz, tx, ty, tz, radius) {
		const r2 = radius * radius;
		for (let i = 0; i < this.count; i++) {
			if (this.invMass[i] === 0) continue;
			const i3 = i * 3;
			const ox = this.rest[i3] - px;
			const oy = this.rest[i3 + 1] - py;
			const oz = this.rest[i3 + 2] - pz;
			const d2 = ox * ox + oy * oy + oz * oz;
			if (d2 > r2 * 2.4) continue;
			const falloff = (1 - Math.min((Math.sqrt(d2) || 1e-5) / radius, 1)) ** 1.3;
			if (falloff <= 0) continue;
			const k = Math.min(1, falloff * 1.2);
			this.pos[i3] += (tx + ox * .4 - this.pos[i3]) * k;
			this.pos[i3 + 1] += (ty + oy * .4 - this.pos[i3 + 1]) * k;
			this.pos[i3 + 2] += (tz + oz * .4 - this.pos[i3 + 2]) * k;
		}
	}
	step(dt, params) {
		this.acc += Math.min(dt, .08);
		const fixed = 1 / 60;
		let n = 0;
		while (this.acc >= fixed && n < 4) {
			this.integrate(fixed, params);
			this.acc -= fixed;
			n++;
		}
		this.apply();
	}
	apply() {
		for (const b of this.bindings) {
			const { positions, rest, weight, corners, bweights } = b;
			const n = weight.length;
			for (let i = 0; i < n; i++) {
				const w = weight[i];
				if (w <= .001 || corners[i * 8] < 0) continue;
				let x = 0;
				let y = 0;
				let z = 0;
				const o = i * 8;
				for (let k = 0; k < 8; k++) {
					const ci = corners[o + k] * 3;
					const bw = bweights[o + k];
					x += this.pos[ci] * bw;
					y += this.pos[ci + 1] * bw;
					z += this.pos[ci + 2] * bw;
				}
				const i3 = i * 3;
				positions[i3] = rest[i3] + (x - rest[i3]) * w;
				positions[i3 + 1] = rest[i3 + 1] + (y - rest[i3 + 1]) * w;
				positions[i3 + 2] = rest[i3 + 2] + (z - rest[i3 + 2]) * w;
			}
		}
	}
	integrate(dt, params) {
		const damp = .82 + params.damping * .175;
		const g = params.gravity * (.3 + params.jiggle * .7);
		const wind = Math.sin(params.time * 1.7) * params.wind * 2.2;
		const breath = params.breathing ? (Math.sin(params.time * 1.35) * .5 + .5) * .01 : 0;
		const dt2 = dt * dt;
		const jiggle = Math.max(.15, params.jiggle);
		for (let i = 0; i < this.count; i++) {
			if (this.invMass[i] === 0) continue;
			const i3 = i * 3;
			let x = this.pos[i3];
			let y = this.pos[i3 + 1];
			let z = this.pos[i3 + 2];
			const vx = (x - this.prev[i3]) * damp;
			const vy = (y - this.prev[i3 + 1]) * damp;
			const vz = (z - this.prev[i3 + 2]) * damp;
			this.prev[i3] = x;
			this.prev[i3 + 1] = y;
			this.prev[i3 + 2] = z;
			x += vx;
			y += vy + g * dt2 * jiggle;
			z += vz + wind * dt2 * jiggle + breath * jiggle;
			this.pos[i3] = x;
			this.pos[i3 + 1] = y;
			this.pos[i3 + 2] = z;
		}
		const iterations = 5 + Math.round(params.stiffness * 4);
		const kSpring = .24 + params.stiffness * .5;
		for (let it = 0; it < iterations; it++) {
			for (let s = 0; s < this.springs.length; s++) {
				const sp = this.springs[s];
				const a3 = sp.a * 3;
				const b3 = sp.b * 3;
				const wA = this.invMass[sp.a];
				const wB = this.invMass[sp.b];
				const wSum = wA + wB;
				if (wSum === 0) continue;
				let dx = this.pos[a3] - this.pos[b3];
				let dy = this.pos[a3 + 1] - this.pos[b3 + 1];
				let dz = this.pos[a3 + 2] - this.pos[b3 + 2];
				const dist = Math.hypot(dx, dy, dz) || 1e-6;
				const inv = (dist - sp.rest) / dist * kSpring / wSum;
				this.pos[a3] -= dx * inv * wA;
				this.pos[a3 + 1] -= dy * inv * wA;
				this.pos[a3 + 2] -= dz * inv * wA;
				this.pos[b3] += dx * inv * wB;
				this.pos[b3 + 1] += dy * inv * wB;
				this.pos[b3 + 2] += dz * inv * wB;
			}
			const kShape = .03 + params.stiffness * .12;
			const kVol = .12 + params.pressure * .4;
			let energy = 0;
			const midX = this.origin[0] + this.cell[0] * (this.nx - 1) * .5;
			const midZ = this.origin[2] + this.cell[2] * (this.nz - 1) * .5;
			for (let i = 0; i < this.count; i++) {
				if (this.invMass[i] === 0) continue;
				const i3 = i * 3;
				const rx = this.rest[i3];
				const ry = this.rest[i3 + 1];
				const rz = this.rest[i3 + 2];
				let x = this.pos[i3];
				let y = this.pos[i3 + 1];
				let z = this.pos[i3 + 2];
				x += (rx - x) * kShape;
				y += (ry - y) * (kShape + .04);
				z += (rz - z) * kShape;
				const ox = x - midX;
				const oz = z - midZ;
				const r = Math.hypot(ox, oz) || 1e-6;
				const vol = (Math.hypot(rx - midX, rz - midZ) - r) / r * kVol * jiggle;
				x += ox * vol;
				z += oz * vol;
				let dx = x - rx;
				let dy = y - ry;
				let dz = z - rz;
				const len = Math.hypot(dx, dy, dz);
				if (len > MAX_OFF) {
					const s = MAX_OFF / len;
					x = rx + dx * s;
					y = ry + dy * s;
					z = rz + dz * s;
				}
				this.pos[i3] = x;
				this.pos[i3 + 1] = y;
				this.pos[i3 + 2] = z;
				energy += dx * dx + dy * dy + dz * dz;
			}
			this.energy = energy;
		}
	}
};
/** Rewrite FBX texture URLs so they resolve to files we actually host. */
var ANGEL_TEX = /* @__PURE__ */ new Set([
	"BOD-default-eye-GLS.png",
	"Mercy_Classic_D.jpg",
	"Mercy_D.jpg",
	"Mercy_Eye_D.jpg",
	"Mercy_Gun_D.jpg",
	"Mercy_Hair_D.jpg",
	"Mercy_Staff_D.jpg",
	"Mercy_Ziegler_D.jpg",
	"Mercy_Ziegler_D2.jpg",
	"Mercy_Ziegler_Hair_D.jpg"
]);
var HIDE_RE = /futa|penis|dick|balls|strapon|panty|bikini|thong|garter|stocking|swim|phys_|gun|staff|caduceus|blaster|pistol|weapon|ziegler|glasses|pearls|heels|skirt|lanyard|bangle|shoe|buttonth|lifeguard|dva|pouch|torn|pharah/;
function rewriteModelUrl(url) {
	const cleaned = url.replace(/\\/g, "/").split("?")[0];
	let name = cleaned.split("/").pop() || cleaned;
	try {
		name = decodeURIComponent(name);
	} catch {}
	if (/\.(fbx|obj|gltf|glb|bin)$/i.test(name)) return url;
	if (/futa|thong|swim|white_fabric|leather_pouch|shoes1|tornshirt|dva_body|ziegler_n|horizon\.exr/i.test(name)) return "/models/angel/Mercy_D.jpg";
	if (/\.(jpe?g|png|webp|tif|tiff|exr|tga|bmp)$/i.test(name) && (/Mercy_|BOD-/i.test(name) || /\/angel\//i.test(cleaned))) {
		const file = name.replace(/\.jpeg$/i, ".jpg");
		if (ANGEL_TEX.has(file)) return `/models/angel/${file}`;
		return "/models/angel/Mercy_D.jpg";
	}
	if (/Tjocktarm/i.test(cleaned)) return `/models/organs/Tjocktarm_normal/${name.replace(/\.tiff?$/i, ".jpg")}`;
	if (/Tunntarm/i.test(cleaned)) return `/models/organs/Tunntarm_normal/${name.replace(/\.tiff?$/i, ".jpg")}`;
	if (/\.tiff?$/i.test(name) || /Channel_Default/i.test(name)) {
		const file = name.replace(/\.tiff?$/i, ".jpg");
		if (/normal/i.test(file)) return `/models/organs/Tjocktarm_normal/${file}`;
		return `/models/organs/Tjocktarm_normal/${file}`;
	}
	return url;
}
function isHiddenMesh(name) {
	return HIDE_RE.test(name.toLowerCase());
}
function textureBlob(mat) {
	const img = mat.map?.image;
	return `${mat.name ?? ""} ${mat.map?.name ?? ""} ${img?.src ?? ""} ${img?.currentSrc ?? ""}`;
}
function objectIsHidden(obj) {
	let o = obj;
	while (o) {
		if (isHiddenMesh(o.name)) return true;
		o = o.parent ?? null;
	}
	const mesh = obj;
	if (!mesh.isMesh || !mesh.material) return false;
	const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
	for (const raw of mats) {
		if (!raw) continue;
		if (isHiddenMesh(textureBlob(raw))) return true;
	}
	return false;
}
var _hit = new Vector3();
var _normal = new Vector3();
var _target = new Vector3();
var _camDir = new Vector3();
var _plane = new Plane();
var _ray = new Ray();
var _ndc = new Vector2();
var _box = new Box3();
var _size = new Vector3();
var _center = new Vector3();
var _local = new Vector3();
function configureGltf(loader) {
	loader.manager.setURLModifier(rewriteModelUrl);
}
function textureForAngel(name) {
	const n = name.toLowerCase();
	if (/hair/.test(n)) return "/models/angel/Mercy_Hair_D.jpg";
	if (/eye/.test(n)) return "/models/angel/Mercy_Eye_D.jpg";
	if (/wing|classic|outfit|body|cloth|torso/.test(n)) return "/models/angel/Mercy_Classic_D.jpg";
	return "/models/angel/Mercy_D.jpg";
}
function paintAngel(root) {
	const manager = new LoadingManager();
	const loader = new TextureLoader(manager);
	const cache = /* @__PURE__ */ new Map();
	const get = (url) => {
		let t = cache.get(url);
		if (!t) {
			t = loader.load(url);
			t.colorSpace = SRGBColorSpace;
			t.flipY = false;
			t.wrapS = RepeatWrapping;
			t.wrapT = RepeatWrapping;
			cache.set(url, t);
		}
		return t;
	};
	root.traverse((obj) => {
		const mesh = obj;
		if (!mesh.isMesh) return;
		const next = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((raw) => {
			const m = raw ? raw.clone() : new MeshStandardMaterial();
			m.map = get(textureForAngel(mesh.name));
			m.roughness = .5;
			m.metalness = .06;
			m.needsUpdate = true;
			return m;
		});
		mesh.material = next.length === 1 ? next[0] : next;
	});
}
function paintOrgans(root) {
	const manager = new LoadingManager();
	const loader = new TextureLoader(manager);
	const colon = loader.load("/models/organs/Tjocktarm_normal/Channel_Default Material_Diffuse.jpg");
	const small = loader.load("/models/organs/Tunntarm_normal/Channel_Default Material_Diffuse.jpg");
	colon.colorSpace = SRGBColorSpace;
	small.colorSpace = SRGBColorSpace;
	colon.flipY = false;
	small.flipY = false;
	root.traverse((obj) => {
		const mesh = obj;
		if (!mesh.isMesh) return;
		const m = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material)?.clone();
		if (!m) return;
		const n = mesh.name.toLowerCase();
		m.map = /tunn|small/.test(n) ? small : colon;
		m.side = 2;
		m.color.lerp(new Color("#c45a4a"), .12);
		m.emissive = new Color("#4a140e");
		m.emissiveIntensity = .22;
		m.roughness = .46;
		m.metalness = .04;
		m.needsUpdate = true;
		mesh.material = m;
		mesh.renderOrder = 1;
	});
}
function hideByName(root) {
	root.traverse((obj) => {
		const mesh = obj;
		if (!mesh.isMesh) return;
		if (objectIsHidden(mesh)) mesh.visible = false;
	});
}
function hideByBounds(root) {
	root.updateMatrixWorld(true);
	root.traverse((obj) => {
		const mesh = obj;
		if (!mesh.isMesh || !mesh.visible) return;
		const n = mesh.name.toLowerCase();
		if (/wing|hair|eye|body|outfit|cloth|torso|teeth|nail/.test(n)) return;
		_box.setFromObject(mesh);
		_box.getCenter(_center);
		_box.getSize(_size);
		const longest = Math.max(_size.x, _size.y, _size.z);
		const thin = Math.min(_size.x, _size.y, _size.z);
		if (longest > .38 && longest / Math.max(thin, .01) > 5 && Math.abs(_center.x) > .22) mesh.visible = false;
	});
}
function pruneHidden(root) {
	hideByName(root);
	const dead = [];
	root.traverse((o) => {
		const mesh = o;
		if (mesh.isMesh && !mesh.visible) dead.push(mesh);
	});
	for (const mesh of dead) mesh.removeFromParent();
}
function fitStanding(source, targetHeight) {
	const root = SkeletonUtils.clone(source);
	pruneHidden(root);
	_box.setFromObject(root);
	_box.getSize(_size);
	_box.getCenter(_center);
	if (_size.z > _size.y * 1.25) {
		root.rotation.x = -Math.PI / 2;
		root.updateMatrixWorld(true);
		_box.setFromObject(root);
		_box.getSize(_size);
		_box.getCenter(_center);
	}
	const s = targetHeight / Math.max(_size.y, .001);
	root.scale.multiplyScalar(s);
	root.updateMatrixWorld(true);
	_box.setFromObject(root);
	_box.getSize(_size);
	_box.getCenter(_center);
	root.position.x -= _center.x;
	root.position.z -= _center.z;
	root.position.y -= _box.min.y;
	root.updateMatrixWorld(true);
	hideByBounds(root);
	pruneHidden(root);
	return root;
}
function flattenToWorld(source) {
	const baked = new Group();
	source.updateMatrixWorld(true);
	source.traverse((obj) => {
		const mesh = obj;
		if (!mesh.isMesh || !mesh.visible || !mesh.geometry) return;
		if (objectIsHidden(mesh)) return;
		const geo = mesh.geometry.clone();
		geo.applyMatrix4(mesh.matrixWorld);
		const out = new Mesh(geo, mesh.material);
		out.name = mesh.name;
		out.frustumCulled = true;
		baked.add(out);
	});
	return baked;
}
function sampleTorsoBox(character, y0, y1, height) {
	const box = new Box3();
	box.makeEmpty();
	let count = 0;
	character.traverse((obj) => {
		const mesh = obj;
		if (!mesh.isMesh || !mesh.geometry) return;
		const n = mesh.name.toLowerCase();
		if (/wing|hair|eye|staff|gun|weapon/.test(n)) return;
		const pos = mesh.geometry.getAttribute("position");
		if (!pos) return;
		const step = Math.max(1, Math.floor(pos.count / 5e3));
		for (let i = 0; i < pos.count; i += step) {
			_local.fromBufferAttribute(pos, i);
			mesh.localToWorld(_local);
			if (_local.y < y0 || _local.y > y1) continue;
			if (Math.abs(_local.x) > .2) continue;
			box.expandByPoint(_local);
			count++;
		}
	});
	if (count < 20 || box.isEmpty()) box.set(new Vector3(-.12, y0, -.06), new Vector3(.12, y1, .1));
	const size = box.getSize(new Vector3());
	if (size.x < .1) {
		box.min.x = -.11;
		box.max.x = .11;
	}
	if (size.z < .08) {
		box.min.z = -.05;
		box.max.z = .09;
	}
	box.min.y = Math.min(box.min.y, height * .48);
	box.max.y = Math.max(box.max.y, height * .63);
	return box;
}
function orientOrganPack(obj) {
	obj.updateMatrixWorld(true);
	_box.setFromObject(obj);
	_box.getSize(_size);
	if (_size.z >= _size.y && _size.z >= _size.x) {
		obj.rotation.x += -Math.PI / 2;
		obj.updateMatrixWorld(true);
		_box.setFromObject(obj);
		_box.getSize(_size);
	}
	if (_size.x < _size.z && _size.x <= _size.y) {
		obj.rotation.y += Math.PI / 2;
		obj.updateMatrixWorld(true);
	}
}
function placeInCavity(obj, cavity) {
	orientOrganPack(obj);
	_box.setFromObject(obj);
	_box.getSize(_size);
	const as = cavity.getSize(new Vector3());
	const ac = cavity.getCenter(new Vector3());
	const sx = as.x / Math.max(_size.x, 1e-4);
	const sy = as.y / Math.max(_size.y, 1e-4);
	const sz = as.z / Math.max(_size.z, 1e-4);
	obj.scale.x *= sx * .92;
	obj.scale.y *= sy * .9;
	obj.scale.z *= sz * .86;
	obj.updateMatrixWorld(true);
	const oc = new Box3().setFromObject(obj).getCenter(new Vector3());
	obj.position.add(ac.clone().sub(oc));
	obj.position.z += as.z * .06;
	obj.updateMatrixWorld(true);
}
function Figure({ controlsRef }) {
	const angelG = useLoader(GLTFLoader, "/models/angel/angel.glb", configureGltf);
	const organG = useLoader(GLTFLoader, "/models/organs/intestines.glb", configureGltf);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FittedFigure, {
		angel: angelG.scene,
		organs: organG.scene,
		controlsRef
	});
}
function FittedFigure({ angel, organs, controlsRef }) {
	const pokeRef = (0, import_react.useRef)(null);
	const latticeRef = (0, import_react.useRef)(null);
	const grab = (0, import_react.useRef)(null);
	const lastShake = (0, import_react.useRef)(0);
	const lastReset = (0, import_react.useRef)(0);
	const energyTick = (0, import_react.useRef)(0);
	const { camera, gl, raycaster, pointer } = useThree();
	const setup = (0, import_react.useMemo)(() => {
		const xrayList = [];
		const root = new Group();
		const character = fitStanding(angel, 1.66);
		paintAngel(character);
		character.traverse((obj) => {
			const mesh = obj;
			if (!mesh.isMesh || !mesh.visible) return;
			if (objectIsHidden(mesh)) {
				mesh.visible = false;
				return;
			}
			_box.setFromObject(mesh);
			_box.getCenter(_center);
			_box.getSize(_size);
			const n = mesh.name.toLowerCase();
			if (/wing|hair|eye|body|outfit|cloth|torso/.test(n)) return;
			const longest = Math.max(_size.x, _size.y, _size.z);
			const thin = Math.min(_size.x, _size.y, _size.z);
			if (longest > .32 && longest / Math.max(thin, .01) > 4 && Math.abs(_center.x) > .2) mesh.visible = false;
		});
		root.add(character);
		_box.setFromObject(character);
		_box.getSize(_size);
		const height = _size.y;
		const y0 = height * .5;
		const y1 = height * .635;
		const cavity = sampleTorsoBox(character, y0, y1, height);
		cavity.min.x += .012;
		cavity.max.x -= .012;
		cavity.min.z += .018;
		cavity.max.z -= .01;
		const abdomen = cavity.clone();
		abdomen.min.y -= .02;
		abdomen.max.y += .02;
		abdomen.min.z -= .03;
		abdomen.max.z += .04;
		const organSrc = SkeletonUtils.clone(organs);
		paintOrgans(organSrc);
		placeInCavity(organSrc, cavity);
		const organBaked = flattenToWorld(organSrc);
		root.add(organBaked);
		const bellyLight = new PointLight("#f2c2ae", 0, .62);
		bellyLight.position.set(0, (cavity.min.y + cavity.max.y) * .5, cavity.max.z - .02);
		root.add(bellyLight);
		const pad = .03;
		const cage = new SoftCage([
			abdomen.min.x - pad,
			abdomen.min.y - pad,
			abdomen.min.z - pad
		], [
			abdomen.max.x - abdomen.min.x + pad * 2,
			abdomen.max.y - abdomen.min.y + pad * 2,
			abdomen.max.z - abdomen.min.z + pad * 2
		], 8, 6, 6);
		const boundGeos = [];
		const bindMesh = (mesh, all = false) => {
			let geo = mesh.geometry;
			const pos0 = geo.getAttribute("position");
			if (!pos0 || pos0.itemSize !== 3) return;
			mesh.geometry = geo.clone();
			geo = mesh.geometry;
			const pos = geo.getAttribute("position");
			if (!(pos.array instanceof Float32Array)) return;
			mesh.updateWorldMatrix(true, false);
			const n = pos.count;
			const weight = new Float32Array(n);
			let softCount = 0;
			for (let i = 0; i < n; i++) {
				_local.fromBufferAttribute(pos, i);
				mesh.localToWorld(_local);
				const y = _local.y;
				const inY = y > y0 && y < y1;
				const front = _local.z > abdomen.min.z - .04;
				if (all || inY && front) {
					const ty = all ? .7 : Math.min((y - y0) / .045, (y1 - y) / .045, 1);
					weight[i] = Math.max(0, Math.min(1, ty));
					if (weight[i] > .04) softCount++;
				}
			}
			if (softCount > 8) {
				cage.bind(pos.array, weight);
				boundGeos.push(geo);
			}
		};
		character.traverse((obj) => {
			const mesh = obj;
			if (!mesh.isMesh || !mesh.geometry) return;
			const before = boundGeos.length;
			bindMesh(mesh, false);
			if (boundGeos.length === before) return;
			const next = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((mat) => {
				if (!mat) return mat;
				const cloned = mat.clone();
				cloned.transparent = true;
				cloned.side = 0;
				cloned.depthWrite = true;
				cloned.onBeforeCompile = (shader) => {
					shader.uniforms.uXray = { value: 0 };
					shader.uniforms.uY0 = { value: y0 };
					shader.uniforms.uY1 = { value: y1 };
					shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nvarying float vBodyY;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvBodyY = (modelMatrix * vec4(transformed, 1.0)).y;");
					shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\nuniform float uXray; uniform float uY0; uniform float uY1; varying float vBodyY;").replace("#include <dithering_fragment>", `float band = smoothstep(uY0, uY0 + 0.035, vBodyY) * (1.0 - smoothstep(uY1 - 0.035, uY1, vBodyY));
               float x = clamp(band * uXray, 0.0, 1.0);
               gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * 0.22 + vec3(0.42, 0.12, 0.09) * 0.18, x);
               gl_FragColor.a *= mix(1.0, 0.14, x);
               if (gl_FragColor.a < 0.03) discard;
               #include <dithering_fragment>`);
					cloned.userData.shader = shader;
				};
				cloned.needsUpdate = true;
				xrayList.push(cloned);
				return cloned;
			});
			mesh.material = next.length === 1 ? next[0] : next;
		});
		organBaked.traverse((obj) => {
			const mesh = obj;
			if (mesh.isMesh) bindMesh(mesh, true);
		});
		const charBox = new Box3().setFromObject(character);
		const organBox = new Box3().setFromObject(organBaked);
		const meshNames = [];
		character.traverse((o) => {
			if (o.isMesh) meshNames.push(o.name);
		});
		if (typeof window !== "undefined") window.__vela = {
			char: {
				min: charBox.min.toArray(),
				max: charBox.max.toArray()
			},
			cavity: {
				min: cavity.min.toArray(),
				max: cavity.max.toArray()
			},
			organs: {
				min: organBox.min.toArray(),
				max: organBox.max.toArray()
			},
			meshes: meshNames.slice(0, 48),
			meshCount: meshNames.length
		};
		return {
			root,
			cage,
			y0,
			y1,
			abdomen,
			cavity,
			xrayList,
			organRoot: organBaked,
			boundGeos,
			bellyLight
		};
	}, [angel, organs]);
	(0, import_react.useEffect)(() => {
		const id = requestAnimationFrame(() => {
			useStudio.setState({
				loading: false,
				loadProgress: 100
			});
		});
		return () => cancelAnimationFrame(id);
	}, []);
	(0, import_react.useEffect)(() => {
		if (controlsRef.current) {
			const c = setup.cavity.getCenter(new Vector3());
			controlsRef.current.target.set(c.x, c.y, c.z);
			controlsRef.current.update();
		}
	}, [setup, controlsRef]);
	(0, import_react.useEffect)(() => {
		const onUp = () => {
			grab.current = null;
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
	}, [gl]);
	useFrame((state, delta) => {
		const d = Math.min(delta, .1);
		const s = useStudio.getState();
		const dt = s.slowMo ? d * .38 : d;
		if (s.shakeNonce !== lastShake.current) {
			lastShake.current = s.shakeNonce;
			setup.cage.shake(.05);
		}
		if (s.resetNonce !== lastReset.current) {
			lastReset.current = s.resetNonce;
			setup.cage.reset();
		}
		if (grab.current?.active) {
			camera.getWorldDirection(_camDir);
			_plane.setFromNormalAndCoplanarPoint(_camDir, grab.current.planePoint);
			_ndc.copy(pointer);
			raycaster.setFromCamera(_ndc, camera);
			_ray.copy(raycaster.ray);
			if (_ray.intersectPlane(_plane, _target)) {
				setup.cage.grab(grab.current.origin.x, grab.current.origin.y, grab.current.origin.z, _target.x, _target.y, _target.z, .14);
				if (pokeRef.current) {
					pokeRef.current.position.copy(_target);
					pokeRef.current.visible = true;
				}
			}
		}
		setup.cage.step(dt, {
			stiffness: s.stiffness,
			damping: s.damping,
			gravity: s.gravity,
			pressure: s.pressure,
			jiggle: s.jiggle,
			wind: s.wind,
			time: state.clock.elapsedTime,
			breathing: s.breathing
		});
		energyTick.current += 1;
		if (energyTick.current % 8 === 0) {
			s.setEnergy(setup.cage.energy);
			for (const geo of setup.boundGeos) {
				const pos = geo.getAttribute("position");
				if (pos) pos.needsUpdate = true;
			}
		}
		if (energyTick.current % 16 === 0) for (const geo of setup.boundGeos) geo.computeVertexNormals();
		const xray = s.abdomenXray;
		for (const mat of setup.xrayList) {
			const shader = mat.userData.shader;
			if (shader?.uniforms?.uXray) shader.uniforms.uXray.value = xray;
			mat.depthWrite = true;
			mat.side = xray > .35 ? 0 : 2;
		}
		setup.organRoot.visible = s.showOrgans && xray > .04;
		setup.bellyLight.intensity = xray > .04 ? 2.2 + xray * 6 : 0;
		if (latticeRef.current) {
			latticeRef.current.visible = s.showLattice;
			if (s.showLattice) {
				const lp = latticeRef.current.geometry.getAttribute("position");
				lp.array.set(setup.cage.pos);
				lp.needsUpdate = true;
			}
		}
	});
	const latticeGeo = (0, import_react.useMemo)(() => {
		const g = new BufferGeometry();
		g.setAttribute("position", new BufferAttribute(setup.cage.pos.slice(), 3));
		return g;
	}, [setup]);
	const onPointerDown = (e) => {
		if (e.button !== 0 && e.nativeEvent.button !== 0) return;
		e.stopPropagation();
		const y = e.point.y;
		if (y < setup.y0 - .06 || y > setup.y1 + .06) return;
		_hit.copy(e.point);
		if (e.face) _normal.copy(e.face.normal).transformDirection(e.object.matrixWorld).normalize();
		else _normal.set(0, 0, 1);
		setup.cage.applyImpulse(_hit.x, _hit.y, _hit.z, -_normal.x, -_normal.y, -_normal.z, .12, .08);
		grab.current = {
			active: true,
			origin: _hit.clone(),
			planePoint: _hit.clone()
		};
		useStudio.getState().setGrabbing(true);
		gl.domElement.style.cursor = "grabbing";
		if (pokeRef.current) {
			pokeRef.current.position.copy(_hit);
			pokeRef.current.lookAt(_hit.clone().add(_normal));
			pokeRef.current.visible = true;
		}
	};
	const midY = (setup.y0 + setup.y1) * .5;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("primitive", {
			object: setup.root,
			onPointerDown
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
			position: [
				0,
				midY,
				.06
			],
			onPointerDown,
			onPointerOver: () => {
				gl.domElement.style.cursor = "grab";
			},
			onPointerOut: () => {
				if (!grab.current) gl.domElement.style.cursor = "default";
			},
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("sphereGeometry", { args: [
				.2,
				16,
				12
			] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshBasicMaterial", {
				transparent: true,
				opacity: 0,
				depthWrite: false
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("points", {
			ref: latticeRef,
			geometry: latticeGeo,
			visible: false,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pointsMaterial", {
				color: "#d4b5a0",
				size: .012,
				sizeAttenuation: true
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
			ref: pokeRef,
			visible: false,
			renderOrder: 10,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ringGeometry", { args: [
				.028,
				.042,
				28
			] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshBasicMaterial", {
				color: "#d4b5a0",
				transparent: true,
				opacity: .85,
				side: 2,
				depthTest: false
			})]
		})
	] });
}
function Scene() {
	const controlsRef = (0, import_react.useRef)(null);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "absolute inset-0 touch-none",
		onContextMenu: (e) => e.preventDefault(),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Canvas, {
			dpr: [1, 1.5],
			camera: {
				position: [
					.55,
					1.12,
					1.85
				],
				fov: 32,
				near: .05,
				far: 24
			},
			gl: {
				antialias: true,
				toneMapping: 4,
				toneMappingExposure: 1.08,
				alpha: false,
				powerPreference: "high-performance"
			},
			onCreated: ({ scene, gl }) => {
				scene.background = new Color("#0b0b0c");
				scene.fog = new Fog("#0b0b0c", 4.2, 11);
				gl.setClearColor("#0b0b0c");
			},
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_react.Suspense, {
				fallback: null,
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StudioLights, {}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("group", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Figure, { controlsRef }) }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
						rotation: [
							-Math.PI / 2,
							0,
							0
						],
						position: [
							0,
							0,
							0
						],
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circleGeometry", { args: [3.8, 72] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
							color: "#101012",
							roughness: .88,
							metalness: .08
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
						position: [
							0,
							1.15,
							-2.4
						],
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("planeGeometry", { args: [10, 6] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
							color: "#121214",
							roughness: 1,
							metalness: 0
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
						rotation: [
							-Math.PI / 2,
							0,
							0
						],
						position: [
							0,
							.002,
							.03
						],
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circleGeometry", { args: [.32, 48] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshBasicMaterial", {
							color: "#000000",
							transparent: true,
							opacity: .38
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
						rotation: [
							-Math.PI / 2,
							0,
							0
						],
						position: [
							0,
							.001,
							.03
						],
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circleGeometry", { args: [.55, 48] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshBasicMaterial", {
							color: "#000000",
							transparent: true,
							opacity: .16
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ControlsBridge, { controlsRef })
				]
			})
		})
	});
}
function ControlsBridge({ controlsRef }) {
	const autoRotate = useStudio((s) => s.autoRotate);
	const grabbing = useStudio((s) => s.grabbing);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OrbitControls, {
		ref: controlsRef,
		makeDefault: true,
		enablePan: true,
		enableDamping: true,
		dampingFactor: .08,
		autoRotate: autoRotate && !grabbing,
		autoRotateSpeed: .55,
		minDistance: .65,
		maxDistance: 5.5,
		minPolarAngle: Math.PI * .12,
		maxPolarAngle: Math.PI * .86,
		target: [
			0,
			1.05,
			.04
		],
		mouseButtons: {
			LEFT: -1,
			MIDDLE: MOUSE.PAN,
			RIGHT: MOUSE.ROTATE
		},
		touches: {
			ONE: TOUCH.ROTATE,
			TWO: TOUCH.DOLLY_PAN
		}
	});
}
function StudioLights() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ambientLight", {
			intensity: .14,
			color: "#cfc8c0"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("hemisphereLight", { args: [
			"#d9d2c8",
			"#2a2420",
			.42
		] }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("directionalLight", {
			position: [
				2.2,
				3.4,
				2.6
			],
			intensity: 2.05,
			color: "#fff4ea"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("directionalLight", {
			position: [
				-2.4,
				1.6,
				1.2
			],
			intensity: .55,
			color: "#aeb8c8"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("directionalLight", {
			position: [
				.2,
				1.8,
				-2.4
			],
			intensity: 1.45,
			color: "#ffe4d2"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("spotLight", {
			position: [
				.15,
				2.1,
				1.4
			],
			angle: .32,
			penumbra: .7,
			intensity: 10,
			color: "#f0d2bc",
			distance: 5,
			castShadow: false
		})
	] });
}
//#endregion
export { Scene as default };
