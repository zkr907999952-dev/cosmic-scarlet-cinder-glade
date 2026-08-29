import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import { Suspense, useRef, type RefObject } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { Figure } from "./figure";
import { useStudio } from "@/lib/studio-store";

export default function Scene({
  character,
  intestines,
  pelvis,
  arm,
}: {
  character: THREE.Object3D;
  intestines: THREE.Object3D;
  pelvis: THREE.Object3D;
  arm: THREE.Object3D;
}) {
  const controlsRef = useRef<OrbitControlsImpl>(null);

  return (
    <div
      className="absolute inset-0 touch-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0.12, 1.02, 1.55], fov: 32, near: 0.05, far: 80 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.92,
          alpha: false,
          powerPreference: "high-performance",
          preserveDrawingBuffer: true,
        }}
        onCreated={({ gl }) => {
          gl.setClearColor("#0b0b0c");
          gl.domElement.style.touchAction = "none";
        }}
      >
        <Suspense fallback={null}>
          <Environment files="/env/sky.hdr" background environmentIntensity={0.88} />
          <StudioLights />
          <Figure
            controlsRef={controlsRef}
            character={character}
            intestines={intestines}
            pelvis={pelvis}
            arm={arm}
          />
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
        LEFT: -1 as unknown as THREE.MOUSE,
        MIDDLE: THREE.MOUSE.PAN,
        RIGHT: THREE.MOUSE.ROTATE,
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
      <ambientLight intensity={0.1} color="#cfc8c0" />
      <hemisphereLight args={["#e8e4dc", "#2a2622", 0.22]} />
      <directionalLight position={[2.2, 3.4, 2.6]} intensity={0.55} color="#fff4ea" />
      <directionalLight position={[-2.4, 1.6, 1.2]} intensity={0.18} color="#aeb8c8" />
      <directionalLight position={[0.2, 1.8, -2.4]} intensity={0.28} color="#ffe4d2" />
    </>
  );
}