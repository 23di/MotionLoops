import {useEffect,type ReactNode} from "react";
import { ControlRenderer, DialStore, Folder, SelectControl, type ControlMeta } from "dialkit";
import { freshPreset } from "./catalog";
import { documentValues, motionEditor, motionModelOptions, switchMotionModel, toMotionDocument } from "./motion-system";
import type { MotionSettings } from "./types";
import {DialKitRangeOverride} from "./dialkit-range-override";
import { animationFor, animationOptions, applyAnimation } from "./animation-recipes";
import { editableVisibleMax } from "./motion-capabilities";

import { LanguageSelect, localizeControl, useTranslation } from "./language";
import { LocalizedToggle, LocalizedTransition } from "./localized-controls";

const libraryLinks = [
  { label: "DialKit · MIT", href: "https://www.dialkit.dev/" },
  { label: "React · MIT", href: "https://react.dev/" },
  { label: "Motion · MIT", href: "https://motion.dev/" },
] as const;

/** One renderer for every model. No preset/legacy/reference branches. */
export function PresetEditor({settings,onChange,theme,panelId,shapeEditor,diagnosticsAction,itemCount}:{
  settings:MotionSettings; onChange:(settings:MotionSettings)=>void;
  theme:"light"|"dark";panelId:string;shapeEditor:ReactNode;
  itemCount:number;
  diagnosticsAction?:ReactNode;
}){
  const t=useTranslation();
  const document=toMotionDocument(settings);
  const schema=motionEditor(document),panel=DialStore.getPanel(panelId);
  const selectedAnimation=animationFor(settings);
  const visibleLimit=editableVisibleMax(itemCount);
  const configuredVisible=Number(settings.reference?.visible);
  const adaptiveControlIds=new Set(schema.sections.flatMap(section=>section.bindings.map(binding=>binding.id))
    .filter(id=>id==="adaptiveSize"||id==="shape_adaptiveSize"));
  const adaptiveEnabled=settings.appearance.adaptiveSize!==false&&adaptiveControlIds.size>0;
  useEffect(()=>{
    if(["rfStack","rfCarousel"].includes(document.model)&&configuredVisible>visibleLimit)
      onChange({...settings,reference:{...settings.reference,visible:visibleLimit}});
  },[document.model,configuredVisible,visibleLimit,onChange]);
  const flatten=(controls:ControlMeta[]):ControlMeta[]=>controls.flatMap(control=>control.children?flatten(control.children):[control]);
  const leaves=flatten(panel?.controls??[]),values=DialStore.getValues(panelId);
  const presetDefaults=documentValues(toMotionDocument(switchMotionModel(
    freshPreset(settings.preset,settings),document.model,itemCount)));
  const controlsFor=(bindings:typeof schema.quick)=>bindings.flatMap(binding=>{
    const control=leaves.find(control=>control.path==="parameters."+binding.id);
    if(!control)return [];
    const config:any=binding.config;
    return [{...control,label:binding.label,...(Array.isArray(config)?{min:config[1],max:binding.id==="visible"&&["rfStack","rfCarousel"].includes(document.model)
      ?Math.min(config[2],visibleLimit):config[2],step:config[3]}:
      config?.options?{options:config.options}:{})}];
  });
  const other=leaves.filter(control=>[
    "other.scope","other.centerBeforeApply","other.serviceLayers",
    "other.copyJson","other.pasteJson","other.resetSettings",
  ].includes(control.path));
  const entryControls=leaves.filter(control=>control.path==="other.startOnEntry"||control.path==="other.loopCardAnimation"||
    settings.other.startOnEntry&&control.path==="other.entryOffset").map(control=>({...control,
      label:control.path==="other.startOnEntry"?"Start when card is main":control.path==="other.loopCardAnimation"?"Loop card animation":"Offset (s)",
      ...(control.path==="other.entryOffset"?{min:-5,max:5,step:.01}:{})}));
  const renderControls=(controls:ControlMeta[])=>controls.map(source=>{
    const control=localizeControl(source,t);
    const sizeLocked=adaptiveEnabled&&["parameters.cardSize","parameters.shape_cardSize"].includes(control.path);
    return <div key={control.path} className={[control.path==="parameters.easing"?"motion-easing":"",control.path==="other.entryOffset"?"entry-offset":"",sizeLocked?"orbit-control-disabled":""].filter(Boolean).join(" ")||undefined}
      title={source.path==="other.startOnEntry"?t("Start animations inside each card when it becomes the front or central card."):control.path==="other.loopCardAnimation"?t("Repeat animations inside each card. Independent loops fit whole cycles into the scene duration. Start when card is main restarts the authored loop on each visit."):control.path==="other.entryOffset"?t("Negative starts earlier; positive starts later. Double-press the handle to reset to zero."):undefined}
      inert={sizeLocked} aria-disabled={sizeLocked}>
    {control.type==="slider"&&!(["rfStack","rfCarousel"].includes(document.model)&&control.path==="parameters.visible")
      ?<DialKitRangeOverride panelId={panelId} control={control} values={values}
      symmetric={control.path==="other.entryOffset"}
      resetValue={control.path==="other.entryOffset"?0:typeof presetDefaults[control.path]==="number"?presetDefaults[control.path] as number:undefined}/>:
      control.type==="toggle"?<LocalizedToggle label={control.label} checked={Boolean(values[control.path])} onChange={value=>DialStore.updateValue(panelId,control.path,value)}/>:
      control.type==="transition"?<LocalizedTransition panelId={panelId} path={control.path} label={control.label}
      value={values[control.path] as never} onChange={value=>DialStore.updateValue(panelId,control.path,value)}/>:
      <ControlRenderer panelId={panelId} controls={[control]} values={values}/>}
  </div>});
  const renderOther=()=>{
    const clipboard=other.filter(control=>["other.copyJson","other.pasteJson"].includes(control.path));
    const settings=other.filter(control=>["other.scope","other.centerBeforeApply","other.serviceLayers"].includes(control.path));
    const reset=other.filter(control=>control.path==="other.resetSettings");
    return <div className="other-controls">
      <LanguageSelect />
      <div className="other-settings">{renderControls(settings)}</div>
      <div className="other-clipboard-row">{renderControls(clipboard)}</div>
      {diagnosticsAction}
      <div className="other-reset-row">{renderControls(reset)}</div>
      <nav className="library-links" aria-label={t("Free libraries")}>
        {libraryLinks.map(link=><a key={link.href} href={link.href} target="_blank" rel="noreferrer">{link.label}</a>)}
      </nav>
    </div>;
  };
  return <section className="dial-panel curated-dial-panel" aria-label={t("Animation settings")}>
    <div className="dialkit-root" data-theme={theme}>
      <div className="dial-quick-row" aria-label={t("Quick settings")}>
        {renderControls(controlsFor(schema.quick))}
      </div>
      <Folder title="Motion Loops" isRoot inline open>
        {schema.sections.map(section=><Folder key={section.id} title={t(section.title)} defaultOpen={false}>
          {section.id==="motion"&&<SelectControl label={t("Model")} value={document.model}
            options={motionModelOptions.map(option=>({...option,label:t(option.label)}))} onChange={value=>onChange(switchMotionModel(settings,value,itemCount))}/>}
          {section.id==="motion"&&["trajectory","rfCarousel","rfStack"].includes(document.model)&&<SelectControl label={t("Animation")} value={selectedAnimation}
            options={[...(document.model==="rfStack"?animationOptions.filter(option=>["queue","continuous"].includes(option.value)):animationOptions).map(({value,label})=>({value,label:t(label)})),
              ...(selectedAnimation==="custom"?[{value:"custom",label:t("Custom")}]:[])]}
            onChange={value=>onChange(applyAnimation(settings,value))}/>}
          {section.id==="other"?renderOther():renderControls(controlsFor(section.bindings.filter(binding=>!binding.advanced)))}
          {section.id==="motion"&&<div className="entry-timing-controls">{renderControls(entryControls)}</div>}
          {section.bindings.some(binding=>binding.advanced)&&<Folder title={t("Advanced")} defaultOpen={false}>
            {renderControls(controlsFor(section.bindings.filter(binding=>binding.advanced)))}
          </Folder>}
          {section.id==="trajectory"&&schema.pathEditor&&shapeEditor}
        </Folder>)}
      </Folder>
    </div>
  </section>;
}
