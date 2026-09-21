import {useRef,useState} from "react";
import {flushSync} from "react-dom";
import {ControlRenderer,DialStore,type ControlMeta} from "dialkit";

/**
 * External DialKit shim: keep its slider, input, styling and pointer handling.
 * Bypass only the input's upper clamp; restore the normal range on scrubbing.
 */
export function DialKitRangeOverride({panelId,control,values,resetValue}:{
  panelId:string;control:ControlMeta;values:ReturnType<typeof DialStore.getValues>;
  resetValue?:number;
}){
  const [revision,setRevision]=useState(0);
  const committing=useRef(false);
  const handlePress=useRef<{time:number;x:number;y:number}|null>(null);
  const value=Number(values[control.path]),cap=control.max??1,min=control.min??0;
  const finish=(input:HTMLInputElement)=>{
    if(committing.current)return;
    committing.current=true;
    const raw=input.value.trim(),next=Number(raw.replace(",","."));
    if(raw&&Number.isFinite(next)&&next>=min)DialStore.updateValue(panelId,control.path,next);
    setRevision(revision=>revision+1); // close the stock input without its clamping submit
    queueMicrotask(()=>{committing.current=false;});
  };
  const resetRange=()=>{
    if(value>cap)flushSync(()=>DialStore.updateValue(panelId,control.path,cap));
  };
  const hitsHandle=(target:EventTarget|null,x:number,y:number)=>{
    const slider=target instanceof Element?target.closest(".dialkit-slider"):null;
    const handle=slider?.querySelector(".dialkit-slider-handle");
    if(!handle)return false;
    const rect=handle.getBoundingClientRect(),hitSlop=8;
    return x>=rect.left-hitSlop&&x<=rect.right+hitSlop&&
      y>=rect.top-hitSlop&&y<=rect.bottom+hitSlop;
  };
  return <div className="dialkit-range-override"
    onBlurCapture={event=>{
      if(event.target instanceof HTMLInputElement){event.stopPropagation();finish(event.target);}
    }}
    onKeyDownCapture={event=>{
      if(event.target instanceof HTMLInputElement){
        if(event.key==="Enter"){event.preventDefault();event.stopPropagation();finish(event.target);}
        if(event.key==="Escape"){
          event.preventDefault();event.stopPropagation();committing.current=true;
          setRevision(revision=>revision+1);
          queueMicrotask(()=>{committing.current=false;});
        }
      }else if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End","PageUp","PageDown"].includes(event.key)&&value>cap){
        event.preventDefault();event.stopPropagation();resetRange();
      }
    }}
    onPointerMoveCapture={event=>{
      const press=handlePress.current;
      if(press&&Math.hypot(event.clientX-press.x,event.clientY-press.y)>4)handlePress.current=null;
    }}
    onPointerDownCapture={event=>{
      // DialKit's visible handle has pointer-events:none, so the event target is
      // the track. Hit-test the handle's actual bounds instead of its selector.
      if(hitsHandle(event.target,event.clientX,event.clientY)){
        const now=performance.now(),previous=handlePress.current;
        if(previous&&now-previous.time<=400&&Math.hypot(event.clientX-previous.x,event.clientY-previous.y)<=6){
          event.preventDefault();
          event.stopPropagation();
          handlePress.current=null;
          if(resetValue!==undefined){
            DialStore.updateValue(panelId,control.path,resetValue);
          }
          return;
        }
        handlePress.current={time:now,x:event.clientX,y:event.clientY};
      }else handlePress.current=null;
      if(!(event.target as Element).closest(".dialkit-slider-value, .dialkit-slider-input"))resetRange();
    }}>
    <ControlRenderer key={revision} panelId={panelId} controls={[{...control,max:Math.max(cap,value)}]} values={values}/>
  </div>;
}
