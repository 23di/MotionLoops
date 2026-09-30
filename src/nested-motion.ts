import { convertPresetSelection, manualAt, sameMotion, trackContents } from "./preset-conversion";
import type { GeneratedKeyframe } from "./engine";

const markerKey = "orbit-entry-motion";
const copy = <T>(value:T):T => JSON.parse(JSON.stringify(value));
const propertyFields = new Set([
  "CORNER_RADIUS", "STROKE_WEIGHT", "STACK_SPACING", "STACK_PADDING_LEFT", "STACK_PADDING_TOP",
  "STACK_PADDING_RIGHT", "STACK_PADDING_BOTTOM", "WIDTH", "HEIGHT", "RECTANGLE_TOP_LEFT_CORNER_RADIUS",
  "RECTANGLE_TOP_RIGHT_CORNER_RADIUS", "RECTANGLE_BOTTOM_LEFT_CORNER_RADIUS", "RECTANGLE_BOTTOM_RIGHT_CORNER_RADIUS",
  "BORDER_TOP_WEIGHT", "BORDER_BOTTOM_WEIGHT", "BORDER_LEFT_WEIGHT", "BORDER_RIGHT_WEIGHT", "STACK_COUNTER_SPACING",
  "OPACITY", "GRID_ROW_GAP", "GRID_COLUMN_GAP", "TRANSLATION_X", "TRANSLATION_Y", "TRANSLATION_XY",
  "ROTATION", "SCALE_X", "SCALE_Y", "SCALE_XY", "PATH_TRIM_START", "PATH_TRIM_END",
]);
interface SavedTrack { field:KeyframeField; original:ManualKeyframeTrackInput; applied:ManualKeyframeTrackInput }
interface EntryMarker { version:1; tracks:SavedTrack[] }
interface NestedLayer { path:number[]; tracks:Array<{field:KeyframeField; input:ManualKeyframeTrackInput}> }
export interface NestedMotion { layers:NestedLayer[]; firstKey:number; unsupported?:string[] }

/** Property, paint, effect and component-property tracks all move together. */
export function collectManualTracks(tracks:ManualKeyframeTracks,onUnsupported?:(field:string)=>void):Array<{field:KeyframeField; input:ManualKeyframeTrackInput}> {
  const result:Array<{field:KeyframeField; input:ManualKeyframeTrackInput}>=[];
  const visit=(value:unknown,path:string[])=>{
    if(!value||typeof value!=="object")return;
    if("keyframes" in value&&Array.isArray(value.keyframes)){
      let field:KeyframeField;
      if(path.length===1){
        // Figma exposes some internal fields (e.g. ellipse arc motion) as "".
        // They survive native cloning, but the public write API rejects them.
        if(!propertyFields.has(path[0])){if(value.keyframes.length)onUnsupported?.(path[0]);return;}
        field={type:"PROPERTY",name:path[0] as KeyframePropertyFieldName};
      }
      else {
        const [collection,index]=path;
        if(!["fills","strokes","effects"].includes(collection)||!/^\d+$/.test(index))throw new Error("Unsupported nested animation field.");
        const indexed={type:"INDEXED_ITEM" as const,collection:collection as "effects",index:Number(index)};
        if(path.length===4&&path[2]==="properties")field={...indexed,propertyId:path[3]};
        else if(path.length===3&&collection==="effects")field={...indexed,field:path[2] as EffectKeyframeFieldName};
        else if(path.length===2&&collection!=="effects")field={...indexed,collection:collection as "fills"|"strokes"};
        else throw new Error("Unsupported nested animation field.");
      }
      result.push({field,input:trackContents(value as ManualKeyframeTrackInput)});
    }else for(const [key,item] of Object.entries(value))visit(item,[...path,key]);
  };
  visit(tracks,[]);
  return result;
}
function descendants(root:SceneNode):Array<{node:SceneNode;path:number[]}> {
  const result:Array<{node:SceneNode;path:number[]}>=[];
  const visit=(parent:SceneNode,path:number[])=>{
    if(!("children" in parent))return;
    [...parent.children].forEach((node,index)=>{
      const childPath=[...path,index];result.push({node,path:childPath});visit(node,childPath);
    });
  };
  visit(root,[]);
  return result;
}
function readMarker(node:SceneNode):EntryMarker|undefined {
  const raw=node.getPluginData(markerKey);
  if(!raw)return;
  const value=JSON.parse(raw) as EntryMarker;
  if(value.version!==1||!Array.isArray(value.tracks))throw new Error("Unsupported saved nested animation timing.");
  return value;
}
const fieldKey=(field:KeyframeField)=>JSON.stringify(field);

/** Bake once before cloning. Read a stable baseline; never add offsets to a previous Apply. */
export async function prepareNestedMotion(roots:readonly SceneNode[],enabled:boolean):Promise<NestedMotion[]> {
  const trees=roots.map(descendants);
  if(enabled){
    const rootIds=new Set(roots.map(node=>node.id));
    if(trees.some(tree=>tree.some(({node})=>rootIds.has(node.id))))
      throw new Error("Select the outer cards only when starting their nested animations on entry.");
    const styled=[...new Map(trees.flat().map(({node})=>[node.id,node])).values()]
      .filter(node=>node.animationStyles?.length);
    if(styled.length)await convertPresetSelection(styled,propertyFields);
  }
  return Promise.all(trees.map(async (tree,rootIndex)=>{
    let firstKey=Infinity;
    const unsupported:string[]=[];
    const layers=(await Promise.all(tree.map(async ({path})=>{
      const node=await layerAt(roots[rootIndex].id,path);
      if(!node.manualKeyframeTracks)return [];
      const marker=readMarker(node);
      if(!enabled&&!marker)return [];
      const tracks=collectManualTracks(node.manualKeyframeTracks,field=>{if(enabled)unsupported.push(`${node.name} (${node.id}): ${field||"unnamed field"}`);}).map(({field,input})=>{
        const saved=marker?.tracks.find(track=>fieldKey(track.field)===fieldKey(field));
        // Preserve edits made by the user after Apply, including newly added tracks.
        const original=saved&&sameMotion(input,saved.applied)?copy(saved.original):input;
        for(const key of original.keyframes){
          if(!Number.isFinite(key.timelinePosition)||key.timelinePosition<0)throw new Error(`${node.name}: invalid nested animation timing.`);
          firstKey=Math.min(firstKey,key.timelinePosition);
        }
        return {field,input:original};
      }).filter(({input})=>input.keyframes.length);
      return tracks.length?[{path,tracks}]:[];
    }))).flat();
    return {layers,firstKey:Number.isFinite(firstKey)?firstKey:0,unsupported};
  }));
}

type RootResolver=()=>Promise<BaseNode|null>;
// Motion can replace an entire card subtree, dropping aliases for the old IDs.
// Child order stays fixed during nested writes, so retain a page-relative anchor.
function rootResolver(root:SceneNode):RootResolver {
  let id=root.id;
  const path:number[]=[];
  let ancestor:BaseNode=root;
  while(ancestor.parent&&ancestor.parent.type!=="DOCUMENT"){
    const parent:BaseNode=ancestor.parent;
    if(!("children" in parent))break;
    const index=parent.children.findIndex(child=>child.id===ancestor.id);
    if(index<0)break;
    path.unshift(index);ancestor=parent;
  }
  const pageId=ancestor.type==="PAGE"?ancestor.id:undefined;
  return async()=>{
    const direct=await figma.getNodeByIdAsync(id);
    if(direct&&!direct.removed)return direct;
    if(!pageId)return null;
    let node=await figma.getNodeByIdAsync(pageId);
    for(const index of path){
      if(!node||!("children" in node))return null;
      const child:BaseNode|undefined=node.children[index];
      node=child?await figma.getNodeByIdAsync(child.id):null;
    }
    if(node)id=node.id;
    return node;
  };
}

async function layerAt(rootId:string,path:number[],resolveRoot?:RootResolver):Promise<SceneNode> {
  let node=resolveRoot?await resolveRoot():await figma.getNodeByIdAsync(rootId);
  for(const index of path){
    if(!node||!("children" in node))throw new Error("A nested animation layer became unavailable.");
    const child:BaseNode|undefined=node.children[index];
    node=child?await figma.getNodeByIdAsync(child.id):null;
  }
  if(!node||node.type==="DOCUMENT"||node.type==="PAGE"||node.removed)throw new Error("A nested animation layer became unavailable.");
  return node;
}

/** A single group shift retains all authored delays and never crushes keys at zero. */
export function nestedShift(snapshot:NestedMotion,entry:number,offset:number):number {
  if(!Number.isFinite(entry)||!Number.isFinite(offset))throw new Error("Invalid animation entry offset.");
  return Math.max(-snapshot.firstKey,entry+offset);
}
type LayerState = {path:number[]; tracks:ReturnType<typeof collectManualTracks>; marker:string};
const errorText=(error:unknown)=>error instanceof Error?error.message:String(error);

/** Re-resolve after every mutation: native Motion writes can invalidate node handles. */
async function writeLayer(rootId:string,layer:LayerState,resolveRoot?:RootResolver):Promise<void> {
  let id=(await layerAt(rootId,layer.path,resolveRoot)).id;
  const fresh=async()=>{
    const node=await figma.getNodeByIdAsync(id);
    if(node&&node.type!=="DOCUMENT"&&node.type!=="PAGE"&&!node.removed)return node;
    const replacement=await layerAt(rootId,layer.path,resolveRoot);id=replacement.id;return replacement;
  };
  for(const {field,input} of layer.tracks){
    const node=await fresh();
    const current=manualAt(node,field);
    if(current&&sameMotion(trackContents(current),input))continue;
    try{node.applyManualKeyframeTrack(field,input);}
    catch(error){throw new Error(`${node.name} (${node.id}), ${fieldKey(field)}: ${errorText(error)}`);}
  }
  const node=await fresh();
  if(node.getPluginData(markerKey)!==layer.marker)node.setPluginData(markerKey,layer.marker);
}
async function restoreLayers(rootId:string,layers:LayerState[],resolveRoot?:RootResolver):Promise<string[]> {
  const errors:string[]=[];
  for(const layer of layers){
    try{await writeLayer(rootId,layer,resolveRoot);}
    catch(error){errors.push(errorText(error));}
  }
  return errors;
}
export interface NestedMotionJob {rootId:string; snapshot:NestedMotion; shift:number; enabled:boolean; rewindAt?:number; loopEnd?:number; occurrences?:MainOccurrence[]; offset?:number}
/** One write phase and one native readback flush for the whole composition. */
export async function applyNestedMotionBatch(jobs:readonly NestedMotionJob[]):Promise<void> {
  const previous:Array<{rootId:string;layer:LayerState}>=[];
  const expected:Array<{rootId:string;id:string;layer:LayerState}>=[];
  const roots=new Map<string,RootResolver>();
  try{
    const requests=jobs.flatMap(({rootId,snapshot,shift,enabled,rewindAt,loopEnd,occurrences,offset})=>snapshot.layers.map(layer=>({rootId,shift,enabled,rewindAt,loopEnd,occurrences,offset,layer})));
    for(const rootId of new Set(requests.map(request=>request.rootId))){
      const root=await layerAt(rootId,[]);roots.set(rootId,rootResolver(root));
    }
    const resolved=await Promise.all(requests.map(({rootId,layer})=>layerAt(rootId,layer.path,roots.get(rootId))));
    for(const [index,{rootId,shift,enabled,rewindAt,loopEnd,occurrences,offset,layer}] of requests.entries()){
      const node=resolved[index];
      const before={path:layer.path,tracks:collectManualTracks(node.manualKeyframeTracks),marker:node.getPluginData(markerKey)};
      const saved:SavedTrack[]=layer.tracks.map(({field,input})=>({field,original:input,
        applied:enabled&&occurrences?.length&&loopEnd?periodicNestedTrack(input,occurrences,offset??0,loopEnd):retimeNestedTrack(input,enabled?shift:0,enabled?rewindAt:undefined,loopEnd),
      }));
      const after:LayerState={path:layer.path,tracks:saved.map(({field,applied})=>({field,input:applied})),
        marker:enabled?JSON.stringify({version:1,tracks:saved} satisfies EntryMarker):""};
      // Unchanged source baselines need neither writes nor a deferred readback.
      if(before.marker===after.marker&&after.tracks.every(({field,input})=>{
        const current=before.tracks.find(track=>fieldKey(track.field)===fieldKey(field));
        return current&&sameMotion(current.input,input);
      }))continue;
      previous.push({rootId,layer:before});expected.push({rootId,id:node.id,layer:after});
    }
    if(!expected.length)return;
    const fresh=async(item:typeof expected[number])=>{
      const node=await figma.getNodeByIdAsync(item.id);
      if(node&&node.type!=="DOCUMENT"&&node.type!=="PAGE"&&!node.removed)return node;
      const replacement=await layerAt(item.rootId,item.layer.path,roots.get(item.rootId));item.id=replacement.id;return replacement;
    };
    // Resolve fresh handles together, then synchronously write one field per node.
    // This retains native-handle safety without awaiting every individual layer.
    const rounds=Math.max(...expected.map(item=>item.layer.tracks.length));
    for(let index=0;index<rounds;index++){
      const active=expected.filter(item=>index<item.layer.tracks.length);
      const nodes=await Promise.all(active.map(fresh));
      for(const [i,item] of active.entries()){
        const node=nodes[i],{field,input}=item.layer.tracks[index],current=manualAt(node,field);
        if(current&&sameMotion(trackContents(current),input))continue;
        try{node.applyManualKeyframeTrack(field,input);}
        catch(error){throw new Error(`${node.name} (${node.id}), ${fieldKey(field)}: ${errorText(error)}`);}
      }
    }
    const markerNodes=await Promise.all(expected.map(fresh));
    for(const [index,item] of expected.entries()){
      const node=markerNodes[index];
      if(node.getPluginData(markerKey)!==item.layer.marker)node.setPluginData(markerKey,item.layer.marker);
    }
    await new Promise<void>(resolve=>setTimeout(resolve,0));
    for(const {rootId,layer} of expected){
      const node=await layerAt(rootId,layer.path,roots.get(rootId));
      for(const {field,input} of layer.tracks){
        const actual=manualAt(node,field);
        if(!actual||!sameMotion(trackContents(actual),input))throw new Error(`${node.name} (${node.id}), ${fieldKey(field)}: Figma did not preserve nested animation timing.`);
      }
    }
  }catch(error){
    const failures:string[]=[];
    for(const {rootId,layer} of previous.reverse())failures.push(...await restoreLayers(rootId,[layer],roots.get(rootId)));
    if(failures.length)throw new Error(`${errorText(error)}; nested rollback failed: ${failures.join("; ")}`);
    throw error;
  }
}
export async function applyNestedMotion(rootId:string,snapshot:NestedMotion,shift:number,enabled:boolean):Promise<void> {
  await applyNestedMotionBatch([{rootId,snapshot,shift,enabled}]);
}

export async function restoreNestedMotion(root:SceneNode):Promise<void> {
  const [snapshot]=await prepareNestedMotion([root],false);
  await applyNestedMotion(root.id,snapshot,0,false);
}

/** Restore original child state if a native composition fails during commit. */
export async function captureNestedState(roots:readonly SceneNode[]):Promise<()=>Promise<void>> {
  const states=roots.map(root=>({id:root.id,resolveRoot:rootResolver(root),layers:descendants(root).filter(({node})=>node.manualKeyframeTracks).map(({node,path})=>({
    path,tracks:collectManualTracks(node.manualKeyframeTracks),marker:node.getPluginData(markerKey),
  }))}));
  return async()=>{
    const errors:string[]=[];
    for(const root of states)errors.push(...await restoreLayers(root.id,root.layers.filter(layer=>layer.tracks.length||layer.marker),root.resolveRoot));
    if(errors.length)throw new Error(errors.join("; "));
  };
}

export interface EntryGeometry { width:number; height:number; frameWidth:number; frameHeight:number; offsetX?:number; offsetY?:number }
export interface VisibilityWindow { start:number; end:number }
/** Intersect the animated card with its containing frame, before depth-copy opacity splitting. */
export function visibilityWindows(frames:readonly GeneratedKeyframe[],geometry:EntryGeometry):VisibilityWindow[] {
  const visible=(frame:GeneratedKeyframe)=>{
    if(frame.opacity<=.001||Math.abs(frame.scaleX)<.00001||Math.abs(frame.scaleY)<.00001)return false;
    const angle=frame.rotation*Math.PI/180,c=Math.abs(Math.cos(angle)),s=Math.abs(Math.sin(angle));
    const w=geometry.width*Math.abs(frame.scaleX)/2,h=geometry.height*Math.abs(frame.scaleY)/2;
    return Math.abs(frame.x+(geometry.offsetX??0))<geometry.frameWidth/2+w*c+h*s&&
      Math.abs(frame.y+(geometry.offsetY??0))<geometry.frameHeight/2+w*s+h*c;
  };
  const windows:VisibilityWindow[]=[];
  let previous:GeneratedKeyframe|undefined;
  let wasVisible=false;
  for(const right of frames){
    // Subdivide the exported linear segments so entry timing is finer than
    // the sparse trajectory keys. Reference frames already include handoffs.
    const left=previous??right,steps=Math.max(1,Math.ceil((right.time-left.time)*120));
    for(let step=previous?1:0;step<=steps;step++){
      const p=step/steps;
      const frame={...right,time:left.time+(right.time-left.time)*p};
      for(const key of ["x","y","scaleX","scaleY","rotation","opacity"] as const)
        frame[key]=left[key]+(right[key]-left[key])*p;
      const current=visible(frame);
      if(current&&!wasVisible)windows.push({start:frame.time,end:frame.time});
      if(current)windows[windows.length-1].end=frame.time;
      wasVisible=current;
    }
    previous=right;
  }
  return windows;
}
/** A layer handoff is not a new entry. All copies of one visible card share its start. */
export function mergeVisibilityWindows(windows:readonly VisibilityWindow[]):VisibilityWindow[] {
  const result:VisibilityWindow[]=[];
  for(const window of [...windows].sort((a,b)=>a.start-b.start)){
    const last=result[result.length-1];
    if(last&&window.start<=last.end+1/60)last.end=Math.max(last.end,window.end);
    else result.push({...window});
  }
  return result;
}
export function entryForInstance(windows:readonly VisibilityWindow[],sourceWindows:readonly VisibilityWindow[],duration:number):number {
  const first=windows[0]?.start;
  if(first===undefined)return duration; // A fully offscreen copy must not start early.
  return sourceWindows.find(window=>first>=window.start-1/60&&first<=window.end+1/60)?.start??first;
}

/** Never report complete retiming when Figma only exposes a read-only field. */
export function nestedMotionNotice(snapshots:readonly NestedMotion[]):string {
  const fields=[...new Set(snapshots.flatMap(snapshot=>snapshot.unsupported??[]))];
  return fields.length?` ${fields.length} nested animation track(s) kept their original timing because Figma does not support editing them: ${fields.join("; ")}.`:"";
}

/** Start when a card becomes the foreground/central owner, not at the viewport edge.
 * Native instances share the same sample times; merge ownership across service copies.
 */
export function mainCardStarts(instances:readonly {source:number;layer:number;frames:readonly GeneratedKeyframe[]}[],sourceCount:number,duration:number,mode:"front"|"center"="center"):number[] {
  const starts=Array.from({length:sourceCount},()=>duration);
  const sampleCount=instances[0]?.frames.length??0;
  for(let i=0;i<sampleCount;i++){
    let winner:typeof instances[number]|undefined,best=-Infinity;
    for(const instance of instances){
      const frame=instance.frames[i];
      if(!frame||frame.opacity<=.001)continue;
      const score=mode==="front"?instance.layer:-(frame.x*frame.x+frame.y*frame.y);
      if(score>best){best=score;winner=instance;}
    }
    if(winner)starts[winner.source]=Math.min(starts[winner.source],winner.frames[i].time);
  }
  return starts;
}
/** For a trajectory, foreground depth defines the main pose; flat paths use the center. */
export function mainPoseTime(frames:readonly GeneratedKeyframe[],duration:number):number {
  const visible=frames.filter(frame=>frame.opacity>.001);
  if(!visible.length)return duration;
  const zs=visible.map(frame=>frame.z),hasDepth=Math.max(...zs)-Math.min(...zs)>1e-5;
  let best=-Infinity,time=duration;
  for(const frame of visible){
    const score=hasDepth?frame.z:-(frame.x*frame.x+frame.y*frame.y);
    if(score>best+1e-8){best=score;time=frame.time;}
  }
  return time;
}

/** Clip the last visible segment exactly before the instantaneous loop reset. */
function clippedNestedKey(left:ManualKeyframeInput,right:ManualKeyframeInput,time:number):ManualKeyframeInput {
  const progress=(time-left.timelinePosition)/(right.timelinePosition-left.timelinePosition);
  const ease=right.easing;
  let amount=progress,easing:MotionEasing={type:"LINEAR"};
  if(sameMotion(left.value,right.value)||ease?.type==="HOLD")return {timelinePosition:time,value:copy(left.value),easing:{type:"HOLD"}};
  if(ease&&ease.type!=="LINEAR"){
    const curve="easingFunctionCubicBezier" in ease?ease.easingFunctionCubicBezier:undefined;
    if(!curve||("easingFunctionSpring" in ease&&ease.easingFunctionSpring))
      throw new Error("A nested spring crosses the loop reset. Increase the cycle duration or shorten that animation.");
    const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
    const split=(a:number,b:number,t:number)=>{
      const p=lerp(0,a,t),q=lerp(a,b,t),r=lerp(b,1,t),s=lerp(p,q,t),u=lerp(q,r,t);
      return [p,s,lerp(s,u,t)];
    };
    let lo=0,hi=1;
    for(let i=0;i<50;i++){const mid=(lo+hi)/2;if(split(curve.x1,curve.x2,mid)[2]<progress)lo=mid;else hi=mid;}
    const t=(lo+hi)/2,x=split(curve.x1,curve.x2,t),y=split(curve.y1,curve.y2,t);amount=y[2];
    if(Math.abs(amount)<1e-12)throw new Error("A nested easing turning point crosses the loop reset. Adjust the offset slightly.");
    easing={type:"CUSTOM_CUBIC_BEZIER",easingFunctionCubicBezier:{x1:x[0]/progress,y1:y[0]/amount,x2:x[1]/progress,y2:y[1]/amount}};
  }
  const interpolate=(a:unknown,b:unknown):unknown=>{
    if(typeof a==="number"&&typeof b==="number")return a+(b-a)*amount;
    if(a&&b&&typeof a==="object"&&typeof b==="object")return Object.fromEntries(Object.entries(a).map(([key,value])=>[key,interpolate(value,(b as Record<string,unknown>)[key])]));
    return a;
  };
  return {timelinePosition:time,value:interpolate(left.value,right.value) as KeyframeValue,easing};
}

/** Rewind the returning duplicate with a discrete key, never a reverse tween. */
export function retimeNestedTrack(input:ManualKeyframeTrackInput,shift:number,rewindAt?:number,loopEnd?:number):ManualKeyframeTrackInput {
  const result={...copy(input),keyframes:input.keyframes.map(key=>({...copy(key),timelinePosition:key.timelinePosition+shift}))};
  if(rewindAt===undefined||!result.keyframes.length)return result;
  if(loopEnd===undefined||!Number.isFinite(rewindAt)||rewindAt<0||rewindAt>loopEnd)throw new Error("Invalid nested loop boundary.");
  const first=result.keyframes[0],last=result.keyframes[result.keyframes.length-1];
  if(last.timelinePosition<=rewindAt&&sameMotion(first.value,last.value))return result;
  if(last.timelinePosition>=rewindAt){
    const boundary=Math.max(0,rewindAt-1e-5);
    const prefix=result.keyframes.filter(key=>key.timelinePosition<=boundary);
    const left=prefix[prefix.length-1],right=result.keyframes.find(key=>key.timelinePosition>boundary);
    if(left&&right&&left.timelinePosition<boundary)prefix.push(clippedNestedKey(left,right,boundary));
    if(!prefix.length)prefix.push({timelinePosition:0,value:copy(first.value),easing:{type:"HOLD"}});
    result.keyframes=prefix;
  }
  result.keyframes=result.keyframes.filter(key=>key.timelinePosition<rewindAt);
  result.keyframes.push({timelinePosition:rewindAt,value:copy(first.value),easing:{type:"HOLD"}});
  return result;
}

/** Return to the initial state before a seam duplicate re-enters the scene.
 * Visibility is merged across service layers, so depth handoffs never reset it.
 */
export function loopRewindTimes(instances:readonly {source:number;frames:readonly GeneratedKeyframe[]}[],sourceCount:number,duration:number,mainStarts:readonly number[]):Array<number|undefined> {
  const count=instances[0]?.frames.length??0;
  return Array.from({length:sourceCount},(_,source)=>{
    const copies=instances.filter(instance=>instance.source===source);
    const visible=(i:number)=>copies.some(instance=>(instance.frames[i]?.opacity??0)>.001);
    if(!count||!visible(0)||!visible(count-1))return undefined;
    let reset=duration;
    for(let i=1;i<count;i++)if(!visible(i-1)&&visible(i)){
      const time=copies[0].frames[i].time;
      if(time>mainStarts[source]+1e-5)reset=time;
    }
    return reset;
  });
}

export interface MainOccurrence {start:number; reset:number}
/** Real ownership transitions, including the occurrence spanning the timeline seam. */
export function mainCardOccurrences(instances:readonly {source:number;layer:number;frames:readonly GeneratedKeyframe[]}[],sourceCount:number,duration:number,mode:"front"|"center"="center"):MainOccurrence[][] {
  const events:Array<{source:number;time:number}>=[];
  const count=instances[0]?.frames.length??0;
  let previous=-1;
  for(let i=0;i<count;i++){
    let winner=-1,best=-Infinity;
    for(const item of instances){const f=item.frames[i];if(!f||f.opacity<=.001)continue;
      const score=mode==="front"?item.layer:-(f.x*f.x+f.y*f.y);
      if(score>best){best=score;winner=item.source;}
    }
    const time=instances[0].frames[i].time;
    if(winner!==previous&&winner>=0&&time<duration-1e-7)events.push({source:winner,time});
    previous=winner;
  }
  // t=0 is a sample of an existing occurrence, not a new start on every loop.
  if(events.length>1&&events[0].time===0&&events[0].source===previous)events.shift();
  return Array.from({length:sourceCount},(_,source)=>{
    const copies=instances.filter(item=>item.source===source);
    const arrivals:number[]=[];
    let visible=copies.some(item=>(item.frames[count-1]?.opacity??0)>.001);
    for(let i=0;i<count;i++){
      const next=copies.some(item=>(item.frames[i]?.opacity??0)>.001);
      if(next&&!visible)arrivals.push(instances[0].frames[i].time);
      visible=next;
    }
    return events.filter(event=>event.source===source).map(({time})=>({start:time,
      reset:arrivals.filter(t=>t<=time).at(-1)??(arrivals.length?arrivals.at(-1)!-duration:time)}));
  });
}

/** Slice linear/cubic motion in time/value space, preserving its easing. */
function nestedTrackWindow(input:ManualKeyframeTrackInput,from:number,to:number):ManualKeyframeTrackInput {
  const keys=input.keyframes;
  if(!keys.length)return copy(input);
  const out:ManualKeyframeInput[]=[];
  const hold=(time:number,value:KeyframeValue)=>({timelinePosition:time,value:copy(value),easing:{type:"HOLD" as const}});
  if(from<keys[0].timelinePosition)out.push(hold(from,keys[0].value));
  const mix=(a:unknown,b:unknown,p:number):unknown=>{
    if(typeof a==="number"&&typeof b==="number")return a+(b-a)*p;
    if(a&&b&&typeof a==="object"&&typeof b==="object")return Object.fromEntries(Object.entries(a).map(([k,v])=>[k,mix(v,(b as Record<string,unknown>)[k],p)]));
    return a;
  };
  const split=(v:number[],t:number):[number[],number[]]=>{
    const a=v[0]+(v[1]-v[0])*t,b=v[1]+(v[2]-v[1])*t,c=v[2]+(v[3]-v[2])*t;
    const d=a+(b-a)*t,e=b+(c-b)*t,f=d+(e-d)*t;
    return [[v[0],a,d,f],[f,e,c,v[3]]];
  };
  for(let i=1;i<keys.length;i++){
    const a=keys[i-1],b=keys[i],start=Math.max(from,a.timelinePosition),end=Math.min(to,b.timelinePosition);
    if(end<=start)continue;
    const span=b.timelinePosition-a.timelinePosition,p=(start-a.timelinePosition)/span,q=(end-a.timelinePosition)/span;
    let left=a.value,right=b.value,easing=b.easing;
    if(p!==0||q!==1){
      if(easing?.type==="HOLD"||sameMotion(a.value,b.value)){right=q===1?b.value:a.value;easing={type:"HOLD"};}
      else if(!easing||easing.type==="LINEAR"){left=mix(a.value,b.value,p) as KeyframeValue;right=mix(a.value,b.value,q) as KeyframeValue;easing={type:"LINEAR"};}
      else{
        const curve="easingFunctionCubicBezier" in easing?easing.easingFunctionCubicBezier:undefined;
        if(!curve||("easingFunctionSpring" in easing&&easing.easingFunctionSpring))throw new Error("A nested spring crosses the loop seam. Shorten the animation or adjust its offset.");
        const x=[0,curve.x1,curve.x2,1],y=[0,curve.y1,curve.y2,1];
        const at=(value:number)=>{let lo=0,hi=1;for(let j=0;j<50;j++){const m=(lo+hi)/2;if(split(x,m)[0][3]<value)lo=m;else hi=m;}return (lo+hi)/2;};
        const lo=p===0?0:at(p),hi=q===1?1:at(q);
        const restrict=(v:number[])=>split(split(v,hi)[0],lo/hi)[1];
        const cx=restrict(x),cy=restrict(y),dy=cy[3]-cy[0];
        left=mix(a.value,b.value,cy[0]) as KeyframeValue;right=mix(a.value,b.value,cy[3]) as KeyframeValue;
        if(Math.abs(dy)<1e-12)throw new Error("A nested easing turning point crosses the loop seam. Adjust its offset slightly.");
        easing={type:"CUSTOM_CUBIC_BEZIER",easingFunctionCubicBezier:{x1:(cx[1]-p)/(q-p),x2:(cx[2]-p)/(q-p),y1:(cy[1]-cy[0])/dy,y2:(cy[2]-cy[0])/dy}};
      }
    }
    if(!out.length||out[out.length-1].timelinePosition<start)out.push(hold(start,left));
    out.push({timelinePosition:end,value:copy(right),easing:copy(easing??{type:"LINEAR"})});
  }
  if(!out.length)out.push(hold(from,from>=keys[keys.length-1].timelinePosition?keys[keys.length-1].value:keys[0].value));
  if(out[out.length-1].timelinePosition<to)out.push(hold(to,out[out.length-1].value));
  return {...copy(input),keyframes:out};
}

/** Replay each foreground occurrence, including the tail that wraps across t=0. */
export function periodicNestedTrack(input:ManualKeyframeTrackInput,occurrences:readonly MainOccurrence[],offset:number,duration:number):ManualKeyframeTrackInput {
  if(!occurrences.length||!input.keyframes.length)return copy(input);
  if(!Number.isFinite(offset)||!Number.isFinite(duration)||duration<=0)
    throw new Error("Invalid nested loop timing.");
  const episodes:Array<{start:number;reset:number}>=[];
  for(const occurrence of occurrences){
    // Only neighboring resets can affect this loop. Normalize their phase
    // before enumerating cycles; huge offsets must never allocate huge arrays
    // or produce a cycle counter too large for ++ to advance.
    const start=occurrence.start+offset,reset=Math.min(start,occurrence.reset);
    const phase=((reset%duration)+duration)%duration;
    const delay=Math.min(start-reset,duration);
    for(let cycle=-2;cycle<=2;cycle++){
      const time=phase+cycle*duration;
      episodes.push({start:time+delay,reset:time});
    }
  }
  episodes.sort((a,b)=>a.reset-b.reset);
  const keys:ManualKeyframeInput[]=[];
  for(let i=0;i<episodes.length-1;i++){
    const episode=episodes[i],end=episodes[i+1].reset;
    if(end<=0||episode.reset>=duration||end<=episode.reset)continue;
    const shifted={...input,keyframes:input.keyframes.map(key=>({...copy(key),timelinePosition:key.timelinePosition+episode.start}))};
    const segment=nestedTrackWindow(shifted,episode.reset,end-1e-5);
    keys.push(...segment.keyframes.map((key,index)=>index===0?{...key,easing:{type:"HOLD" as const}}:key));
  }
  return nestedTrackWindow({...input,keyframes:keys},0,duration);
}
