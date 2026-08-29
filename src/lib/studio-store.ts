import { create } from "zustand";
import type { ExpressionId, PoseId } from "@/lib/softbody/soft-skeleton";

export type PresetId = "soft" | "firm" | "jelly" | "athletic";
export type InteractMode = "drag" | "pose" | "strike" | "fist";

export type StudioParams = {
  stiffness: number;
  damping: number;
  gravity: number;
  pressure: number;
  jiggle: number;
  wind: number;
  breathing: boolean;
  slowMo: boolean;
  showLattice: boolean;
  showWeights: boolean;
  autoRotate: boolean;
  abdomenXray: number;
  bellyInflate: number;
  showOrgans: boolean;
  showGutHp: boolean;
  gutAmp: number;
  gutSpeed: number;
  strikeForce: number;
  strikeRange: number;
  strikeRebound: number;
  fistBulge: number;
  fistSpread: number;
  fistGut: number;
  fistLever: number;
  fistMaxDepth: number;
  fistRise: number;
  uiHidden: boolean;
};

export const PRESETS: Record<
  PresetId,
  { label: string; hint: string } & StudioParams
> = {
  soft: {
    label: "柔软",
    hint: "松弛回弹",
    stiffness: 0.28,
    damping: 0.94,
    gravity: -1.4,
    pressure: 0.55,
    jiggle: 1,
    wind: 0,
    breathing: true,
    slowMo: false,
    showLattice: false,
    showWeights: false,
    autoRotate: false,
    abdomenXray: 0.38,
    bellyInflate: 0,
    showOrgans: true,
    showGutHp: false,
    gutAmp: 0.3,
    gutSpeed: 0.5,
    strikeForce: 0.78,
    strikeRange: 0.55,
    strikeRebound: 0.58,
    fistBulge: 1.4,
    fistSpread: 1,
    fistGut: 1,
    fistLever: 1,
    fistMaxDepth: 1,
    fistRise: 1.5,
    uiHidden: false,
  },
  firm: {
    label: "紧致",
    hint: "快速复位",
    stiffness: 0.82,
    damping: 0.9,
    gravity: -0.4,
    pressure: 0.85,
    jiggle: 0.55,
    wind: 0,
    breathing: true,
    slowMo: false,
    showLattice: false,
    showWeights: false,
    autoRotate: false,
    abdomenXray: 0.38,
    bellyInflate: 0,
    showOrgans: true,
    showGutHp: false,
    gutAmp: 0.3,
    gutSpeed: 0.5,
    strikeForce: 0.78,
    strikeRange: 0.55,
    strikeRebound: 0.58,
    fistBulge: 1.4,
    fistSpread: 1,
    fistGut: 1,
    fistLever: 1,
    fistMaxDepth: 1,
    fistRise: 1.5,
    uiHidden: false,
  },
  jelly: {
    label: "果冻",
    hint: "长时间晃动",
    stiffness: 0.16,
    damping: 0.985,
    gravity: -0.2,
    pressure: 0.7,
    jiggle: 1,
    wind: 0.15,
    breathing: false,
    slowMo: false,
    showLattice: false,
    showWeights: false,
    autoRotate: false,
    abdomenXray: 0.38,
    bellyInflate: 0,
    showOrgans: true,
    showGutHp: false,
    gutAmp: 0.3,
    gutSpeed: 0.5,
    strikeForce: 0.78,
    strikeRange: 0.55,
    strikeRebound: 0.58,
    fistBulge: 1.4,
    fistSpread: 1,
    fistGut: 1,
    fistLever: 1,
    fistMaxDepth: 1,
    fistRise: 1.5,
    uiHidden: false,
  },
  athletic: {
    label: "运动",
    hint: "弹性支撑",
    stiffness: 0.58,
    damping: 0.92,
    gravity: -0.8,
    pressure: 0.72,
    jiggle: 0.78,
    wind: 0,
    breathing: true,
    slowMo: false,
    showLattice: false,
    showWeights: false,
    autoRotate: false,
    abdomenXray: 0.38,
    bellyInflate: 0,
    showOrgans: true,
    showGutHp: false,
    gutAmp: 0.3,
    gutSpeed: 0.5,
    strikeForce: 0.78,
    strikeRange: 0.55,
    strikeRebound: 0.58,
    fistBulge: 1.4,
    fistSpread: 1,
    fistGut: 1,
    fistLever: 1,
    fistMaxDepth: 1,
    fistRise: 1.5,
    uiHidden: false,
  },
};

type StudioState = StudioParams & {
  preset: PresetId;
  interactMode: InteractMode;
  expression: ExpressionId;
  pose: PoseId;
  energy: number;
  grabbing: boolean;
  shakeNonce: number;
  resetNonce: number;
  strikeNonce: number;
  strikePoint: [number, number, number] | null;
  loading: boolean;
  loadProgress: number;
  loadHint: string;
  loadError: string | null;
  retryNonce: number;
  setParam: <K extends keyof StudioParams>(key: K, value: StudioParams[K]) => void;
  applyPreset: (id: PresetId) => void;
  setInteractMode: (mode: InteractMode) => void;
  setExpression: (id: ExpressionId) => void;
  setPose: (id: PoseId) => void;
  setEnergy: (v: number) => void;
  setGrabbing: (v: boolean) => void;
  shake: () => void;
  fireStrike: (point?: [number, number, number] | null) => void;
  resetSim: () => void;
  retryLoad: () => void;
};

export const useStudio = create<StudioState>((set) => ({
  ...PRESETS.soft,
  preset: "soft",
  interactMode: "drag",
  expression: "rest",
  pose: "idle",
  energy: 0,
  grabbing: false,
  shakeNonce: 0,
  resetNonce: 0,
  strikeNonce: 0,
  strikePoint: null,
  loading: true,
  loadProgress: 0,
  loadHint: "准备下载",
  loadError: null,
  retryNonce: 0,
  setParam: (key, value) =>
    set((s) => ({
      ...s,
      [key]: value,
      preset: s.preset,
    })),
  applyPreset: (id) =>
    set((s) => ({
      ...PRESETS[id],
      preset: id,
      abdomenXray: s.abdomenXray,
      bellyInflate: s.bellyInflate,
      showOrgans: s.showOrgans,
      showGutHp: s.showGutHp,
      gutAmp: s.gutAmp,
      gutSpeed: s.gutSpeed,
      strikeForce: s.strikeForce,
      strikeRange: s.strikeRange,
      strikeRebound: s.strikeRebound,
      fistBulge: s.fistBulge,
      fistSpread: s.fistSpread,
      fistGut: s.fistGut,
      fistLever: s.fistLever,
      fistMaxDepth: s.fistMaxDepth,
      fistRise: s.fistRise,
      showLattice: s.showLattice,
      showWeights: s.showWeights,
      uiHidden: s.uiHidden,
      interactMode: s.interactMode,
      expression: s.expression,
      pose: s.pose,
    })),
  setInteractMode: (interactMode) => set({ interactMode }),
  setExpression: (expression) => set({ expression }),
  setPose: (pose) => set({ pose }),
  setEnergy: (energy) => set({ energy }),
  setGrabbing: (grabbing) => set({ grabbing }),
  shake: () => set((s) => ({ shakeNonce: s.shakeNonce + 1 })),
  fireStrike: (point = null) =>
    set((s) => ({ strikeNonce: s.strikeNonce + 1, strikePoint: point ?? null })),
  resetSim: () => set((s) => ({ resetNonce: s.resetNonce + 1, energy: 0 })),
  retryLoad: () =>
    set((s) => ({
      loading: true,
      loadProgress: 0,
      loadHint: "重新下载",
      loadError: null,
      retryNonce: s.retryNonce + 1,
    })),
}));
