import { useEffect, useState, type ReactNode } from "react";
import {
  Activity,
  Eye,
  EyeOff,
  Grid3x3,
  MousePointerClick,
  Hand,
  Pause,
  RotateCcw,
  RotateCw,
  Scan,
  Wind,
} from "lucide-react";
import * as Slider from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";
import { PRESETS, useStudio, type PresetId, type StudioParams } from "@/lib/studio-store";
import { EXPRESSIONS, POSES } from "@/lib/softbody/soft-skeleton";

const SLIDERS: {
  id: keyof Pick<
    StudioParams,
    "stiffness" | "damping" | "gravity" | "pressure" | "jiggle" | "wind" | "abdomenXray"
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
];

export function Overlay() {
  const [open, setOpen] = useState(false);
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "r" || e.key === "R") resetSim();
      if (e.key === "b" || e.key === "B") setParam("breathing", !useStudio.getState().breathing);
      if (e.key === "h" || e.key === "H") setParam("uiHidden", !useStudio.getState().uiHidden);
      if (e.key === "t" || e.key === "T") {
        const cur = useStudio.getState().interactMode;
        setInteractMode(cur === "drag" ? "pose" : "drag");
      }
      if (e.key === "x" || e.key === "X") {
        const cur = useStudio.getState().abdomenXray;
        setParam("abdomenXray", cur > 0.5 ? 0 : 0.82);
        if (cur <= 0.5) setParam("showOrgans", true);
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
          "pointer-events-auto absolute right-4 bottom-4 left-4 max-h-[46vh] overflow-y-auto rounded-xl border border-border bg-surface p-3 sm:right-6 sm:bottom-auto sm:left-auto sm:top-24 sm:max-h-[calc(100dvh-8rem)] sm:w-72 sm:p-4",
        )}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm font-medium">物理参数</p>
          <button
            type="button"
            className="text-xs text-muted sm:hidden"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "收起" : "展开"}
          </button>
        </div>

        <div className={cn("sm:block", open ? "block" : "hidden")}>
          <div className="mb-3 flex gap-1 overflow-x-auto sm:hidden">
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
                if (next && abdomenXray < 0.3) setParam("abdomenXray", 0.78);
                if (!next) setParam("abdomenXray", 0);
              }}
              icon={<Scan className="size-3.5" />}
              label="脏器"
            />
            <Toggle
              active={abdomenXray > 0.4}
              onClick={() => {
                setParam("abdomenXray", abdomenXray > 0.4 ? 0 : 0.82);
                if (abdomenXray <= 0.4) setParam("showOrgans", true);
              }}
              icon={<Scan className="size-3.5" />}
              label="透视"
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
          <div className="grid grid-cols-3 gap-1 sm:grid-cols-3">
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
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setInteractMode("drag")}
            className={cn(
              "inline-flex h-11 items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors duration-fast",
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
              "inline-flex h-11 items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors duration-fast",
              interactMode === "pose"
                ? "bg-accent text-accent-fg"
                : "border border-border bg-surface-2 text-muted hover:text-fg",
            )}
          >
            <MousePointerClick className="size-4" />
            姿势
          </button>
        </div>

        <div className="mt-2">
          <button
            type="button"
            onClick={resetSim}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-border bg-surface-2 text-sm font-medium text-fg transition-transform duration-quick ease-smooth-out active:scale-[0.98]"
          >
            <RotateCcw className="size-4" />
            复位
          </button>
        </div>
      </aside>

      <div className="pointer-events-none absolute bottom-auto left-4 hidden items-center gap-2 text-xs text-muted sm:bottom-6 sm:flex">
        <Hand className="size-3.5" />
        <span>{interactMode === "pose" ? "姿势" : "拖拽"}</span>
        <span className="text-border">/</span>
        <Activity className="size-3.5" />
        <span>左键旋转 · 点身体操作 · T 拖拽/姿势 · X 透视 · K 骨骼 · W 绑定</span>
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
