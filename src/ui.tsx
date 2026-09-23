import { StrictMode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { createPortal } from "react-dom";
import { DialStore, useDialKit } from "dialkit";
import { motionControls as controls, toMotionDocument, fromMotionDocument, documentValues, documentFromValues } from "./motion-system";
import "dialkit/styles.css";
import "./styles.css";
import {
  fitPreviewFrame,
  fitSettingsToFrame,
  generateNodeKeyframes,
  sampleGeneratedKeyframes,
  supportsOrbitOrientation,
  supportsPathGeometry,
} from "./engine";
import { families, freshPreset, familyFor, motionFingerprint, settingsFromSaved } from "./catalog";
import { PresetEditor } from "./preset-editor";
import { referenceDefinition, activeReferencePresets } from "./reference-catalog";
import { referenceScene } from "./reference-engine";
import { migrateSettingsToPercent, parseSettingsJson, serializeSettingsJson } from "./settings-json";
import {
  presetOptions,
  type DialTransition,
  type MotionSettings,
  type PluginToUiMessage,
  type PresetId,
  type SelectionSummary,
  type TargetPreview,
  type UiToPluginMessage,
} from "./types";

const panelId = "orbit-motion-controls-v8";
const legacyPanelId = "orbit-motion-controls-v7";

const builtInPresetSchemaKey = "orbit-built-in-preset-schema";
const builtInPresetSchemaVersion = "24";
let builtInPresetSchemaMigratedInSession = false;

function migrateLegacyDialkitStorage(): void {
  try {
    const currentKey = `dialkit:${panelId}`;
    if (window.localStorage.getItem(currentKey)) return;
    const raw = window.localStorage.getItem(`dialkit:${legacyPanelId}`) ?? window.localStorage.getItem("dialkit:orbit-motion-controls-v6");
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || parsed.version !== 1) return;

    const convertValues = (input: unknown): unknown => {
      if (!input || typeof input !== "object" || Array.isArray(input)) return input;
      const values = input as Record<string,unknown>;
      const id=(values.preset??"circle") as PresetId;
      const settings=settingsFromSaved(values,freshPreset(id));
      return documentValues(toMotionDocument(migrateSettingsToPercent(settings)));
    };

    const presets = Array.isArray(parsed.presets)
      ? parsed.presets.map((preset) => {
          if (!preset || typeof preset !== "object" || Array.isArray(preset)) return preset;
          const record = preset as Record<string, unknown>;
          return { ...record, values: convertValues(record.values) };
        })
      : parsed.presets;
    window.localStorage.setItem(currentKey, JSON.stringify({
      ...parsed,
      values: convertValues(parsed.values),
      baseValues: convertValues(parsed.baseValues),
      presets,
    }));
  } catch {
    // Start clean if persisted state is unavailable or malformed.
  }
}

migrateLegacyDialkitStorage();

function shouldMigrateBuiltInPresets(): boolean {
  if (builtInPresetSchemaMigratedInSession) return false;
  try {
    return window.localStorage.getItem(builtInPresetSchemaKey) !== builtInPresetSchemaVersion;
  } catch {
    return true;
  }
}

function markBuiltInPresetsMigrated(): void {
  builtInPresetSchemaMigratedInSession = true;
  try {
    window.localStorage.setItem(builtInPresetSchemaKey, builtInPresetSchemaVersion);
  } catch {
    // The preset catalog remains usable when Figma disables iframe storage.
  }
}

function applyBuiltInPresetTuning(preset:PresetId):void {
  applySettingsToStore(freshPreset(preset));
}

function applySettingsToStore(settings:MotionSettings):void {
  DialStore.clearActivePreset(panelId);
  DialStore.updateValues(panelId,documentValues(toMotionDocument(settings)) as never);
}

function updateLegacyValue(path:string,value:unknown):void {
  const settings=fromMotionDocument(documentFromValues(DialStore.getValues(panelId)));
  const parts=path.replace(".advanced.",".").split("."),key=parts.pop()!;
  let cursor:any=settings;
  for(const part of parts)cursor=cursor[part];
  cursor[key]=value;
  applySettingsToStore(settings);
}

async function writeClipboardText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    if (!copied) throw new Error("Clipboard access is unavailable.");
  }
}

const cycleEasingPresets = {
  linear: [0, 0, 1, 1],
  easeIn: [0.42, 0, 1, 1],
  easeOut: [0, 0, 0.58, 1],
  easeInOut: [0.42, 0, 0.58, 1],
} as const;

interface SavedEasingPreset {
  id: string;
  name: string;
  ease: [number, number, number, number];
}

const easingStorageKey = "orbit-motion-easing-presets";
const builtInEasings: SavedEasingPreset[] = Object.entries(cycleEasingPresets).map(
  ([id, ease]) => ({
    id,
    name: id === "easeInOut" ? "Ease in out" : id === "easeIn" ? "Ease in" : id === "easeOut" ? "Ease out" : "Linear",
    ease: [...ease],
  }),
);

function readSavedEasings(): SavedEasingPreset[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(easingStorageKey) ?? "[]") as SavedEasingPreset[];
    return parsed.filter((preset) => (
      typeof preset.id === "string" && typeof preset.name === "string" &&
      Array.isArray(preset.ease) && preset.ease.length === 4
    ));
  } catch {
    return [];
  }
}

function writeSavedEasings(presets: SavedEasingPreset[]): void {
  try {
    window.localStorage.setItem(easingStorageKey, JSON.stringify(presets));
  } catch {
    // Presets remain available for the current session when storage is unavailable.
  }
}

function EasingPresetManager({ transition }: { transition: DialTransition }) {
  const [saved, setSaved] = useState(readSavedEasings);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const ease = transition.type === "easing" && Array.isArray(transition.ease)
    ? transition.ease
    : cycleEasingPresets.linear;
  const presets = [...saved, ...builtInEasings];
  const matching = presets.find((preset) => preset.ease.every((value, index) => value === ease[index]));
  const selectedId = matching?.id ?? "custom";

  useEffect(() => {
    if (!open) return undefined;
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const applyPreset = (id: string) => {
    const preset = presets.find((item) => item.id === id);
    if (!preset) return;
    updateLegacyValue("motion.fullCycle", {
      type: "easing",
      duration: transition.type === "easing" ? transition.duration ?? 1 : 1,
      ease: [...preset.ease],
    });
    setOpen(false);
  };
  const savePreset = () => {
    const usedNames = new Set(presets.map((preset) => preset.name));
    let suffix = saved.length + 1;
    while (usedNames.has(`Easing ${suffix}`)) suffix += 1;
    const next = [{
      id: `custom-${Date.now()}`,
      name: `Easing ${suffix}`,
      ease: [...ease] as [number, number, number, number],
    }, ...saved];
    setSaved(next);
    writeSavedEasings(next);
  };
  const deletePreset = (id: string) => {
    const next = saved.filter((preset) => preset.id !== id);
    setSaved(next);
    writeSavedEasings(next);
    if (selectedId === id) applyPreset("linear");
  };

  const toggleOpen = () => {
    if (!open) {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) setPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
    setOpen((current) => !current);
  };

  return (
    <div className="dialkit-panel-toolbar orbit-easing-toolbar">
      <button className="dialkit-toolbar-add" type="button" onClick={savePreset} title="Add easing preset" aria-label="Add easing preset">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
      </button>
      <div className="dialkit-preset-manager">
        <button ref={triggerRef} className="dialkit-preset-trigger" type="button" onClick={toggleOpen} data-open={String(open)} aria-haspopup="menu" aria-expanded={open} aria-label="Easing presets">
          <span className="dialkit-preset-label">{matching?.name ?? "Custom"}</span>
          <svg className="dialkit-select-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m7 9 5 5 5-5" /></svg>
        </button>
        {open && createPortal(
          <div ref={dropdownRef} className="dialkit-root dialkit-preset-dropdown" role="menu" style={{ position: "fixed", top: position.top, left: position.left, minWidth: position.width }}>
            {presets.map((preset) => {
              const deletable = preset.id.startsWith("custom-");
              return (
                <div className="dialkit-preset-item" data-active={String(preset.id === selectedId)} key={preset.id} onClick={() => applyPreset(preset.id)}>
                  <button className="dialkit-preset-name" type="button">{preset.name}</button>
                  {deletable && (
                    <button className="dialkit-preset-delete" type="button" title={`Delete ${preset.name}`} onClick={(event) => { event.stopPropagation(); deletePreset(preset.id); }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 10v6M14 10v6" /></svg>
                    </button>
                  )}
                </div>
              );
            })}
          </div>,
          document.body,
        )}
      </div>
    </div>
  );
}

function parsePathPoints(value: string): Array<[number, number]> {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((point): point is [number, number] => (
      Array.isArray(point) && point.length === 2 &&
      typeof point[0] === "number" && typeof point[1] === "number"
    ));
  } catch {
    return [];
  }
}

function GeometryPathEditor({ settings, target }: { settings: MotionSettings; target: TargetPreview }) {
  const [points, setPoints] = useState<Array<[number, number]>>(
    () => parsePathPoints(settings.geometry.customPath),
  );
  const drawing = useRef(false);
  const draft = useRef<Array<[number, number]>>(points);
  const activeHandle = useRef<"x" | "y" | "rotation" | "tilt" | null>(null);
  const editorRef = useRef<SVGSVGElement>(null);
  const frameWidth = target.frameWidth || 720;
  const frameHeight = target.frameHeight || 400;
  const { width: viewWidth, height: viewHeight } = fitPreviewFrame(frameWidth, frameHeight, 328, 240);
  const source = target.items[0] ?? { width: 80, height: 100, offsetX: 0, offsetY: 0 };
  const fitted = fitSettingsToFrame(
    settings,
    frameWidth,
    frameHeight,
    source.width,
    source.height,
  );
  const rawRadiusX = fitted.geometry.radiusX / frameWidth * viewWidth;
  const rawRadiusY = fitted.geometry.radiusY / frameHeight * viewHeight;
  const circleRotation = settings.geometry.circleRotation ?? 0;
  const orbitOrientation = supportsOrbitOrientation(settings.geometry) && settings.geometry.shape !== "custom-path";
  // The editable ellipse is the projected base shape, independent of pulse,
  // depth waves and the number of turns in its animation.
  const ellipseTiltScale = orbitOrientation && settings.geometry.shape === "ellipse"
    ? Math.cos(settings.geometry.tilt * Math.PI / 180) : 1;
  const projectionAngle = circleRotation * Math.PI / 180;
  const rawProjectedY = rawRadiusY * Math.abs(ellipseTiltScale);
  const ellipseBoundsX = Math.hypot(rawRadiusX * Math.cos(projectionAngle), rawProjectedY * Math.sin(projectionAngle));
  const ellipseBoundsY = Math.hypot(rawRadiusX * Math.sin(projectionAngle), rawProjectedY * Math.cos(projectionAngle));
  // Reserve room for both the side rotation handle and the tilt guide.
  // This is a camera scale only; the animation's dimensions stay unchanged.
  const editorScale = settings.geometry.shape === "ellipse" ? Math.min(1,
    Math.max(1, viewWidth / 2 - 40) / Math.max(1, ellipseBoundsX),
    Math.max(1, viewHeight / 2 - 30) / Math.max(1, ellipseBoundsY),
  ) : 1;
  const radiusX = rawRadiusX * editorScale;
  const radiusY = rawRadiusY * editorScale;
  const projectedRadiusY = radiusY * Math.abs(ellipseTiltScale);
  const renderOrbitPreview = !supportsPathGeometry(settings.geometry.shape);
  const orbitPathCount = settings.geometry.shape === "sphere"
    ? Math.min(Math.max(target.count || 9, 2), 24)
    : 1;
  const orbitPreviewPaths = renderOrbitPreview
    ? Array.from({ length: orbitPathCount }, (_, index) => {
        const frames = generateNodeKeyframes({
          ...fitted,
          motion: {
            ...fitted.motion,
            keyframes: 48,
            fullCycle: { type: "easing", duration: 1, ease: [0, 0, 1, 1] },
          },
        }, index, orbitPathCount);
        const scale = viewWidth / frameWidth;
        return frames.map((frame) => (
          `${viewWidth / 2 + frame.x * scale},${viewHeight / 2 + frame.y * scale}`
        )).join(" ");
      })
    : [];
  const centerX = viewWidth / 2;
  const centerY = viewHeight / 2;
  const orbitRotationRadians = circleRotation * Math.PI / 180;
  const rotationCos = Math.cos(orbitRotationRadians);
  const rotationSin = Math.sin(orbitRotationRadians);
  const rotationRoom = Math.min(
    (centerX - 10) / Math.max(Math.abs(rotationCos), 1e-6),
    (centerY - 10) / Math.max(Math.abs(rotationSin), 1e-6),
  );
  const orientationRadius = Math.min(radiusX + 20, rotationRoom);
  const rotationAnchor = {
    x: centerX + rotationCos * Math.max(0, orientationRadius - 20),
    y: centerY + rotationSin * Math.max(0, orientationRadius - 20),
  };
  const rotationHandle = {
    x: centerX + rotationCos * orientationRadius,
    y: centerY + rotationSin * orientationRadius,
  };
  const tiltTravel = Math.max(20, Math.min(56, viewHeight / 2 - 16));
  const tiltGuideX = 14;
  const tiltHandleY = centerY - (settings.geometry.tilt / 90) * tiltTravel;

  useEffect(() => {
    if (!drawing.current) {
      const next = parsePathPoints(settings.geometry.customPath);
      setPoints(next);
      draft.current = next;
    }
  }, [settings.geometry.customPath]);

  const pointFromEvent = (event: React.PointerEvent<SVGSVGElement>): [number, number] => {
    const bounds = editorRef.current!.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)),
      Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)),
    ];
  };
  const start = (event: React.PointerEvent<SVGSVGElement>) => {
    if (settings.geometry.shape !== "custom-path") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    draft.current = [pointFromEvent(event)];
    setPoints(draft.current);
  };
  const move = (event: React.PointerEvent<SVGSVGElement>) => {
    if (activeHandle.current) {
      const bounds = editorRef.current!.getBoundingClientRect();
      const dx = event.clientX - bounds.left - bounds.width / 2;
      const dy = event.clientY - bounds.top - bounds.height / 2;
      if (activeHandle.current === "rotation") {
        const degrees = Math.atan2(dy, dx) * 180 / Math.PI;
        updateLegacyValue("geometry.circleRotation", Math.round(degrees));
        return;
      }
      if (activeHandle.current === "tilt") {
        const dyInViewBox = dy * viewHeight / bounds.height;
        const normalized = Math.min(1, Math.max(-1, -dyInViewBox / tiltTravel));
        updateLegacyValue("geometry.tilt", Math.round(normalized * 90));
        return;
      }
      const radians = -circleRotation * Math.PI / 180;
      const localX = dx * Math.cos(radians) - dy * Math.sin(radians);
      const localY = dx * Math.sin(radians) + dy * Math.cos(radians);
      if (activeHandle.current === "x") {
        const normalized = Math.abs(localX) / bounds.width / editorScale;
        updateLegacyValue("geometry.radiusX", Math.round(normalized * 100));
      } else {
        const normalized = Math.abs(localY) / bounds.height / editorScale / Math.max(0.05, Math.abs(ellipseTiltScale));
        updateLegacyValue("geometry.radiusY", Math.round(normalized * 100));
      }
      return;
    }
    if (!drawing.current) return;
    const point = pointFromEvent(event);
    const last = draft.current[draft.current.length - 1];
    if (last && Math.hypot(point[0] - last[0], point[1] - last[1]) < 0.015) return;
    draft.current = [...draft.current, point].slice(-96);
    setPoints(draft.current);
  };
  const finish = () => {
    activeHandle.current = null;
    if (!drawing.current) return;
    drawing.current = false;
    if (draft.current.length >= 2) {
      updateLegacyValue("geometry.customPath", JSON.stringify(draft.current));
    }
  };
  const startHandle = (
    event: React.PointerEvent<SVGCircleElement>,
    handle: "x" | "y" | "rotation" | "tilt",
  ) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    activeHandle.current = handle;
  };
  const polyline = points.map(([x, y]) => `${x * viewWidth},${y * viewHeight}`).join(" ");
  const pathIsClosed = points.length > 2 && Math.hypot(
    points[0][0] - points[points.length - 1][0],
    points[0][1] - points[points.length - 1][1],
  ) < 0.001;

  return (
    <div className="orbit-path-controls">
    <svg ref={editorRef} className={`orbit-path-editor ${renderOrbitPreview ? "orbit-path-editor-preview" : ""}`} style={{ width: `${viewWidth}px` }} viewBox={`0 0 ${viewWidth} ${viewHeight}`} role="img" aria-label={renderOrbitPreview ? "3D trajectory preview" : settings.geometry.shape === "custom-path" ? pathIsClosed ? "Edit a closed motion path" : "Draw an open motion path" : settings.geometry.dynamicScale ? "Ellipse fitted automatically to the selected frame" : "Adjust ellipse width and height"} onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish}>
      <rect width={viewWidth} height={viewHeight} rx="10" />
      <path className="orbit-path-grid" d={`M${centerX} 0V${viewHeight}M0 ${centerY}H${viewWidth}`} />
      {renderOrbitPreview ? orbitPreviewPaths.map((previewPath, index) => (
        <polyline className="orbit-path-line orbit-path-line-preview" points={previewPath} key={index} />
      )) : settings.geometry.shape === "ellipse" ? (
        <g transform={`rotate(${circleRotation} ${centerX} ${centerY})`}>
          <ellipse className="orbit-path-line" cx={centerX} cy={centerY} rx={radiusX} ry={projectedRadiusY} />
          {!settings.geometry.dynamicScale && !orbitOrientation && <circle className="orbit-path-handle" cx={centerX + radiusX} cy={centerY} r="6" onPointerDown={(event) => startHandle(event, "x")} />}
          {!settings.geometry.dynamicScale && !orbitOrientation && <circle className="orbit-path-handle" cx={centerX} cy={centerY + projectedRadiusY} r="6" onPointerDown={(event) => startHandle(event, "y")} />}
        </g>
      ) : points.length > 1 ? <polyline className="orbit-path-line" points={polyline} /> : null}
      {orbitOrientation && (
        <g className="orbit-orientation-handles">
          {!settings.geometry.dynamicScale && (
            <g transform={`rotate(${circleRotation} ${centerX} ${centerY})`}>
              <circle className="orbit-path-handle" cx={centerX + radiusX} cy={centerY} r="6" aria-label="Adjust orbit width" onPointerDown={(event) => startHandle(event, "x")} />
              <circle className="orbit-path-handle" cx={centerX} cy={centerY + projectedRadiusY} r="6" aria-label="Adjust orbit height" onPointerDown={(event) => startHandle(event, "y")} />
            </g>
          )}
          <line className="orbit-handle-guide" x1={rotationAnchor.x} y1={rotationAnchor.y} x2={rotationHandle.x} y2={rotationHandle.y} />
          <circle className="orbit-path-handle orbit-rotation-handle" cx={rotationHandle.x} cy={rotationHandle.y} r="6" aria-label="Rotate orbit" onPointerDown={(event) => startHandle(event, "rotation")} />
          <line className="orbit-handle-guide" x1={tiltGuideX} y1={centerY - tiltTravel} x2={tiltGuideX} y2={centerY + tiltTravel} />
          <circle className="orbit-path-handle orbit-tilt-handle" cx={tiltGuideX} cy={tiltHandleY} r="6" aria-label="Tilt orbit" onPointerDown={(event) => startHandle(event, "tilt")} />
        </g>
      )}
    </svg>
    </div>
  );
}

function send(message: UiToPluginMessage): void {
  parent.postMessage({ pluginMessage: message }, "*");
}

function usePreviewTime(duration: number): number {
  const [time, setTime] = useState(0);
  const started = useRef(performance.now());

  useEffect(() => {
    let frame = 0;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setTime(duration * 0.16);
      return undefined;
    }
    started.current = performance.now();
    const tick = (now: number) => {
      setTime(((now - started.current) / 1000) % Math.max(duration, 0.1));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration]);

  return time;
}

function readFigmaTheme(): "light" | "dark" {
  if (document.body.classList.contains("figma-light")) return "light";
  if (document.body.classList.contains("figma-dark")) return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function useFigmaTheme(): "light" | "dark" {
  const [theme, setTheme] = useState(readFigmaTheme);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const update = () => setTheme(readFigmaTheme());
    const observer = new MutationObserver(update);
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    media.addEventListener("change", update);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", update);
    };
  }, []);

  return theme;
}

function OrbitPreview({
  settings,
  target,
  onBack,
}: {
  settings: MotionSettings;
  target: TargetPreview;
  onBack: () => void;
}) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [previewSize, setPreviewSize] = useState({ width: 328, height: 180 });
  const [pinned, setPinned] = useState(() => {
    try {
      return window.localStorage.getItem("orbit-motion-preview-pinned") === "true";
    } catch {
      return false;
    }
  });
  const time = usePreviewTime(settings.motion.duration);
  useEffect(() => {
    const element = previewRef.current;
    if (!element) return undefined;
    const updateSize = () => {
      setPreviewSize({ width: element.clientWidth, height: element.clientHeight });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const itemCount = target.count > 0 ? target.count : 9;
  const drawCount = Math.min(itemCount, 18);
  const previewScale = Math.min(previewSize.width/(target.frameWidth||720),previewSize.height/(target.frameHeight||400));
  const cards = referenceDefinition(settings) ? referenceScene(settings,Array.from({length:itemCount},(_,i)=>target.items[i]??{width:72,height:92}),target.frameWidth||720,target.frameHeight||400,time).map(card=>({
    index:card.source,layer:card.layer,layerCount:1,width:card.width*previewScale,height:card.height*previewScale,offsetX:0,offsetY:0,
    point:{x:card.x-(target.frameWidth||720)/2,y:card.y-(target.frameHeight||400)/2,z:0,scaleX:1,scaleY:1,rotation:card.rotation,opacity:card.opacity??1,radius:card.radius,shade:card.shade},
  })) : Array.from({ length: drawCount }, (_, previewIndex) => {
    const index = itemCount <= drawCount
      ? previewIndex
      : Math.floor((previewIndex / drawCount) * itemCount);
    const sourceSize = target.items[index] ?? {
      width: 72,
      height: 92,
      offsetX: 0,
      offsetY: 0,
    };
    const fittedSettings = fitSettingsToFrame(
      settings,
      target.frameWidth || 720,
      target.frameHeight || 400,
      sourceSize.width,
      sourceSize.height,
      itemCount,
    );
    const frames = generateNodeKeyframes(fittedSettings, index, itemCount);
    const width = Math.max(1, sourceSize.width * previewScale);
    const height = Math.max(1, sourceSize.height * previewScale);
    const configuredLayers = Number(settings.other.serviceLayers ?? (settings.other.depthSplit === false ? "0" : "2"));
    const layerCount = Math.max(
      configuredLayers,
      settings.geometry.shape === "falling-stack" ? 4 : 0,
      settings.appearance.farBlur > 0 || settings.appearance.frontShadow > 0 ? 2 : 0,
    );
    const layers = layerCount > 1 ? Array.from({ length: layerCount }, (_, layer) => layer) : [-1];
    return layers.map((layer) => {
      const point = sampleGeneratedKeyframes(
        frames,
        time,
        // Full-cycle timing is already baked into generateNodeKeyframes.
        // Interpolating those samples with it again would double-apply easing.
        { type: "easing", duration: 1, ease: [0, 0, 1, 1] },
      );
      if (layer >= 0) {
        const normalizedDepth = fittedSettings.geometry.depth > 0
          ? Math.max(0, Math.min(0.999999, (point.z / fittedSettings.geometry.depth + 1) / 2))
          : 0.5;
        const band = point.stackOrder === undefined ? Math.floor(normalizedDepth * layerCount)
          : Math.round(point.stackOrder / 3 * (layerCount - 1));
        point.opacity = band === layer ? point.opacity : 0;
      }
      return {
        index,
        layer,
        layerCount,
        point,
        width,
        height,
        offsetX: sourceSize.offsetX,
        offsetY: sourceSize.offsetY,
      };
    });
  }).flat();

  const togglePinned = () => {
    setPinned((current) => {
      const next = !current;
      try {
        window.localStorage.setItem("orbit-motion-preview-pinned", String(next));
      } catch {
        // Sticky preview still works when storage is unavailable.
      }
      return next;
    });
  };

  return (
    <div
      ref={previewRef}
      className={`preview ${pinned ? "pinned" : ""}`}
      aria-label="Live animation preview"
    >
      <div className="preview-grid" />
      <div className="preview-origin" />
      <div style={{position:"absolute",inset:0,clipPath:referenceDefinition(settings)?`inset(${Math.max(0,(previewSize.height-(target.frameHeight||400)*previewScale)/2)}px ${Math.max(0,(previewSize.width-(target.frameWidth||720)*previewScale)/2)}px)`:undefined}}>
      {cards.map(({ index, layer, layerCount, point, width, height, offsetX, offsetY }) => (
        <div
          className={`preview-card preview-card-${index % 5}`}
          key={`${layer}-${index}`}
          style={{
            width,
            height,
            marginLeft: -width / 2,
            marginTop: -height / 2,
            opacity: point.opacity,
            borderRadius:point.radius===undefined?undefined:point.radius*previewScale,
            filter: layer === 0 && settings.appearance.farBlur > 0
              ? `blur(${settings.appearance.farBlur * previewScale}px)`
              : point.shade?`brightness(${1-point.shade})`:undefined,
            boxShadow: layer === layerCount - 1 && settings.appearance.frontShadow > 0
              ? `0 ${settings.appearance.frontShadow * previewScale * .5}px ${settings.appearance.frontShadow * previewScale}px rgba(0,0,0,.3)`
              : undefined,
            zIndex: (layer < 0 ? 0 : layer * drawCount) + index,
            transform: `translate3d(${(point.x + (settings.other.centerBeforeApply ? 0 : offsetX)) * previewScale}px, ${(point.y + (settings.other.centerBeforeApply ? 0 : offsetY)) * previewScale}px, 0) rotate(${point.rotation}deg) scale(${point.scaleX}, ${point.scaleY})`,
          }}
        >
          <span>{String(index + 1).padStart(2, "0")}</span>
        </div>
      ))}
      </div>
      <button
        className="preview-back"
        type="button"
        aria-label="Choose preset"
        title="Presets"
        onClick={onBack}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      </button>
      <button
        className="dialkit-root dialkit-toolbar-add preview-pin"
        type="button"
        aria-label={pinned ? "Unpin preview" : "Pin preview"}
        aria-pressed={pinned}
        title={pinned ? "Unpin preview" : "Pin preview while scrolling"}
        onClick={togglePinned}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 17v5M5 17h14M6 17l1-5 2-2V5L7 3h10l-2 2v5l2 2 1 5H6Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}

function settingsForPreset(settings: MotionSettings, preset: PresetId): MotionSettings {
  return freshPreset(preset, settings);
}

function PresetThumbnail({
  settings,
  target,
  time,
}: {
  settings: MotionSettings;
  target: TargetPreview;
  time: number;
}) {
  const itemCount = target.count > 0 ? target.count : 9;
  const drawCount = Math.min(itemCount, 9);
  const frameWidth = target.frameWidth || 720;
  const frameHeight = target.frameHeight || 400;
  const previewScale = Math.min(132 / frameWidth, 84 / frameHeight);
  const cardFrames = useMemo(() => (referenceDefinition(settings)?[]:
    Array.from({ length: drawCount }, (_, index) => {
      const source = target.items[index] ?? { width: 72, height: 92, offsetX: 0, offsetY: 0 };
      const fitted = fitSettingsToFrame(settings, frameWidth, frameHeight, source.width, source.height, itemCount);
      const thumbnailSize = {width:source.width*previewScale,height:source.height*previewScale};
      return {
        index,
        frames: generateNodeKeyframes(fitted, index, itemCount),
        width: thumbnailSize.width,
        height: thumbnailSize.height,
      };
    })
  ), [drawCount, frameHeight, frameWidth, itemCount, previewScale, settings, target.items]);
  const nativeCards=referenceDefinition(settings)?referenceScene(settings,Array.from({length:itemCount},(_,i)=>target.items[i]??{width:72,height:92}),frameWidth,frameHeight,time):null;
  const cards = nativeCards ? nativeCards.map(card=>({index:card.source,width:card.width*previewScale,height:card.height*previewScale,point:{x:card.x-frameWidth/2,y:card.y-frameHeight/2,z:card.layer,opacity:card.opacity??1,rotation:card.rotation,scaleX:1,scaleY:1,stackOrder:card.layer,radius:card.radius,shade:card.shade}})) : cardFrames.map(({ frames, ...card }) => ({
    ...card,
    point: sampleGeneratedKeyframes(
      frames,
      time % Math.max(settings.motion.duration, 0.1),
      { type: "easing", duration: 1, ease: [0, 0, 1, 1] },
    ),
  })).sort((a, b) => (a.point.stackOrder ?? a.point.z) - (b.point.stackOrder ?? b.point.z));

  return (
    <div className="preset-thumbnail" aria-hidden="true">
      <div className="preset-thumbnail-grid" />
      {cards.map(({ index, point, width, height }, order) => (
        <span
          className={`preset-thumbnail-card preview-card-${index % 5}`}
          key={`${index}-${order}`}
          style={{
            width,
            height,
            marginLeft: -width / 2,
            marginTop: -height / 2,
            opacity: point.opacity,
            borderRadius:point.radius===undefined?undefined:point.radius*previewScale,
            filter: settings.appearance.farBlur > 0 && point.z < 0
              ? `blur(${settings.appearance.farBlur * previewScale}px)`
              : point.shade?`brightness(${1-point.shade})`:undefined,
            boxShadow: settings.appearance.frontShadow > 0 && point.z >= 0
              ? `0 ${settings.appearance.frontShadow * previewScale * .5}px ${settings.appearance.frontShadow * previewScale}px rgba(0,0,0,.3)`
              : undefined,
            zIndex: order,
            transform: `translate3d(${point.x * previewScale}px, ${point.y * previewScale}px, 0) rotate(${point.rotation}deg) scale(${point.scaleX}, ${point.scaleY})`,
          }}
        />
      ))}
    </div>
  );
}

function PresetGallery({
  settings,
  target,
  onSelect,
  saved,
  onLoad,
  onCurrent,
  onSave,
  onDelete,
  theme,
}: {
  settings: MotionSettings;
  target: TargetPreview;
  onSelect: (preset: PresetId) => void;
  saved: {id: string; name: string; settings: MotionSettings}[];
  onLoad: (id: string) => void;
  onCurrent: () => void;
  onSave: () => void;
  onDelete: (id: string) => void;
  theme: "light" | "dark";
}) {
  const time = usePreviewTime(3600);
  const fingerprint = motionFingerprint(settings);
  const currentSaved = saved.find((item) => motionFingerprint(item.settings) === fingerprint);
  const showCurrent = Boolean(currentSaved) || fingerprint !== motionFingerprint(freshPreset(settings.preset, settings));
  const galleryPresets = useMemo(() => (
    [
      ...families.filter(family=>family.name.startsWith("Orbit ")),
      ...activeReferencePresets.map(p=>({name:p.label,description:"Editable native animation",variants:[{id:p.id,name:p.label}]})),
      ...families.filter(family=>!family.name.startsWith("Orbit ")),
    ].map((family) => ({
      value: family.variants[0].id,
      label: family.name,
      description: family.description,
      settings: settingsForPreset(settings, family.variants[0].id),
    }))
  ), [settings]);

  return (
    <main className="gallery-page">
      <section className="preset-gallery" aria-label="Animation presets">
        {showCurrent && <div className="preset-gallery-item saved-preset-row dialkit-root" data-theme={theme}>
          <button className="saved-preset-preview" type="button" title={currentSaved ? `Current · ${currentSaved.name}` : "Current"} onClick={onCurrent}><PresetThumbnail settings={settings} target={target} time={time} /><span>Current</span></button>
          <button className="dialkit-toolbar-add saved-preset-save" type="button" aria-label="Save current preset" title={currentSaved ? "Already saved" : "Save current preset"} disabled={Boolean(currentSaved)} onClick={onSave}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M5 3h12l4 4v14H3V3h2Zm2 0v6h10V3M7 21v-8h10v8" /></svg></button>
          {currentSaved && <button className="dialkit-toolbar-add" type="button" aria-label={`Delete ${currentSaved.name}`} title="Delete saved preset" onClick={() => onDelete(currentSaved.id)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 10v8m4-8v8" /></svg></button>}
        </div>}
        {saved.filter((item) => item.id !== currentSaved?.id).map((item) => <div className="preset-gallery-item saved-preset-row dialkit-root" data-theme={theme} key={item.id}>
          <button className="saved-preset-preview" type="button" onClick={() => onLoad(item.id)}><PresetThumbnail settings={item.settings} target={target} time={time} /><span>{item.name}</span></button>
          <button className="dialkit-toolbar-add" type="button" aria-label={`Delete ${item.name}`} title="Delete saved preset" onClick={() => onDelete(item.id)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14" /></svg></button>
        </div>)}
        {galleryPresets.map((preset, index) => {
          return (
            <button
              className="preset-gallery-item preset-gallery-card"
              type="button"
              key={preset.value}
              title={preset.description}
              onClick={() => onSelect(preset.value)}
              style={{ "--gallery-index": index } as React.CSSProperties}
            >
              <PresetThumbnail settings={preset.settings} target={target} time={time} />
              <span className="preset-gallery-name">{preset.label}</span>
              <svg className="preset-gallery-arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="m9 18 6-6-6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          );
        })}
      </section>
      <OverlayScrollbar />
      <ResizeHandle />
    </main>
  );
}

const windowHeightKey = "orbit-motion-window-height";
const minWindowHeight = 420;
const maxWindowHeight = 960;

function readSavedWindowHeight(): number | null {
  try {
    const saved = Number(window.localStorage.getItem(windowHeightKey));
    return Number.isFinite(saved) && saved >= minWindowHeight && saved <= maxWindowHeight
      ? saved
      : null;
  } catch {
    return null;
  }
}

function saveWindowHeight(height: number): void {
  try {
    window.localStorage.setItem(windowHeightKey, String(height));
  } catch {
    // Figma may disable storage for a sandboxed plugin UI. Resizing still works.
  }
}

function ResizeHandle() {
  const [dragging, setDragging] = useState(false);
  const [height, setHeight] = useState(() => window.innerHeight);
  const dragStart = useRef({ screenY: 0, height: window.innerHeight });
  const pendingFrame = useRef(0);
  const pendingHeight = useRef(window.innerHeight);

  const resize = useCallback((nextHeight: number) => {
    const clamped = Math.round(
      Math.min(maxWindowHeight, Math.max(minWindowHeight, nextHeight)),
    );
    setHeight(clamped);
    pendingHeight.current = clamped;
    saveWindowHeight(clamped);

    if (pendingFrame.current) return;
    pendingFrame.current = requestAnimationFrame(() => {
      pendingFrame.current = 0;
      send({ type: "resize", height: pendingHeight.current });
    });
  }, []);

  useEffect(() => {
    const saved = readSavedWindowHeight();
    if (saved !== null) resize(saved);
    return () => {
      if (pendingFrame.current) cancelAnimationFrame(pendingFrame.current);
    };
  }, [resize]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = { screenY: event.screenY, height: window.innerHeight };
    setDragging(true);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    resize(dragStart.current.height + event.screenY - dragStart.current.screenY);
  };

  const stopDragging = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragging(false);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    resize(height + (event.key === "ArrowDown" ? 40 : -40));
  };

  return (
    <div
      className={`resize-handle ${dragging ? "dragging" : ""}`}
      role="separator"
      aria-label="Resize plugin height"
      aria-orientation="horizontal"
      aria-valuemin={minWindowHeight}
      aria-valuemax={maxWindowHeight}
      aria-valuenow={height}
      tabIndex={0}
      title="Drag to resize · Arrow keys change height"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      onKeyDown={onKeyDown}
    >
      <span className="resize-grip" />
    </div>
  );
}

function OverlayScrollbar() {
  const [state, setState] = useState({ visible: false, scrollable: false, top: 0, height: 36 });
  const metrics = useRef({ maxScroll: 0, maxThumbTop: 0 });
  const drag = useRef({ active: false, y: 0, scrollY: 0 });
  const hideTimer = useRef(0);

  const update = useCallback((show: boolean) => {
    const root = document.documentElement;
    const trackHeight = Math.max(0, window.innerHeight - 18);
    const maxScroll = Math.max(0, root.scrollHeight - window.innerHeight);
    const height = Math.max(36, trackHeight * (window.innerHeight / Math.max(root.scrollHeight, 1)));
    const maxThumbTop = Math.max(0, trackHeight - height);
    const top = maxScroll > 0 ? (window.scrollY / maxScroll) * maxThumbTop : 0;
    metrics.current = { maxScroll, maxThumbTop };
    setState((current) => ({
      visible: show ? true : current.visible,
      scrollable: maxScroll > 1,
      top,
      height,
    }));
  }, []);

  const showTemporarily = useCallback(() => {
    update(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      if (!drag.current.active) {
        setState((current) => ({ ...current, visible: false }));
      }
    }, 700);
  }, [update]);

  useEffect(() => {
    const onResize = () => update(false);
    const sizeObserver = new ResizeObserver(onResize);
    sizeObserver.observe(document.body);
    window.addEventListener("scroll", showTemporarily, { passive: true });
    window.addEventListener("wheel", showTemporarily, { passive: true });
    window.addEventListener("resize", onResize);
    const frame = requestAnimationFrame(() => update(false));
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(hideTimer.current);
      sizeObserver.disconnect();
      window.removeEventListener("scroll", showTemporarily);
      window.removeEventListener("wheel", showTemporarily);
      window.removeEventListener("resize", onResize);
    };
  }, [showTemporarily, update]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { active: true, y: event.clientY, scrollY: window.scrollY };
    window.clearTimeout(hideTimer.current);
    setState((current) => ({ ...current, visible: true }));
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current.active) return;
    const ratio = metrics.current.maxScroll / Math.max(metrics.current.maxThumbTop, 1);
    window.scrollTo(0, drag.current.scrollY + (event.clientY - drag.current.y) * ratio);
  };

  const stopDragging = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    drag.current.active = false;
    showTemporarily();
  };

  if (!state.scrollable) return null;

  return (
    <div className={`overlay-scrollbar ${state.visible ? "visible" : ""}`} aria-hidden="true">
      <div
        className="overlay-scrollbar-thumb"
        style={{ height: state.height, transform: `translateY(${state.top}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
      />
    </div>
  );
}

function App() {
  const theme = useFigmaTheme();
  const [page, setPage] = useState<"gallery" | "editor">("gallery");
  const initialSelectionHandled = useRef(false);
  const [selection, setSelection] = useState<SelectionSummary>({
    selected: 0,
    names: [],
    types: [],
    targets: {
      selection: { count: 0, orbitCount: 0, frameWidth: 0, frameHeight: 0, items: [] },
      children: { count: 0, orbitCount: 0, frameWidth: 0, frameHeight: 0, items: [] },
      deep: { count: 0, orbitCount: 0, frameWidth: 0, frameHeight: 0, items: [] },
    },
    appliedSettings: null,
    appliedPreset: null,
  });
  const [status, setStatus] = useState<{
    kind: "success" | "error";
    message: string;
    diagnostics?: string;
  } | null>(null);
  const [diagnosticsCopied, setDiagnosticsCopied] = useState(false);
  const [lastDiagnostics, setLastDiagnostics] = useState<string | null>(null);
  const [operation, setOperation] = useState<"apply" | "clear" | null>(null);
  const [pasteDraft,setPasteDraft]=useState<string|null>(null);

  const resetSettings = useCallback(() => {
    setStatus(null);
    const stored = DialStore.getValues(panelId);
    const id = stored.preset as PresetId;
    const current = settingsFromSaved(stored, freshPreset(id));
    applySettingsToStore(freshPreset(id, current));
  }, []);

  useDialKit("Motion Loops", controls, {
    id: panelId,
    persist: true,
    onAction: (action) => {
      if (action === "other.resetSettings") resetSettings();
      if (action === "other.copyJson") void copySettingsJson();
      if (action === "other.pasteJson") void pasteSettingsJson();
    },
  });
  const effectiveValues = fromMotionDocument(documentFromValues(DialStore.getValues(panelId)));

  useEffect(() => {
    const storedPresets = DialStore.getPresets(panelId);
    const storedActiveId = DialStore.getActivePresetId(panelId);
    const activePresetName = storedPresets.find((preset) => preset.id === storedActiveId)?.name;
    const builtInNames = new Set(presetOptions.map((preset) => preset.label));
    const migrateBuiltIns = shouldMigrateBuiltInPresets();
    const obsoletePresets = storedPresets.filter((preset) => (
      preset.name === "Album Wall" || preset.name === "Tunnel" ||
      preset.name === "Ripple" || preset.name === "Tile Wave" ||
      (migrateBuiltIns && builtInNames.has(preset.name as typeof presetOptions[number]["label"]))
    ));
    const removedActivePreset = obsoletePresets.some(
      (preset) => preset.id === storedActiveId,
    );
    for (const preset of obsoletePresets) {
      DialStore.deletePreset(panelId, preset.id);
    }

    const existingPresets = DialStore.getPresets(panelId);
    const previousValues = { ...DialStore.getValues(panelId) };
    const previousActiveId = removedActivePreset ? null : storedActiveId;
    const knownNames = new Set(existingPresets.map((preset) => preset.name));
    let defaultPresetId = existingPresets.find(
      (preset) => preset.name === "3D · Turntable",
    )?.id ?? "";

    for (const preset of presetOptions) {
      if (knownNames.has(preset.label)) continue;
      DialStore.resetValues(panelId);
      applyBuiltInPresetTuning(preset.value);
      const presetId = DialStore.savePreset(panelId, preset.label);
      if (preset.value === "orbit-3d-ring") defaultPresetId = presetId;
    }

    if (migrateBuiltIns) markBuiltInPresetsMigrated();

    const migratedActivePresetId = removedActivePreset && activePresetName
      ? DialStore.getPresets(panelId).find((preset) => preset.name === activePresetName)?.id
      : undefined;
    if (migratedActivePresetId) {
      DialStore.loadPreset(panelId, migratedActivePresetId);
    } else if ((existingPresets.length === 0 || removedActivePreset) && defaultPresetId) {
      DialStore.loadPreset(panelId, defaultPresetId);
    } else if (
      previousActiveId &&
      DialStore.getPresets(panelId).some((preset) => preset.id === previousActiveId)
    ) {
      DialStore.loadPreset(panelId, previousActiveId);
    } else {
      DialStore.clearActivePreset(panelId);
      DialStore.updateValues(panelId, previousValues);
    }

    for (const path of ["motion.fullCycle"] as const) {
      const transition = DialStore.getValues(panelId)["parameters.easing"] as DialTransition | undefined;
      if (transition?.type === "spring") {
        updateLegacyValue(path, {
          type: "easing",
          duration: 1,
          ease: [0, 0, 1, 1],
        });
      }
    }
    const draft = { ...DialStore.getValues(panelId) };
    DialStore.clearActivePreset(panelId);
    DialStore.updateValues(panelId, draft);
  }, []);

  useEffect(() => {
    window.onmessage = (event: MessageEvent<{ pluginMessage?: PluginToUiMessage }>) => {
      const message = event.data.pluginMessage;
      if (!message) return;
      if (message.type === "selection") {
        setSelection(message.selection);
        if (!initialSelectionHandled.current) {
          initialSelectionHandled.current = true;
          if (message.selection.appliedSettings) {
            const restoredTarget = message.selection.targets[
              message.selection.appliedSettings.other.scope
            ];
            const restored = migrateSettingsToPercent(
              message.selection.appliedSettings,
              restoredTarget.frameWidth,
              restoredTarget.frameHeight,
            );
            applySettingsToStore(restored);
            setPage("editor");
          } else if (message.selection.appliedPreset) {
            const label = presetOptions.find(
              (option) => option.value === message.selection.appliedPreset,
            )?.label;
            const storedPreset = label
              ? DialStore.getPresets(panelId).find((preset) => preset.name === label)
              : undefined;
            if (storedPreset) DialStore.loadPreset(panelId, storedPreset.id);
            else applyBuiltInPresetTuning(message.selection.appliedPreset);
            setPage("editor");
          }
        }
      }
      if (message.type === "result") {
        if (message.diagnostics) setLastDiagnostics(message.diagnostics);
        setOperation(null);
        setDiagnosticsCopied(false);
        setStatus(message.kind === "error" ? message : null);
      }
    };
    send({ type: "refresh-selection" });
    return () => {
      window.onmessage = null;
    };
  }, []);

  const activeTarget = selection.targets[effectiveValues.other.scope];
  const hasOrbitMotion = activeTarget.orbitCount > 0;
  const canApply = activeTarget.count > 0;

  const applyMotion = () => {
    if (operation) return;
    setStatus(null);
    setOperation("apply");
    send({ type: "apply", settings: toMotionDocument(effectiveValues) });
  };

  const clearMotion = () => {
    if (operation) return;
    setStatus(null);
    setOperation("clear");
    send({ type: "clear", scope: effectiveValues.other.scope });
  };

  const copyDiagnostics = async (diagnostics = status?.diagnostics) => {
    if (!diagnostics) return;
    try {
      await writeClipboardText(diagnostics);
      setDiagnosticsCopied(true);
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Could not copy diagnostics.",
        diagnostics,
      });
    }
  };

  const copySettingsJson = async () => {
    try {
      await writeClipboardText(serializeSettingsJson(effectiveValues));
      setStatus({ kind: "success", message: "Settings JSON copied." });
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Could not copy settings JSON.",
      });
    }
  };

  const importSettingsJson = (text:string) => {
    try {
      const parsed = parseSettingsJson(text, effectiveValues);
      const imported = migrateSettingsToPercent(
        parsed,
        activeTarget.frameWidth,
        activeTarget.frameHeight,
      );
      applySettingsToStore(imported);
      setPasteDraft(null);
      setStatus({ kind: "success", message: "Settings JSON pasted." });
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Could not paste settings JSON.",
      });
    }
  };

  const pasteSettingsJson = async () => {
    setStatus(null);
    try {
      if(navigator.clipboard?.readText){
        const text=await navigator.clipboard.readText();
        if(text.trim()){importSettingsJson(text);return;}
      }
    }catch{
      // Figma may deny programmatic reads; a user paste event still works.
    }
    setPasteDraft("");
  };

  const selectPreset = (preset: PresetId) => {
    setStatus(null);
    setDiagnosticsCopied(false);
    applySettingsToStore(freshPreset(preset, effectiveValues));
    window.scrollTo({ top: 0, behavior: "auto" });
    setPage("editor");
  };

  const savedPresets = DialStore.getPresets(panelId)
    .filter((item) => !presetOptions.some((preset) => preset.label === item.name) &&
      item.name !== "Version 1" && item.name !== "Ripple" && item.name !== "Tile Wave")
    .map((item) => ({...item, settings: settingsFromSaved(item.values, effectiveValues)}));
  const saveCurrent = () => {
    const base = familyFor(effectiveValues.preset).name;
    const names = new Set(savedPresets.map((item) => item.name));
    let number = 1;
    while (names.has(`${base} · ${number}`)) number += 1;
    DialStore.savePreset(panelId, `${base} · ${number}`);
    // Keep editing a draft, never silently mutate a saved preset.
    applySettingsToStore(effectiveValues);
  };

  if (page === "gallery") {
    return (
      <PresetGallery
        settings={effectiveValues}
        target={selection.targets[effectiveValues.other.scope]}
        onSelect={selectPreset}
        saved={savedPresets}
        onLoad={(id) => { const item = savedPresets.find((entry) => entry.id === id); if (item) applySettingsToStore(item.settings); setPage("editor"); }}
        onCurrent={() => setPage("editor")}
        onSave={saveCurrent}
        onDelete={(id) => DialStore.deletePreset(panelId, id)}
        theme={theme}
      />
    );
  }

  return (
    <main aria-busy={operation !== null}>
      {operation && <div className="operation-blocker" aria-hidden="true" />}
      <OrbitPreview
        settings={effectiveValues}
        target={selection.targets[effectiveValues.other.scope]}
        onBack={() => {
          window.scrollTo({ top: 0, behavior: "auto" });
          setPage("gallery");
        }}
      />

      {status && <div className={`status ${status.kind}`}>
        <div>{status.message}</div>
        {status.kind === "error" && status.diagnostics && (
          <button className="diagnostics-copy" type="button" onClick={() => void copyDiagnostics()}>
            {diagnosticsCopied ? "Diagnostics copied" : "Copy diagnostics"}
          </button>
        )}
      </div>}

      {pasteDraft!==null&&<section className="paste-settings dialkit-root" data-theme={theme} aria-label="Import settings">
        <label htmlFor="paste-settings-json">Paste settings JSON (⌘V / Ctrl+V)</label>
        <textarea id="paste-settings-json" autoFocus value={pasteDraft} onChange={event=>setPasteDraft(event.target.value)}
          onKeyDown={event=>{if(event.key==="Escape")setPasteDraft(null);}} spellCheck={false}/>
        <div className="other-clipboard-row">
          <button className="dialkit-button" onClick={()=>setPasteDraft(null)}>Cancel</button>
          <button className="dialkit-button" disabled={!pasteDraft.trim()} onClick={()=>importSettingsJson(pasteDraft)}>Import JSON</button>
        </div>
      </section>}

      <PresetEditor settings={effectiveValues} onChange={applySettingsToStore}
        theme={theme} panelId={panelId}
        diagnosticsAction={<button className="dialkit-button diagnostics-action" type="button" disabled={!lastDiagnostics || operation !== null}
          onClick={() => void copyDiagnostics(lastDiagnostics ?? undefined)}>
          {diagnosticsCopied ? "Diagnostics copied" : "Copy diagnostics"}
        </button>}
        shapeEditor={<GeometryPathEditor settings={effectiveValues} target={selection.targets[effectiveValues.other.scope]} />} />

      <div className="dialkit-root bottom-actions" data-theme={theme}>
        <button
          className="dialkit-button"
          type="button"
          disabled={operation !== null || !hasOrbitMotion}
          onClick={clearMotion}
        >
          {operation === "clear" ? (
            <span className="orbit-button-progress"><span className="orbit-spinner" />Clearing…</span>
          ) : "Clear"}
        </button>
        <button
          className="dialkit-button"
          type="button"
          disabled={operation !== null || !canApply}
          onClick={applyMotion}
        >
          {operation === "apply" ? (
            <span className="orbit-button-progress"><span className="orbit-spinner" />Updating…</span>
          ) : hasOrbitMotion ? "Refresh motion" : "Apply motion"}
        </button>
      </div>

      <OverlayScrollbar />
      <ResizeHandle />
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
