import { i as __toESM } from "../_runtime.mjs";
import { a as require_jsx_runtime, o as require_react } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { h as DefaultLoadingManager } from "../_libs/@react-three/drei+[...].mjs";
import { a as RotateCw, c as Hand, d as EyeOff, f as Activity, i as Scan, l as Grid3x3, n as Waves, o as RotateCcw, s as Pause, t as Wind, u as Eye } from "../_libs/lucide-react.mjs";
import { t as create } from "../_libs/zustand.mjs";
import { i as SliderTrack, n as SliderRange, r as SliderThumb, t as Slider } from "../_libs/@radix-ui/react-slider+[...].mjs";
import { t as clsx } from "../_libs/clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes--bddlASq.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
var PRESETS = {
	soft: {
		label: "柔软",
		hint: "松弛回弹",
		stiffness: .28,
		damping: .94,
		gravity: -1.4,
		pressure: .55,
		jiggle: 1,
		wind: 0,
		breathing: true,
		slowMo: false,
		showLattice: false,
		autoRotate: false,
		abdomenXray: 0,
		showOrgans: true,
		uiHidden: false
	},
	firm: {
		label: "紧致",
		hint: "快速复位",
		stiffness: .82,
		damping: .9,
		gravity: -.4,
		pressure: .85,
		jiggle: .55,
		wind: 0,
		breathing: true,
		slowMo: false,
		showLattice: false,
		autoRotate: false,
		abdomenXray: 0,
		showOrgans: true,
		uiHidden: false
	},
	jelly: {
		label: "果冻",
		hint: "长时间晃动",
		stiffness: .16,
		damping: .985,
		gravity: -.2,
		pressure: .7,
		jiggle: 1,
		wind: .15,
		breathing: false,
		slowMo: false,
		showLattice: false,
		autoRotate: false,
		abdomenXray: 0,
		showOrgans: true,
		uiHidden: false
	},
	athletic: {
		label: "运动",
		hint: "弹性支撑",
		stiffness: .58,
		damping: .92,
		gravity: -.8,
		pressure: .72,
		jiggle: .78,
		wind: 0,
		breathing: true,
		slowMo: false,
		showLattice: false,
		autoRotate: false,
		abdomenXray: 0,
		showOrgans: true,
		uiHidden: false
	}
};
var useStudio = create((set) => ({
	...PRESETS.soft,
	preset: "soft",
	energy: 0,
	grabbing: false,
	shakeNonce: 0,
	resetNonce: 0,
	loading: true,
	loadProgress: 0,
	setParam: (key, value) => set((s) => ({
		...s,
		[key]: value,
		preset: s.preset
	})),
	applyPreset: (id) => set((s) => ({
		...PRESETS[id],
		preset: id,
		abdomenXray: s.abdomenXray,
		showOrgans: s.showOrgans,
		uiHidden: s.uiHidden
	})),
	setEnergy: (energy) => set({ energy }),
	setGrabbing: (grabbing) => set({ grabbing }),
	shake: () => set((s) => ({ shakeNonce: s.shakeNonce + 1 })),
	resetSim: () => set((s) => ({
		resetNonce: s.resetNonce + 1,
		energy: 0
	}))
}));
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
var SLIDERS = [
	{
		id: "stiffness",
		label: "刚度",
		min: .08,
		max: 1,
		step: .01
	},
	{
		id: "damping",
		label: "阻尼",
		min: .82,
		max: .995,
		step: .001
	},
	{
		id: "gravity",
		label: "重力",
		min: -4,
		max: 2,
		step: .05
	},
	{
		id: "pressure",
		label: "体积",
		min: .1,
		max: 1,
		step: .01
	},
	{
		id: "jiggle",
		label: "柔度",
		min: .2,
		max: 1,
		step: .01
	},
	{
		id: "wind",
		label: "风力",
		min: 0,
		max: 1,
		step: .01
	},
	{
		id: "abdomenXray",
		label: "腹部半透明",
		min: 0,
		max: 1,
		step: .01
	}
];
function Overlay() {
	const [open, setOpen] = (0, import_react.useState)(false);
	const preset = useStudio((s) => s.preset);
	const energy = useStudio((s) => s.energy);
	const breathing = useStudio((s) => s.breathing);
	const slowMo = useStudio((s) => s.slowMo);
	const showLattice = useStudio((s) => s.showLattice);
	const autoRotate = useStudio((s) => s.autoRotate);
	const showOrgans = useStudio((s) => s.showOrgans);
	const uiHidden = useStudio((s) => s.uiHidden);
	const abdomenXray = useStudio((s) => s.abdomenXray);
	const grabbing = useStudio((s) => s.grabbing);
	const loading = useStudio((s) => s.loading);
	const loadProgress = useStudio((s) => s.loadProgress);
	const applyPreset = useStudio((s) => s.applyPreset);
	const setParam = useStudio((s) => s.setParam);
	const shake = useStudio((s) => s.shake);
	const resetSim = useStudio((s) => s.resetSim);
	(0, import_react.useEffect)(() => {
		const onKey = (e) => {
			const tag = e.target?.tagName;
			if (tag === "INPUT" || tag === "TEXTAREA") return;
			if (e.key === "r" || e.key === "R") resetSim();
			if (e.key === " ") {
				e.preventDefault();
				shake();
			}
			if (e.key === "b" || e.key === "B") setParam("breathing", !useStudio.getState().breathing);
			if (e.key === "h" || e.key === "H") setParam("uiHidden", !useStudio.getState().uiHidden);
			if (e.key === "x" || e.key === "X") {
				const cur = useStudio.getState().abdomenXray;
				setParam("abdomenXray", cur > .5 ? 0 : .82);
				if (cur <= .5) setParam("showOrgans", true);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [
		resetSim,
		shake,
		setParam
	]);
	const energyNorm = Math.min(1, energy * 8);
	const hideUi = () => setParam("uiHidden", true);
	const showUi = () => setParam("uiHidden", false);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "pointer-events-none absolute inset-0 z-10 text-fg",
		children: [
			loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-bg/55",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "w-56 rounded-xl border border-border bg-surface px-6 py-5 text-center",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-display text-xl tracking-display",
							children: "载入模型"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-3 h-1 overflow-hidden rounded-full bg-surface-2",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "h-full rounded-full bg-accent transition-[width] duration-fast ease-smooth-out",
								style: { width: `${Math.max(4, Math.round(loadProgress))}%` }
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-2 text-xs text-muted tabular-nums",
							children: [Math.round(loadProgress), "%"]
						})
					]
				})
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: uiHidden ? showUi : hideUi,
				className: "pointer-events-auto absolute top-4 right-4 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-fg sm:top-6 sm:right-6",
				"aria-label": uiHidden ? "显示菜单" : "隐藏菜单",
				children: uiHidden ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eye, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EyeOff, { className: "size-4" })
			}),
			uiHidden ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
					className: "pointer-events-none absolute top-0 right-0 left-0 flex items-start justify-between gap-4 p-4 pr-16 sm:p-6 sm:pr-20",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "max-w-[16rem]",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-display text-3xl leading-none tracking-display text-fg sm:text-4xl",
							children: "VELA"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-xs tracking-[0.18em] text-muted uppercase",
							children: "腰腹柔体模拟"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "pointer-events-auto hidden items-center gap-1 sm:flex",
						children: Object.keys(PRESETS).map((id) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => applyPreset(id),
							className: cn("rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-fast ease-smooth-out", preset === id ? "border-accent bg-accent text-accent-fg" : "border-border bg-surface/80 text-muted hover:text-fg"),
							children: PRESETS[id].label
						}, id))
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "pointer-events-none absolute top-20 left-4 hidden w-44 sm:block sm:left-6",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs leading-snug text-muted text-pretty",
						children: "左键拖动按压腰腹，右键旋转视角，中键平移。调高「腹部半透明」可观察腹腔内大小肠。"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mb-1 flex items-center justify-between text-xs tracking-wide text-muted uppercase",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "形变能量" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "tabular-nums text-fg",
									children: energyNorm.toFixed(2)
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "h-1 overflow-hidden rounded-full bg-surface-2",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "h-full rounded-full bg-accent transition-[width] duration-fast ease-smooth-out",
									style: { width: `${energyNorm * 100}%` }
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-3 text-xs text-muted",
								children: grabbing ? "按压中" : "待机"
							})
						]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
					className: cn("pointer-events-auto absolute right-4 bottom-4 left-4 max-h-[46vh] overflow-y-auto rounded-xl border border-border bg-surface p-3 sm:right-6 sm:bottom-auto sm:left-auto sm:top-24 sm:max-h-[calc(100dvh-8rem)] sm:w-72 sm:p-4"),
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mb-3 flex items-center justify-between gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm font-medium",
								children: "物理参数"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "text-xs text-muted sm:hidden",
								onClick: () => setOpen((v) => !v),
								children: open ? "收起" : "展开"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: cn("sm:block", open ? "block" : "hidden"),
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mb-3 flex gap-1 overflow-x-auto sm:hidden",
									children: Object.keys(PRESETS).map((id) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => applyPreset(id),
										className: cn("shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium", preset === id ? "border-accent bg-accent text-accent-fg" : "border-border bg-surface-2 text-muted"),
										children: PRESETS[id].label
									}, id))
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "flex flex-col gap-3",
									children: SLIDERS.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SliderRow, { ...item }, item.id))
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-4 grid grid-cols-2 gap-2",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toggle, {
											active: breathing,
											onClick: () => setParam("breathing", !breathing),
											icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Wind, { className: "size-3.5" }),
											label: "呼吸"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toggle, {
											active: slowMo,
											onClick: () => setParam("slowMo", !slowMo),
											icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pause, { className: "size-3.5" }),
											label: "慢动作"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toggle, {
											active: showLattice,
											onClick: () => setParam("showLattice", !showLattice),
											icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Grid3x3, { className: "size-3.5" }),
											label: "质点"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toggle, {
											active: autoRotate,
											onClick: () => setParam("autoRotate", !autoRotate),
											icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCw, { className: "size-3.5" }),
											label: "旋转"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toggle, {
											active: showOrgans,
											onClick: () => {
												const next = !showOrgans;
												setParam("showOrgans", next);
												if (next && abdomenXray < .3) setParam("abdomenXray", .78);
												if (!next) setParam("abdomenXray", 0);
											},
											icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scan, { className: "size-3.5" }),
											label: "脏器"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toggle, {
											active: abdomenXray > .4,
											onClick: () => {
												setParam("abdomenXray", abdomenXray > .4 ? 0 : .82);
												if (abdomenXray <= .4) setParam("showOrgans", true);
											},
											icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scan, { className: "size-3.5" }),
											label: "透视"
										})
									]
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-3 grid grid-cols-2 gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: shake,
								className: "inline-flex h-11 items-center justify-center gap-2 rounded-md bg-accent text-sm font-medium text-accent-fg transition-transform duration-quick ease-smooth-out active:scale-[0.98]",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Waves, { className: "size-4" }), "晃动"]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: resetSim,
								className: "inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border bg-surface-2 text-sm font-medium text-fg transition-transform duration-quick ease-smooth-out active:scale-[0.98]",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, { className: "size-4" }), "复位"]
							})]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "pointer-events-none absolute bottom-auto left-4 hidden items-center gap-2 text-xs text-muted sm:bottom-6 sm:flex",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Hand, { className: "size-3.5" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "拖拽按压" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-border",
							children: "/"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Activity, { className: "size-3.5" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "左键按压 · 右键旋转 · 中键平移 · H 隐藏 · X 透视" })
					]
				})
			] })
		]
	});
}
function SliderRow(item) {
	const value = useStudio((s) => s[item.id]);
	const setParam = useStudio((s) => s.setParam);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
		className: "block",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
			className: "mb-1.5 flex items-center justify-between text-xs text-muted",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: item.label }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "tabular-nums text-fg",
				children: value.toFixed(item.step < .01 ? 3 : 2)
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Slider, {
			value: [value],
			min: item.min,
			max: item.max,
			step: item.step,
			onValueChange: ([v]) => {
				if (typeof v === "number") setParam(item.id, v);
			},
			className: "relative flex h-5 w-full touch-none items-center",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SliderTrack, {
				className: "relative h-1 grow rounded-full bg-surface-2",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SliderRange, { className: "absolute h-full rounded-full bg-accent" })
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SliderThumb, { className: "block size-3.5 rounded-full bg-fg shadow-sm outline-none ring-2 ring-transparent focus-visible:ring-accent" })]
		})]
	});
}
function Toggle({ active, onClick, icon, label }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		type: "button",
		onClick,
		className: cn("inline-flex h-10 items-center justify-center gap-1.5 rounded-md border text-xs font-medium transition-colors duration-fast", active ? "border-accent/40 bg-surface-2 text-fg" : "border-border bg-bg text-muted hover:text-fg"),
		children: [icon, label]
	});
}
var Scene = (0, import_react.lazy)(() => import("./scene-C-StUZg3.mjs"));
function StudioApp() {
	const [mounted, setMounted] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => setMounted(true), []);
	(0, import_react.useEffect)(() => {
		const mgr = DefaultLoadingManager;
		const prev = mgr.onProgress;
		mgr.onProgress = (url, loaded, total) => {
			prev?.(url, loaded, total);
			if (!useStudio.getState().loading) return;
			const pct = total > 0 ? Math.min(99, Math.round(loaded / total * 100)) : 0;
			const next = Math.max(useStudio.getState().loadProgress, pct);
			if (next !== useStudio.getState().loadProgress) queueMicrotask(() => {
				if (useStudio.getState().loading) useStudio.setState({ loadProgress: next });
			});
		};
		const t = window.setTimeout(() => {
			if (useStudio.getState().loading) useStudio.setState({
				loading: false,
				loadProgress: 100
			});
		}, 45e3);
		return () => {
			window.clearTimeout(t);
			mgr.onProgress = prev;
		};
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "relative h-dvh w-full overflow-hidden bg-bg text-fg",
		children: [mounted ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react.Suspense, {
			fallback: null,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene, {})
		}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Overlay, {})]
	});
}
var routes_exports = /* @__PURE__ */ __exportAll({ component: () => Home });
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StudioApp, {});
}
//#endregion
export { useStudio as n, routes_exports as t };
