import type { ReactNode } from "react";
import { ControlRenderer, DialStore, Folder, TransitionControl, type ControlMeta } from "dialkit";
import { freshPreset } from "./catalog";
import { documentValues, motionEditor, toMotionDocument } from "./motion-system";
import type { MotionSettings } from "./types";
import {DialKitRangeOverride} from "./dialkit-range-override";

const libraryLinks = [
  { label: "DialKit · MIT", href: "https://www.dialkit.dev/" },
  { label: "React · MIT", href: "https://react.dev/" },
  { label: "Motion · MIT", href: "https://motion.dev/" },
] as const;

/** One renderer for every model. No preset/legacy/reference branches. */
export function PresetEditor({settings,theme,panelId,shapeEditor,diagnosticsAction}:{
  settings:MotionSettings; onChange:(settings:MotionSettings)=>void;
  theme:"light"|"dark";panelId:string;shapeEditor:ReactNode;
  diagnosticsAction?:ReactNode;
}){
  const schema=motionEditor(toMotionDocument(settings)),panel=DialStore.getPanel(panelId);
  const flatten=(controls:ControlMeta[]):ControlMeta[]=>controls.flatMap(control=>control.children?flatten(control.children):[control]);
  const leaves=flatten(panel?.controls??[]),values=DialStore.getValues(panelId);
  const presetDefaults=documentValues(toMotionDocument(freshPreset(settings.preset,settings)));
  const controlsFor=(bindings:typeof schema.quick)=>bindings.flatMap(binding=>{
    const control=leaves.find(control=>control.path==="parameters."+binding.id);
    if(!control)return [];
    const config:any=binding.config;
    return [{...control,label:binding.label,...(Array.isArray(config)?{min:config[1],max:config[2],step:config[3]}:
      config?.options?{options:config.options}:{})}];
  });
  const other=leaves.filter(control=>[
    "other.scope","other.centerBeforeApply","other.serviceLayers",
    "other.copyJson","other.pasteJson","other.resetSettings",
  ].includes(control.path));
  const renderControls=(controls:ControlMeta[])=>controls.map(control=><div key={control.path} className={control.path==="parameters.easing"?"motion-easing":undefined}>
    {control.type==="slider"?<DialKitRangeOverride panelId={panelId} control={control} values={values}
      resetValue={typeof presetDefaults[control.path]==="number"?presetDefaults[control.path] as number:undefined}/>:
      control.type==="transition"?<TransitionControl panelId={panelId} path={control.path} label={control.label}
      value={values[control.path] as never} hideDuration onChange={value=>DialStore.updateValue(panelId,control.path,value)}/>:
      <ControlRenderer panelId={panelId} controls={[control]} values={values}/>}
  </div>);
  const renderOther=()=>{
    const clipboard=other.filter(control=>["other.copyJson","other.pasteJson"].includes(control.path));
    const settings=other.filter(control=>["other.scope","other.centerBeforeApply","other.serviceLayers"].includes(control.path));
    const reset=other.filter(control=>control.path==="other.resetSettings");
    return <div className="other-controls">
      <div className="other-settings">{renderControls(settings)}</div>
      <div className="other-clipboard-row">{renderControls(clipboard)}</div>
      {diagnosticsAction}
      <div className="other-reset-row">{renderControls(reset)}</div>
      <nav className="library-links" aria-label="Free libraries">
        {libraryLinks.map(link=><a key={link.href} href={link.href} target="_blank" rel="noreferrer">{link.label}</a>)}
      </nav>
    </div>;
  };
  return <section className="dial-panel curated-dial-panel" aria-label="Animation settings">
    <div className="dialkit-root" data-theme={theme}>
      <div className="dial-quick-row" aria-label="Quick settings">
        {renderControls(controlsFor(schema.quick))}
      </div>
      <Folder title="Motion Loops" isRoot inline open>
        {schema.sections.map(section=><Folder key={section.id} title={section.title} defaultOpen={false}>
          {section.id==="other"?renderOther():renderControls(controlsFor(section.bindings.filter(binding=>!binding.advanced)))}
          {section.bindings.some(binding=>binding.advanced)&&<Folder title="Advanced" defaultOpen={false}>
            {renderControls(controlsFor(section.bindings.filter(binding=>binding.advanced)))}
          </Folder>}
          {section.id==="trajectory"&&schema.pathEditor&&shapeEditor}
        </Folder>)}
      </Folder>
    </div>
  </section>;
}
