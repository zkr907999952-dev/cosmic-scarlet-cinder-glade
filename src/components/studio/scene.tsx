import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Suspense, useRef, type RefObject } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { Figure } from "./figure";
import { useStudio } from "@/lib/studio-store";

export default function Scene({
  character,
  intestines,
  pelvis,
}: {
  character: THREE.Object3D;
  intestines: THREE.Object3D;
  pelvis: THREE.Object3D;
}) {
  const controlsRef = useRef<OrbitControlsImpl>(null);

  return (
    <div
      className="absolute inset-0 touch-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0.12, 1.02, 1.55], fov: 32, near: 0.05, far: 24 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.05,
          alpha: false,
          powerPreference: "high-performance",
        }}
        onCreated={({ scene, gl }) => {
          scene.background = new THREE.Color("#0b0b0c");
          scene.fog = new THREE.Fog("#0b0b0c", 4.2, 11);
          gl.setClearColor("#0b0b0c");
          gl.domElement.style.touchAction = "none";
        }}
      >
        <Suspense fallback={null}>
          <StudioLights />
          <Figure
            controlsRef={controlsRef}
            character={character}
            intestines={intestines}
            pelvis={pelvis}
          />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
            <circleGeometry args={[3.8, 72]} />
            <meshStandardMaterial color="#101012" roughness={0.88} metalness={0.08} />
          </mesh>
          <mesh position={[0, 1.15, -2.4]}>
            <planeGeometry args={[10, 6]} />
            <meshStandardMaterial color="#121214" roughness={1} metalness={0} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0.03]}>
            <circleGeometry args={[0.32, 48]} />
            <meshBasicMaterial color="#000000" transparent opacity={0.38} />
          </mesh>
          <ControlsBridge controlsRef={controlsRef} />
        </Suspense>
      </Canvas>
    </div>
  );
}

function ControlsBridge({
  controlsRef,
}: {
  controlsRef: RefObject<OrbitControlsImpl | null>;
}) {
  const autoRotate = useStudio((s) => s.autoRotate);
  const grabbing = useStudio((s) => s.grabbing);
  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableRotate={!grabbing}
      enablePan={!grabbing}
      enableDamping
      dampingFactor={0.08}
      autoRotate={autoRotate && !grabbing}
      autoRotateSpeed={0.45}
      minDistance={0.45}
      maxDistance={5.5}
      minPolarAngle={Math.PI * 0.12}
      maxPolarAngle={Math.PI * 0.86}
      target={[0, 0.98, 0.04]}
      mouseButtons={{
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.PAN,
        RIGHT: THREE.MOUSE.PAN,
      }}
      touches={{
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN,
      }}
    />
  );
}

function StudioLights() {
  return (
    <>
      <ambientLight intensity={0.22} color="#cfc8c0" />
      <hemisphereLight args={["#ddd6cc", "#2a2420", 0.5]} />
      <directionalLight position={[2.2, 3.4, 2.6]} intensity={1.85} color="#fff4ea" />
      <directionalLight position={[-2.4, 1.6, 1.2]} intensity={0.45} color="#aeb8c8" />
      <directionalLight position={[0.2, 1.8, -2.4]} intensity={1.15} color="#ffe4d2" />
      <spotLight
        position={[0.1, 2.0, 1.35]}
        angle={0.34}
        penumbra={0.8}
        intensity={4.2}
        color="#f0d2bc"
        distance={5}
        castShadow={false}
      />
    </>
  );
}
