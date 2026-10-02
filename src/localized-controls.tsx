import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { DialStore, EasingVisualization, Folder, Slider, SpringVisualization, type TransitionConfig } from "dialkit";
import { useLanguage, useTranslation } from "./language";

/** The curve's DOM is imperative DialKit output. Localize its accessibility copy in place. */
function LocalizedEasingVisualization(props: Parameters<typeof EasingVisualization>[0]) {
  const host = useRef<HTMLDivElement>(null);
  const { locale } = useLanguage();
  const t = useTranslation();
  useEffect(() => {
    const localize = () => {
      const curve = host.current?.querySelector(".dialkit-easing-viz");
      if (!curve) return;
      const label = t("Bézier easing curve");
      if (curve.getAttribute("aria-label") !== label) curve.setAttribute("aria-label", label);
      const instructions = curve.querySelector(".dialkit-easing-instructions");
      const help = t("Drag to adjust X from 0 to 1 and Y from -1 to 2. Arrow keys adjust by 0.01. Shift adjusts by 0.1. Escape cancels a drag.");
      if (instructions && instructions.textContent !== help) instructions.textContent = help;
      for (const handle of curve.querySelectorAll(".dialkit-easing-handle")) {
        const match = handle.getAttribute("aria-label")?.match(/^Bézier handle (\d+): X (.*), Y (.*)$/);
        if (match) {
          const next = t("Bézier handle {count}: X {x}, Y {y}", {count:match[1], x:match[2], y:match[3]});
          if (handle.getAttribute("aria-label") !== next) handle.setAttribute("aria-label", next);
        }
      }
    };
    localize();
    const observer = new MutationObserver(localize);
    if (host.current) observer.observe(host.current, {subtree:true,childList:true,attributes:true,attributeFilter:["aria-label"]});
    return () => observer.disconnect();
  }, [locale, t]);
  return <div ref={host}><EasingVisualization {...props} /></div>;
}

/** DialKit's stock toggle/transition labels are fixed English; reuse its visualizations and store. */
function Segments({ label, options, value, onChange }: {
  label: string; options: { value: string; label: string }[]; value: string; onChange: (value: string) => void;
}) {
  return <div className="dialkit-segmented" role="radiogroup" aria-label={label} onKeyDown={event => {
    const step = ["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : ["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 0;
    if (!step && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const index = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1
      : (options.findIndex(option => option.value === value) + step + options.length) % options.length;
    onChange(options[index].value);
    (event.currentTarget.querySelectorAll("button")[index] as HTMLButtonElement)?.focus();
  }}>
    {options.map(option => <button key={option.value} type="button" className="dialkit-segmented-button"
      role="radio" aria-checked={value === option.value} data-active={String(value === option.value)}
      tabIndex={value === option.value ? 0 : -1} onClick={() => onChange(option.value)}>{option.label}</button>)}
  </div>;
}
export function LocalizedToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  const t = useTranslation();
  return <div className="dialkit-labeled-control orbit-localized-toggle"><span className="dialkit-labeled-control-label">{label}</span>
    <Segments label={label} options={[{ value: "off", label: t("Off") }, { value: "on", label: t("On") }]}
      value={checked ? "on" : "off"} onChange={value => onChange(value === "on")} />
  </div>;
}
export function LocalizedTransition({ panelId, path, label, value, onChange }: {
  panelId: string; path: string; label: string; value: TransitionConfig; onChange: (value: TransitionConfig) => void;
}) {
  const t = useTranslation();
  const subscribe = useCallback((callback: () => void) => DialStore.subscribe(panelId, callback), [panelId]);
  const snapshot = useCallback(() => DialStore.getTransitionMode(panelId, path), [panelId, path]);
  const mode = useSyncExternalStore(subscribe, snapshot, snapshot);
  const cache = useRef<Record<typeof mode, TransitionConfig>>({
    easing: value.type === "easing" ? value : { type: "easing", duration: .3, ease: [1, -.4, .5, 1] },
    simple: value.type === "spring" && value.visualDuration !== undefined ? value : { type: "spring", visualDuration: .3, bounce: .2 },
    advanced: value.type === "spring" && value.stiffness !== undefined ? value : { type: "spring", stiffness: 200, damping: 25, mass: 1 },
  });
  if (mode === "easing" && value.type === "easing" || mode !== "easing" && value.type === "spring") cache.current[mode] = value;
  const easing = value.type === "easing" ? value : cache.current.easing;
  const spring = value.type === "spring" ? value : cache.current.simple;
  const [draft, setDraft] = useState<string | null>(null);
  const updateSpring = (key: string, next: number) => {
    if (spring.type !== "spring") return;
    const { stiffness, damping, mass, visualDuration, bounce, ...rest } = spring;
    onChange({ ...rest, ...(mode === "simple" ? { visualDuration, bounce } : { stiffness, damping, mass }), [key]: next });
  };
  const commitEase = () => {
    if (easing.type !== "easing" || draft === null) return;
    const fields = draft.replace(/^\s*\[|\]\s*$/g, "").split(",");
    const parts = fields.map(part => Number(part.trim()));
    if (fields.every(part => /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(part.trim())) && parts.length === 4 && parts.every(Number.isFinite) && parts[0] >= 0 && parts[0] <= 1 && parts[2] >= 0 && parts[2] <= 1)
      onChange({ ...easing, ease: [parts[0], Math.max(-1, Math.min(2, parts[1])), parts[2], Math.max(-1, Math.min(2, parts[3]))] });
    setDraft(null);
  };
  return <Folder title={label} defaultOpen>
    <div className="orbit-transition-controls">
      {mode === "easing" && easing.type === "easing" ? <LocalizedEasingVisualization easing={easing} onChange={ease => onChange({ ...easing, ease })} />
        : spring.type === "spring" ? <SpringVisualization spring={spring} isSimpleMode={mode === "simple"} /> : null}
      <div className="dialkit-labeled-control"><span className="dialkit-labeled-control-label">{t("Type")}</span>
        <Segments label={t("Type")} value={mode} options={[{ value: "easing", label: t("Easing") }, { value: "simple", label: t("Time") }, { value: "advanced", label: t("Physics") }]}
          onChange={next => {
            if (next !== "easing" && next !== "simple" && next !== "advanced") return;
            setDraft(null); DialStore.updateTransitionMode(panelId, path, next); onChange(cache.current[next]);
          }} />
      </div>
      {mode === "easing" && easing.type === "easing" ? <div className="dialkit-labeled-control">
        <span className="dialkit-labeled-control-label">{t("Ease")}</span>
        <input className="dialkit-text-input" aria-label={t("Bézier coordinates")} spellCheck={false}
          value={draft ?? easing.ease.join(", ")} onFocus={() => setDraft(easing.ease.join(", "))}
          onChange={event => setDraft(event.target.value)} onBlur={commitEase}
          onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }} />
      </div> : spring.type === "spring" ? mode === "simple" ? <Slider label={t("Bounce")} value={spring.bounce ?? .2} onChange={next => updateSpring("bounce", next)} min={0} max={1} step={.05} />
        : <>{[["stiffness", "Stiffness", 400, 1, 1000, 10], ["damping", "Damping", 17, 0, 100, 1], ["mass", "Mass", 1, .1, 10, .1]].map(([key, title, initial, min, max, step]) =>
          <Slider key={String(key)} label={t(String(title))} value={Number(spring[key as keyof typeof spring] ?? initial)}
            onChange={next => updateSpring(String(key), next)} min={Number(min)} max={Number(max)} step={Number(step)} />)}</> : null}
    </div>
  </Folder>;
}
