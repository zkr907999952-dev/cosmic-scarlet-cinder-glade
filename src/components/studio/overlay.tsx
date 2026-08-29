import { useEffect, useState, type ReactNode } from "react";
import {
  Activity,
  Crosshair,
  Eye,
  EyeOff,
  Grid3x3,
  Hand,
  Grab,
  Heart,
  MousePointerClick,
  Pause,
  RotateCcw,
  RotateCw,
  Scan,
  Settings2,
  Sword,
  Wrench,
  Wind,
  Zap,
} from "lucide-react";
import * as Slider from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";
import { PRESETS, useStudio, type PresetId, type StudioParams } from "@/lib/studio-store";
import { EXPRESSIONS, POSES } from "@/lib/softbody/soft-skeleton";

const SLIDERS: {
  id: keyof Pick<
    StudioParams,
    "stiffness" | "damping" | "gravity" | "pressure" | "jiggle" | "wind" | "abdomenXray" | "bellyInflate" | "gutAmp" | "gutSpeed" | "fistBulge" | "fistSpread" | "fistGut" | "fistLever" | "fistMaxDepth" | "fistRise"
  >;
  label: string;
  min: number;
  max: number;
  step: number;
}[] = [
  { id: "stiffness", label: "刚度", min: 0.08, max: 1, step: 0.01 },
  { id: "damping", label: "阻尼", min: 0.82, max: 0.995, step: 0.001 },
  { id: "gravity", label: "重力", min: -4, max: 2, step: 0.05 },
  { id: "pressure", label: "体积", min: 0.1, max: 1, step: 0.01 },
  { id: "jiggle", label: "柔度", min: 0.2, max: 1, step: 0.01 },
  { id: "wind", label: "风力", min: 0, max: 1, step: 0.01 },
  { id: "abdomenXray", label: "腹部半透明", min: 0, max: 1, step: 0.01 },
  { id: "bellyInflate", label: "彭腹", min: -1, max: 1, step: 0.01 },
  { id: "gutAmp", label: "蠕动幅度", min: 0, max: 1, step: 0.01 },
  { id: "gutSpeed", label: "蠕动速度", min: 0, max: 1, step: 0.01 },
  { id: "fistBulge", label: "拳头鼓起", min: 0, max: 2, step: 0.01 },
  { id: "fistSpread", label: "鼓起范围", min: 0.2, max: 2, step: 0.01 },
  { id: "fistGut", label: "肠子撑开", min: 0, max: 2, step: 0.01 },
  { id: "fistLever", label: "杠杆搅动", min: 0, max: 2, step: 0.01 },
  { id: "fistMaxDepth", label: "最大插入深度", min: 0.5, max: 1.5, step: 0.01 },
  { id: "fistRise", label: "隆起叠加速度", min: 0.2, max: 3, step: 0.01 },
];

type PanelId = "settings" | "interact" | "tools" | "weapons";

const PANELS: { id: PanelId; label: string; icon: typeof Settings2 }[] = [
  { id: "settings", label: "设置", icon: Settings2 },
  { id: "interact", label: "互动", icon: Hand },
  { id: "tools", label: "工具", icon: Wrench },
  { id: "weapons", label: "武器", icon: Sword },
];

const STRIKE_LEVELS: { id: string; label: string; force: number }[] = [
  { id: "light", label: "轻", force: 0.28 },
  { id: "mid", label: "中", force: 0.52 },
  { id: "heavy", label: "重", force: 0.78 },
  { id: "max", label: "极重", force: 1 },
];

export function Overlay() {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<PanelId>("settings");
  const preset = useStudio((s) => s.preset);
  const energy = useStudio((s) => s.energy);
  const breathing = useStudio((s) => s.breathing);
  const slowMo = useStudio((s) => s.slowMo);
  const showLattice = useStudio((s) => s.showLattice);
  const showWeights = useStudio((s) => s.showWeights);
  const expression = useStudio((s) => s.expression);
  const pose = useStudio((s) => s.pose);
  const setExpression = useStudio((s) => s.setExpression);
  const setPose = useStudio((s) => s.setPose);
  const autoRotate = useStudio((s) => s.autoRotate);
  const showOrgans = useStudio((s) => s.showOrgans);
  const showGutHp = useStudio((s) => s.showGutHp);
  const uiHidden = useStudio((s) => s.uiHidden);
  const abdomenXray = useStudio((s) => s.abdomenXray);
  const interactMode = useStudio((s) => s.interactMode);
  const setInteractMode = useStudio((s) => s.setInteractMode);
  const grabbing = useStudio((s) => s.grabbing);
  const loading = useStudio((s) => s.loading);
  const loadProgress = useStudio((s) => s.loadProgress);
  const loadHint = useStudio((s) => s.loadHint);
  const loadError = useStudio((s) => s.loadError);
  const retryLoad = useStudio((s) => s.retryLoad);
  const applyPreset = useStudio((s) => s.applyPreset);
  const setParam = useStudio((s) => s.setParam);
  const resetSim = useStudio((s) => s.resetSim);
  const fireStrike = useStudio((s) => s.fireStrike);
  const strikeForce = useStudio((s) => s.strikeForce);
  const strikeRange = useStudio((s) => s.strikeRange);
  const strikeRebound = useStudio((s) => s.strikeRebound);
  const fistMaxDepth = useStudio((s) => s.fistMaxDepth);
  const fistThrust = useStudio((s) => s.fistThrust);
  const fistStir = useStudio((s) => s.fistStir);
  const fistThrustSpeed = useStudio((s) => s.fistThrustSpeed);
  const fistThrustStart = useStudio((s) => s.fistThrustStart);
  const fistStirSpeed = useStudio((s) => s.fistStirSpeed);
  const fistStirRadius = useStudio((s) => s.fistStirRadius);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "r" || e.key === "R") resetSim();
      if (e.key === "b" || e.key === "B") setParam("breathing", !useStudio.getState().breathing);
      if (e.key === "h" || e.key === "H") setParam("uiHidden", !useStudio.getState().uiHidden);
      if (e.key === "t" || e.key === "T") {
        const cur = useStudio.getState().interactMode;
        setInteractMode(cur === "drag" ? "pose" : cur === "pose" ? "strike" : cur === "strike" ? "fist" : "drag");
      }
      if (e.key === "x" || e.key === "X") {
        const cur = useStudio.getState().abdomenXray;
        setParam("abdomenXray", cur > 0.05 ? 0 : 0.38);
        if (cur <= 0.05) setParam("showOrgans", true);
      }
      if (e.key === "k" || e.key === "K") setParam("showLattice", !useStudio.getState().showLattice);
      if (e.key === "w" || e.key === "W") setParam("showWeights", !useStudio.getState().showWeights);
      const exprKeys: Record<string, (typeof EXPRESSIONS)[number]["id"]> = {
        "1": "rest",
        "2": "smile",
        "3": "surprise",
        "4": "open",
      };
      if (exprKeys[e.key]) setExpression(exprKeys[e.key]);
      const poseKeys: Record<string, (typeof POSES)[number]["id"]> = {
        "5": "idle",
        "6": "armsUp",
        "7": "bow",
        "8": "legLift",
        "9": "twist",
        "0": "sway",
      };
      if (poseKeys[e.key]) setPose(poseKeys[e.key]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [resetSim, setParam, setInteractMode, setExpression, setPose]);

  const energyNorm = Math.min(1, energy * 8);
  const hideUi = () => setParam("uiHidden", true);
  const showUi = () => setParam("uiHidden", false);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 text-fg">
      {loading ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-bg/70">
          <div className="w-64 rounded-xl border border-border bg-surface px-6 py-5 text-center">
            <p className="font-display text-xl tracking-display">
              {loadError ? "载入失败" : "载入模型"}
            </p>
            {loadError ? (
              <>
                <p className="mt-2 text-xs leading-relaxed text-muted text-pretty">{loadError}</p>
                <button
                  type="button"
                  onClick={retryLoad}
                  className="pointer-events-auto mt-4 inline-flex h-11 w-full items-center justify-center rounded-md bg-accent text-sm font-medium text-accent-fg"
                >
                  重试
                </button>
              </>
            ) : (
              <>
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-fast ease-smooth-out"
                    style={{ width: `${Math.max(3, Math.round(loadProgress))}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-muted tabular-nums">{Math.round(loadProgress)}%</p>
                <p className="mt-1 text-xs text-muted">{loadHint}</p>
              </>
            )}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={uiHidden ? showUi : hideUi}
        className="pointer-events-auto absolute top-4 right-4 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-fg sm:top-6 sm:right-6"
        aria-label={uiHidden ? "显示菜单" : "隐藏菜单"}
      >
        {uiHidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
      </button>

      {uiHidden ? null : (
        <>
      <header className="pointer-events-none absolute top-0 right-0 left-0 flex items-start justify-between gap-4 p-4 pr-16 sm:p-6 sm:pr-20">
        <div className="max-w-[16rem]">
          <p className="font-display text-3xl leading-none tracking-display text-fg sm:text-4xl">VELA</p>
          <p className="mt-1 text-xs tracking-[0.18em] text-muted uppercase">腰腹柔体模拟</p>
        </div>
        <div className="pointer-events-auto hidden items-center gap-1 sm:flex">
          {(Object.keys(PRESETS) as PresetId[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => applyPreset(id)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-fast ease-smooth-out",
                preset === id
                  ? "border-accent bg-accent text-accent-fg"
                  : "border-border bg-surface/80 text-muted hover:text-fg",
              )}
            >
              {PRESETS[id].label}
            </button>
          ))}
        </div>
      </header>

      <div className="pointer-events-none absolute top-20 left-4 hidden w-44 sm:block sm:left-6">
        <p className="text-xs leading-snug text-muted text-pretty">
          左键空白处旋转。拖拽：在骨骼上捏软组织。姿势：拉关节，松手后保持。K 骨骼 · W 绑定 · 1-4 表情 · 5-0 动作 · X 透视。
        </p>
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-xs tracking-wide text-muted uppercase">
            <span>形变能量</span>
            <span className="tabular-nums text-fg">{energyNorm.toFixed(2)}</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-fast ease-smooth-out"
              style={{ width: `${energyNorm * 100}%` }}
            />
          </div>
          <p className="mt-3 text-xs text-muted">{grabbing ? (interactMode === "pose" ? "调姿中" : "拖拽中") : "待机"}</p>
        </div>
      </div>

      <aside
        className={cn(
          "pointer-events-auto absolute right-4 bottom-4 left-4 max-h-[52vh] overflow-hidden rounded-xl border border-border bg-surface sm:right-6 sm:bottom-auto sm:left-auto sm:top-24 sm:max-h-[calc(100dvh-8rem)] sm:w-80",
        )}
      >
        <div className="grid grid-cols-4 border-b border-border">
          {PANELS.map((item) => {
            const Icon = item.icon;
            const on = panel === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setPanel(item.id);
                  setOpen(true);
                }}
                className={cn(
                  "inline-flex h-11 flex-col items-center justify-center gap-0.5 text-[10px] font-medium sm:h-12 sm:text-[11px]",
                  on ? "bg-surface-2 text-fg" : "text-muted hover:text-fg",
                )}
              >
                <Icon className="size-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-2 px-3 pt-2 sm:hidden">
          <p className="text-sm font-medium">{PANELS.find((p) => p.id === panel)?.label}</p>
          <button type="button" className="text-xs text-muted" onClick={() => setOpen((v) => !v)}>
            {open ? "收起" : "展开"}
          </button>
        </div>

        <div className={cn("overflow-y-auto p-3 sm:block sm:max-h-[calc(100dvh-12rem)] sm:p-4", open ? "block" : "hidden")}>
          {panel === "settings" ? (
            <>
              <div className="mb-3 flex gap-1 overflow-x-auto">
                {(Object.keys(PRESETS) as PresetId[]).map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => applyPreset(id)}
                    className={cn(
                      "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium",
                      preset === id
                        ? "border-accent bg-accent text-accent-fg"
                        : "border-border bg-surface-2 text-muted",
                    )}
                  >
                    {PRESETS[id].label}
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-3">
                {SLIDERS.map((item) => (
                  <SliderRow key={item.id} {...item} />
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Toggle
                  active={breathing}
                  onClick={() => setParam("breathing", !breathing)}
                  icon={<Wind className="size-3.5" />}
                  label="呼吸"
                />
                <Toggle
                  active={slowMo}
                  onClick={() => setParam("slowMo", !slowMo)}
                  icon={<Pause className="size-3.5" />}
                  label="慢动作"
                />
                <Toggle
                  active={showLattice}
                  onClick={() => setParam("showLattice", !showLattice)}
                  icon={<Grid3x3 className="size-3.5" />}
                  label="显示骨骼"
                />
                <Toggle
                  active={showWeights}
                  onClick={() => setParam("showWeights", !showWeights)}
                  icon={<Scan className="size-3.5" />}
                  label="显示绑定"
                />
                <Toggle
                  active={autoRotate}
                  onClick={() => setParam("autoRotate", !autoRotate)}
                  icon={<RotateCw className="size-3.5" />}
                  label="旋转"
                />
                <Toggle
                  active={showOrgans}
                  onClick={() => {
                    const next = !showOrgans;
                    setParam("showOrgans", next);
                    if (next && abdomenXray < 0.08) setParam("abdomenXray", 0.38);
                    if (!next) setParam("abdomenXray", 0);
                  }}
                  icon={<Scan className="size-3.5" />}
                  label="脏器"
                />
                <Toggle
                  active={abdomenXray > 0.05}
                  onClick={() => {
                    setParam("abdomenXray", abdomenXray > 0.05 ? 0 : 0.38);
                    if (abdomenXray <= 0.05) setParam("showOrgans", true);
                  }}
                  icon={<Scan className="size-3.5" />}
                  label="透视"
                />
                <Toggle
                  active={showGutHp}
                  onClick={() => {
                    const next = !showGutHp;
                    setParam("showGutHp", next);
                    if (next) {
                      setParam("showOrgans", true);
                      if (abdomenXray < 0.08) setParam("abdomenXray", 0.38);
                    }
                  }}
                  icon={<Heart className="size-3.5" />}
                  label="显示生命值"
                />
              </div>
              <p className="mt-4 mb-1.5 text-xs text-muted">表情</p>
              <div className="grid grid-cols-4 gap-1">
                {EXPRESSIONS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setExpression(item.id)}
                    className={cn(
                      "h-9 rounded-md border text-[11px] font-medium",
                      expression === item.id
                        ? "border-accent bg-accent text-accent-fg"
                        : "border-border bg-surface-2 text-muted hover:text-fg",
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <p className="mt-3 mb-1.5 text-xs text-muted">动作</p>
              <div className="grid grid-cols-3 gap-1">
                {POSES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setPose(item.id)}
                    className={cn(
                      "h-9 rounded-md border text-[11px] font-medium",
                      pose === item.id
                        ? "border-accent bg-accent text-accent-fg"
                        : "border-border bg-surface-2 text-muted hover:text-fg",
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {panel === "interact" ? (
            <>
              <p className="mb-3 text-xs leading-relaxed text-muted">
                左键点身体操作。拖拽捏软组织，姿势拉关节，击腹点击释放环状冲击，拳交拖动手臂沿大肠插入。
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setInteractMode("drag")}
                  className={cn(
                    "inline-flex h-11 items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors duration-fast",
                    interactMode === "drag"
                      ? "bg-accent text-accent-fg"
                      : "border border-border bg-surface-2 text-muted hover:text-fg",
                  )}
                >
                  <Hand className="size-4" />
                  拖拽
                </button>
                <button
                  type="button"
                  onClick={() => setInteractMode("pose")}
                  className={cn(
                    "inline-flex h-11 items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors duration-fast",
                    interactMode === "pose"
                      ? "bg-accent text-accent-fg"
                      : "border border-border bg-surface-2 text-muted hover:text-fg",
                  )}
                >
                  <MousePointerClick className="size-4" />
                  姿势
                </button>
                <button
                  type="button"
                  onClick={() => setInteractMode("strike")}
                  className={cn(
                    "inline-flex h-11 items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors duration-fast",
                    interactMode === "strike"
                      ? "bg-accent text-accent-fg"
                      : "border border-border bg-surface-2 text-muted hover:text-fg",
                  )}
                >
                  <Zap className="size-4" />
                  击腹
                </button>
                <button
                  type="button"
                  onClick={() => setInteractMode("fist")}
                  className={cn(
                    "inline-flex h-11 items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors duration-fast",
                    interactMode === "fist"
                      ? "bg-accent text-accent-fg"
                      : "border border-border bg-surface-2 text-muted hover:text-fg",
                  )}
                >
                  <Grab className="size-4" />
                  拳交
                </button>
              </div>

              {interactMode === "fist" ? (
                <div className="mt-3">
                  <p className="text-xs leading-relaxed text-muted">
                    左键拖拳头。肛门是支点，体外的手臂会跟着转，手臂本身是刚体不会弯折。
                  </p>
                  <label className="mt-3 block">
                    <span className="mb-1.5 flex items-center justify-between text-xs text-muted">
                      <span>最大插入深度</span>
                      <span className="tabular-nums text-fg">{fistMaxDepth.toFixed(2)}</span>
                    </span>
                    <Slider.Root
                      value={[fistMaxDepth]}
                      min={0.5}
                      max={1.5}
                      step={0.01}
                      onValueChange={([v]) => {
                        if (typeof v === "number") setParam("fistMaxDepth", v);
                      }}
                      className="relative flex h-5 w-full touch-none items-center"
                    >
                      <Slider.Track className="relative h-1 grow rounded-full bg-surface-2">
                        <Slider.Range className="absolute h-full rounded-full bg-accent" />
                      </Slider.Track>
                      <Slider.Thumb className="block size-3.5 rounded-full bg-fg shadow-sm outline-none ring-2 ring-transparent focus-visible:ring-accent" />
                    </Slider.Root>
                  </label>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Toggle
                      active={fistThrust}
                      onClick={() => setParam("fistThrust", !fistThrust)}
                      icon={<Activity className="size-3.5" />}
                      label="抽插"
                    />
                    <Toggle
                      active={fistStir}
                      onClick={() => setParam("fistStir", !fistStir)}
                      icon={<RotateCw className="size-3.5" />}
                      label="搅动"
                    />
                  </div>
                  <div className="mt-3 flex flex-col gap-3">
                    <label className="block">
                      <span className="mb-1.5 flex items-center justify-between text-xs text-muted">
                        <span>抽插速度</span>
                        <span className="tabular-nums text-fg">{fistThrustSpeed.toFixed(2)}</span>
                      </span>
                      <Slider.Root
                        value={[fistThrustSpeed]}
                        min={0.05}
                        max={1}
                        step={0.01}
                        onValueChange={([v]) => {
                          if (typeof v === "number") setParam("fistThrustSpeed", v);
                        }}
                        className="relative flex h-5 w-full touch-none items-center"
                      >
                        <Slider.Track className="relative h-1 grow rounded-full bg-surface-2">
                          <Slider.Range className="absolute h-full rounded-full bg-accent" />
                        </Slider.Track>
                        <Slider.Thumb className="block size-3.5 rounded-full bg-fg shadow-sm outline-none ring-2 ring-transparent focus-visible:ring-accent" />
                      </Slider.Root>
                    </label>
                    <label className="block">
                      <span className="mb-1.5 flex items-center justify-between text-xs text-muted">
                        <span>抽插起始深度</span>
                        <span className="tabular-nums text-fg">{fistThrustStart.toFixed(2)}</span>
                      </span>
                      <Slider.Root
                        value={[fistThrustStart]}
                        min={0.012}
                        max={0.12}
                        step={0.001}
                        onValueChange={([v]) => {
                          if (typeof v === "number") setParam("fistThrustStart", v);
                        }}
                        className="relative flex h-5 w-full touch-none items-center"
                      >
                        <Slider.Track className="relative h-1 grow rounded-full bg-surface-2">
                          <Slider.Range className="absolute h-full rounded-full bg-accent" />
                        </Slider.Track>
                        <Slider.Thumb className="block size-3.5 rounded-full bg-fg shadow-sm outline-none ring-2 ring-transparent focus-visible:ring-accent" />
                      </Slider.Root>
                    </label>
                    <label className="block">
                      <span className="mb-1.5 flex items-center justify-between text-xs text-muted">
                        <span>搅动速度</span>
                        <span className="tabular-nums text-fg">{fistStirSpeed.toFixed(2)}</span>
                      </span>
                      <Slider.Root
                        value={[fistStirSpeed]}
                        min={0.05}
                        max={1}
                        step={0.01}
                        onValueChange={([v]) => {
                          if (typeof v === "number") setParam("fistStirSpeed", v);
                        }}
                        className="relative flex h-5 w-full touch-none items-center"
                      >
                        <Slider.Track className="relative h-1 grow rounded-full bg-surface-2">
                          <Slider.Range className="absolute h-full rounded-full bg-accent" />
                        </Slider.Track>
                        <Slider.Thumb className="block size-3.5 rounded-full bg-fg shadow-sm outline-none ring-2 ring-transparent focus-visible:ring-accent" />
                      </Slider.Root>
                    </label>
                    <label className="block">
                      <span className="mb-1.5 flex items-center justify-between text-xs text-muted">
                        <span>搅动半径</span>
                        <span className="tabular-nums text-fg">{fistStirRadius.toFixed(2)}</span>
                      </span>
                      <Slider.Root
                        value={[fistStirRadius]}
                        min={0.05}
                        max={1}
                        step={0.01}
                        onValueChange={([v]) => {
                          if (typeof v === "number") setParam("fistStirRadius", v);
                        }}
                        className="relative flex h-5 w-full touch-none items-center"
                      >
                        <Slider.Track className="relative h-1 grow rounded-full bg-surface-2">
                          <Slider.Range className="absolute h-full rounded-full bg-accent" />
                        </Slider.Track>
                        <Slider.Thumb className="block size-3.5 rounded-full bg-fg shadow-sm outline-none ring-2 ring-transparent focus-visible:ring-accent" />
                      </Slider.Root>
                    </label>
                  </div>
                </div>
              ) : null}

              {interactMode === "strike" ? (
                <div className="mt-3">
                  <p className="mb-1.5 text-xs text-muted">力度档位</p>
                  <div className="grid grid-cols-4 gap-1">
                    {STRIKE_LEVELS.map((lv) => (
                      <button
                        key={lv.id}
                        type="button"
                        onClick={() => setParam("strikeForce", lv.force)}
                        className={cn(
                          "h-9 rounded-md border text-[11px] font-medium",
                          Math.abs(strikeForce - lv.force) < 0.06
                            ? "border-accent bg-accent text-accent-fg"
                            : "border-border bg-surface-2 text-muted hover:text-fg",
                        )}
                      >
                        {lv.label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-col gap-3">
                    <label className="block">
                      <span className="mb-1.5 flex items-center justify-between text-xs text-muted">
                        <span>力度</span>
                        <span className="tabular-nums text-fg">{strikeForce.toFixed(2)}</span>
                      </span>
                      <Slider.Root
                        value={[strikeForce]}
                        min={0.1}
                        max={1}
                        step={0.01}
                        onValueChange={([v]) => {
                          if (typeof v === "number") setParam("strikeForce", v);
                        }}
                        className="relative flex h-5 w-full touch-none items-center"
                      >
                        <Slider.Track className="relative h-1 grow rounded-full bg-surface-2">
                          <Slider.Range className="absolute h-full rounded-full bg-accent" />
                        </Slider.Track>
                        <Slider.Thumb className="block size-3.5 rounded-full bg-fg shadow-sm outline-none ring-2 ring-transparent focus-visible:ring-accent" />
                      </Slider.Root>
                    </label>
                    <label className="block">
                      <span className="mb-1.5 flex items-center justify-between text-xs text-muted">
                        <span>范围</span>
                        <span className="tabular-nums text-fg">{strikeRange.toFixed(2)}</span>
                      </span>
                      <Slider.Root
                        value={[strikeRange]}
                        min={0.1}
                        max={1}
                        step={0.01}
                        onValueChange={([v]) => {
                          if (typeof v === "number") setParam("strikeRange", v);
                        }}
                        className="relative flex h-5 w-full touch-none items-center"
                      >
                        <Slider.Track className="relative h-1 grow rounded-full bg-surface-2">
                          <Slider.Range className="absolute h-full rounded-full bg-accent" />
                        </Slider.Track>
                        <Slider.Thumb className="block size-3.5 rounded-full bg-fg shadow-sm outline-none ring-2 ring-transparent focus-visible:ring-accent" />
                      </Slider.Root>
                    </label>
                    <label className="block">
                      <span className="mb-1.5 flex items-center justify-between text-xs text-muted">
                        <span>回弹速度</span>
                        <span className="tabular-nums text-fg">{strikeRebound.toFixed(2)}</span>
                      </span>
                      <Slider.Root
                        value={[strikeRebound]}
                        min={0}
                        max={1}
                        step={0.01}
                        onValueChange={([v]) => {
                          if (typeof v === "number") setParam("strikeRebound", v);
                        }}
                        className="relative flex h-5 w-full touch-none items-center"
                      >
                        <Slider.Track className="relative h-1 grow rounded-full bg-surface-2">
                          <Slider.Range className="absolute h-full rounded-full bg-accent" />
                        </Slider.Track>
                        <Slider.Thumb className="block size-3.5 rounded-full bg-fg shadow-sm outline-none ring-2 ring-transparent focus-visible:ring-accent" />
                      </Slider.Root>
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => fireStrike(null)}
                    className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-accent text-sm font-medium text-accent-fg transition-transform duration-quick ease-smooth-out active:scale-[0.98]"
                  >
                    <Zap className="size-4" />
                    释放冲击
                  </button>
                </div>
              ) : null}

              <button
                type="button"
                onClick={resetSim}
                className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-border bg-surface-2 text-sm font-medium text-fg transition-transform duration-quick ease-smooth-out active:scale-[0.98]"
              >
                <RotateCcw className="size-4" />
                复位
              </button>
              <p className="mt-3 text-xs text-muted">
                {grabbing
                  ? interactMode === "pose"
                    ? "调姿中"
                    : "拖拽中"
                  : interactMode === "strike"
                    ? "击腹就绪"
                    : interactMode === "fist"
                      ? "拳交：拖动手臂插入"
                      : "待机"}
              </p>
            </>
          ) : null}

          {panel === "tools" ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <Wrench className="size-6 text-muted" />
              <p className="text-sm text-fg">工具</p>
              <p className="text-xs text-muted">测量、截图等工具稍后加入</p>
            </div>
          ) : null}

          {panel === "weapons" ? (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-muted">装备栏空</p>
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 6 }, (_, i) => (
                  <div
                    key={i}
                    className="flex aspect-square items-center justify-center rounded-md border border-dashed border-border bg-surface-2/50 text-muted"
                  >
                    <Crosshair className="size-4 opacity-40" />
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted">武器系统稍后加入</p>
            </div>
          ) : null}
        </div>
      </aside>

      <div className="pointer-events-none absolute bottom-auto left-4 hidden items-center gap-2 text-xs text-muted sm:bottom-6 sm:flex">
        <Hand className="size-3.5" />
        <span>
          {interactMode === "pose"
            ? "姿势"
            : interactMode === "strike"
              ? "击腹"
              : interactMode === "fist"
                ? "拳交"
                : "拖拽"}
        </span>
        <span className="text-border">/</span>
        <Activity className="size-3.5" />
        <span>右键旋转 · 左键点身体操作 · T 拖拽/姿势 · X 透视 · K 骨骼 · W 绑定</span>
      </div>
        </>
      )}
    </div>
  );
}

function SliderRow(item: (typeof SLIDERS)[number]) {
  const value = useStudio((s) => s[item.id]) as number;
  const setParam = useStudio((s) => s.setParam);
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between text-xs text-muted">
        <span>{item.label}</span>
        <span className="tabular-nums text-fg">{value.toFixed(item.step < 0.01 ? 3 : 2)}</span>
      </span>
      <Slider.Root
        value={[value]}
        min={item.min}
        max={item.max}
        step={item.step}
        onValueChange={([v]) => {
          if (typeof v === "number") setParam(item.id, v);
        }}
        className="relative flex h-5 w-full touch-none items-center"
      >
        <Slider.Track className="relative h-1 grow rounded-full bg-surface-2">
          <Slider.Range className="absolute h-full rounded-full bg-accent" />
        </Slider.Track>
        <Slider.Thumb className="block size-3.5 rounded-full bg-fg shadow-sm outline-none ring-2 ring-transparent focus-visible:ring-accent" />
      </Slider.Root>
    </label>
  );
}

function Toggle({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-1.5 rounded-md border text-xs font-medium transition-colors duration-fast",
        active
          ? "border-accent/40 bg-surface-2 text-fg"
          : "border-border bg-bg text-muted hover:text-fg",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
