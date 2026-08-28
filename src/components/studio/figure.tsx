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

function hideExternalGenitals(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (/vulve|clitoris|corpsetracines|materialcorps|materialbulbes/.test(meshKey(mesh))) {
      mesh.visible = false;
    }
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

function taperGutTop(group: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(group);
  const y0 = box.min.y;
  const y1 = box.max.y;
  const span = Math.max(1e-4, y1 - y0);
  const cx = (box.min.x + box.max.x) * 0.5;
  const cz = (box.min.z + box.max.z) * 0.5;
  const cutHi = y0 + span * 0.4;
  const cutLo = y0 + span * 0.48;
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const pos = mesh.geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
    if (!pos || !(pos.array instanceof Float32Array)) return;
    const arr = pos.array;
    for (let i = 0; i < pos.count; i++) {
      const y = arr[i * 3 + 1]!;
      if (y > cutHi) {
        const k = (y - cutHi) / Math.max(1e-4, y1 - cutHi);
        const s = 1 - k * k * 0.48;
        arr[i * 3] = cx + (arr[i * 3]! - cx) * s;
        arr[i * 3 + 2] = cz + (arr[i * 3 + 2]! - cz) * s;
        arr[i * 3 + 1] = cutHi + (y - cutHi) * (1 - k * 0.28);
      } else if (y < cutLo) {
        const k = 1 - (y - y0) / Math.max(1e-4, cutLo - y0);
        const s = 1 + k * k * 0.22;
        arr[i * 3] = cx + (arr[i * 3]! - cx) * s;
        arr[i * 3 + 2] = cz + (arr[i * 3 + 2]! - cz) * s;
      }
    }
    pos.needsUpdate = true;
    mesh.geometry.computeBoundingBox();
  });
}

function placeInFront(source: THREE.Object3D, box: THREE.Box3, fillW: number, frontZ: number) {
  const root = cloneGraph(source);
  root.updateMatrixWorld(true);
  _box.setFromObject(root);
  _box.getSize(_size);
  const ts = box.getSize(new THREE.Vector3());
  const tc = box.getCenter(new THREE.Vector3());
  const s = Math.min((ts.x / Math.max(_size.x, 1e-4)) * fillW, (ts.y / Math.max(_size.y, 1e-4)) * 1.2);
  root.scale.multiplyScalar(s);
  root.updateMatrixWorld(true);
  const ob = new THREE.Box3().setFromObject(root);
  const oc = ob.getCenter(new THREE.Vector3());
  root.position.x += tc.x - oc.x;
  root.position.y += tc.y - oc.y;
  root.updateMatrixWorld(true);
  const ob2 = new THREE.Box3().setFromObject(root);
  root.position.z += frontZ - ob2.max.z;
  root.updateMatrixWorld(true);
  const baked = flattenToWorld(root);
  bakeIntoVertices(baked);
  return baked;
}

function placePelvisPack(source: THREE.Object3D, uterusTarget: THREE.Vector3, frontZ: number) {
  const root = cloneGraph(source);
  hideExternalGenitals(root);
  root.updateMatrixWorld(true);
  const uterusBox = collectNamedBox(root, /uterus/) ?? new THREE.Box3().setFromObject(root);
  const uSize = uterusBox.getSize(new THREE.Vector3());
  root.scale.multiplyScalar(0.07 / Math.max(uSize.y, 1e-4));
  root.updateMatrixWorld(true);
  const u2 = collectNamedBox(root, /uterus/) ?? new THREE.Box3().setFromObject(root);
  const uc = u2.getCenter(new THREE.Vector3());
  root.position.add(uterusTarget.clone().sub(uc));
  root.updateMatrixWorld(true);
  const baked = flattenToWorld(root);
  bakeIntoVertices(baked);
  const pb = new THREE.Box3().setFromObject(baked);
  baked.position.x -= (pb.min.x + pb.max.x) * 0.5;
  baked.position.z += frontZ - pb.max.z;
  bakeIntoVertices(baked);
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
    mode: "press" | "drag";
    origin: THREE.Vector3;
    planePoint: THREE.Vector3;
    normal: THREE.Vector3;
    bone: number;
  } | null>(null);
  const lastShake = useRef(0);
  const lastReset = useRef(0);
  const energyTick = useRef(0);
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
    const yX0 = yNavel - 0.16;
    const yX1 = yNavel + 0.16;

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
    abdomen.max.z = skinZ - 0.012;
    abdomen.min.z = skinZ - 0.11;

    const gutBox = new THREE.Box3(
      new THREE.Vector3(abdomen.min.x, yNavel - 0.09, abdomen.min.z),
      new THREE.Vector3(abdomen.max.x, yNavel + 0.1, abdomen.max.z),
    );
    const gut = placeInFront(intestines, gutBox, 1.08, skinZ - 0.016);
    taperGutTop(gut);
    polishOrgans(gut, "gut");
    gut.visible = false;
    root.add(gut);

    const uterusTarget = new THREE.Vector3(0, yNavel - 0.08, skinZ - 0.05);
    const pelvic = placePelvisPack(pelvis, uterusTarget, skinZ - 0.028);
    polishOrgans(pelvic, "pelvis");
    pelvic.visible = false;
    root.add(pelvic);

    const bellyLight = new THREE.PointLight("#a07060", 0, 0.48);
    bellyLight.position.set(0, yNavel, abdomen.max.z - 0.04);
    root.add(bellyLight);

    const armSpan = Math.max(charBox.max.x, -charBox.min.x);
    const skeleton = new SoftSkeleton(navel, height, armSpan);
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
        guts: { min: gutBoxNow.min.toArray(), max: gutBoxNow.max.toArray() },
        navel: navel.toArray(),
        uterus: uterusTarget.toArray(),
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

    if (grab.current?.active) {
      camera.getWorldDirection(_camDir);
      _plane.setFromNormalAndCoplanarPoint(_camDir, grab.current.planePoint);
      _ndc.copy(pointer);
      raycaster.setFromCamera(_ndc, camera);
      _ray.copy(raycaster.ray);
      const o = grab.current.origin;
      const nrm = grab.current.normal;
      const bone = grab.current.bone;
      if (grab.current.mode === "press") {
        let depth = 0.055;
        if (_ray.intersectPlane(_plane, _target)) {
          const along = _target.clone().sub(o).dot(nrm);
          depth = THREE.MathUtils.clamp(0.04 - along * 0.65, 0.03, 0.1);
          pokeRef.current?.position.copy(o.clone().addScaledVector(nrm, -depth * 0.4));
        }
        setup.skeleton.setPress(bone, nrm.x, nrm.y, nrm.z, depth);
        if (pokeRef.current) pokeRef.current.visible = true;
      } else if (_ray.intersectPlane(_plane, _target)) {
        setup.skeleton.setDrag(bone, o.x, o.y, o.z, _target.x, _target.y, _target.z);
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

  const beginGrab = (point: THREE.Vector3, normal: THREE.Vector3, mode: "press" | "drag") => {
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
