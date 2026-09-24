import { referenceScene, type SourceSize } from "./reference-engine";
import type { GeneratedKeyframe } from "./engine";
import type { MotionSettings } from "./types";
import { referenceDefinition } from "./reference-catalog";
import { recipeKey } from "./preset-presentation";
import {maxNativeServiceCopies} from "./motion-capabilities";

export interface NativeFrame extends GeneratedKeyframe { radius: number; shade: number; alpha:number; imageScaleX:number; imageScaleY:number }
export interface NativeInstance { source: number; layer: number; fill: boolean; baseWidth: number; baseHeight: number; frames: NativeFrame[] }

// Track layer/card identities separately. Native Figma cannot animate z-index:
// invisible service copies transfer ownership using HOLD opacity at a handoff.
export function compileReference(settings: MotionSettings,sources:readonly SourceSize[],width:number,height:number):NativeInstance[]{
  const duration=settings.motion.duration;
  if(!Number.isFinite(duration)||duration<=0)throw new Error("Cycle duration must be a positive finite number.");
  const samples=Math.min(10800,Math.max(240,Math.ceil(duration*90)));
  const times=new Set(Array.from({length:samples+1},(_,i)=>duration*i/samples));
  // Adjacent interval checks repeatedly request the same endpoints. Keep a
  // bounded cache for this compilation only; never retain scenes across edits.
  const sceneCache=new Map<number,ReturnType<typeof referenceScene>>();
  const scene=(t:number)=>{
    const cached=sceneCache.get(t);if(cached)return cached;
    const value=referenceScene(settings,sources,width,height,t);
    if(sceneCache.size>=256)sceneCache.delete(sceneCache.keys().next().value!);
    sceneCache.set(t,value);return value;
  };
  const signature=(t:number)=>scene(t).map(c=>`${c.layer}:${c.source}`).join("|");
  // Locate visibility/layer ownership discontinuities; never smear them across
  // a regular sampling interval. Tiny brackets are below a Motion frame.
  for(let i=0;i<samples;i++){
    let lo=duration*i/samples,hi=duration*(i+1)/samples;
    const before=signature(lo);
    if(before===signature(hi))continue;
    for(let j=0;j<36;j++){const mid=(lo+hi)/2;if(signature(mid)===before)lo=mid;else hi=mid;}
    times.add(lo);times.add(hi);
  }
  const seeds=[...times].sort((a,b)=>a-b);
  const refine=(lo:number,hi:number,depth=0)=>{
    if(depth>=10||hi-lo<1e-8)return;
    const mid=(lo+hi)/2,a=new Map(scene(lo).map(c=>[`${c.layer}:${c.source}`,c])),b=new Map(scene(hi).map(c=>[`${c.layer}:${c.source}`,c]));
    let error=0;
    for(const card of scene(mid)){
      const key=`${card.layer}:${card.source}`,left=a.get(key),right=b.get(key);if(!left||!right)continue;
      for(const field of ["x","y","width","height","rotation","radius"] as const)error=Math.max(error,Math.abs(card[field]-(left[field]+right[field])/2));
      error=Math.max(error,100*Math.abs((card.opacity??1)-((left.opacity??1)+(right.opacity??1))/2));
      error=Math.max(error,100*Math.abs((card.shade??0)-((left.shade??0)+(right.shade??0))/2));
    }
    if(error>.01){times.add(mid);refine(lo,mid,depth+1);refine(mid,hi,depth+1);}
  };
  for(let i=1;i<seeds.length;i++)refine(seeds[i-1],seeds[i]);
  const ordered=[...times].sort((a,b)=>a-b);
  let scenes=ordered.map(time=>new Map(scene(time).map(card=>[`${card.layer}:${card.source}`,card])));
  // Board tiles never overlap: their layer order has no visual meaning. Reuse
  // a source's offscreen clones instead of retaining one clone per world cell.
  // Keep ownership until a cell leaves, so visible tiles never exchange tracks.
  const definition=referenceDefinition(settings);
  if(definition&&recipeKey(definition)==="LoopBoardTemplate"){
    const active=new Map<string,number>(),poolSources:number[]=[];
    scenes=scenes.map(snapshot=>{
      for(const key of active.keys())if(!snapshot.has(key))active.delete(key);
      const occupied=new Set(active.values());
      return new Map([...snapshot].map(([key,card])=>{
        let slot=active.get(key);
        if(slot===undefined){
          slot=poolSources.findIndex((source,index)=>source===card.source&&!occupied.has(index));
          if(slot<0){slot=poolSources.length;poolSources.push(card.source);}
          active.set(key,slot);occupied.add(slot);
        }
        return [`${slot}:${card.source}`,{...card,layer:slot}];
      }));
    });
  }
  const keys=new Map<string,ReturnType<typeof scene>[number]>();
  for(const snapshot of scenes)for(const [key,card] of snapshot)keys.set(key,card);
  if(keys.size>maxNativeServiceCopies)throw new Error(`This combination needs more than ${maxNativeServiceCopies} editable service copies. Reduce the card count or visible cards.`);
  return [...keys].map(([key,initial])=>{
    const baseWidth=initial.fill?100:sources[initial.source].width,baseHeight=initial.fill?100*initial.height/initial.width:sources[initial.source].height;
    let last=initial;
    let lastRotation=initial.rotation;
    const frames=ordered.map((time,i):NativeFrame=>{
      const card=scenes[i].get(key),visible=Boolean(card);if(card)last=card;
      const scaleX=Math.max(.000001,last.width/baseWidth),scaleY=Math.max(.000001,last.height/baseHeight);
      let rotation=last.rotation;while(rotation-lastRotation>180)rotation-=360;while(rotation-lastRotation< -180)rotation+=360;lastRotation=rotation;
      const cover=Math.max(last.width/sources[initial.source].width,last.height/sources[initial.source].height);
      return {time,x:last.x-width/2,y:last.y-height/2,z:0,scaleX,scaleY,rotation,opacity:visible?1:0,
        radius:last.radius/scaleX,shade:last.shade??0,alpha:last.opacity??1,imageScaleX:initial.fill?cover/scaleX:1,imageScaleY:initial.fill?cover/scaleY:1,curveBoundary:i>0&&scenes[i-1].has(key)!==visible};
    });
    return {source:initial.source,layer:initial.layer,fill:initial.fill,baseWidth,baseHeight,frames};
  }).sort((a,b)=>a.layer-b.layer||a.source-b.source);
}
