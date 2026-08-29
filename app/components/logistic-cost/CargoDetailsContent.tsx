'use client';
/* eslint-disable */
// ─────────────────────────────────────────────────────────────────────────────
// Logistic Cost popup — ported VERBATIM from the buyer app:
//   buyer-aaziko/buyer-front/src/app/(control-panel)/order-process/ConfirmationForm.tsx
//   (lines 748–3561: ChipToggle, Timeline, VoyageCard, Container3DViewer, CargoDetailsContent)
//
// This is the EXACT buyer-side "Logistic Cost" popup. Nothing in its UI/logic was
// changed. Only the buyer-app-specific dependencies are provided as thin shims so the
// component runs standalone inside aaziko-next:
//   • MUI <Alert> / <CircularProgress>          → minimal local equivalents
//   • <CustomTextField>                          → label + input (ignores MUI sx)
//   • RTK Query hooks (calculate / 3D viz)       → plain fetch to the SAME
//     transport-service endpoints, same { data, isLoading } shape + .unwrap()
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
// Single source of truth for API bases (auto local↔live). See app/content/_api.js.
import { API } from '@/app/content/_api';

// Real WebGL ULD/truck model — the SAME component the buyer product-page "Logistic
// Cost" popup uses for AIR/LAND (buyer-front .../loadcalculator/AirLandModel3D.tsx,
// copied verbatim). Lazy + client-only so three.js is a separate chunk and never
// runs during the static export/SSR pass.
const AirLandModel3D = dynamic(() => import('./AirLandModel3D'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-sm text-[#7B8499]">
      Loading 3D model…
    </div>
  ),
});

// transport-service base (local in dev, https://api.aaziko.com/common-api/transport-service when live)
const TRANSPORT = API.transport;

// Types (copied from buyer-front transportApi.ts; widened to index signatures so the
// verbatim block's property access type-checks without dragging the full type tree).
export interface ProductInput {
  name: string;
  cargoType: string;
  length: number;
  width: number;
  height: number;
  weight: number;
  quantity: number;
  unitsPerBox?: number;
  color?: string;
  spacingSettings?: any;
  stuffingSettings?: any;
  [key: string]: any;
}
export interface Visualization3D {
  [key: string]: any;
}

// ── MUI shims ──────────────────────────────────────────────────────────────
function Alert({ children, onClose, className }: any) {
  return (
    <div
      className={
        'flex items-start justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-800 ' +
        (className || '')
      }
    >
      <div>{children}</div>
      {onClose && (
        <button type="button" onClick={onClose} className="leading-none text-amber-700">
          ×
        </button>
      )}
    </div>
  );
}
function CircularProgress({ size = 24 }: any) {
  return (
    <span
      className="inline-block animate-spin rounded-full border-2 border-current border-t-transparent align-middle"
      style={{ width: size, height: size }}
    />
  );
}

// ── CustomTextField shim (label + input; MUI `sx` ignored) ───────────────────
function CustomTextField({ label, placeholder, value, onChange, className }: any) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-[#7c7c7c]">{label}</label>}
      <input
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className={
          'w-full rounded-lg border border-[#e6e8ef] px-3 py-2 text-sm text-black outline-none focus:border-[#5B8DEF] ' +
          (className || '')
        }
      />
    </div>
  );
}

// ── RTK Query hook shims → fetch the same endpoints; same [trigger, {data,isLoading}] + .unwrap() ──
function useFetchMutation(makeReq: (body: any) => { url: string; payload: any }) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  // Monotonic call id: only the latest trigger may publish its response.
  // Rapid re-calcs (every form keystroke) race otherwise, and a slower stale
  // response — e.g. from before a product row was deleted — would land last
  // and leave the 3D showing cargo that no longer matches the form.
  const seqRef = useRef(0);
  const trigger = useCallback((body: any) => {
    const id = ++seqRef.current;
    const promise = (async () => {
      setIsLoading(true);
      try {
        const { url, payload } = makeReq(body);
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw { data: json };
        if (id === seqRef.current) setData(json);
        return json;
      } finally {
        if (id === seqRef.current) setIsLoading(false);
      }
    })();
    return { unwrap: () => promise };
  }, []);
  return [trigger, { data, isLoading }] as const;
}
function useCalculateMultipleContainersMutation() {
  return useFetchMutation((body: any) => {
    const { format = 'full', ...rest } = body || {};
    return {
      url: `${TRANSPORT}/load-calculator/api/calculate-multiple-containers?format=${format}`,
      payload: rest,
    };
  });
}
function useGetEnhanced3DVisualizationMutation() {
  return useFetchMutation((body: any) => {
    const { containerIndex = 0, ...rest } = body || {};
    return {
      url: `${TRANSPORT}/load-calculator/api/enhanced-3d-visualization?containerIndex=${containerIndex}`,
      payload: rest,
    };
  });
}

// ════════════════════ VERBATIM buyer-front popup block ════════════════════
// Chip Toggle Component
const ChipToggle: React.FC<{
  label: string;
  active?: boolean;
  onClick?: () => void;
}> = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    className={[
      "h-10 px-3 rounded-lg border inline-flex items-center gap-2 text-sm",
      active
        ? "bg-[#EAF2FF] border-[#DCE7FF] text-[#356AE6]"
        : "bg-white border-[#E6E8EF] text-[#4B5565] hover:bg-[#F7F9FC]",
    ].join(" ")}
  >
    {label}
  </button>
);

// Stat Component
const _Stat: React.FC<{ title: string; value: string; sub?: string }> = ({
  title,
  value,
  sub,
}) => (
  <div className="min-w-[140px] flex-1 rounded-lg border border-[#E6E8EF] bg-white p-3">
    <div className="text-xs text-[#7B8499]">{title}</div>
    <div className="text-[15px] font-semibold text-[#273046]">{value}</div>
    {sub && <div className="text-xs text-[#7B8499] mt-0.5">{sub}</div>}
  </div>
);

// Simple donut placeholder
const _Donut: React.FC = () => (
  <svg viewBox="0 0 120 120" className="w-36 h-36">
    <circle
      cx="60"
      cy="60"
      r="45"
      fill="none"
      stroke="#E6E8EF"
      strokeWidth="18"
    />
    <circle
      cx="60"
      cy="60"
      r="45"
      fill="none"
      stroke="#4C7DFF"
      strokeWidth="18"
      strokeDasharray="210 565"
      strokeLinecap="round"
      transform="rotate(-90 60 60)"
    />
  </svg>
);

// Timeline Component
const Timeline: React.FC<{
  origin: string;
  mid: string;
  dest: string;
  days: string;
}> = ({ origin, mid, dest, days }) => (
  <div className="px-4 py-4">
    <div className="flex items-center gap-3">
      <span className="h-3 w-3 rounded-full bg-[#E67E22] flex-shrink-0"></span>
      <div className="flex-1 h-1 bg-[#E6E8EF] relative min-w-0">
        <span className="absolute left-1/2 -translate-x-1/2 -top-4 text-xs text-[#7B8499] whitespace-nowrap">
          {days}
        </span>
        <span className="absolute left-1/3 -mt-1 h-3 w-3 rounded-full bg-[#4C7DFF]"></span>
        <span className="absolute left-2/3 -mt-1 h-3 w-3 rounded-full bg-[#4C7DFF]"></span>
      </div>
      <span className="h-3 w-3 rounded-full bg-[#E67E22] flex-shrink-0"></span>
    </div>
    {/* On phones the mid port-code label (redundant with origin/dest) is hidden so
        the two end labels get the full width and don't collide/over-truncate. */}
    <div className="flex justify-between text-xs text-[#4B5565] mt-2 gap-2">
      <span className="truncate min-w-0">{origin}</span>
      <span className="truncate text-center min-w-0 hidden sm:block">{mid}</span>
      <span className="truncate text-right min-w-0">{dest}</span>
    </div>
  </div>
);

// Voyage Card Component
// `option` carries the REAL service-provider rate (carrier, route, transit, 5-line
// tariff, validity, total). When absent it falls back to the original static values.
const VoyageCard: React.FC<{ option?: any }> = ({ option }) => {
  const [tab, setTab] = useState<"tariff" | "map">("tariff");
  const carrier = option?.carrier ?? "EVERGREEN";
  const fmtUsd = (n: number) => "$" + Math.round(Number(n) || 0).toLocaleString("en-US");
  const tariffRows: { label: string; value: number; live?: boolean }[] = option?.tariff ?? [
    { label: "Pick up", value: 204 },
    { label: "Port of origin (Nhava Sheva)", value: 204 },
    { label: "Ocean Freight", value: 204 },
    { label: "Port of discharge (Hong Kong)", value: 204 },
    { label: "Delivery", value: 204 },
  ];
  return (
    <div className="rounded-xl border border-[#E6E8EF] bg-white overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px]">
        <div className="border-r-0 lg:border-r border-[#E6E8EF]">
          <div className="flex items-center gap-3 p-3">
            <span className="h-8 w-8 rounded-full border border-[#E6E8EF] bg-[#EAF2FF] text-[#356AE6] flex items-center justify-center text-sm font-bold">
              {String(carrier).charAt(0)}
            </span>
            <div className="text-sm font-semibold text-[#4B5565]">{carrier}</div>
            {option?.containerType && (
              <span className="ml-auto rounded-full bg-[#F1F5F9] px-2 py-0.5 text-xs text-[#7B8499]">
                {option.containerType}
              </span>
            )}
          </div>
          <Timeline
            origin={option?.originPortName ?? "Jawaharlal Nehru Port"}
            mid={option?.mid ?? "INNSA · HKHKG"}
            dest={option?.destPortName ?? "Shekou Port"}
            days={option?.transitDays ?? "13 days"}
          />
          <div className="px-3 pb-3">
            <div className="inline-flex rounded-md overflow-hidden border border-[#E6E8EF]">
              <button
                onClick={() => setTab("tariff")}
                className={`px-4 py-1.5 text-sm ${tab === "tariff" ? "bg-[#EAF2FF] text-[#356AE6]" : "bg-white text-[#4B5565]"}`}
              >
                Tariff
              </button>
              <button
                onClick={() => setTab("map")}
                className={`px-4 py-1.5 text-sm border-l border-[#E6E8EF] ${tab === "map" ? "bg-[#EAF2FF] text-[#356AE6]" : "bg-white text-[#4B5565]"}`}
              >
                Map
              </button>
            </div>
            {tab === "tariff" ? (
              <div className="mt-3 rounded-lg overflow-hidden">
                {tariffRows.map((row, i) => (
                  <div
                    key={row.label}
                    className={`flex items-center justify-between px-3 py-2 text-sm ${i % 2 ? "bg-[#F7FBFF]" : "bg-[#F5F8FD]"} border-b border-[#E6E8EF] last:border-0`}
                  >
                    <span>
                      {row.label}
                      {row.live ? (
                        <span className="ml-2 rounded-full bg-[#E7F6EE] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#1f9d63]">
                          live
                        </span>
                      ) : option ? (
                        <span className="ml-2 rounded-full bg-[#F1F2F0] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[#9aa1ab]">
                          est
                        </span>
                      ) : null}
                    </span>
                    <span className="text-[#7B8499]">{fmtUsd(row.value)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 h-36 rounded-lg border border-[#E6E8EF] bg-[#F7F9FC] flex items-center justify-center text-sm text-[#7B8499]">
                {option
                  ? `${option.originPortName} → ${option.destPortName}`
                  : "Map goes here"}
              </div>
            )}
          </div>
        </div>
        <div className="p-3 flex flex-col gap-2">
          <div className="rounded-lg border border-[#E6E8EF] p-3 text-sm">
            <div className="text-[#7B8499]">
              Valid:{" "}
              <span className="text-[#273046] font-semibold">
                {option?.validTo ?? "05/07/2022"}
              </span>
            </div>
            <div className="text-[#7B8499]">
              ID:{" "}
              <span className="text-[#273046] font-semibold">
                {option?.quoteId ?? "3845296"}
              </span>
            </div>
          </div>
          <div className="rounded-lg border border-[#E6E8EF] p-3 text-center">
            <div className="text-2xl font-bold text-[#273046] mb-2">
              {option?.total != null ? fmtUsd(option.total) : "$ 1874"}
            </div>
            <button className="w-full px-4 py-2 rounded-lg bg-[#4C7DFF] text-white hover:bg-[#3B6AF8] shadow-[0_6px_14px_rgba(76,125,255,0.3)]">
              Book Now
            </button>
            <button className="mt-2 text-xs text-[#356AE6]">
              View Details
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Interactive 3D Container Viewer – renders real API positioned items or falls back to demo
const Container3DViewer: React.FC<{
  containerSize?: "20" | "40";
  containerIndex?: number;
  visualization3D?: Visualization3D | null;
  isLoading?: boolean;
  // AIR/LAND modes: real container envelope (metres) from /air-cargo or /trucks.
  // When null (SEA) the viewer keeps its toggle-driven 20ft/40ft box unchanged.
  overrideDims?: { length: number; width: number; height: number } | null;
}> = ({
  containerSize = "40",
  containerIndex = 1,
  visualization3D,
  isLoading,
  overrideDims,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  // Drag state lives in refs — mutating refs does NOT trigger a React
  // re-render, so dragging does not re-run the 250-item cargo render tree.
  const VIEW_PRESETS = [
    { label: "3D", x: -22, y: -30 },
    { label: "Front", x: -5, y: 0 },
    { label: "Top", x: -78, y: -25 },
    { label: "Side", x: -15, y: -75 },
  ] as const;
  const [activeView, setActiveView] = useState(0);
  const rotationRef = useRef<{ x: number; y: number }>({
    x: VIEW_PRESETS[0].x,
    y: VIEW_PRESETS[0].y,
  });
  const zoomRef = useRef(1.0);
  // Responsive fit scale — recomputed from the wrapper's real size so the whole
  // model always sits inside the frame (no cut-off) on any screen width.
  const fitRef = useRef(1);
  const isDraggingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const [animPhase, setAnimPhase] = useState(0);
  const isHovered = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  // ── Intro loading animation state ──
  const [introVisible, setIntroVisible] = useState(false);
  const [introFadeIn, setIntroFadeIn] = useState(false);
  const [counterVal, setCounterVal] = useState(0);
  const introTimersRef = useRef<
    (ReturnType<typeof setTimeout> | ReturnType<typeof setInterval>)[]
  >([]);
  const prevDataKeyRef = useRef("");
  const [refreshKey, setRefreshKey] = useState(0);

  const applyTransform = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const { x, y } = rotationRef.current;
    el.style.transform = `scale(${fitRef.current * zoomRef.current}) rotateX(${x}deg) rotateY(${y}deg)`;
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    isDraggingRef.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    if (containerRef.current) containerRef.current.style.transition = "none";
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      rotationRef.current = {
        x: Math.max(-80, Math.min(80, rotationRef.current.x + dy * 0.4)),
        y: rotationRef.current.y + dx * 0.4,
      };
      lastPos.current = { x: e.clientX, y: e.clientY };
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          applyTransform();
        });
      }
    },
    [applyTransform],
  );

  const handlePointerUp = useCallback(() => {
    isDraggingRef.current = false;
    if (containerRef.current)
      containerRef.current.style.transition = "transform 0.12s ease-out";
  }, []);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!isHovered.current) return;
      e.preventDefault();
      zoomRef.current = Math.min(
        2.5,
        Math.max(0.4, zoomRef.current - e.deltaY * 0.001),
      );
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          applyTransform();
        });
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [applyTransform]);

  // Apply the initial transform after mount / when the scene remounts.
  useEffect(() => {
    applyTransform();
  }, [applyTransform, containerSize, containerIndex, visualization3D]);

  const animTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const playAnimation = useCallback((isRefresh = false) => {
    animTimers.current.forEach(clearTimeout);
    setAnimPhase(0);
    animTimers.current = [
      setTimeout(() => setAnimPhase(1), 100),
      // On Refresh wait for intro overlay to finish (~2.4 s) before dropping boxes
      setTimeout(() => setAnimPhase(2), isRefresh ? 2600 : 600),
    ];
  }, []);
  useEffect(() => {
    playAnimation();
    return () => animTimers.current.forEach(clearTimeout);
  }, [playAnimation, containerSize, containerIndex, visualization3D]);

  // ── Intro animation: counting loader shown before revealing the 3D model ──
  useEffect(() => {
    if (isLoading) return;
    const key = visualization3D
      ? `${visualization3D.items?.length ?? 0}-${String(visualization3D.containerDimensions?.length ?? 0)}-${refreshKey}`
      : "";
    if (!key || key === prevDataKeyRef.current) return;
    prevDataKeyRef.current = key;

    const total = visualization3D!.items.length;
    if (!total) return;

    // Clear any previous intro
    introTimersRef.current.forEach((t) => {
      clearTimeout(t as any);
      clearInterval(t as any);
    });
    introTimersRef.current = [];

    setCounterVal(0);
    setIntroFadeIn(false);
    setIntroVisible(true);

    // Fade in after first paint
    const t0 = setTimeout(() => setIntroFadeIn(true), 30);
    introTimersRef.current.push(t0);

    // Count from 0 → total over 1400ms with easeOut
    const DURATION = 1400;
    const TICK = 30;
    const totalSteps = Math.ceil(DURATION / TICK);
    let step = 0;
    const interval = setInterval(() => {
      step++;
      const progress = Math.min(1, step / totalSteps);
      const eased = 1 - Math.pow(1 - progress, 2.5);
      setCounterVal(Math.round(eased * total));
      if (step >= totalSteps) {
        clearInterval(interval);
        setCounterVal(total);
        // Pause 400ms then fade out
        const t1 = setTimeout(() => {
          setIntroFadeIn(false);
          // Remove overlay after fade (600ms)
          const t2 = setTimeout(() => setIntroVisible(false), 600);
          introTimersRef.current.push(t2);
        }, 400);
        introTimersRef.current.push(t1);
      }
    }, TICK);
    introTimersRef.current.push(interval as any);

    // Watchdog: guarantee the overlay is gone within a bounded time even if the
    // counting interval gets starved (heavy 3D render) or a same-key re-render
    // interrupts it. Without this the overlay could stick on "PACKING…" forever.
    const watchdog = setTimeout(() => {
      setIntroFadeIn(false);
      setIntroVisible(false);
    }, DURATION + 1800);
    introTimersRef.current.push(watchdog);

    // NOTE: no cleanup here on purpose. React runs an effect's cleanup on EVERY
    // dependency change, so clearing the timers in a return() would kill an
    // in-flight animation whenever `visualization3D` gets a new reference with
    // the SAME key (e.g. switching between equal-sized containers) — the body
    // then early-returns and the overlay freezes. Stale timers are already
    // cleared above when a genuinely NEW animation starts; unmount is handled
    // by the dedicated effect below.
  }, [visualization3D, isLoading, refreshKey]);

  // Clear any pending intro timers only when the component unmounts.
  useEffect(() => {
    return () => {
      introTimersRef.current.forEach((t) => {
        clearTimeout(t as any);
        clearInterval(t as any);
      });
    };
  }, []);

  // ── Frontend bin-packing that respects container bounds ──
  const hasApiData = !!visualization3D && visualization3D.items?.length > 0;

  const is20 = containerSize === "20";
  const SCENE_WIDTH = is20 ? 240 : 400;
  const baseH = 8;

  // Container real dimensions (meters) — defaults for 20ft/40ft standard
  // Container envelope follows the SELECTED size (is20), not what the backend
  // packed into — the backend ignores the 20ft/40ft toggle (always returns
  // 40ft), so the viewer treats the user's choice as the real container and
  // packs the items into it. This makes the toggle actually change the box.
  // AIR/LAND: size the box from the real ULD / truck dims; SEA: toggle-driven.
  const realL = overrideDims?.length || (is20 ? 5.898 : 12.032); // meters
  const realW = overrideDims?.width || 2.352;
  const realH = overrideDims?.height || 2.393;

  // Pixel scene dimensions
  const scaleX = SCENE_WIDTH / realL;
  // Depth uses the SAME px-per-metre as length so plan-view geometry is true:
  // drums render as real circles that fill their slots and rows touch. The
  // old fixed 112px depth over-scaled the width axis ~43%, leaving an air
  // lane between every row of cylinders — the container looked gap-ridden at
  // any fill level. Height stays deliberately exaggerated for visibility.
  const SCENE_DEPTH = Math.round(SCENE_WIDTH * (realW / realL));
  const SCENE_HEIGHT = 140; // taller for better item visibility
  const scaleY = SCENE_DEPTH / realW;
  const scaleZ = SCENE_HEIGHT / realH;

  // ── Analytical grid packing — O(1) per product type, handles any quantity ──
  // Cap render count based on input size: 500+ items on CSS 3D would choke the
  // compositor, so we subsample aggressively and rely on the volume-filled look.
  const totalItemCount = visualization3D?.items?.length ?? 0;
  const MAX_RENDER_ITEMS =
    totalItemCount > 2000
      ? 220
      : totalItemCount > 500
        ? 480
        : totalItemCount > 150
          ? 420
          : 520;

  const apiPack = useMemo(() => {
    type Box = {
      id: string;
      cargoType: string;
      color: string;
      pxX: number;
      pxY: number;
      pxZ: number;
      pxW: number;
      pxD: number;
      pxH: number;
      idx: number;
      indivW?: number;
      indivD?: number;
      indivH?: number;
    };

    const empty = {
      boxes: [] as Box[],
      packedCount: 0,
      overflowCount: 0,
      overflowByProduct: {} as Record<string, number>,
    };
    if (!hasApiData || !visualization3D) return empty;

    const items = visualization3D.items;

    // ── Preferred path: client-side shelf packing of the API's item list ──
    // The server's raw positions can over-pack (more units than geometrically
    // fit in the DB container dims) and overlap across products, so the viewer
    // re-packs the SAME items with a bounds-checked shelf sweep: nothing
    // exceeds the container envelope, nothing overlaps, and each product
    // starts on a fresh shelf when there's headroom so cartons sit on top of
    // bags. Items that genuinely don't fit are counted as overflow and shown
    // in the badge instead of being drawn through the roof. Backend untouched.
    if (items.length > 0 && items.length <= MAX_RENDER_ITEMS) {
      // GROUP-BY-PRODUCT packing for a clean, realistic stow: each product
      // (same type + dimensions) is laid down as ONE solid block, and blocks
      // are placed side-by-side across the width — so big bags form a neat wall
      // and the smaller cartons sit together in the leftover side column,
      // instead of being sprinkled into every gap (which read as messy green
      // stripes cutting through the bags). Columns stack upward; once the width
      // is used up a new band starts on top. If the finished stack runs past
      // the container envelope the whole thing is uniformly compressed to fit
      // (below) — so nothing is dropped and nothing overlaps.
      const EPS = 0.001;
      const placed: {
        item: any;
        x: number;
        y: number;
        z: number;
        L: number;
        W: number;
        H: number;
      }[] = [];
      // Group items by product, preserving first-seen order.
      const groups: { L: number; W: number; H: number; items: any[] }[] = [];
      const gmap = new Map<
        string,
        { L: number; W: number; H: number; items: any[] }
      >();
      for (const it of items as any[]) {
        const d = it.dimensions || {};
        const L = Number(d.length) > 0 ? Number(d.length) : 0.1;
        const W = Number(d.width) > 0 ? Number(d.width) : 0.1;
        const H = Number(d.height) > 0 ? Number(d.height) : 0.1;
        const key = `${it.cargoType}|${L}|${W}|${H}`;
        let g = gmap.get(key);
        if (!g) {
          g = { L, W, H, items: [] };
          gmap.set(key, g);
          groups.push(g);
        }
        g.items.push(it);
      }
      let yBase = 0; // width cursor (metres)
      let bandZ = 0; // z-base of the current width band
      let bandMaxH = 0; // tallest column placed in the current band
      for (const g of groups) {
        const { L, W, H } = g;
        let gi = 0;
        while (gi < g.items.length) {
          // Start a fresh band stacked on top once the width is used up.
          if (yBase + W > realW + EPS) {
            bandZ += bandMaxH;
            bandMaxH = 0;
            yBase = 0;
          }
          const cols = Math.max(1, Math.floor((realL + EPS) / L));
          const depth = Math.max(1, Math.floor((realW - yBase + EPS) / W));
          const perLayer = cols * depth;
          const remaining = g.items.length - gi;
          // A full-width block takes ALL the layers its items need (the
          // backend over-packs by a mild ~1.3× at most, absorbed by the
          // uniform fit-compression below) so a group stacks floor-to-ceiling
          // from one end — the way a real container is stowed, leaving one
          // clean gap at the door end. The physical layer cap applies only in
          // narrow leftover strips (e.g. beside a wider product), where
          // unbounded stacking built a 10+-layer tower that the compression
          // then squashed flat — the container rendered near-empty even at
          // 93% real fill.
          const fullDepth = Math.max(1, Math.floor((realW + EPS) / W));
          const headroom = Math.max(realH - bandZ, H);
          const maxLayers =
            depth >= fullDepth
              ? Math.max(1, Math.ceil(remaining / perLayer))
              : Math.max(1, Math.floor((headroom + EPS) / H));
          const layers = Math.min(
            Math.max(1, Math.ceil(remaining / perLayer)),
            maxLayers,
          );
          let usedRows = 1;
          // Column-major fill: each x-column is stacked floor-to-ceiling,
          // full-depth, before the next column starts — so the block grows
          // from one end like a real stow and any shortfall is one clean gap
          // at the far end. Layer-by-layer fills left the top layer as a
          // floating ledge (or, row-major, a front trench) that made a
          // 100%-full container look part-empty from most angles.
          const blockStart = placed.length;
          for (let cx = 0; cx < cols && gi < g.items.length; cx++) {
            for (let layer = 0; layer < layers && gi < g.items.length; layer++) {
              for (let dy = 0; dy < depth && gi < g.items.length; dy++) {
                if (dy + 1 > usedRows) usedRows = dy + 1;
                placed.push({
                  item: g.items[gi++],
                  x: cx * L,
                  y: yBase + dy * W,
                  z: bandZ + layer * H,
                  L,
                  W,
                  H,
                });
              }
            }
          }
          // Cosmetic rounding at the group's end: a lone part-filled column at
          // the door reads as damage, not as the sub-1% count rounding it is.
          // Round it to the nearest full column — ghost-pad when at least half
          // filled, drop the stub otherwise. Only kicks in once the block has
          // a few full columns, so tiny loads stay exact; the items-loaded
          // badge always reports the real API count.
          if (gi >= g.items.length) {
            const slotsPerCol = layers * depth;
            const blockPlaced = placed.length - blockStart;
            const fullCols = Math.floor(blockPlaced / slotsPerCol);
            const tail = blockPlaced % slotsPerCol;
            if (tail > 0 && fullCols >= 4) {
              if (tail >= slotsPerCol / 2) {
                const template = placed[placed.length - 1];
                for (let k = tail; k < slotsPerCol; k++) {
                  const layer = Math.floor(k / depth);
                  const dy = k % depth;
                  placed.push({
                    item: {
                      ...template.item,
                      id: `${template.item?.id ?? "fill"}-ghost${k}`,
                    },
                    x: template.x,
                    y: yBase + dy * W,
                    z: bandZ + layer * H,
                    L,
                    W,
                    H,
                  });
                }
              } else {
                placed.splice(placed.length - tail, tail);
              }
            }
          }
          bandMaxH = Math.max(bandMaxH, layers * H);
          // Advance the width cursor only past rows actually occupied — a
          // short product row must not reserve (and blank out) a full strip.
          yBase += usedRows * W;
        }
      }

      // Uniform per-axis compression when the stack exceeds the envelope —
      // scaling a collision-free layout keeps it collision-free.
      let maxX = 0;
      let maxY = 0;
      let maxZ = 0;
      for (const p of placed) {
        maxX = Math.max(maxX, p.x + p.L);
        maxY = Math.max(maxY, p.y + p.W);
        maxZ = Math.max(maxZ, p.z + p.H);
      }
      // Compress to fit when the stack exceeds the envelope; stretch up to a
      // gentle cap when it falls just short — real stows settle into the full
      // footprint, so a near-full container reads full while a genuinely
      // part-empty one still shows its gap. Height only ever compresses: a
      // half-height load must stay half-height.
      const STRETCH_CAP = 1.15;
      const fitX = Math.min(realL / Math.max(maxX, EPS), STRETCH_CAP);
      const fitY = Math.min(realW / Math.max(maxY, EPS), STRETCH_CAP);
      const fitZ = maxZ > realH ? realH / maxZ : 1;

      const out: Box[] = placed.map((p, i) => ({
        id: p.item.id || `api-${i}`,
        cargoType: p.item.cargoType || "box",
        color: p.item.color || "#3366CC",
        pxX: p.x * scaleX * fitX,
        pxY: p.y * scaleY * fitY,
        pxZ: p.z * scaleZ * fitZ,
        pxW: p.L * scaleX * fitX,
        pxD: p.W * scaleY * fitY,
        pxH: p.H * scaleZ * fitZ,
        idx: i,
      }));
      return {
        boxes: out,
        packedCount: out.length,
        overflowCount: 0,
        overflowByProduct: {},
      };
    }

    // ── Fallback: analytical grid packing when API positions aren't usable ──
    // Group items by type + dimensions
    const typeMap: Record<
      string,
      {
        cargoType: string;
        color: string;
        dimL: number;
        dimW: number;
        dimH: number;
        count: number;
      }
    > = {};
    visualization3D.items.forEach((item) => {
      const ct = (item as any).cargoType || "box";
      const key = `${ct}_${item.dimensions.length}_${item.dimensions.width}_${item.dimensions.height}`;
      if (!typeMap[key]) {
        typeMap[key] = {
          cargoType: ct,
          color: item.color || "#3366CC",
          dimL: item.dimensions.length,
          dimW: item.dimensions.width,
          dimH: item.dimensions.height,
          count: 0,
        };
      }
      typeMap[key].count++;
    });

    const types = Object.values(typeMap);
    const result: Box[] = [];
    let zOffset = 0; // meters — current base Z for next product type
    let globalIdx = 0;

    for (const t of types) {
      const remainH = realH - zOffset;
      if (remainH < Math.min(t.dimL, t.dimW, t.dimH) * 0.5) break;

      // Try all 6 orientations and pick the one that fits most items
      const dims = [t.dimL, t.dimW, t.dimH];
      let bestCols = 1,
        bestRows = 1,
        _bestLayers = 1,
        bestFit = 0;
      let useDimL = t.dimL,
        useDimW = t.dimW,
        useDimH = t.dimH;
      // Cylindrical cargo has a fixed natural axis: rolls lie horizontal
      // (axis = longest dim → must be along L to match the renderer's X-axis
      // assumption), drums stand upright (axis = longest dim → along H).
      // Restricting the orientation search keeps the visual cylinder aligned
      // with the bounding-box footprint it occupies.
      const sortedDesc = [...dims].sort((a, b) => b - a);
      const isRoll =
        t.cargoType === "roll" ||
        t.cargoType === "rolls" ||
        t.cargoType === "pipes";
      const isDrum =
        t.cargoType === "drum" ||
        t.cargoType === "drums" ||
        t.cargoType === "barrels";
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          if (j === i) continue;
          const k = 3 - i - j;
          const dL = dims[i],
            dW = dims[j],
            dH = dims[k];
          if (isRoll && dL !== sortedDesc[0]) continue;
          if (isDrum && dH !== sortedDesc[0]) continue;
          const cx = Math.floor(realL / dL);
          const ry = Math.floor(realW / dW);
          const lz = Math.floor(remainH / dH);
          const fit = cx * ry * lz;
          if (fit > bestFit) {
            bestFit = fit;
            bestCols = cx;
            bestRows = ry;
            _bestLayers = lz;
            useDimL = dL;
            useDimW = dW;
            useDimH = dH;
          }
        }
      }

      // Trust the API count: render *all* items the API reports, never less.
      // If a single-orientation grid can't hold them all, compress layer spacing
      // so the extras still appear inside the container instead of leaving a gap.
      const itemsPerLayer = Math.max(1, bestCols * bestRows);
      const totalFit = t.count;
      let layersNeeded = Math.ceil(totalFit / itemsPerLayer);
      // Absorb a sliver top layer into the full ones: 455 items at 150/layer
      // means a 4th layer of just 5 — evenly-split spacing then left the main
      // stack at 3/4 height with a lone spike touching the roof, reading as a
      // half-empty container despite a ~99% real fill. If the leftover layer is
      // small, spread its items across one fewer layer instead (at most one
      // extra visual row per layer, clamped to the container depth below).
      if (layersNeeded > 1) {
        const lastLayerCount = totalFit - (layersNeeded - 1) * itemsPerLayer;
        if (lastLayerCount <= itemsPerLayer * 0.25) {
          layersNeeded -= 1;
        }
      }
      const perLayerVisual = Math.ceil(totalFit / layersNeeded);

      // Layer spacing: natural box height when there's slack, compressed to fit
      // available height when the API packed more layers than fit linearly.
      const naturalSpacing = useDimH;
      const compressedSpacing = remainH / layersNeeded;
      const layerSpacingMeters = Math.min(naturalSpacing, compressedSpacing);

      const indivW = useDimL * scaleX;
      const indivD = useDimW * scaleY;
      const indivH = useDimH * scaleZ;

      // Visual slab height: at least 25 px (so tiny boxes are still visible)
      // but never taller than the layer spacing (avoids overlap when compressed).
      const layerSpacingPx = layerSpacingMeters * scaleZ;
      const slabPxH = Math.max(25, layerSpacingPx);

      // Never draw more rows than physically fit across the width — a layer's
      // absorbed surplus folds into the LAST row's merged-slab width (clamped
      // to the scene) instead of spawning a phantom extra row. The old extra
      // row spilled past the container depth and rendered as a lone tall fin
      // at the front corner, one per layer.
      // Settle the grid into the full footprint (same gentle stretch as the
      // per-item path) so the floor-rounding gaps at the end/front don't read
      // as missing cargo on a near-full container.
      const colStretch = Math.min(
        (realL * scaleX) / Math.max(bestCols * indivW, 1),
        1.15,
      );
      const rowStretch = Math.min(
        (realW * scaleY) / Math.max(bestRows * indivD, 1),
        1.15,
      );
      let remaining = totalFit;
      for (let lz = 0; lz < layersNeeded && remaining > 0; lz++) {
        const inThisLayer = Math.min(remaining, perLayerVisual);
        remaining -= inThisLayer;

        const zPx = (zOffset + lz * layerSpacingMeters) * scaleZ;
        const rowsInLayer = Math.min(
          Math.ceil(inThisLayer / bestCols),
          bestRows,
        );
        let leftInLayer = inThisLayer;
        for (let r = 0; r < rowsInLayer; r++) {
          const rowCount =
            r === rowsInLayer - 1 ? leftInLayer : bestCols;
          leftInLayer -= rowCount;
          result.push({
            id: `g-${t.cargoType}-${globalIdx}`,
            cargoType: t.cargoType,
            color: t.color,
            pxX: 0,
            pxY: r * indivD * rowStretch,
            pxZ: zPx,
            pxW: Math.min(rowCount * indivW * colStretch, realL * scaleX),
            pxD: indivD * rowStretch,
            pxH: slabPxH,
            idx: globalIdx++,
            indivW: indivW * colStretch,
            indivD: indivD * rowStretch,
            indivH,
          });
        }
      }
      zOffset += layersNeeded * layerSpacingMeters;
    }

    // Slabs represent every item, so nothing is reported as overflow here.
    return {
      boxes: result,
      packedCount: visualization3D.items.length,
      overflowCount: 0,
      overflowByProduct: {},
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    hasApiData,
    visualization3D,
    realL,
    realW,
    realH,
    scaleX,
    scaleY,
    scaleZ,
  ]);
  const apiBoxes = apiPack.boxes;

  // Scene dimensions
  const baseLen = SCENE_WIDTH;
  const cWid = SCENE_DEPTH;
  const cHgt = hasApiData ? SCENE_HEIGHT : 112;

  // ── Auto-fit: keep the whole 3D model inside its frame on every screen ──
  // The scene is drawn at fixed pixel sizes (baseLen × cHgt) and then rotated,
  // so on a narrow column it used to overflow the 320px, overflow-hidden
  // wrapper and get clipped. Measure the real wrapper and derive a fit scale
  // that leaves room for both the width and the extra vertical extent the 3D
  // tilt adds (~0.3 × baseLen). Stored in a ref because the transform is
  // applied imperatively (like zoom/rotation) to avoid re-rendering the cargo.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const recompute = () => {
      const w = el.clientWidth || baseLen;
      const h = el.clientHeight || 320;
      // Approximate the model's on-screen bounding box at the default 3D view
      // (after rotateX/rotateY), then scale it so it fills FILL of the frame.
      // The old version under-filled (~1.1 cap) and left the container looking
      // small. Raise FILL to make it bigger, lower it if edges ever clip.
      const FILL = 0.94;
      const projW = baseLen * 0.85 + cWid * 0.45; // projected width after rotateY
      const projH = cHgt * 0.95 + cWid * 0.45 + baseLen * 0.12; // height after tilt
      const next = Math.max(
        0.4,
        Math.min(2.2, Math.min((w * FILL) / projW, (h * FILL) / projH)),
      );
      fitRef.current = next;
      applyTransform();
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [applyTransform, baseLen, cHgt, cWid]);

  // Fallback grid (when no API data)
  const boxSize = 28;
  const fallbackCols = Math.floor((is20 ? 168 : 280) / boxSize);
  const fallbackDepthLayers = Math.floor(cWid / boxSize);
  const blueRows = 3;
  const greenRows = 1;
  const fallbackCHgt = (blueRows + greenRows) * boxSize;
  const totalBlueBoxes = fallbackCols * blueRows * fallbackDepthLayers;
  const boxStagger = 0.02;
  const greenBaseDelay = totalBlueBoxes * boxStagger + 0.2;

  // Helper: darken/lighten color
  const adjustColor = (hex: string, amount: number) => {
    const num = parseInt(hex.replace("#", ""), 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + amount));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amount));
    const b = Math.min(255, Math.max(0, (num & 0x0000ff) + amount));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
  };

  const baseAnim: React.CSSProperties = {
    opacity: animPhase >= 1 ? 1 : 0,
    transform:
      animPhase >= 1
        ? "translateY(0) scale(1)"
        : "translateY(15px) scale(0.95)",
    transition:
      animPhase >= 1
        ? "opacity 0.5s ease-out, transform 0.5s ease-out"
        : "none",
  };
  // Colors
  const blue = "#3366CC";
  const green = "#4CAF50";
  const orange = "#E8A838";
  const orangeDark = "#CC8A20";

  const f = (transform: string, w: number, h: number): React.CSSProperties => ({
    position: "absolute",
    width: w,
    height: h,
    backfaceVisibility: "visible",
    transform,
    transformOrigin: "center center",
  });

  // ── Shape-aware 3D cargo renderer (variable w, h, d) ──
  // Lower segment count when the scene is dense — each drum/roll contributes
  // N nested 3D layers, so 20 × hundreds of cylinders is a paint-time killer.
  // Drums get a higher count because their circular silhouette is the most
  // visually prominent feature; a 10-sided drum reads as a decagon, not a circle.
  // Level-of-detail: use fewer wall segments per cylinder when there are many
  // of them, so a container full of drums/rolls doesn't choke the CSS-3D
  // compositor (each segment is a separately-composited 3D div). A small
  // on-screen cylinder still reads as round at ~10 sides.
  const CYLINDER_SEGMENTS =
    totalItemCount > 150
      ? 7
      : totalItemCount > 60
        ? 9
        : totalItemCount > 24
          ? 11
          : 14;
  const DRUM_SEGMENTS =
    totalItemCount > 150
      ? 8
      : totalItemCount > 60
        ? 10
        : totalItemCount > 24
          ? 12
          : 18;

  const renderCargoItem = (
    key: string,
    left: number,
    top: number,
    zPos: number,
    w: number,
    h: number,
    d: number, // width, height, depth in px
    color: string,
    cargoType: string,
    animStyle: React.CSSProperties,
    indivW?: number,
    indivH?: number,
    indivD?: number, // single-box px dims for grid lines
  ) => {
    const dark = adjustColor(color, -40);
    const light = adjustColor(color, 30);
    const bdr = `1.5px solid ${adjustColor(color, -80)}`;
    const hw = w / 2;
    const hh = h / 2;
    const hd = d / 2;
    const face: React.CSSProperties = {
      position: "absolute",
      boxSizing: "border-box",
      border: bdr,
      backfaceVisibility: "visible",
    };

    // Grid-line helper: overlay a repeating grid on a solid-colour face so that
    // each merged slab visually shows its constituent individual boxes/bags.
    const gridLine = "rgba(0,0,0,0.22)";
    const gridBg = (base: string, cw?: number, ch?: number): string => {
      if (!cw || !ch || cw < 3 || ch < 3) return base;
      return [
        `repeating-linear-gradient(0deg,transparent 0,transparent calc(${ch}px - 1px),${gridLine} calc(${ch}px - 1px),${gridLine} ${ch}px)`,
        `repeating-linear-gradient(90deg,transparent 0,transparent calc(${cw}px - 1px),${gridLine} calc(${cw}px - 1px),${gridLine} ${cw}px)`,
        base,
      ].join(",");
    };

    // ─── DRUM: upright cylinder with chime rings + rolling hoops ───
    if (
      cargoType === "drum" ||
      cargoType === "drums" ||
      cargoType === "barrels"
    ) {
      // Merged row-slab from the analytical fallback (indivW set, w spans many
      // drums): drawing ONE centred cylinder here left the container looking
      // near-empty at high item counts (the slab is a whole row, min(w,d)
      // collapsed it to a single drum). Fake the row instead — a box whose
      // faces tile per-drum lids and curvature shading — so hundreds of drums
      // render as a handful of divs but still read as a full row of barrels.
      if (indivW && indivW > 3 && w > indivW * 1.5) {
        const iw = indivW;
        const hoop = "rgba(0,0,0,0.16)";
        const hoopBands =
          `linear-gradient(to bottom,` +
          ` ${hoop} 0%, ${hoop} 4%, transparent 5%,` +
          ` transparent 32%, ${hoop} 33%, ${hoop} 36%, transparent 37%,` +
          ` transparent 63%, ${hoop} 64%, ${hoop} 67%, transparent 68%,` +
          ` transparent 95%, ${hoop} 96%, ${hoop} 100%)`;
        // Per-drum tile: an ellipse-shaded cell per barrel (bright core →
        // dark rounded edges) instead of flat vertical stripes — sharp
        // linear stripes read as corrugated BOXES at block scale, losing the
        // barrel identity the per-item path has. One tiled gradient per
        // face keeps the cost identical.
        const rowFaceStyle = (base: string): React.CSSProperties => ({
          backgroundColor: adjustColor(base, -62),
          backgroundImage: `${hoopBands}, radial-gradient(ellipse 78% 94% at 50% 46%, ${adjustColor(base, 30)} 0%, ${base} 55%, ${adjustColor(base, -38)} 84%, ${adjustColor(base, -60)} 100%)`,
          backgroundSize: `auto, ${iw}px 100%`,
        });
        const endFace = (base: string) =>
          `${hoopBands}, linear-gradient(90deg, ${adjustColor(base, -45)}, ${adjustColor(base, 25)} 50%, ${adjustColor(base, -45)})`;
        const lidR = Math.min(iw, d) / 2;
        const lidTop: React.CSSProperties = {
          backgroundColor: adjustColor(color, -70),
          backgroundImage: `radial-gradient(circle at 50% 50%, ${light} 0%, ${color} ${lidR * 0.55}px, ${dark} ${lidR * 0.9}px, transparent ${lidR}px)`,
          backgroundSize: `${iw}px ${d}px`,
        };
        return (
          <div key={key} style={animStyle}>
            <div
              style={{
                position: "absolute",
                left,
                top,
                width: w,
                height: h,
                transformStyle: "preserve-3d",
                transform: `translateZ(${zPos}px)`,
              }}
            >
              <div
                style={{
                  ...face,
                  width: w,
                  height: h,
                  ...rowFaceStyle(color),
                  transform: `translateZ(${hd}px)`,
                }}
              />
              <div
                style={{
                  ...face,
                  width: w,
                  height: h,
                  ...rowFaceStyle(dark),
                  transform: `rotateY(180deg) translateZ(${hd}px)`,
                }}
              />
              <div
                style={{
                  ...face,
                  width: w,
                  height: d,
                  ...lidTop,
                  top: (h - d) / 2,
                  transform: `rotateX(90deg) translateZ(${hh}px)`,
                }}
              />
              <div
                style={{
                  ...face,
                  width: w,
                  height: d,
                  background: adjustColor(color, -70),
                  top: (h - d) / 2,
                  transform: `rotateX(-90deg) translateZ(${hh}px)`,
                }}
              />
              <div
                style={{
                  ...face,
                  width: d,
                  height: h,
                  background: endFace(light),
                  transform: `rotateY(-90deg) translateZ(${hw}px)`,
                  left: (w - d) / 2,
                }}
              />
              <div
                style={{
                  ...face,
                  width: d,
                  height: h,
                  background: endFace(dark),
                  transform: `rotateY(90deg) translateZ(${hw}px)`,
                  left: (w - d) / 2,
                }}
              />
            </div>
          </div>
        );
      }

      // A drum is a true circle in plan view, so we build it at diameter
      // `minWD` and CENTER it in the w × d slot (no scale3d stretching).
      // Stretching to fill the bounding box turns the top lid into an ellipse;
      // any leftover space along the longer axis is just cell padding.
      const minWD = Math.min(w, d);
      const r = minWD * 0.5;
      const segW = 2 * r * Math.sin(Math.PI / DRUM_SEGMENTS);
      const darker = adjustColor(color, -60);
      const segments: React.ReactNode[] = [];
      for (let i = 0; i < DRUM_SEGMENTS; i++) {
        const angle = (i / DRUM_SEGMENTS) * 360;
        // Per-segment shading based on facing direction (smooth cylinder look)
        const rad = (angle * Math.PI) / 180;
        const facing = Math.cos(rad); // -1 (back) .. 1 (front)
        const shadeAmt = Math.round(facing * 25);
        const segColor = adjustColor(color, shadeAmt);
        const segDark = adjustColor(color, shadeAmt - 45);
        const segLight = adjustColor(color, shadeAmt + 25);
        // Drum profile: top chime ring, two rolling hoops, bottom chime ring
        const bg =
          `linear-gradient(to bottom,` +
          ` ${segDark} 0%, ${segDark} 4%,` +
          ` ${segLight} 5%, ${segLight} 7%,` +
          ` ${segColor} 9%, ${segColor} 32%,` +
          ` ${segDark} 33%, ${segDark} 36%,` +
          ` ${segColor} 37%, ${segColor} 63%,` +
          ` ${segDark} 64%, ${segDark} 67%,` +
          ` ${segColor} 68%, ${segColor} 91%,` +
          ` ${segLight} 93%, ${segLight} 95%,` +
          ` ${segDark} 96%, ${segDark} 100%)`;
        segments.push(
          <div
            key={`seg-${i}`}
            style={{
              position: "absolute",
              width: segW + 0.5,
              height: h,
              background: bg,
              // Back-facing wall panels are occluded by the front of the opaque
              // cylinder — cull them so we paint ~half as many segments.
              backfaceVisibility: "hidden",
              transform: `rotateY(${angle}deg) translateZ(${r}px)`,
              left: (minWD - segW) / 2,
            }}
          />,
        );
      }
      const circD = r * 2;
      // Top: outer chime ring (darker) + inner lid (lighter) + small fill plug
      const plugD = circD * 0.22;
      const innerD = circD * 0.86;
      const topLid = (
        <div
          style={{
            position: "absolute",
            width: circD,
            height: circD,
            borderRadius: "50%",
            background: `radial-gradient(circle at 40% 35%, ${light} 0%, ${color} 55%, ${darker} 100%)`,
            border: `1px solid ${darker}`,
            left: (minWD - circD) / 2,
            backfaceVisibility: "visible",
            transform: `rotateX(90deg) translateZ(${hh}px)`,
            top: (h - circD) / 2,
          }}
        >
          <div
            style={{
              position: "absolute",
              width: innerD,
              height: innerD,
              borderRadius: "50%",
              left: (circD - innerD) / 2,
              top: (circD - innerD) / 2,
              border: `1px solid ${adjustColor(color, -30)}`,
              boxSizing: "border-box",
            }}
          />
          <div
            style={{
              position: "absolute",
              width: plugD,
              height: plugD,
              borderRadius: "50%",
              background: darker,
              left: circD * 0.25,
              top: circD * 0.32,
              border: `0.5px solid ${adjustColor(color, -80)}`,
              boxSizing: "border-box",
            }}
          />
        </div>
      );
      const bottomLid = (
        <div
          style={{
            position: "absolute",
            width: circD,
            height: circD,
            borderRadius: "50%",
            background: `radial-gradient(circle at 50% 50%, ${dark} 0%, ${darker} 100%)`,
            border: `1px solid ${darker}`,
            left: (minWD - circD) / 2,
            backfaceVisibility: "visible",
            transform: `rotateX(-90deg) translateZ(${hh}px)`,
            top: (h - circD) / 2,
          }}
        />
      );
      // Center the cylinder in the slot — depth offset (z) handles d > minWD,
      // horizontal offset (left) handles w > minWD. No scale3d → true circle.
      const zCenterOffset = (d - minWD) / 2;
      return (
        <div key={key} style={animStyle}>
          <div
            style={{
              position: "absolute",
              left,
              top,
              width: w,
              height: h,
              transformStyle: "preserve-3d",
              transform: `translateZ(${zPos}px)`,
            }}
          >
            <div
              style={{
                position: "absolute",
                left: (w - minWD) / 2,
                top: 0,
                width: minWD,
                height: h,
                transformStyle: "preserve-3d",
                transform: `translateZ(${zCenterOffset}px)`,
              }}
            >
              {segments}
              {topLid}
              {bottomLid}
            </div>
          </div>
        </div>
      );
    }

    // ─── ROLL: horizontal cylinder (elliptical if h != d) ───
    if (cargoType === "roll" || cargoType === "rolls" || cargoType === "pipes") {
      // Build a unit-circular cylinder inside a box of side `minHD`, then
      // non-uniformly scale Y and Z so it fills the full h × d bounding box.
      // Without this, pxH and pxD differ (per-axis scene scales) and using
      // min(h,d) as radius leaves visible gaps between stacked rolls.
      const minHD = Math.min(h, d);
      const r = minHD * 0.5;
      const segH = 2 * r * Math.sin(Math.PI / CYLINDER_SEGMENTS);
      const sY = h / minHD;
      const sZ = d / minHD;
      const segments: React.ReactNode[] = [];
      for (let i = 0; i < CYLINDER_SEGMENTS; i++) {
        const angle = (i / CYLINDER_SEGMENTS) * 360;
        const shade = i % 2 === 0 ? color : light;
        segments.push(
          <div
            key={`seg-${i}`}
            style={{
              position: "absolute",
              width: w,
              height: segH,
              background: shade,
              border: `1px solid ${dark}`,
              // Cull back-facing panels of the opaque roll (perf: ~half the segments).
              backfaceVisibility: "hidden",
              transform: `rotateX(${angle}deg) translateZ(${r}px)`,
              top: (minHD - segH) / 2,
            }}
          />,
        );
      }
      const capD = r * 2;
      const cap: React.CSSProperties = {
        position: "absolute",
        width: capD,
        height: capD,
        borderRadius: "50%",
        border: `1.5px solid ${dark}`,
        top: (minHD - capD) / 2,
        backfaceVisibility: "visible",
      };
      return (
        <div key={key} style={animStyle}>
          <div
            style={{
              position: "absolute",
              left,
              top,
              width: w,
              height: h,
              transformStyle: "preserve-3d",
              transform: `translateZ(${zPos}px)`,
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                top: (h - minHD) / 2,
                width: w,
                height: minHD,
                transformStyle: "preserve-3d",
                transform: `scale3d(1, ${sY}, ${sZ})`,
                transformOrigin: "center center",
              }}
            >
              {segments}
              <div
                style={{
                  ...cap,
                  background: light,
                  transform: `rotateY(-90deg) translateZ(${hw}px)`,
                  left: (w - capD) / 2,
                }}
              />
              <div
                style={{
                  ...cap,
                  background: dark,
                  transform: `rotateY(90deg) translateZ(${hw}px)`,
                  left: (w - capD) / 2,
                }}
              />
            </div>
          </div>
        </div>
      );
    }

    // ─── BIGBAGS / SACK: rounded cube with grid lines for individual bags ───
    if (
      cargoType === "bigbags" ||
      cargoType === "sack" ||
      cargoType === "sacks"
    ) {
      const rad = cargoType === "sack" || cargoType === "sacks" ? "30%" : "18%";
      const faceR: React.CSSProperties = { ...face, borderRadius: rad };
      return (
        <div key={key} style={animStyle}>
          <div
            style={{
              position: "absolute",
              left,
              top,
              width: w,
              height: h,
              transformStyle: "preserve-3d",
              transform: `translateZ(${zPos}px)`,
            }}
          >
            <div
              style={{
                ...faceR,
                width: w,
                height: h,
                background: gridBg(color, indivW, indivH),
                transform: `translateZ(${hd}px)`,
              }}
            />
            <div
              style={{
                ...faceR,
                width: w,
                height: h,
                background: gridBg(dark, indivW, indivH),
                transform: `rotateY(180deg) translateZ(${hd}px)`,
              }}
            />
            <div
              style={{
                ...faceR,
                width: w,
                height: d,
                background: gridBg(light, indivW, indivD),
                top: (h - d) / 2,
                transform: `rotateX(90deg) translateZ(${hh}px)`,
              }}
            />
            <div
              style={{
                ...faceR,
                width: w,
                height: d,
                background: gridBg(dark, indivW, indivD),
                top: (h - d) / 2,
                transform: `rotateX(-90deg) translateZ(${hh}px)`,
              }}
            />
            <div
              style={{
                ...faceR,
                width: d,
                height: h,
                background: gridBg(light, indivD, indivH),
                transform: `rotateY(-90deg) translateZ(${hw}px)`,
                left: (w - d) / 2,
              }}
            />
            <div
              style={{
                ...faceR,
                width: d,
                height: h,
                background: gridBg(dark, indivD, indivH),
                transform: `rotateY(90deg) translateZ(${hw}px)`,
                left: (w - d) / 2,
              }}
            />
          </div>
        </div>
      );
    }

    // ─── PALLET: flat base + cargo block ───
    if (cargoType === "pallet") {
      const baseThick = Math.max(3, h * 0.18);
      const cargoH2 = h - baseThick;
      const cargoW2 = w * 0.9;
      const cOff = (w - cargoW2) / 2;
      return (
        <div key={key} style={animStyle}>
          <div
            style={{
              position: "absolute",
              left,
              top,
              width: w,
              height: h,
              transformStyle: "preserve-3d",
              transform: `translateZ(${zPos}px)`,
            }}
          >
            <div
              style={{
                position: "absolute",
                width: w,
                height: baseThick,
                bottom: 0,
                transformStyle: "preserve-3d",
              }}
            >
              <div
                style={{
                  ...face,
                  width: w,
                  height: baseThick,
                  background: "#C9A86C",
                  transform: `translateZ(${hd}px)`,
                }}
              />
              <div
                style={{
                  ...face,
                  width: w,
                  height: baseThick,
                  background: "#A68B5B",
                  transform: `rotateY(180deg) translateZ(${hd}px)`,
                }}
              />
              <div
                style={{
                  ...face,
                  width: w,
                  height: baseThick,
                  background: "#D4B87A",
                  transform: `rotateX(90deg) translateZ(${baseThick / 2}px)`,
                }}
              />
              <div
                style={{
                  ...face,
                  width: w,
                  height: baseThick,
                  background: "#A68B5B",
                  transform: `rotateX(-90deg) translateZ(${baseThick / 2}px)`,
                }}
              />
            </div>
            <div
              style={{
                position: "absolute",
                left: cOff,
                width: cargoW2,
                height: cargoH2,
                bottom: baseThick,
                transformStyle: "preserve-3d",
              }}
            >
              <div
                style={{
                  ...face,
                  width: cargoW2,
                  height: cargoH2,
                  background: color,
                  transform: `translateZ(${d * 0.45}px)`,
                }}
              />
              <div
                style={{
                  ...face,
                  width: cargoW2,
                  height: cargoH2,
                  background: dark,
                  transform: `rotateY(180deg) translateZ(${d * 0.45}px)`,
                }}
              />
              <div
                style={{
                  ...face,
                  width: cargoW2,
                  height: cargoH2,
                  background: light,
                  transform: `rotateX(90deg) translateZ(${cargoH2 / 2}px)`,
                }}
              />
              <div
                style={{
                  ...face,
                  width: cargoW2,
                  height: cargoH2,
                  background: dark,
                  transform: `rotateX(-90deg) translateZ(${cargoH2 / 2}px)`,
                }}
              />
            </div>
          </div>
        </div>
      );
    }

    // ─── BUNDLE: stacked bars ───
    if (cargoType === "bundle") {
      const barCount = 3;
      const gap = 2;
      const barH = (h - gap * (barCount - 1)) / barCount;
      return (
        <div key={key} style={animStyle}>
          <div
            style={{
              position: "absolute",
              left,
              top,
              width: w,
              height: h,
              transformStyle: "preserve-3d",
              transform: `translateZ(${zPos}px)`,
            }}
          >
            {Array.from({ length: barCount }, (_, b) => {
              const barTop = h - (b + 1) * (barH + gap) + gap;
              const shade = b % 2 === 0 ? color : light;
              const bf: React.CSSProperties = { ...face, borderRadius: "2px" };
              return (
                <div
                  key={`bar-${b}`}
                  style={{
                    position: "absolute",
                    width: w,
                    height: barH,
                    top: barTop,
                    transformStyle: "preserve-3d",
                  }}
                >
                  <div
                    style={{
                      ...bf,
                      width: w,
                      height: barH,
                      background: shade,
                      transform: `translateZ(${hd}px)`,
                    }}
                  />
                  <div
                    style={{
                      ...bf,
                      width: w,
                      height: barH,
                      background: dark,
                      transform: `rotateY(180deg) translateZ(${hd}px)`,
                    }}
                  />
                  <div
                    style={{
                      ...bf,
                      width: w,
                      height: barH,
                      background: light,
                      transform: `rotateX(90deg) translateZ(${barH / 2}px)`,
                    }}
                  />
                  <div
                    style={{
                      ...bf,
                      width: w,
                      height: barH,
                      background: dark,
                      transform: `rotateX(-90deg) translateZ(${barH / 2}px)`,
                    }}
                  />
                  <div
                    style={{
                      ...bf,
                      width: d,
                      height: barH,
                      background: light,
                      transform: `rotateY(-90deg) translateZ(${hw}px)`,
                      left: (w - d) / 2,
                    }}
                  />
                  <div
                    style={{
                      ...bf,
                      width: d,
                      height: barH,
                      background: dark,
                      transform: `rotateY(90deg) translateZ(${hw}px)`,
                      left: (w - d) / 2,
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // ─── CRATE: wireframe/open-top box ───
    if (cargoType === "crate") {
      const lw = 2;
      const ls: React.CSSProperties = {
        position: "absolute",
        background: dark,
        backfaceVisibility: "visible",
      };
      return (
        <div key={key} style={animStyle}>
          <div
            style={{
              position: "absolute",
              left,
              top,
              width: w,
              height: h,
              transformStyle: "preserve-3d",
              transform: `translateZ(${zPos}px)`,
            }}
          >
            <div
              style={{
                ...face,
                width: w,
                height: d,
                background: light,
                opacity: 0.3,
                transform: `rotateX(-90deg) translateZ(${hh}px)`,
                top: (h - d) / 2,
              }}
            />
            {/* Front/back */}
            {[`translateZ(${hd}px)`, `rotateY(180deg) translateZ(${hd}px)`].map(
              (tf, fi) => (
                <div
                  key={`f${fi}`}
                  style={{
                    position: "absolute",
                    width: w,
                    height: h,
                    transformStyle: "preserve-3d",
                    transform: tf,
                  }}
                >
                  <div style={{ ...ls, width: w, height: lw, top: 0 }} />
                  <div style={{ ...ls, width: w, height: lw, bottom: 0 }} />
                  <div style={{ ...ls, width: lw, height: h, left: 0 }} />
                  <div style={{ ...ls, width: lw, height: h, right: 0 }} />
                </div>
              ),
            )}
            {/* Sides */}
            {[
              `rotateY(-90deg) translateZ(${hw}px)`,
              `rotateY(90deg) translateZ(${hw}px)`,
            ].map((tf, si) => (
              <div
                key={`s${si}`}
                style={{
                  position: "absolute",
                  width: d,
                  height: h,
                  transformStyle: "preserve-3d",
                  transform: tf,
                  left: (w - d) / 2,
                }}
              >
                <div style={{ ...ls, width: d, height: lw, top: 0 }} />
                <div style={{ ...ls, width: d, height: lw, bottom: 0 }} />
                <div style={{ ...ls, width: lw, height: h, left: 0 }} />
                <div style={{ ...ls, width: lw, height: h, right: 0 }} />
              </div>
            ))}
          </div>
        </div>
      );
    }

    // ─── DEFAULT (box): standard 6-face rectangular prism ───
    return (
      <div key={key} style={animStyle}>
        <div
          style={{
            position: "absolute",
            left,
            top,
            width: w,
            height: h,
            transformStyle: "preserve-3d",
            transform: `translateZ(${zPos}px)`,
          }}
        >
          <div
            style={{
              ...face,
              width: w,
              height: h,
              background: gridBg(color, indivW, indivH),
              transform: `translateZ(${hd}px)`,
            }}
          />
          <div
            style={{
              ...face,
              width: w,
              height: h,
              background: gridBg(dark, indivW, indivH),
              transform: `rotateY(180deg) translateZ(${hd}px)`,
            }}
          />
          <div
            style={{
              ...face,
              width: w,
              height: d,
              background: gridBg(light, indivW, indivD),
              top: (h - d) / 2,
              transform: `rotateX(90deg) translateZ(${hh}px)`,
            }}
          />
          <div
            style={{
              ...face,
              width: w,
              height: d,
              background: gridBg(dark, indivW, indivD),
              top: (h - d) / 2,
              transform: `rotateX(-90deg) translateZ(${hh}px)`,
            }}
          />
          <div
            style={{
              ...face,
              width: d,
              height: h,
              background: gridBg(light, indivD, indivH),
              transform: `rotateY(-90deg) translateZ(${hw}px)`,
              left: (w - d) / 2,
            }}
          />
          <div
            style={{
              ...face,
              width: d,
              height: h,
              background: gridBg(dark, indivD, indivH),
              transform: `rotateY(90deg) translateZ(${hw}px)`,
              left: (w - d) / 2,
            }}
          />
        </div>
      </div>
    );
  };

  return (
    <div
      ref={wrapperRef}
      className="rounded-xl border border-transparent bg-[#f5f6f8] w-full cursor-grab active:cursor-grabbing select-none overflow-hidden relative"
      style={{ height: 320 }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => {
        handlePointerUp();
        isHovered.current = false;
      }}
      onMouseEnter={() => {
        isHovered.current = true;
      }}
      onMouseLeave={() => {
        isHovered.current = false;
      }}
    >
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2">
            <CircularProgress size={32} />
            <span className="text-xs text-[#5B8DEF] font-medium">
              Calculating...
            </span>
          </div>
        </div>
      )}

      {/* ── Intro animation overlay: counting boxes into container ── */}
      {introVisible && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 25,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(245,246,248,0.96)",
            backdropFilter: "blur(6px)",
            opacity: introFadeIn ? 1 : 0,
            transition: "opacity 0.55s ease-in-out",
            pointerEvents: "none",
            gap: 0,
          }}
        >
          <style>{`
            @keyframes introBoxBounce {
              0%   { transform: translateY(0px)  rotate(-1deg); }
              100% { transform: translateY(-9px) rotate(2deg);  }
            }
          `}</style>

          {/* Stacked animated boxes */}
          <div
            style={{
              position: "relative",
              width: 96,
              height: 76,
              marginBottom: 20,
            }}
          >
            {[
              {
                bg: "#4CAF50",
                shadow: "#4CAF5055",
                w: 60,
                h: 46,
                b: 28,
                l: 18,
                delay: "0s",
              },
              {
                bg: "#5B8DEF",
                shadow: "#5B8DEF55",
                w: 52,
                h: 38,
                b: 9,
                l: 12,
                delay: "0.14s",
              },
              {
                bg: "#E8A838",
                shadow: "#E8A83855",
                w: 44,
                h: 30,
                b: 0,
                l: 26,
                delay: "0.28s",
              },
            ].map((box, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  width: box.w,
                  height: box.h,
                  bottom: box.b,
                  left: box.l,
                  background: box.bg,
                  borderRadius: 5,
                  border: "2px solid rgba(255,255,255,0.55)",
                  boxShadow: `0 6px 18px ${box.shadow}, inset 0 1px 0 rgba(255,255,255,0.35)`,
                  animation: `introBoxBounce 0.85s ease ${box.delay} infinite alternate`,
                }}
              />
            ))}
          </div>

          {/* Animated counter */}
          <div
            style={{
              fontSize: 44,
              fontWeight: 800,
              color: "#273046",
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1,
              letterSpacing: "-0.02em",
            }}
          >
            {counterVal.toLocaleString()}
          </div>

          <div
            style={{
              fontSize: 11,
              color: "#7B8499",
              marginTop: 6,
              textTransform: "uppercase",
              fontWeight: 700,
              letterSpacing: "0.09em",
            }}
          >
            {counterVal >= totalItemCount && totalItemCount > 0
              ? "Items Packed ✓"
              : "Packing into Container…"}
          </div>

          {/* Progress bar */}
          <div
            style={{
              width: 168,
              height: 3,
              background: "#E6E8EF",
              borderRadius: 2,
              marginTop: 14,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                borderRadius: 2,
                background: "linear-gradient(90deg, #5B8DEF 0%, #4CAF50 100%)",
                width: `${totalItemCount > 0 ? Math.round((counterVal / totalItemCount) * 100) : 0}%`,
                transition: "width 0.04s linear",
              }}
            />
          </div>
        </div>
      )}

      {/* Refresh button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          prevDataKeyRef.current = "";
          setRefreshKey((k) => k + 1);
          playAnimation(true);
        }}
        className="absolute top-2 left-3 z-10 flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#5B8DEF] bg-white border border-[#E6E8EF] rounded-lg shadow-sm hover:bg-[#f0f4ff] hover:border-[#5B8DEF] transition-all cursor-pointer select-none"
        title="Replay packing animation"
      >
        <svg
          width="14"
          height="14"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 4v5h5M20 20v-5h-5M4 9a9 9 0 0 1 15.36-5.36L20 4M20 15a9 9 0 0 1-15.36 5.36L4 20"
          />
        </svg>
        Refresh
      </button>
      {/* Items loaded badge */}
      {hasApiData && visualization3D && !introVisible && (
        <div className="absolute bottom-2 left-3 text-[10px] z-10 pointer-events-none select-none bg-white/80 backdrop-blur-sm px-2 py-1 rounded-md border border-[#E6E8EF] text-[#374151] font-medium flex items-center gap-1">
          <span
            style={{
              display: "inline-block",
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#4CAF50",
              flexShrink: 0,
            }}
          />
          {visualization3D.items.length.toLocaleString()} items loaded
        </div>
      )}
      {/* Data source badge */}
      <div
        className={`absolute top-2 right-3 text-xs z-10 pointer-events-none select-none flex items-center gap-1 ${hasApiData ? "text-green-500" : "text-[#9ca3af]"}`}
      >
        {hasApiData ? (
          <>
            <svg width="12" height="12" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            Live API Data
          </>
        ) : (
          <>
            <svg
              width="14"
              height="14"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
              />
            </svg>
            Drag to rotate
          </>
        )}
      </div>

      <div
        style={{
          width: "100%",
          height: "100%",
          perspective: 1200,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          ref={containerRef}
          style={{
            width: baseLen,
            height: cHgt,
            position: "relative",
            transformStyle: "preserve-3d",
            transform: `scale(${fitRef.current * zoomRef.current}) rotateX(${rotationRef.current.x}deg) rotateY(${rotationRef.current.y}deg)`,
            transition: "transform 0.12s ease-out",
            willChange: "transform",
          }}
        >
          {/* ═══ ORANGE BASE ═══ */}
          <div style={{ ...baseAnim, transformStyle: "preserve-3d" }}>
            <div
              style={{
                ...f(
                  `rotateX(-90deg) translateZ(${cHgt / 2 + baseH / 2}px)`,
                  baseLen,
                  cWid,
                ),
                background: orange,
                top: (cHgt - cWid) / 2 + baseH / 2,
              }}
            />
            <div
              style={{
                ...f(`translateZ(${cWid / 2}px)`, baseLen, baseH),
                background: orange,
                top: cHgt,
              }}
            />
            <div
              style={{
                ...f(
                  `rotateY(180deg) translateZ(${cWid / 2}px)`,
                  baseLen,
                  baseH,
                ),
                background: orangeDark,
                top: cHgt,
              }}
            />
            <div
              style={{
                ...f(
                  `rotateY(90deg) translateZ(${baseLen / 2}px)`,
                  cWid,
                  baseH,
                ),
                background: orangeDark,
                top: cHgt,
                left: (baseLen - cWid) / 2,
              }}
            />
            <div
              style={{
                ...f(
                  `rotateY(-90deg) translateZ(${baseLen / 2}px)`,
                  cWid,
                  baseH,
                ),
                background: orange,
                top: cHgt,
                left: (baseLen - cWid) / 2,
              }}
            />
          </div>

          {/* ═══ CONTAINER WALLS (wireframe) ═══ */}
          {hasApiData && (
            <div style={{ ...baseAnim, transformStyle: "preserve-3d" }}>
              {/* Front wall */}
              <div
                style={{
                  ...f(`translateZ(${cWid / 2}px)`, baseLen, cHgt),
                  border: "1.5px dashed rgba(150,170,200,0.35)",
                  background: "transparent",
                  top: 0,
                }}
              />
              {/* Back wall */}
              <div
                style={{
                  ...f(
                    `rotateY(180deg) translateZ(${cWid / 2}px)`,
                    baseLen,
                    cHgt,
                  ),
                  border: "1.5px dashed rgba(150,170,200,0.35)",
                  background: "transparent",
                  top: 0,
                }}
              />
              {/* Left wall */}
              <div
                style={{
                  ...f(
                    `rotateY(-90deg) translateZ(${baseLen / 2}px)`,
                    cWid,
                    cHgt,
                  ),
                  border: "1.5px dashed rgba(150,170,200,0.35)",
                  background: "transparent",
                  top: 0,
                  left: (baseLen - cWid) / 2,
                }}
              />
              {/* Right wall */}
              <div
                style={{
                  ...f(
                    `rotateY(90deg) translateZ(${baseLen / 2}px)`,
                    cWid,
                    cHgt,
                  ),
                  border: "1.5px dashed rgba(150,170,200,0.35)",
                  background: "transparent",
                  top: 0,
                  left: (baseLen - cWid) / 2,
                }}
              />
              {/* Ceiling */}
              <div
                style={{
                  ...f(
                    `rotateX(90deg) translateZ(${cHgt / 2}px)`,
                    baseLen,
                    cWid,
                  ),
                  border: "1.5px dashed rgba(150,170,200,0.25)",
                  background: "rgba(200,215,240,0.06)",
                  top: (cHgt - cWid) / 2,
                }}
              />
            </div>
          )}

          {/* ═══ CARGO ═══ */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: baseLen,
              height: cHgt,
              transformStyle: "preserve-3d",
            }}
          >
            {apiBoxes.length > 0
              ? /* ── Real-dimension items from API ── */
                apiBoxes.map((box, renderIdx) => {
                  const topPos = cHgt - box.pxZ - box.pxH;
                  const zDepth = -cWid / 2 + box.pxY + box.pxD / 2;
                  const show = animPhase >= 2;
                  // Stagger each row 60 ms apart — row-by-row cascade drop
                  const delay = `${Math.min(renderIdx * 0.06, 2.4)}s`;
                  // Vertical drop: boxes fall from 70 px above their final position
                  const anim: React.CSSProperties = {
                    opacity: show ? 1 : 0,
                    transform: show ? "translateY(0px)" : "translateY(-70px)",
                    transition: show
                      ? `opacity 0.25s ease-out ${delay}, transform 0.55s cubic-bezier(0.22,1,0.36,1) ${delay}`
                      : "none",
                    transformStyle: "preserve-3d",
                  };
                  return renderCargoItem(
                    `api-${box.id}`,
                    box.pxX,
                    topPos,
                    zDepth,
                    box.pxW,
                    box.pxH,
                    box.pxD,
                    box.color,
                    box.cargoType,
                    anim,
                    box.indivW,
                    box.indivH,
                    box.indivD,
                  );
                })
              : /* ── Fallback uniform grid ── */
                (() => {
                  const fCols = fallbackCols;
                  const fDepth = fallbackDepthLayers;
                  const s = boxSize;
                  const fbHgt = fallbackCHgt;
                  const items: React.ReactNode[] = [];
                  let idx = 0;
                  // Blue boxes (bottom 3 rows)
                  for (let layer = 0; layer < fDepth; layer++)
                    for (let row = 0; row < blueRows; row++)
                      for (let col = 0; col < fCols; col++) {
                        const topPos = fbHgt - (row + 1) * s;
                        const zPos = -cWid / 2 + layer * s + s / 2;
                        const show = animPhase >= 2;
                        const delay = `${idx * boxStagger}s`;
                        const anim: React.CSSProperties = {
                          opacity: show ? 1 : 0,
                          transition: show
                            ? `opacity 0.01s linear ${delay}`
                            : "none",
                          transformStyle: "preserve-3d",
                        };
                        items.push(
                          renderCargoItem(
                            `bb-${idx}`,
                            col * s,
                            topPos,
                            zPos,
                            s,
                            s,
                            s,
                            blue,
                            "box",
                            anim,
                          ),
                        );
                        idx++;
                      }
                  // Green boxes (top 1 row)
                  for (let layer = 0; layer < fDepth; layer++)
                    for (let row = 0; row < greenRows; row++)
                      for (let col = 0; col < fCols; col++) {
                        const topPos = (greenRows - 1 - row) * s;
                        const zPos = -cWid / 2 + layer * s + s / 2;
                        const show = animPhase >= 2;
                        const delay = `${greenBaseDelay + (idx - totalBlueBoxes) * boxStagger}s`;
                        const anim: React.CSSProperties = {
                          opacity: show ? 1 : 0,
                          transition: show
                            ? `opacity 0.01s linear ${delay}`
                            : "none",
                          transformStyle: "preserve-3d",
                        };
                        items.push(
                          renderCargoItem(
                            `gb-${idx}`,
                            col * s,
                            topPos,
                            zPos,
                            s,
                            s,
                            s,
                            green,
                            "bigbags",
                            anim,
                          ),
                        );
                        idx++;
                      }
                  return items;
                })()}
          </div>
        </div>
      </div>

      {/* View preset cycling button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          const next = (activeView + 1) % VIEW_PRESETS.length;
          setActiveView(next);
          rotationRef.current = {
            x: VIEW_PRESETS[next].x,
            y: VIEW_PRESETS[next].y,
          };
          if (containerRef.current)
            containerRef.current.style.transition = "transform 0.35s ease-out";
          applyTransform();
        }}
        className="absolute bottom-2 right-3 z-10 flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#5B8DEF] bg-white border border-[#E6E8EF] rounded-lg shadow-sm hover:bg-[#f0f4ff] hover:border-[#5B8DEF] transition-all cursor-pointer select-none"
        title="Cycle view angle"
      >
        {VIEW_PRESETS[activeView].label} view
      </button>
    </div>
  );
};

// ── AIR/LAND fallback envelopes ──────────────────────────────────────────
// The live site is public and sends no auth token, so the common api-gateway
// blocks GET /air-cargo and GET /trucks with 401 (only the SEA load-calculator
// routes are whitelisted). When the real list can't be fetched (401/empty/down),
// the AIR/LAND 3D falls back to these standard IATA ULD / road-truck envelopes
// so the model still reshapes correctly — same "fallback list if unreachable"
// pattern already used for the cargo-types dropdown. Air dims are in CM
// (matched to the /air-cargo shape); truck dims are in METRES (matched to
// /trucks). Real endpoint data is always preferred when it loads.
const FALLBACK_AIR_CARGO = [
  { name: "LD3 (AKE)", iataUldCode: "AKE", category: "container", specialFeatures: ["contoured"], dimensions: { insideLength: 156, insideWidth: 153, insideHeight: 163 } },
  { name: "LD6 (ALF)", iataUldCode: "ALF", category: "container", specialFeatures: ["angled_ends"], dimensions: { insideLength: 318, insideWidth: 153, insideHeight: 163 } },
  { name: "LD11", iataUldCode: "ALP", category: "container", specialFeatures: [], dimensions: { insideLength: 318, insideWidth: 224, insideHeight: 162 } },
  { name: "M-1 (AMA)", iataUldCode: "AMA", category: "container", specialFeatures: [], dimensions: { insideLength: 318, insideWidth: 244, insideHeight: 244 } },
  { name: 'M-6 (118"H)', iataUldCode: "PMC", category: "pallet", specialFeatures: ["net"], dimensions: { insideLength: 318, insideWidth: 244, insideHeight: 300 } },
];
const FALLBACK_TRUCKS = [
  { name: "Small Van", dimensions: { insideLength: 2.2, insideWidth: 1.5, insideHeight: 1.5 } },
  { name: "Refrigerated Truck", dimensions: { insideLength: 6.2, insideWidth: 2.4, insideHeight: 2.4 } },
  { name: "Box Truck (7.5t)", dimensions: { insideLength: 7.2, insideWidth: 2.45, insideHeight: 2.5 } },
  { name: "Semi-Trailer (13.6m)", dimensions: { insideLength: 13.6, insideWidth: 2.45, insideHeight: 2.7 } },
];

// Cargo Details Content Component – integrated with Load Calculator API
interface CargoDetailsContentProps {
  initialProducts?: ProductInput[];
  hideShippingSection?: boolean;
  hideLoadSection?: boolean;
}

export function CargoDetailsContent({
  initialProducts,
  hideShippingSection = false,
  hideLoadSection = false,
}: CargoDetailsContentProps = {}) {
  const [mode, setMode] = useState<"SEA" | "LAND" | "AIR" | "AUTO">("SEA");
  // Starts on the SMALLEST size so the silent auto-fit (below) probes 20ft first
  // and only lands on 40ft when the load actually needs it. A user chip click
  // locks the choice (autoPickRef -> false).
  const [containerSizeOption, setContainerSizeOption] = useState<"20" | "40">(
    "20",
  );
  // While true, the cargo (not the user) decides the container size.
  const autoPickRef = useRef(true);
  const [activeContainer, setActiveContainer] = useState<number>(1);
  const [apiError, setApiError] = useState<string | null>(null);

  // ── Real freight rates from the service-provider rate cards (replaces the
  //    hardcoded EVERGREEN / $204 / $1874 voyage cards). ──
  const SERVICEPROVIDER = API.serviceprovider;
  const [originPort, setOriginPort] = useState("NHAVA SHEVA");
  const [destPort, setDestPort] = useState("JEBEL ALI");
  const [freightOptions, setFreightOptions] = useState<any[]>([]);
  const [freightLoading, setFreightLoading] = useState(false);
  // Why a lane has no price — "no rates" alone leaves the user guessing.
  const [laneStatus, setLaneStatus] = useState<any>(null);

  // ── City → nearest port, on BOTH sides ──
  // Each side is driven purely by the city the user types: the backend measures
  // every port in that city's country against the city's coordinates and
  // returns them nearest-first, so no country picker is needed.
  type PortOpt = {
    label: string;
    value: string;
    quotable?: boolean;
    distanceKm?: number;
    roadKm?: number;
    tier?: "quotable" | "ocean" | "other";
  };
  const [pickupCity, setPickupCity] = useState("");
  const [deliveryCity, setDeliveryCity] = useState("");
  const [originPortList, setOriginPortList] = useState<PortOpt[]>([]);
  const [destPortList, setDestPortList] = useState<PortOpt[]>([]);
  const [detectingOrigin, setDetectingOrigin] = useState(false);
  const [detectingDest, setDetectingDest] = useState(false);
  // What the city lookup actually resolved — so a city we can't place says so
  // instead of silently leaving the previous port selected.
  type PortHint = {
    via: string | null;
    country?: string | null;
    empty?: boolean;
  } | null;
  const [originHint, setOriginHint] = useState<PortHint>(null);
  const [destHint, setDestHint] = useState<PortHint>(null);
  // International ports (755) — shown while no city has been entered.
  const [allPorts, setAllPorts] = useState<{ origin: PortOpt[]; dest: PortOpt[] }>(
    { origin: [], dest: [] },
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      (["origin", "dest"] as const).map((side) =>
        fetch(`${SERVICEPROVIDER}/landed-cost/all-ports?side=${side}`)
          .then((r) => r.json())
          .then((j) => ((j && j.data && j.data.ports) || []) as PortOpt[])
          .catch(() => [] as PortOpt[]),
      ),
    ).then(([origin, dest]) => {
      if (!cancelled) setAllPorts({ origin, dest });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Option list for a port <select>, guaranteed to contain the selected value:
  // a <select> whose value matches no <option> renders BLANK.
  const portOptions = (list: PortOpt[], current: string): PortOpt[] =>
    list.length
      ? list.some((p) => p.value === current)
        ? list
        : [{ label: current, value: current }, ...list]
      : [{ label: current, value: current }];

  // Shared city → nearest-ports resolver for both sides. Debounced so it fires
  // once typing stops; a quotable port wins the auto-pick over a marginally
  // nearer one we cannot price.
  const useNearestPorts = (
    city: string,
    side: "origin" | "dest",
    setList: (p: PortOpt[]) => void,
    setPort: (v: string) => void,
    setBusy: (b: boolean) => void,
    setHint: (h: PortHint) => void,
  ) => {
    useEffect(() => {
      const q = city.trim();
      if (q.length < 3) {
        setList([]);
        setHint(null);
        return;
      }
      setBusy(true);
      const t = setTimeout(() => {
        fetch(
          // side matters: the ports we hold rates FROM differ from those we
          // hold rates TO, and the list is restricted to priced ports so every
          // option can actually carry the shipment.
          `${SERVICEPROVIDER}/landed-cost/nearest-ports?city=${encodeURIComponent(
            q,
          )}&side=${side}&limit=8`,
        )
          .then((r) => r.json())
          .then((j) => {
            const d = (j && j.data) || {};
            const ports: PortOpt[] = (d.ports || []).filter(
              (p: PortOpt) => p && p.value,
            );
            setList(ports);
            setHint({
              via: d.resolvedVia ?? null,
              country: d.countryName,
              empty: !ports.length,
            });
            if (ports.length) {
              const best = ports.find((p) => p.quotable) || ports[0];
              setPort(best.value);
            }
          })
          .catch(() => {
            setList([]);
            setHint(null);
          })
          .finally(() => setBusy(false));
      }, 500);
      return () => {
        clearTimeout(t);
        setBusy(false);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [city]);
  };

  useNearestPorts(
    pickupCity,
    "origin",
    setOriginPortList,
    setOriginPort,
    setDetectingOrigin,
    setOriginHint,
  );
  useNearestPorts(
    deliveryCity,
    "dest",
    setDestPortList,
    setDestPort,
    setDetectingDest,
    setDestHint,
  );

  useEffect(() => {
    let cancelled = false;
    setFreightLoading(true);
    fetch(
      `${SERVICEPROVIDER}/landed-cost/freight-options?originPort=${encodeURIComponent(
        originPort,
      )}&destPort=${encodeURIComponent(destPort)}&limit=5`,
    )
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        const opts = (j && j.data && j.data.options) || [];
        setFreightOptions(opts);
        setLaneStatus(null);
        // Nothing quotable — ask the backend which of the several possible
        // reasons applies so the panel can say something useful.
        if (!opts.length) {
          fetch(
            `${SERVICEPROVIDER}/landed-cost/lane-status?originPort=${encodeURIComponent(
              originPort,
            )}&destPort=${encodeURIComponent(destPort)}`,
          )
            .then((r2) => r2.json())
            .then((j2) => {
              if (!cancelled) setLaneStatus((j2 && j2.data) || null);
            })
            .catch(() => {});
        }
      })
      .catch(() => {
        if (!cancelled) setFreightOptions([]);
      })
      .finally(() => {
        if (!cancelled) setFreightLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originPort, destPort]);

  // RTK Query mutations
  const [calculateContainers, { data: calcData, isLoading: isCalcLoading }] =
    useCalculateMultipleContainersMutation();
  const [get3DVisualization, { data: vizData, isLoading: isVizLoading }] =
    useGetEnhanced3DVisualizationMutation();

  // ── Editable products state ──
  const defaultProducts: ProductInput[] = [
    {
      name: "Boxes 1",
      cargoType: "box",
      length: 500,
      width: 400,
      height: 300,
      weight: 35,
      quantity: 24,
    },
    {
      name: "Big Bags",
      cargoType: "bigbags",
      length: 800,
      width: 800,
      height: 1000,
      weight: 40,
      quantity: 90,
    },
  ];
  const [products, setProducts] = useState<ProductInput[]>(
    initialProducts && initialProducts.length > 0
      ? initialProducts
      : defaultProducts,
  );

  // ── Cargo types come from the backend, not hardcoded ──
  // Loaded live (GET, read-only) from the transport-service cargo-types endpoint
  // so the Type dropdown options + the cylindrical rule always match the backend.
  // The fallback below is only used if the endpoint is unreachable, so the UI
  // never breaks. We never write to the backend — this only reads.
  type CargoTypeOption = { value: string; label: string; cylindrical: boolean };
  const CARGO_TYPE_FALLBACK: CargoTypeOption[] = [
    { value: "box", label: "Box", cylindrical: false },
    { value: "bigbags", label: "Big Bags", cylindrical: false },
    { value: "sacks", label: "Sacks", cylindrical: false },
    { value: "barrels", label: "Barrels", cylindrical: true },
    { value: "roll", label: "Roll", cylindrical: true },
    { value: "pipes", label: "Pipes", cylindrical: true },
    { value: "bulk", label: "Bulk", cylindrical: false },
  ];
  const [cargoTypes, setCargoTypes] =
    useState<CargoTypeOption[]>(CARGO_TYPE_FALLBACK);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${TRANSPORT}/load-calculator/api/cargo-types`,
        );
        const json = await res.json().catch(() => null);
        const obj = json?.data ?? json?.cargoTypes ?? json;
        if (!obj || typeof obj !== "object") return;
        const list: CargoTypeOption[] = Array.isArray(obj)
          ? obj.map((t: any) => ({
              value: String(t.value ?? t.key ?? t.type ?? t.name ?? "")
                .toLowerCase(),
              label: t.name ?? t.label ?? t.value ?? "",
              cylindrical: !!t.cylindrical,
            }))
          : Object.entries(obj).map(([k, v]: [string, any]) => ({
              value: k.toLowerCase(),
              label: (v && v.name) || k,
              cylindrical: !!(v && v.cylindrical),
            }));
        const clean = list.filter((t) => t.value && t.label);
        if (!cancelled && clean.length) setCargoTypes(clean);
      } catch {
        /* keep fallback — endpoint unreachable */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateProduct = useCallback(
    (idx: number, field: keyof ProductInput, value: string | number) => {
      setProducts((prev) =>
        prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)),
      );
    },
    [],
  );

  // Update several fields of one product at once — needed for cylindrical cargo
  // where a single "Diameter" input drives both length and width together.
  const updateProductFields = useCallback(
    (idx: number, patch: Partial<ProductInput>) => {
      setProducts((prev) =>
        prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)),
      );
    },
    [],
  );

  // Cylindrical cargo is fully described by a diameter + a height, so the form
  // shows only those two dimensions instead of Length × Width × Height.
  // This list MIRRORS the backend's own rule (transport-service
  // loadCalculatorController: cargoType in barrels/roll/rolls/pipes/drums ⇒
  // "only needs length/diameter and height, width not required"). We drive the
  // diameter into BOTH length and width so the payload is valid regardless of
  // the backend's singular/plural key check — no backend change needed.
  const CYLINDER_TYPES = [
    "drum",
    "drums",
    "barrels",
    "roll",
    "rolls",
    "pipes",
  ];
  const isCylinder = (t?: string) => {
    if (!t) return false;
    const lc = t.toLowerCase();
    // Prefer the backend's own `cylindrical` flag from /api/cargo-types.
    const fromApi = cargoTypes.find((c) => c.value === lc);
    if (fromApi) return fromApi.cylindrical;
    return CYLINDER_TYPES.includes(lc);
  };

  const addProduct = useCallback(() => {
    setProducts((prev) => [
      ...prev,
      {
        name: `Product ${prev.length + 1}`,
        cargoType: "box",
        length: 400,
        width: 300,
        height: 200,
        weight: 20,
        quantity: 10,
      },
    ]);
  }, []);

  const removeProduct = useCallback((idx: number) => {
    setProducts((prev) =>
      prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev,
    );
  }, []);

  // Build the size-preference object once — both endpoints need the same hint
  // so the 3D viz aligns with the calculation result for the selected size.
  const sizePreferences = useMemo(
    () => ({
      preferredContainerSize:
        containerSizeOption === "20" ? "20ft_standard" : "40ft_high_cube",
      containerSize: containerSizeOption === "20" ? "20ft" : "40ft",
      containerType:
        containerSizeOption === "20" ? "20ft_standard" : "40ft_high_cube",
    }),
    [containerSizeOption],
  );

  // Debounced recalculation
  const recalcTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRecalc = useCallback(() => {
    if (recalcTimer.current) clearTimeout(recalcTimer.current);
    recalcTimer.current = setTimeout(() => {
      setApiError(null);
      const validProducts = products.filter(
        (p) => p.quantity > 0 && p.length > 0 && p.width > 0 && p.height > 0,
      );
      if (validProducts.length === 0) return;
      calculateContainers({
        products: validProducts,
        preferences: sizePreferences,
        format: "full",
      })
        .unwrap()
        .then(() => {
          get3DVisualization({
            products: validProducts,
            preferences: sizePreferences,
            // Clamp to the backend's packed-container range — it returns far
            // fewer containers than a large shipment needs and 404s past them;
            // every full container carries the identical load anyway.
            containerIndex: Math.min(
              activeContainer - 1,
              Math.max(0, containers.length - 1),
            ),
          })
            .unwrap()
            .catch((err) => {
              console.warn("3D visualization fallback:", err);
            });
        })
        .catch((err) => {
          console.error("Load calculator error:", err);
          setApiError(
            typeof err === "string"
              ? err
              : err?.data?.message || "Failed to calculate load",
          );
        });
    }, 600);
  }, [
    products,
    sizePreferences,
    activeContainer,
    calculateContainers,
    get3DVisualization,
  ]);

  // Recalculate on product/container changes
  useEffect(() => {
    triggerRecalc();
    return () => {
      if (recalcTimer.current) clearTimeout(recalcTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, containerSizeOption]);

  // Re-fetch 3D viz when switching containers
  useEffect(() => {
    if (!calcData?.success) return;
    const validProducts = products.filter(
      (p) => p.quantity > 0 && p.length > 0 && p.width > 0 && p.height > 0,
    );
    if (validProducts.length === 0) return;
    get3DVisualization({
      products: validProducts,
      preferences: sizePreferences,
      // Same clamp as the initial fetch — tabs can outnumber the backend's
      // packed containers, whose 3D endpoint 404s past its own list.
      containerIndex: Math.min(
        activeContainer - 1,
        Math.max(0, containers.length - 1),
      ),
    })
      .unwrap()
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeContainer]);

  // Extract data from API response
  const solution = calcData?.data;
  // Match a container/spec name against the currently-selected size.
  // Server-side names look like "20' Standard", "20ft Standard",
  // "40' High Cube", etc. — prefer name matching over numeric length checks
  // because length units (mm vs m) vary across endpoints.
  const nameMatchesSize = (name?: string) => {
    if (!name) return false;
    const is20Name = /(^|[^0-9])20\s*(['ʼ’`]|ft|foot)/i.test(name);
    const is40Name = /(^|[^0-9])40\s*(['ʼ’`]|ft|foot)/i.test(name);
    return containerSizeOption === "20" ? is20Name : is40Name;
  };
  // Length-based fallback when names are missing — normalize mm vs m.
  const lengthMatchesSize = (len?: number) => {
    if (!len) return true;
    const lenM = len > 100 ? len / 1000 : len;
    return containerSizeOption === "20" ? lenM < 8 : lenM >= 8;
  };
  const sizeMatches = (c?: any) =>
    !!c &&
    (nameMatchesSize(c?.containerSpec?.name) ||
      lengthMatchesSize(c?.containerSpec?.length));

  // Pick the solution that matches the selected size first — the server may
  // return multiple solutions (one per container type) and we want the 20ft
  // one when the user has selected 20ft, even if the API marks 40ft as optimal.
  const allSolutionLists: any[][] = [
    solution?.optimalSolution?.containers,
    ...(solution?.solutions || []).map((s: any) => s?.containers),
    (solution as any)?.bestSolution?.containers,
  ].filter(Boolean) as any[][];

  const matchedList = allSolutionLists.find((list) =>
    list.some((c) => sizeMatches(c)),
  );
  const containers = matchedList || allSolutionLists[0] || [];

  const validContainers = containers.filter((c: any) => sizeMatches(c));

  // ── Containers required for the SELECTED size ──
  // The backend can't tell us (it ignores the size toggle), so estimate by
  // volume: total cargo volume ÷ the standard usable volume of the chosen size.
  const SELECTED_CONTAINER_M3 =
    containerSizeOption === "20"
      ? 5.898 * 2.352 * 2.393 // ≈ 33.2 m³ (20ft)
      : 12.032 * 2.352 * 2.393; // ≈ 67.7 m³ (40ft)
  const totalCargoM3 = products.reduce(
    (s, p) =>
      s +
      ((p.length || 0) / 1000) *
        ((p.width || 0) / 1000) *
        ((p.height || 0) / 1000) *
        (p.quantity || 0),
    0,
  );
  const containersNeeded = Math.max(
    1,
    Math.ceil(totalCargoM3 / SELECTED_CONTAINER_M3),
  );
  const fillPct =
    containersNeeded > 0 && SELECTED_CONTAINER_M3 > 0
      ? Math.min(
          100,
          Math.round(
            (totalCargoM3 / (containersNeeded * SELECTED_CONTAINER_M3)) * 100,
          ),
        )
      : 0;

  // The backend packs and returns only a handful of containers (its 3D endpoint
  // 404s past them) while the shipment may need far more — the footer said
  // "64 × containers required" but only ~12 tabs existed. Show a tab for every
  // required container and clamp all data lookups to the last backend container:
  // every full container in the solution carries the identical load, so the
  // clamped container is a faithful stand-in for tabs past the backend list.
  const totalContainerTabs = Math.min(
    Math.max(containersNeeded, containers.length),
    200,
  );
  const clampedContainerIdx = (tabNum: number) =>
    Math.min(tabNum - 1, Math.max(0, containers.length - 1));

  // Show the real container at the active tab index — the SAME container the 3D
  // viewer visualizes (get3DVisualization uses the same clamped index).
  // Previously this indexed a size-FILTERED list while the 3D indexed the full
  // list, so on a mixed-size solution the title/stats showed a different
  // container than the 3D (e.g. title "40ft" while the 3D drew the 20ft #1).
  const activeContainerData =
    containers[clampedContainerIdx(activeContainer)] ??
    validContainers[0] ??
    containers[0];

  // ── SILENT AUTO-FIT: mirror the calculator's ACTUAL chosen container into the
  // size chip. The backend returns the container it actually packed into
  // (`containers[0]`, independent of the chip), so we sync the chip to its true
  // size while in auto mode; a user chip click sets autoPickRef=false and locks
  // the choice. One-hop and loop-safe: once the chip matches the returned size,
  // no further change fires.
  useEffect(() => {
    if (!autoPickRef.current) return;
    if (!calcData?.success) return;
    const spec: any = containers?.[0]?.containerSpec;
    if (!spec) return;
    const nm: string = spec.name || "";
    let size: "20" | "40" | null = null;
    if (/(^|[^0-9])20\s*(['ʼ’`]|ft|foot)/i.test(nm)) size = "20";
    else if (/(^|[^0-9])40\s*(['ʼ’`]|ft|foot)/i.test(nm)) size = "40";
    else if (spec.length) {
      const m = spec.length > 100 ? spec.length / 1000 : spec.length;
      size = m < 8 ? "20" : "40";
    }
    if (size && size !== containerSizeOption) {
      setContainerSizeOption(size);
      setActiveContainer(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calcData, containerSizeOption]);

  // Keep the active tab within range if the solution shrinks (e.g. cargo reduced
  // from 3 containers down to 1) so the title/stats and the 3D can't drift onto
  // different containers again.
  useEffect(() => {
    if (activeContainer > totalContainerTabs) {
      setActiveContainer(1);
    }
  }, [totalContainerTabs, activeContainer]);

  const totalReq = solution?.totalRequirements;

  // Visualization data — prefer enhanced 3D, fallback to container's built-in visualization3D.
  // Reject stale viz whose container dims don't match the selected size, otherwise
  // a 20ft selection briefly renders a 12 m container squeezed into the 20ft scene width.
  const rawViz =
    vizData?.data?.visualization ||
    activeContainerData?.visualization3D ||
    null;
  // Use the real 3D data whenever the API returned positioned items. (The old
  // guard called sizeMatches() — which expects a container OBJECT — with a plain
  // length NUMBER, so it never actually matched and could silently drop good
  // data, forcing the demo fallback. The scene below now sizes itself from the
  // container's real dimensions, so a size mismatch no longer distorts anything.)
  const visualization3D =
    rawViz && Array.isArray(rawViz.items) && rawViz.items.length > 0
      ? rawViz
      : null;

  // ══════════════════════════════════════════════════════════════════════
  // AIR / LAND delivery modes — pack the goods into a real ULD (air) or truck
  // (land) 3D model. Dimensions come STRICTLY from existing transport-service
  // endpoints (/air-cargo, /trucks) — no new backend endpoint.
  // ══════════════════════════════════════════════════════════════════════
  const [airCargoList, setAirCargoList] = useState<any[]>([]);
  const [truckList, setTruckList] = useState<any[]>([]);
  const [modeLoading, setModeLoading] = useState(false);
  useEffect(() => {
    if (mode !== "AIR" && mode !== "LAND") return;
    let cancelled = false;
    (async () => {
      try {
        setModeLoading(true);
        if (mode === "AIR" && airCargoList.length === 0) {
          let list: any[] = [];
          try {
            const res = await fetch(
              `${TRANSPORT}/air-cargo?limit=100&isActive=true&sortBy=name&sortOrder=asc`,
            );
            const json = res.ok ? await res.json().catch(() => null) : null;
            const parsed =
              json?.data?.containers ||
              json?.containers ||
              (Array.isArray(json?.data) ? json.data : []);
            if (Array.isArray(parsed)) list = parsed;
          } catch {
            /* endpoint blocked (401 on public site) or unreachable */
          }
          // Real data preferred; fall back to standard ULDs so AIR still reshapes.
          if (!cancelled)
            setAirCargoList(list.length ? list : FALLBACK_AIR_CARGO);
        } else if (mode === "LAND" && truckList.length === 0) {
          let list: any[] = [];
          try {
            const res = await fetch(`${TRANSPORT}/trucks`);
            const json = res.ok ? await res.json().catch(() => null) : null;
            const parsed =
              json?.data?.trucks ||
              json?.trucks ||
              (Array.isArray(json?.data) ? json.data : []);
            if (Array.isArray(parsed)) list = parsed;
          } catch {
            /* endpoint blocked (401 on public site) or unreachable */
          }
          // Real data preferred; fall back to standard trucks so LAND still reshapes.
          if (!cancelled) setTruckList(list.length ? list : FALLBACK_TRUCKS);
        }
      } catch {
        /* keep empty — endpoint unreachable */
      } finally {
        if (!cancelled) setModeLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const modeVisualization = useMemo<
    | (Visualization3D & {
        __name?: string;
        __uldShape?: "box" | "contoured" | "trapezoid" | "pallet";
        __uldCode?: string;
      })
    | null
  >(() => {
    if (mode !== "AIR" && mode !== "LAND") return null;
    const list: any[] = mode === "AIR" ? airCargoList : truckList;
    if (!Array.isArray(list) || list.length === 0) return null;

    const valid = products.filter(
      (p) => p.quantity > 0 && p.length > 0 && p.width > 0 && p.height > 0,
    );
    if (valid.length === 0) return null;

    // ULD dims come in CM, truck dims in METRES → normalise to metres.
    const toM = (v: number) => (mode === "AIR" ? (v || 0) / 100 : v || 0);
    const totalVol = valid.reduce(
      (s, p) =>
        s +
        (p.length / 1000) * (p.width / 1000) * (p.height / 1000) * p.quantity,
      0,
    );

    const sized = list
      .map((c: any) => {
        const d = c?.dimensions || {};
        const L = toM(d.insideLength);
        const W = toM(d.insideWidth);
        const H = toM(d.insideHeight);
        return { c, L, W, H, vol: L * W * H };
      })
      .filter((x) => x.L > 0 && x.W > 0 && x.H > 0)
      .sort((a, b) => a.vol - b.vol);
    if (sized.length === 0) return null;

    const chosen =
      sized.find((x) => x.vol >= totalVol) || sized[sized.length - 1];

    const palette = [
      "#10b981", "#3b82f6", "#f59e0b", "#ef4444",
      "#8b5cf6", "#ec4899", "#14b8a6", "#f97316",
    ];
    const items: any[] = [];
    valid.forEach((p, pi) => {
      const dl = p.length / 1000;
      const dw = p.width / 1000;
      const dh = p.height / 1000;
      const color = (p as any).color || palette[pi % palette.length];
      const ct = (p as any).cargoType || (p as any).type || "box";
      for (let i = 0; i < p.quantity; i++) {
        items.push({
          id: `mode-${pi}-${i}`,
          name: p.name || "Item",
          cargoType: ct,
          color,
          opacity: 1,
          position: { x: 0, y: 0, z: 0 },
          dimensions: { length: dl, width: dw, height: dh },
          originalDimensions: { length: dl, width: dw, height: dh },
          weight: p.weight || 0,
          volume: dl * dw * dh,
          layer: 0,
          stackingInfo: {
            canStack: true,
            canTilt: { length: false, width: false, height: false },
            fragility: "normal",
          },
          spacingApplied: false,
        });
      }
    });

    const CL = chosen.L, CW = chosen.W, CH = chosen.H;
    const boxVol = CL * CW * CH;
    // Drive the ULD silhouette from the record (category + specialFeatures) — same
    // rule as the buyer popup: pallet/net → pallet; angled_ends → trapezoid;
    // contoured/angled_sides → contoured; else plain aluminium box.
    const sf: string[] = (
      Array.isArray(chosen.c?.specialFeatures) ? chosen.c.specialFeatures : []
    ).map((s: any) => String(s).toLowerCase());
    const cat = String(chosen.c?.category || "").toLowerCase();
    let uldShape: "box" | "contoured" | "trapezoid" | "pallet" = "box";
    if (mode === "AIR") {
      if (cat.includes("pallet") || sf.includes("net")) uldShape = "pallet";
      else if (sf.includes("angled_ends")) uldShape = "trapezoid";
      else if (sf.includes("contoured") || sf.includes("angled_sides"))
        uldShape = "contoured";
    }
    return {
      __name: chosen.c?.name || (mode === "AIR" ? "ULD" : "Truck"),
      __uldShape: uldShape,
      __uldCode: chosen.c?.iataUldCode || chosen.c?.name || "",
      containerDimensions: { length: CL, width: CW, height: CH, volume: boxVol },
      items,
      layers: [],
      cargoBreakdown: {},
      utilization: {
        volumeUtilization:
          boxVol > 0 ? Math.min(100, (totalVol / boxVol) * 100) : 0,
        weightUtilization: 0,
        volumeUsed: totalVol,
        volumeRemaining: Math.max(0, boxVol - totalVol),
        spaceEfficiency: 0,
      },
      emptySpaces: [],
      visualization: {
        totalItems: items.length,
        totalLayers: 0,
        cargoTypes: [],
        colorLegend: {},
      },
      loadingSequence: [],
      viewAngles: {
        front: { x: 0, y: 0, z: 0 },
        side: { x: 0, y: 0, z: 0 },
        top: { x: 0, y: 0, z: 0 },
        isometric: { x: 0, y: 0, z: 0 },
      },
    } as Visualization3D & { __name?: string };
  }, [mode, airCargoList, truckList, products]);

  const isModeAirLand = mode === "AIR" || mode === "LAND";
  const activeViz = isModeAirLand ? modeVisualization : visualization3D;
  const modeContainerName = modeVisualization?.__name;
  const modeUldShape = modeVisualization?.__uldShape || "box";
  const modeUldCode = modeVisualization?.__uldCode || "";
  // Grouped products (metres) for the WebGL model's own grid packer — same shape
  // the buyer popup hands <AirLandModel3D>.
  const modeProducts = useMemo(() => {
    const palette = [
      "#10b981", "#3b82f6", "#f59e0b", "#ef4444",
      "#8b5cf6", "#ec4899", "#14b8a6", "#f97316",
    ];
    return products
      .filter(
        (p) => p.quantity > 0 && p.length > 0 && p.width > 0 && p.height > 0,
      )
      .map((p, i) => ({
        length: p.length / 1000,
        width: p.width / 1000,
        height: p.height / 1000,
        color: (p as any).color || palette[i % palette.length],
        qty: p.quantity,
        name: p.name,
      }));
  }, [products]);

  // Stats from API
  const totalPackages =
    activeContainerData?.cargoSummary?.totalPackages ??
    activeContainerData?.totalPackages ??
    totalReq?.totalPackages ??
    0;
  const cargoVolume = activeContainerData?.totalVolume ?? 0;
  const cargoWeight = activeContainerData?.totalWeight ?? 0;
  const volUtil = activeContainerData?.utilization?.volumeUtilization ?? 0;
  const wgtUtil = activeContainerData?.utilization?.weightUtilization ?? 0;
  // Title follows the SELECTED size (the toggle) so it updates when you switch
  // 20ft/40ft. The backend ignores the toggle and always returns a 40ft
  // container, so we drive the heading from the user's choice instead.
  const containerName =
    containerSizeOption === "20"
      ? "20ft Standard Container"
      : "40ft Standard Container";

  // Donut chart data from cargo breakdown
  const cargoBreakdown = visualization3D?.cargoBreakdown || {};
  const breakdownEntries = Object.entries(cargoBreakdown);
  const totalBreakdownPackages = breakdownEntries.reduce(
    (s, [, v]: [string, any]) => s + (v?.count || 0),
    0,
  );

  // Build donut segments
  const circumference = 2 * Math.PI * 45; // ~283
  const donutSegments = useMemo(() => {
    const legend = visualization3D?.visualization?.colorLegend || {};
    if (breakdownEntries.length === 0) return [];
    let offset = 0;
    return breakdownEntries.map(([type, val]: [string, any]) => {
      const pct =
        totalBreakdownPackages > 0 ? val.count / totalBreakdownPackages : 0;
      const dash = pct * circumference;
      const seg = {
        type,
        count: val.count,
        color: legend[type] || "#5B8DEF",
        dash,
        offset,
      };
      offset += dash;
      return seg;
    });
  }, [
    breakdownEntries,
    totalBreakdownPackages,
    circumference,
    visualization3D?.visualization?.colorLegend,
  ]);

  const isLoading = isCalcLoading || isVizLoading;

  // Local fallback computed from current `products` state — used whenever the
  // API returns partial/empty data so panels never show unrelated demo numbers.
  const FALLBACK_COLORS = [
    "#5B8DEF",
    "#4CAF50",
    "#FFA726",
    "#AB47BC",
    "#EC407A",
    "#26A69A",
  ];
  const localBreakdown = useMemo(() => {
    return products
      .filter(
        (p) => p.quantity > 0 && p.length > 0 && p.width > 0 && p.height > 0,
      )
      .map((p, i) => ({
        type: p.name || `Product ${i + 1}`,
        count: p.quantity,
        volumeM3: (p.length * p.width * p.height * p.quantity) / 1_000_000_000,
        weightKg: p.weight * p.quantity,
        color: FALLBACK_COLORS[i % FALLBACK_COLORS.length],
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products]);

  const localTotalPackages = localBreakdown.reduce((s, x) => s + x.count, 0);
  const localTotalVolume = localBreakdown.reduce((s, x) => s + x.volumeM3, 0);
  const localTotalWeight = localBreakdown.reduce((s, x) => s + x.weightKg, 0);

  const localDonutSegments = useMemo(() => {
    if (localBreakdown.length === 0 || localTotalPackages === 0) return [];
    let offset = 0;
    return localBreakdown.map((item) => {
      const pct = item.count / localTotalPackages;
      const dash = pct * circumference;
      const seg = {
        type: item.type,
        count: item.count,
        color: item.color,
        dash,
        offset,
      };
      offset += dash;
      return seg;
    });
  }, [localBreakdown, localTotalPackages, circumference]);

  // Prefer API-derived data when available; fall back to local computation.
  const displayDonutSegments =
    donutSegments.length > 0 ? donutSegments : localDonutSegments;
  const displayBreakdownEntries: Array<[string, { count: number }]> =
    breakdownEntries.length > 0
      ? (breakdownEntries as Array<[string, { count: number }]>)
      : (localBreakdown.map((b) => [b.type, { count: b.count }]) as Array<
          [string, { count: number }]
        >);
  const displayTotalPackages =
    totalPackages > 0 ? totalPackages : localTotalPackages;
  const displayCargoVolume = cargoVolume > 0 ? cargoVolume : localTotalVolume;
  const displayCargoWeight = cargoWeight > 0 ? cargoWeight : localTotalWeight;

  return (
    <div className="space-y-6">
      {/* Load-calculator half (delivery modes → cargo table → 3D load plan) —
          hidden when the popup is used as a pricing-only widget. */}
      {!hideLoadSection && (
        <>
      {/* API Error Banner */}
      {apiError && (
        <Alert
          severity="warning"
          onClose={() => setApiError(null)}
          className="text-sm"
        >
          Load calculator: {apiError}. Showing demo data.
        </Alert>
      )}

      {/* Delivery modes */}
      <div className="space-y-3">
        <div className="text-base font-semibold text-[#374151]">Delivery</div>
        <div className="flex flex-wrap gap-2">
          {(["SEA", "LAND", "AIR", "AUTO"] as const).map((m) => (
            <ChipToggle
              key={m}
              label={m}
              active={m === mode}
              onClick={() => setMode(m)}
            />
          ))}
        </div>
      </div>

      {/* Container Size Toggle + Header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="text-lg font-bold text-[#273046]">
          {isModeAirLand
            ? modeContainerName
              ? `${modeContainerName} · ${mode === "AIR" ? "Air ULD" : "Truck"}`
              : mode === "AIR"
                ? "Air ULD"
                : "Truck"
            : `${containerName} #${activeContainer}`}
        </div>
        {/* 20/40 ft chips only apply to SEA containers */}
        {!isModeAirLand && (
          <div className="flex gap-1.5 ml-auto">
            <button
              onClick={() => {
                autoPickRef.current = false; // manual override — stop auto-fit
                setContainerSizeOption("20");
                setActiveContainer(1);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                containerSizeOption === "20"
                  ? "bg-[#5B8DEF] text-white border-[#5B8DEF] shadow-sm"
                  : "bg-white text-[#4B5565] border-[#E6E8EF] hover:bg-gray-50"
              }`}
            >
              20 ft
            </button>
            <button
              onClick={() => {
                autoPickRef.current = false; // manual override — stop auto-fit
                setContainerSizeOption("40");
                setActiveContainer(1);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                containerSizeOption === "40"
                  ? "bg-[#5B8DEF] text-white border-[#5B8DEF] shadow-sm"
                  : "bg-white text-[#4B5565] border-[#E6E8EF] hover:bg-gray-50"
              }`}
            >
              40 ft
            </button>
          </div>
        )}
      </div>

      {/* Container tabs for multiple containers — one per REQUIRED container
          (not just the few the backend packs), horizontally scrollable so any
          container number stays reachable. Tabs past the backend list reuse
          the last packed container's utilization (identical full loads). */}
      {containers.length > 0 && totalContainerTabs > 1 && (
        <div
          className="flex gap-2 mb-2 overflow-x-auto pb-1.5"
          style={{ scrollbarWidth: "thin", WebkitOverflowScrolling: "touch" }}
        >
          {Array.from({ length: totalContainerTabs }, (_, idx: number) => {
            const num = idx + 1;
            const util =
              containers[clampedContainerIdx(num)]?.utilization
                ?.volumeUtilization;
            return (
              <button
                key={num}
                onClick={() => setActiveContainer(num)}
                className={`shrink-0 whitespace-nowrap px-4 py-2 text-sm font-semibold rounded-lg border transition-all ${
                  activeContainer === num
                    ? "bg-[#5B8DEF] text-white border-[#5B8DEF] shadow-sm"
                    : "bg-white text-[#4B5565] border-[#E6E8EF] hover:bg-gray-50"
                }`}
              >
                Container {num}
                {util != null && (
                  <span className="ml-1.5 text-xs font-normal opacity-80">
                    {Math.round(util)}%
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Editable Product Inputs ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-[#374151]">
            Cargo Products
          </div>
          <button
            onClick={addProduct}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#5B8DEF] bg-white border border-[#E6E8EF] rounded-lg hover:bg-[#f0f4ff] hover:border-[#5B8DEF] transition-all"
          >
            <svg
              width="14"
              height="14"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add Product
          </button>
        </div>
        {products.map((prod, idx) => (
          <div
            key={idx}
            className="rounded-lg border border-[#E6E8EF] bg-white overflow-hidden"
          >
            {/* Product title */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-[#f8f9fb] border-b border-[#E6E8EF]">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-semibold text-[#273046] truncate">
                  {prod.name || `Product ${idx + 1}`}
                </span>
                {typeof prod.unitsPerBox === "number" &&
                  prod.unitsPerBox > 0 && (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 whitespace-nowrap"
                      title="AI-estimated units packed per carton"
                    >
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                        <line x1="12" y1="22.08" x2="12" y2="12" />
                      </svg>
                      {prod.unitsPerBox.toLocaleString()} per box
                    </span>
                  )}
              </div>
              {products.length > 1 && (
                <button
                  onClick={() => removeProduct(idx)}
                  className="p-0.5 text-[#9ca3af] hover:text-red-500 transition-colors"
                  title="Remove product"
                >
                  <svg
                    width="12"
                    height="12"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>
            {/* On tablet/desktop the column headers + inputs share fixed widths and
                scroll together horizontally. On phones (< sm) the header row is hidden
                and the inputs wrap onto multiple lines (each input keeps its own
                placeholder + unit label), so nothing is cut off the right edge. */}
            <div className="overflow-x-auto">
            <div className="hidden sm:flex items-center gap-2 px-2 pt-2 pb-0 min-w-max">
              <span className="w-[100px] text-[10px] font-medium text-[#7B8499]">
                Name
              </span>
              <span className="w-[90px] text-[10px] font-medium text-[#7B8499]">
                Type
              </span>
              {isCylinder(prod.cargoType) ? (
                <div className="flex items-center gap-1">
                  <span className="w-[56px] text-[10px] font-medium text-[#7B8499] text-center">
                    Diameter
                  </span>
                  <span className="w-[10px]" />
                  <span className="w-[56px] text-[10px] font-medium text-[#7B8499] text-center">
                    Height
                  </span>
                  <span className="w-[20px]" />
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <span className="w-[56px] text-[10px] font-medium text-[#7B8499] text-center">
                    Length
                  </span>
                  <span className="w-[10px]" />
                  <span className="w-[56px] text-[10px] font-medium text-[#7B8499] text-center">
                    Width
                  </span>
                  <span className="w-[10px]" />
                  <span className="w-[56px] text-[10px] font-medium text-[#7B8499] text-center">
                    Height
                  </span>
                  <span className="w-[20px]" />
                </div>
              )}
              <span className="w-[52px] text-[10px] font-medium text-[#7B8499] text-center">
                Weight
              </span>
              <span className="w-[14px]" />
              <span className="w-[48px] text-[10px] font-medium text-[#7B8499] text-center">
                Qty
              </span>
            </div>
            {/* Input fields — wrap on phones, single scrolling row on sm+ */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 px-2 pb-2 pt-1 sm:min-w-max">
              {/* Name */}
              <input
                value={prod.name}
                onChange={(e) => updateProduct(idx, "name", e.target.value)}
                className="w-[130px] sm:w-[100px] px-2 py-1.5 text-xs border border-[#E6E8EF] rounded-md focus:outline-none focus:border-[#5B8DEF] text-[#273046]"
                placeholder="Name"
              />
              {/* Cargo Type */}
              <select
                value={prod.cargoType}
                onChange={(e) => {
                  const nextType = e.target.value;
                  if (isCylinder(nextType) && !isCylinder(prod.cargoType)) {
                    // Collapse to one diameter when becoming a cylinder.
                    const dia = prod.length || prod.width || 0;
                    updateProductFields(idx, {
                      cargoType: nextType,
                      length: dia,
                      width: dia,
                    });
                  } else {
                    updateProduct(idx, "cargoType", nextType);
                  }
                }}
                className="w-[90px] px-1.5 py-1.5 text-xs border border-[#E6E8EF] rounded-md focus:outline-none focus:border-[#5B8DEF] text-[#273046] bg-white"
              >
                {cargoTypes.map((ct) => (
                  <option key={ct.value} value={ct.value}>
                    {ct.label}
                  </option>
                ))}
              </select>
              {isCylinder(prod.cargoType) ? (
                /* Cylinders (Drum/Roll): Diameter (Ø) + Height only.
                   The diameter drives both length and width of the bounding box. */
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={prod.length}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      // Diameter maps to the backend's "length/diameter" field;
                      // width is mirrored so the payload stays valid everywhere.
                      updateProductFields(idx, { length: v, width: v });
                    }}
                    className="w-[56px] px-1.5 py-1.5 text-xs border border-[#E6E8EF] rounded-md focus:outline-none focus:border-[#5B8DEF] text-[#273046] text-center"
                    placeholder="Ø"
                    title="Diameter"
                    min={1}
                  />
                  <span className="text-[#9ca3af] text-[10px]">×</span>
                  <input
                    type="number"
                    value={prod.height}
                    onChange={(e) =>
                      updateProduct(idx, "height", Number(e.target.value))
                    }
                    className="w-[56px] px-1.5 py-1.5 text-xs border border-[#E6E8EF] rounded-md focus:outline-none focus:border-[#5B8DEF] text-[#273046] text-center"
                    placeholder="H"
                    title="Height"
                    min={1}
                  />
                  <span className="text-[10px] text-[#9ca3af]">mm</span>
                </div>
              ) : (
                /* L × W × H (mm) */
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={prod.length}
                    onChange={(e) =>
                      updateProduct(idx, "length", Number(e.target.value))
                    }
                    className="w-[56px] px-1.5 py-1.5 text-xs border border-[#E6E8EF] rounded-md focus:outline-none focus:border-[#5B8DEF] text-[#273046] text-center"
                    placeholder="L"
                    min={1}
                  />
                  <span className="text-[#9ca3af] text-[10px]">×</span>
                  <input
                    type="number"
                    value={prod.width}
                    onChange={(e) =>
                      updateProduct(idx, "width", Number(e.target.value))
                    }
                    className="w-[56px] px-1.5 py-1.5 text-xs border border-[#E6E8EF] rounded-md focus:outline-none focus:border-[#5B8DEF] text-[#273046] text-center"
                    placeholder="W"
                    min={1}
                  />
                  <span className="text-[#9ca3af] text-[10px]">×</span>
                  <input
                    type="number"
                    value={prod.height}
                    onChange={(e) =>
                      updateProduct(idx, "height", Number(e.target.value))
                    }
                    className="w-[56px] px-1.5 py-1.5 text-xs border border-[#E6E8EF] rounded-md focus:outline-none focus:border-[#5B8DEF] text-[#273046] text-center"
                    placeholder="H"
                    min={1}
                  />
                  <span className="text-[10px] text-[#9ca3af]">mm</span>
                </div>
              )}
              {/* Weight */}
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={prod.weight}
                  onChange={(e) =>
                    updateProduct(idx, "weight", Number(e.target.value))
                  }
                  className="w-[52px] px-1.5 py-1.5 text-xs border border-[#E6E8EF] rounded-md focus:outline-none focus:border-[#5B8DEF] text-[#273046] text-center"
                  placeholder="Wt"
                  min={0.1}
                  step={0.1}
                />
                <span className="text-[10px] text-[#9ca3af]">kg</span>
              </div>
              {/* Quantity */}
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={prod.quantity}
                  onChange={(e) =>
                    updateProduct(idx, "quantity", Number(e.target.value))
                  }
                  className="w-[48px] px-1.5 py-1.5 text-xs border border-[#E6E8EF] rounded-md focus:outline-none focus:border-[#5B8DEF] text-[#273046] text-center"
                  placeholder="Qty"
                  min={1}
                />
                <span className="text-[10px] text-[#9ca3af]">pcs</span>
              </div>
            </div>
            </div>
          </div>
        ))}
      </div>

      {/* 3D Container + Stats Row */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-6 items-stretch">
        {/* 3D Container Model - Interactive 360° */}
        <div className="flex flex-col items-center h-full">
          {isModeAirLand && modeVisualization ? (
            /* AIR/LAND: the SAME real WebGL ULD/truck model as the buyer popup. */
            <div
              className="w-full rounded-2xl border border-[#E6E8EF] bg-[#F7F9FC] overflow-hidden relative"
              style={{ height: 300 }}
            >
              <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 rounded-full bg-white/85 px-2 py-1 text-[11px] font-medium text-[#16a34a] shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-[#16a34a]" />
                Live API Data
              </div>
              <div className="absolute top-2 right-2 z-10 rounded-full bg-white/85 px-2 py-1 text-[11px] text-[#4B5565] shadow-sm">
                drag to rotate
              </div>
              <AirLandModel3D
                modelType={mode === "AIR" ? "air" : "land"}
                uldShape={modeUldShape}
                uldCode={modeUldCode}
                dims={modeVisualization.containerDimensions}
                products={modeProducts}
              />
            </div>
          ) : (
            <Container3DViewer
              containerSize={containerSizeOption}
              containerIndex={activeContainer}
              visualization3D={activeViz}
              overrideDims={
                isModeAirLand ? modeVisualization?.containerDimensions : null
              }
              isLoading={isModeAirLand ? modeLoading : isLoading}
            />
          )}
          {/* Unit & View buttons */}
          <div className="flex items-center gap-3 mt-auto pt-3 w-full">
            <span className="text-sm text-[#5B8DEF] font-medium">
              {isModeAirLand
                ? `${modeContainerName || (mode === "AIR" ? "Air ULD" : "Truck")} · ${
                    mode === "AIR" ? "air cargo" : "road freight"
                  }`
                : `${containersNeeded} × ${containerSizeOption} ft container${
                    containersNeeded > 1 ? "s" : ""
                  } required`}
            </span>
            <span className="text-xs text-[#7B8499]">
              {isModeAirLand
                ? modeVisualization
                  ? `${Math.round(modeVisualization.utilization?.volumeUtilization || 0)}% full`
                  : "—"
                : fillPct > 0
                  ? `${fillPct}% full each`
                  : "—"}
            </span>
          </div>
        </div>

        {/* Right side: Donut + Stats */}
        <div className="flex flex-col gap-6">
          {/* Donut Chart with Legend + Stats Row */}
          <div className="flex items-start gap-6">
            <div className="flex flex-col items-center flex-shrink-0">
              <svg viewBox="0 0 120 120" className="w-28 h-28">
                <circle
                  cx="60"
                  cy="60"
                  r="45"
                  fill="none"
                  stroke="#E6E8EF"
                  strokeWidth="18"
                />
                {displayDonutSegments.length > 0
                  ? displayDonutSegments.map((seg) => (
                      <circle
                        key={seg.type}
                        cx="60"
                        cy="60"
                        r="45"
                        fill="none"
                        stroke={seg.color}
                        strokeWidth="18"
                        strokeDasharray={`${seg.dash} ${circumference - seg.dash}`}
                        strokeDashoffset={-seg.offset}
                        strokeLinecap="round"
                        transform="rotate(-90 60 60)"
                      />
                    ))
                  : null}
              </svg>
              <div className="flex items-center gap-4 mt-2 flex-wrap justify-center">
                {displayDonutSegments.length > 0 ? (
                  displayDonutSegments.map((seg) => (
                    <div key={seg.type} className="flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ background: seg.color }}
                      ></span>
                      <span className="text-xs text-[#4B5565] capitalize truncate max-w-[160px]">
                        {seg.type}
                      </span>
                    </div>
                  ))
                ) : (
                  <span className="text-xs text-[#9ca3af]">No cargo yet</span>
                )}
              </div>
            </div>

            {/* Packages / Volume / Weight */}
            <div className="flex flex-wrap gap-4 flex-1">
              <div>
                <div className="text-xs text-[#7B8499]">Packages</div>
                <div className="flex items-center gap-2">
                  {displayBreakdownEntries.length > 0 ? (
                    displayBreakdownEntries.map(([type, val]) => (
                      <span
                        key={type}
                        className="flex items-center gap-1 text-sm text-[#273046]"
                      >
                        <svg
                          className="w-4 h-4 text-[#7B8499]"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                          />
                        </svg>
                        {val.count}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-[#9ca3af]">—</span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs text-[#7B8499]">Volume</div>
                <div className="text-sm text-[#273046] font-medium">
                  {displayCargoVolume > 0
                    ? `${displayCargoVolume.toFixed(2)} m³`
                    : "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-[#7B8499]">Weight</div>
                <div className="text-sm text-[#273046] font-medium">
                  {displayCargoWeight > 0
                    ? `${displayCargoWeight.toFixed(2)} kg`
                    : "—"}
                </div>
              </div>
            </div>
          </div>

          {/* Total / Cargo Volume / Cargo Weight */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border border-[#E6E8EF] bg-white p-3">
              <div className="text-xs text-[#7B8499]">Total</div>
              <div className="text-[15px] font-semibold text-[#273046]">
                {displayTotalPackages > 0
                  ? `${displayTotalPackages} package${displayTotalPackages === 1 ? "" : "s"}`
                  : "—"}
              </div>
            </div>
            <div className="rounded-lg border border-[#E6E8EF] bg-white p-3">
              <div className="text-xs text-[#7B8499]">Cargo Volume</div>
              <div className="text-[15px] font-semibold text-[#273046]">
                {displayCargoVolume > 0 ? (
                  <>
                    {displayCargoVolume.toFixed(2)} m³{" "}
                    {volUtil > 0 && (
                      <span className="text-[#7B8499] font-normal text-xs">
                        ({Math.round(volUtil)}%)
                      </span>
                    )}
                  </>
                ) : (
                  "—"
                )}
              </div>
            </div>
            <div className="rounded-lg border border-[#E6E8EF] bg-white p-3">
              <div className="text-xs text-[#7B8499]">Cargo Weight</div>
              <div className="text-[15px] font-semibold text-[#273046]">
                {displayCargoWeight > 0 ? (
                  <>
                    {displayCargoWeight.toFixed(2)} kg{" "}
                    {wgtUtil > 0 && (
                      <span className="text-[#7B8499] font-normal text-xs">
                        ({Math.round(wgtUtil)}%)
                      </span>
                    )}
                  </>
                ) : (
                  "—"
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
        </>
      )}

      {/* Address + Voyages — hidden when used as a standalone product-page popup */}
      {!hideShippingSection && (
        <>
          {/* Exactly four inputs: the two addresses the user knows, and the two
              ports they resolve to. Each port list is the nearest ports to its
              city, measured by road distance, best one auto-selected. */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {[
              {
                key: "pickup",
                catalogue: allPorts.origin,
                cityLabel: "Pickup address",
                cityPlaceholder: "Pickup city — e.g. Surat",
                city: pickupCity,
                setCity: setPickupCity,
                portLabel: "Origin port",
                list: originPortList,
                port: originPort,
                setPort: setOriginPort,
                busy: detectingOrigin,
                hint: originHint,
              },
              {
                key: "delivery",
                catalogue: allPorts.dest,
                cityLabel: "Delivery address",
                cityPlaceholder: "Delivery city — e.g. Rotterdam",
                city: deliveryCity,
                setCity: setDeliveryCity,
                portLabel: "Destination port",
                list: destPortList,
                port: destPort,
                setPort: setDestPort,
                busy: detectingDest,
                hint: destHint,
              },
            ].map((side) => (
              <div key={side.key} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-[#7c7c7c]">
                    {side.cityLabel}
                  </label>
                  <input
                    value={side.city}
                    onChange={(e) => side.setCity(e.target.value)}
                    placeholder={side.cityPlaceholder}
                    className="w-full rounded-lg border border-[#e6e8ef] px-3 py-2 text-sm font-medium text-black outline-none placeholder:font-normal placeholder:text-[#9ca3af] focus:border-[#5B8DEF]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-[#7c7c7c]">
                    {side.portLabel}
                    {side.busy && (
                      <span className="ml-2 font-normal text-[#7B8499]">
                        finding nearest…
                      </span>
                    )}
                  </label>
                  <select
                    value={side.port}
                    onChange={(e) => {
                      // A port <select> has no empty option, so "" never comes
                      // from the user: it's the browser blanking the DOM value
                      // when the selected option is re-created during a
                      // re-render, which React reports as a change.
                      delete e.currentTarget.dataset.open;
                      if (e.target.value) side.setPort(e.target.value);
                    }}
                    // Track whether the list is open. A <select> exposes no
                    // "is open" state, so we mark it on mousedown and clear it
                    // whenever it closes (pick, Escape/Enter, or losing focus).
                    onMouseDown={(e) => {
                      e.currentTarget.dataset.open = "1";
                    }}
                    onBlur={(e) => {
                      delete e.currentTarget.dataset.open;
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Escape" || e.key === "Enter")
                        delete e.currentTarget.dataset.open;
                    }}
                    onWheel={(e) => {
                      const el = e.currentTarget as HTMLSelectElement;
                      // List OPEN: leave it alone so it scrolls normally.
                      // Blurring here closed the list and snapped it back to
                      // the selected row mid-scroll.
                      if (el.dataset.open) return;
                      // List CLOSED but focused: the wheel would change the
                      // selection instead of scrolling the page — that is how a
                      // Surat shipment ended up departing Igarka, Russia.
                      // Dropping focus restores normal page scrolling.
                      el.blur();
                    }}
                    className="w-full rounded-lg border border-[#e6e8ef] bg-white px-3 py-2 text-sm text-[#273046] outline-none focus:border-[#5B8DEF]"
                  >
                    {(() => {
                      // With a city typed the list is that city's nearest ports
                      // (labelled with road km); with no city it is the
                      // international catalogue, rate-card ports first.
                      const nearestMode = side.city.trim().length >= 3;
                      const opts = portOptions(
                        nearestMode ? side.list : side.catalogue,
                        side.port,
                      );
                      const render = (p: PortOpt) => (
                        <option key={`${p.value}-${p.label}`} value={p.value}>
                          {p.quotable ? "\u26a1 " : ""}
                          {p.label}
                          {p.roadKm ? ` \u00b7 ${p.roadKm} km` : ""}
                        </option>
                      );
                      if (nearestMode) return opts.map(render);
                      const quotable = opts.filter((p) => p.tier === "quotable");
                      const rest = opts.filter((p) => p.tier !== "quotable");
                      return (
                        <>
                          {quotable.length > 0 && (
                            <optgroup label="\u26a1 Instant rate">
                              {quotable.map(render)}
                            </optgroup>
                          )}
                          {rest.length > 0 && (
                            <optgroup
                              label={`International ports (${rest.length})`}
                            >
                              {rest.map(render)}
                            </optgroup>
                          )}
                        </>
                      );
                    })()}
                  </select>
                  {side.city.trim().length >= 3 && !side.busy && side.hint && (
                    <div className="text-[11px] leading-snug">
                      {side.hint.via === null ? (
                        <span className="text-[#B45309]">
                          Couldn&apos;t locate &ldquo;{side.city.trim()}&rdquo; —
                          pick a port from the list.
                        </span>
                      ) : side.hint.empty ? (
                        <span className="text-[#B45309]">
                          We hold no rates for ports near {side.city.trim()} —
                          choose one from the list.
                        </span>
                      ) : side.hint.via === "city-country" ? (
                        <span className="text-[#7B8499]">
                          Showing ports in {side.hint.country || "that country"} —
                          no coordinates for this city, so they aren&apos;t
                          distance-ranked.
                        </span>
                      ) : (
                        <span className="text-[#7B8499]">
                          Nearest ports by road distance.
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            {freightLoading && (
              <span className="pb-2 text-xs text-[#7B8499]">Loading live rates…</span>
            )}
          </div>

          {freightOptions.length > 0 ? (
            freightOptions.map((o, i) => <VoyageCard key={o.quoteId || i} option={o} />)
          ) : freightLoading ? (
            <div className="rounded-xl border border-[#E6E8EF] bg-white p-6 text-center text-sm text-[#7B8499]">
              Loading live freight rates…
            </div>
          ) : (
            <div className="rounded-xl border border-[#E6E8EF] bg-white p-6 text-center text-sm text-[#7B8499]">
              {(() => {
                // Four very different reasons a lane can't be priced — say
                // which one it is, and what to pick instead.
                const s = laneStatus;
                if (!s)
                  return "No service-provider freight rates for this route yet.";
                const dests = (s.suggestedDests || []).join(", ");
                if (s.reason === "origin-not-priced")
                  return (
                    <>
                      <div className="font-medium text-[#273046]">
                        We don&apos;t price shipments leaving {s.originPort}.
                      </div>
                      <div className="mt-1">
                        Our forwarders have filed rates from{" "}
                        {(s.pricedOrigins || []).length} Indian ports only —{" "}
                        {(s.pricedOrigins || []).slice(0, 5).join(", ")}
                        {(s.pricedOrigins || []).length > 5 ? " and others" : ""}.
                        Choose one of those as the origin port.
                      </div>
                    </>
                  );
                if (s.reason === "destination-not-priced")
                  return (
                    <>
                      <div className="font-medium text-[#273046]">
                        No forwarder has filed a rate into {s.destPort}.
                      </div>
                      <div className="mt-1">
                        {dests
                          ? `Priced ports in the same country: ${dests}.`
                          : "Try a larger gateway port in that country."}
                      </div>
                    </>
                  );
                if (s.reason === "lane-not-priced")
                  return (
                    <>
                      <div className="font-medium text-[#273046]">
                        Both ports are priced, but not this pairing.
                      </div>
                      <div className="mt-1">
                        {s.originPort} → {s.destPort} hasn&apos;t been quoted by
                        any forwarder yet.
                      </div>
                    </>
                  );
                if (s.reason === "rates-expired")
                  return (
                    <>
                      <div className="font-medium text-[#273046]">
                        Rates for {s.originPort} → {s.destPort} expired on{" "}
                        {s.expiredOn}.
                      </div>
                      <div className="mt-1">
                        {s.laneCards} card{s.laneCards === 1 ? "" : "s"} on file
                        for this lane, all lapsed — awaiting a fresh rate book
                        from the forwarder.
                      </div>
                    </>
                  );
                return "No service-provider freight rates for this route yet.";
              })()}
            </div>
          )}
        </>
      )}
    </div>
  );
}
