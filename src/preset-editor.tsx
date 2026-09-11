import { useState } from "react";
import { families, familyFor, freshPreset, visibleGeometry } from "./catalog";
import type { MotionSettings, PresetId } from "./types";

type Props = {
  settings: MotionSettings;
  onChange: (settings: MotionSettings) => void;
  copy: () => void;
  paste: () => void;
  saved: { id: string; name: string }[];
  load: (id: string) => void;
  save: (name: string) => void;
};

function Slider({ label, value, min, max, step = 1, suffix = "", change }: {
  label: string; value: number; min: number; max: number; step?: number; suffix?: string; change: (value: number) => void;
}) {
  return <label className="simple-slider"><span>{label}<output>{Number(value.toFixed(2))}{suffix}</output></span>
    <input aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={(event) => change(Number(event.target.value))} />
  </label>;
}

export function PresetEditor({ settings, onChange, copy, paste, saved, load, save }: Props) {
  const [tab, setTab] = useState("Motion");
  const [saveName, setSaveName] = useState("");
  const family = familyFor(settings.preset);
  const visible = visibleGeometry(settings);
  const geometry = (patch: Partial<MotionSettings["geometry"]>) => onChange({ ...settings, geometry: { ...settings.geometry, ...patch } });
  const appearance = (patch: Partial<MotionSettings["appearance"]>) => onChange({ ...settings, appearance: { ...settings.appearance, ...patch } });
  const motion = (patch: Partial<MotionSettings["motion"]>) => onChange({ ...settings, motion: { ...settings.motion, ...patch } });
  const choose = (id: PresetId) => onChange(freshPreset(id, settings));
  const vertical = settings.geometry.shape === "falling-stack";
  return <section className="simple-editor" aria-label="Animation settings">
    <label className="family-picker"><span>Preset</span><select aria-label="Preset family" value={family.name}
      onChange={(event) => choose(families.find((item) => item.name === event.target.value)!.variants[0].id)}>
      {families.map((item) => <option key={item.name}>{item.name}</option>)}
    </select></label>
    <div className="quick-settings" aria-label="Quick settings">
      {family.variants.length > 1 && <select aria-label="Variation" value={settings.preset} onChange={(event) => choose(event.target.value as PresetId)}>
        {family.variants.map((variant) => <option value={variant.id} key={variant.id}>{variant.name}</option>)}
      </select>}
      <button type="button" aria-label={vertical ? "Move down" : "Clockwise"} aria-pressed={settings.motion.direction === "clockwise"} onClick={() => motion({ direction: "clockwise" })}>{vertical ? "↓ Down" : "↻ Right"}</button>
      <button type="button" aria-label={vertical ? "Move up" : "Counterclockwise"} aria-pressed={settings.motion.direction === "counterclockwise"} onClick={() => motion({ direction: "counterclockwise" })}>{vertical ? "↑ Up" : "↺ Left"}</button>
      {visible.angle && <label className="quick-angle">Angle <input aria-label="Angle" type="number" min={-180} max={180} step={5} value={settings.geometry.circleRotation}
        onChange={(event) => geometry({ circleRotation: Math.min(180, Math.max(-180, Number(event.target.value))) })} />°</label>}
    </div>
    <div className="settings-tabs" role="tablist" aria-label="Settings sections">
      {["Motion", "Look", "Setup"].map((name) => <button id={`tab-${name}`} aria-controls="settings-content" role="tab" aria-selected={tab === name} key={name} type="button" onClick={() => setTab(name)}>{name}</button>)}
    </div>
    <div className="settings-content" id="settings-content" role="tabpanel" aria-labelledby={`tab-${tab}`}>
      {tab === "Motion" && <>
        <Slider label="Cycle duration" value={settings.motion.duration} min={0.4} max={12} step={0.1} suffix=" s" change={(duration) => motion({ duration })} />
        <label className="simple-toggle"><span>Fit inside frame</span><input type="checkbox" checked={settings.geometry.dynamicScale} onChange={(event) => geometry({ dynamicScale: event.target.checked })} /></label>
        {visible.width && <Slider label="Width" suffix="%" value={settings.geometry.radiusX} min={1} max={100} change={(radiusX) => geometry({ radiusX })} />}
        {visible.height && <Slider label="Height" suffix="%" value={settings.geometry.radiusY} min={1} max={100} change={(radiusY) => geometry({ radiusY })} />}
        {visible.spread && <Slider label="Spacing" suffix="%" value={settings.geometry.itemSpread * 100} min={10} max={150} change={(value) => geometry({ itemSpread: value / 100 })} />}
        {visible.amount && <Slider label="Movement" suffix="%" value={settings.geometry.shapeAmount * 100} min={10} max={150} change={(value) => geometry({ shapeAmount: value / 100 })} />}
        <p className="settings-hint">One cycle includes every card. Direction and variation are above.</p>
      </>}
      {tab === "Look" && <>
        <Slider label="Front size" suffix="%" value={settings.appearance.nearScale * 100} min={10} max={200} change={(value) => appearance({ nearScale: value / 100 })} />
        <Slider label="Back size" suffix="%" value={settings.appearance.farScale * 100} min={5} max={150} change={(value) => appearance({ farScale: value / 100 })} />
        <Slider label="Back opacity" suffix="%" value={settings.appearance.farOpacity * 100} min={0} max={100} change={(value) => appearance({ farOpacity: value / 100 })} />
        {settings.geometry.shape !== "falling-stack" && <Slider label="Back blur" value={settings.appearance.farBlur} min={0} max={40} change={(farBlur) => appearance({ farBlur })} />}
        <Slider label="Front shadow" value={settings.appearance.frontShadow} min={0} max={40} change={(frontShadow) => appearance({ frontShadow })} />
      </>}
      {tab === "Setup" && <>
        <label className="family-picker"><span>Animate</span><select aria-label="Animate" value={settings.other.scope} onChange={(event) => onChange({ ...settings, other: { ...settings.other, scope: event.target.value as MotionSettings["other"]["scope"] } })}>
          <option value="selection">Selected layers</option><option value="children">Frame children</option><option value="deep">All descendants</option>
        </select></label>
        <label className="simple-toggle"><span>Center animation</span><input type="checkbox" checked={settings.other.centerBeforeApply} onChange={(event) => onChange({ ...settings, other: { ...settings.other, centerBeforeApply: event.target.checked } })} /></label>
        {saved.length > 0 && <label className="family-picker"><span>Saved</span><select aria-label="Saved presets" value="" onChange={(event) => load(event.target.value)}><option value="" disabled>Choose saved preset</option>{saved.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>}
        <form className="save-preset" onSubmit={(event) => { event.preventDefault(); if (saveName.trim()) { save(saveName.trim()); setSaveName(""); } }}><input aria-label="Preset name" placeholder="Save your variation…" value={saveName} onChange={(event) => setSaveName(event.target.value)} /><button type="submit" disabled={!saveName.trim()}>Save</button></form>
        <div className="orbit-settings-json-actions"><button type="button" onClick={copy}>Copy JSON</button><button type="button" onClick={paste}>Paste</button></div>
        <button className="reset-preset" type="button" onClick={() => choose(settings.preset)}>Reset this variation</button>
      </>}
    </div>
  </section>;
}
