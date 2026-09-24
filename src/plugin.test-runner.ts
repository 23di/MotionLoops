// @ts-nocheck
import assert from "node:assert/strict";
import { depthSplitOpacity, fitSettingsToFrame, generateNodeKeyframes, pointForGeometry } from "./engine";
import { builtInPresetTunings } from "./presets";
import { presetOptions, type MotionSettings } from "./types";
import { referencePresets } from "./reference-catalog";
import { referenceScene } from "./reference-engine";
import { cloneData } from "./clone-data";
import { freshPreset } from "./catalog";
import { pulseDefaults } from "./motion-modifiers";
import { toMotionDocument } from "./motion-system";

let nextId = 1;
const nodes = new Map<string, any>();
const timeline = { id: "timeline-1", duration: 5 };
let proxyChildReads = false;
let findAllCalls = 0;
let failTrackWrite: { nodeId: string; field: string; remaining?: number } | null = null;
let failTrackRemoval: { nodeId: string; field: string; remaining?:number } | null = null;
const invalidatedSourceIds=new Set<string>();
const nodeAliases=new Map<string,any>();
let remapServiceOnNextMarker=false;
let remapTreeOnTrackWriteNodeId:string|null=null;
let remapTreeGeneration=0;
let parentRelaunchData: Record<string, string> = {};
let insertChildCalls = 0;
let failInsertChildRemaining = 0;
let viewportNavigationCalls = 0;
const parent = {
  id: "frame-1",
  name: "Orbit Frame",
  type: "FRAME",
  layoutMode: "NONE",
  parent: { type: "PAGE" },
  getPluginData: () => "",
  setRelaunchData(data: Record<string, string>) { parentRelaunchData = { ...data }; },
  getRelaunchData() { return { ...parentRelaunchData }; },
  _children: [] as any[],
  get children() {
    return proxyChildReads
      ? this._children.map((child: any) => new Proxy(child, {}))
      : this._children;
  },
  set children(children: any[]) {
    this._children = children;
    this.reflow();
  },
  reflow() {
    if (this.layoutMode === "NONE") return;
    let x = 0;
    for (const child of this._children) {
      if (child.layoutPositioning === "ABSOLUTE") continue;
      child.relativeTransform = [[1, 0, x], [0, 1, 0]];
      x += child.width + 32;
    }
  },
  insertChild(index: number, node: any) {
    insertChildCalls += 1;
    if (failInsertChildRemaining > 0) {
      failInsertChildRemaining -= 1;
      throw new Error("Simulated stale insertChild proxy");
    }
    this._children = this._children.filter((child) => child.id !== node.id);
    this._children.splice(index, 0, node);
    node.parent = this;
    this.reflow();
  },
};
nodes.set(parent.id, parent);
const topFrame = { absoluteBoundingBox: { x: 0, y: 0, width: 720, height: 400 } };

function remapAttachedTreeIds():void {
  remapTreeGeneration += 1;
  for(const node of [parent,...parent._children]){
    const oldId=node.id;
    nodes.delete(oldId);
    node.id=`${oldId}-tree-${remapTreeGeneration}`;
    nodeAliases.set(oldId,node);
    nodes.set(node.id,node);
  }
}

let nativeCoordinateWrites=false;
function makeNode(name: string): any {
  const pluginData = new Map<string, string>();
  let relaunchData: Record<string, string> = {};
  const node = {
    id: `node-${nextId++}`,
    name,
    type: "RECTANGLE",
    _layoutPositioning: "AUTO",
    get layoutPositioning(){return this._layoutPositioning;},
    set layoutPositioning(value:string){this._layoutPositioning=value;this._parent.reflow?.();},
    width: 80,
    height: 100,
    opacity: 1,
    rotation:0,
    _x:0,_y:0,_previousX:0,
    get x(){return this._x;},
    set x(value:number){this._previousX=this._x;this._x=value;},
    get y(){return this._y;},
    set y(value:number){if(nativeCoordinateWrites)this._x=this._previousX;this._y=value;},
    get relativeTransform(){return [[1,0,this._x],[0,1,this._y]];},
    set relativeTransform(value:number[][]){this._x=value[0][2];this._y=value[1][2];},
    rescale(scale:number){this.width*=scale;this.height*=scale;},
    effects: [] as any[],
    absoluteBoundingBox: { x: 320, y: 150, width: 80, height: 100 },
    _parent: parent,
    get parent() {
      if (this.removed) throw new Error(`in get_parent: The node with id "${this.id}" does not exist`);
      return this._parent;
    },
    set parent(value: any) { this._parent = value; },
    locked: false,
    visible: true,
    removed: false,
    timelines: [timeline],
    manualKeyframeTracks: {} as Record<string, unknown>,
    removedTrackNames: [] as string[],
    getTopLevelFrame: () => topFrame,
    getPluginData: (key: string) => pluginData.get(key) ?? "",
    setPluginData: (key: string, value: string) => {
      if(invalidatedSourceIds.has(node.id))throw new Error("Source proxy invalidated by service removal");
      pluginData.set(key,value);
      if(remapServiceOnNextMarker&&key==="orbit-motion"&&value){
        const marker=JSON.parse(value);
        if(marker.role==="back"&&marker.effectsVersion===1){
          remapServiceOnNextMarker=false;
          nodes.delete(node.id);node.id=`${node.id}-remapped`;nodes.set(node.id,node);
        }
      }
    },
    setRelaunchData: (data: Record<string, string>) => { relaunchData = { ...data }; },
    getRelaunchData: () => ({ ...relaunchData }),
    applyManualKeyframeTrack(field: { name: string }, track: unknown) {
      if(remapTreeOnTrackWriteNodeId===this.id){
        remapTreeOnTrackWriteNodeId=null;
        remapAttachedTreeIds();
      }
      if (failTrackWrite?.nodeId === this.id && failTrackWrite.field === field.name) {
        if ((failTrackWrite.remaining ?? 1) > 1) failTrackWrite.remaining = (failTrackWrite.remaining ?? 1) - 1;
        else failTrackWrite = null;
        throw new Error("Simulated stale Figma node");
      }
      this.manualKeyframeTracks[field.name] = track;
    },
    removeManualKeyframeTrack(field: { name: string }) {
      if (failTrackRemoval?.nodeId === this.id && failTrackRemoval.field === field.name) {
        if((failTrackRemoval.remaining??1)>1)failTrackRemoval.remaining!--;
        else failTrackRemoval = null;
        throw new Error("Simulated track removal failure");
      }
      this.removedTrackNames.push(field.name);
      delete this.manualKeyframeTracks[field.name];
    },
    setTimelineDuration(id: string, duration: number) {
      assert.equal(id, timeline.id);
      timeline.duration = duration;
    },
    clone() {
      const clone = makeNode(this.name);
      clone.manualKeyframeTracks = cloneData(this.manualKeyframeTracks);
      clone.effects = cloneData(this.effects);
      clone.opacity=this.opacity;clone.visible=this.visible;clone.relativeTransform=this.relativeTransform;
      const marker = this.getPluginData("orbit-motion");
      if (marker) clone.setPluginData("orbit-motion", marker);
      parent.insertChild(parent.children.indexOf(this) + 1, clone);
      return clone;
    },
    remove() {
      this.removed = true;
      parent.children = parent._children.filter((child) => child.id !== this.id);
      nodes.delete(this.id);
    },
  };
  nodes.set(node.id, node);
  return node;
}

const source = makeNode("Card");
const userBlur = { type: "LAYER_BLUR", blurType: "NORMAL", radius: 7, visible: true };
source.effects = [userBlur];
parent.children = [source];
let onMessage: ((message: unknown) => Promise<void>) | undefined;
const postedMessages: any[] = [];
globalThis.__html__ = "";
globalThis.figma = {
  showUI() {},
  ui: {
    postMessage(message: unknown) { postedMessages.push(message); },
    resize() {},
    set onmessage(handler) { onMessage = handler; },
    get onmessage() { return onMessage; },
  },
  currentPage: {
    selection: [source],
    findAll(predicate: (node: any) => boolean) {
      findAllCalls += 1;
      return [...nodes.values()].filter((node) => !node.removed && predicate(node));
    },
  },
  viewport: { scrollAndZoomIntoView() { viewportNavigationCalls += 1; } },
  motion: { physicalSpringToNormalized: () => 0.25 },
  getNodeByIdAsync: async (id: string) => {invalidatedSourceIds.delete(id);return nodeAliases.get(id)??nodes.get(id) ?? null;},
  on() {},
};

await import("./code");

const settings: MotionSettings = {
  preset: "orbit-3d-ring",
  motion: {
    duration: 5,
    stagger: 0,
    keyframes: 32,
    direction: "clockwise",
    fullCycle: { type: "easing", duration: 1, ease: [0, 0, 1, 1] },
  },
  geometry: {
    units: "pixels",
    shape: "parametric",
    dynamicScale: false,
    customPath: "[[0,0.5],[1,0.5]]",
    radiusX: 260,
    radiusY: 120,
    circleRotation: 0,
    depth: 220,
    tilt: 0,
    turns: 1,
    rotation: 0,
    orient3d: true,
    xWave: "cos",
    yWave: "sin",
    depthWave: "sin",
    xFrequency: 1,
    yFrequency: 1,
    depthFrequency: 1,
    xAmplitude: 1,
    yAmplitude: 0.22,
    depthAmplitude: 1,
    xPhase: 0,
    yPhase: 0,
    depthPhase: 0,
    yOffset: 0,
    shapeAmount: 1,
    itemSpread: 1,
    depthFalloff: 1,
  },
  appearance: {
    nearScale: 1.2,
    farScale: 0.6,
    farOpacity: 0.25,
    fadeStart: 0,
    fadeEnd: 100,
    opacityCurve: "linear",
    farBlur: 0,
    frontShadow: 0,
    facePath: false,
  },
  other: { centerBeforeApply: true, serviceLayers: "2", depthSplit: true, scope: "selection" },
};

function cubic(progress: number, a: number, b: number, c: number, d: number): number {
  const inverse = 1 - progress;
  return inverse ** 3 * a + 3 * inverse ** 2 * progress * b +
    3 * inverse * progress ** 2 * c + progress ** 3 * d;
}

function easingProgress(easing: any, progress: number): number {
  if (easing.type === "HOLD") return 0;
  if (easing.type !== "CUSTOM_CUBIC_BEZIER") return progress;
  const curve = easing.easingFunctionCubicBezier;
  let low = 0;
  let high = 1;
  let parameter = progress;
  for (let iteration = 0; iteration < 18; iteration += 1) {
    parameter = (low + high) / 2;
    if (cubic(parameter, 0, curve.x1, curve.x2, 1) < progress) low = parameter;
    else high = parameter;
  }
  return cubic(parameter, 0, curve.y1, curve.y2, 1);
}

function sampleTrack(track: any, time: number): number {
  const keys = track.keyframes;
  if (time <= keys[0].timelinePosition) return keys[0].value.value;
  const last = keys.at(-1);
  if (time >= last.timelinePosition) return last.value.value;
  let destinationIndex = 1;
  while (destinationIndex < keys.length - 1 && time > keys[destinationIndex].timelinePosition) {
    destinationIndex += 1;
  }
  const from = keys[destinationIndex - 1];
  const to = keys[destinationIndex];
  const local = (time - from.timelinePosition) /
    (to.timelinePosition - from.timelinePosition);
  const progress = easingProgress(to.easing, local);
  return from.value.value + (to.value.value - from.value.value) * progress;
}

function assertSparseTrackAccuracy(activeSettings: MotionSettings): void {
  const frames = generateNodeKeyframes(activeSettings, 0, 1);
  const tracks = source.manualKeyframeTracks;
  for (const frame of frames) {
    assert(Math.abs(sampleTrack(tracks.TRANSLATION_X, frame.time) - frame.x) <= 0.76);
    assert(Math.abs(sampleTrack(tracks.TRANSLATION_Y, frame.time) - frame.y) <= 0.76);
    assert(Math.abs(sampleTrack(tracks.SCALE_X, frame.time) - frame.scaleX) <= 0.0031);
    assert(Math.abs(sampleTrack(tracks.SCALE_Y, frame.time) - frame.scaleY) <= 0.0031);
    assert(Math.abs(sampleTrack(tracks.ROTATION, frame.time) - frame.rotation) <= 0.251);
    const expectedOpacity = activeSettings.other.depthSplit
      ? depthSplitOpacity(frame, "front")
      : frame.opacity;
    const opacityError = Math.abs(sampleTrack(tracks.OPACITY, frame.time) - expectedOpacity);
    const intentionalHandoff = tracks.OPACITY.keyframes.some((keyframe: any) =>
      keyframe.timelinePosition === frame.time && keyframe.easing.type === "HOLD"
    );
    assert(opacityError <= 0.0041 || intentionalHandoff);
  }
}

assert(onMessage, "Plugin message handler must be registered");
const selectedBeforeSectionCheck = globalThis.figma.currentPage.selection;
globalThis.figma.currentPage.selection = [{ id: "section-1", name: "Test section", type: "SECTION" }];
for (const [candidate, expected] of [
  [freshPreset("reference-carousel-01"), "Sections can't be animated. Select the cards inside a frame."],
  [settings, "Sections can't be animated. Select a frame or layers inside it."],
] as const) {
  const before = postedMessages.length;
  await onMessage({ type: "apply", settings: candidate });
  assert(postedMessages.slice(before).some((message) =>
    message.type === "result" && message.kind === "error" && message.message === expected
  ), "Selecting a section explains which layers to animate");
}
globalThis.figma.currentPage.selection = selectedBeforeSectionCheck;
const findAllCallsBeforeApply = findAllCalls;
const firstApply = onMessage({ type: "apply", settings });
const duplicateApply = onMessage({ type: "apply", settings });
await Promise.all([firstApply, duplicateApply]);
assert.equal(
  findAllCalls - findAllCallsBeforeApply,
  3,
  "Apply scans for inventory, postcondition verification, and the diagnostic snapshot",
);
assert.equal(parent.children.length, 2, "Concurrent Apply messages must collapse into one operation");
assert.equal(viewportNavigationCalls, 0, "Apply must preserve the user's canvas zoom and position");
assert(
  postedMessages.some((message) => message.type === "result" && message.kind === "success" && message.message === "Animated 1 layer."),
  "Apply must report a successful result",
);
assert.equal(parent.children.length, 2, "Depth Split must create exactly one back copy");
assert.deepEqual(
  source.getRelaunchData(),
  { "edit-orbit": "Edit 3D · Turntable animation in Motion Loops" },
  "Animated sources must expose the native Orbit relaunch action",
);
assert.deepEqual(
  parent.getRelaunchData(),
  { "edit-orbit": "Edit 3D · Turntable animation in Motion Loops" },
  "The animated source's parent must expose the same Orbit relaunch action",
);
assertSparseTrackAccuracy(settings);
assert(
  Math.max(...Object.values(source.manualKeyframeTracks).map((track: any) => track.keyframes.length)) <= 15,
  "The standard orbit must compress every property from 31 samples to at most 15 keys",
);
const firstBack = parent.children.find((node) => node !== source);
assert(firstBack.locked, "Back copy must be locked after applying tracks");
assert.deepEqual(firstBack.getRelaunchData(), {}, "Service copies must not expose a relaunch action");
assert.deepEqual(
  firstBack.effects,
  [userBlur],
  "A fresh service copy must preserve the source layer's own blur effect",
);
assert.equal(firstBack.name, "Card · Orbit Depth 1 (service)", "Back copy must be visibly marked as service-owned");
assert.deepEqual(
  firstBack.removedTrackNames,
  [],
  "The first clean back copy must not run inherited-track cleanup",
);

const currentBack = () => parent.children.find((node) => node !== source);
const assertSynchronizedPair = (back: any) => {
  assert(back, "Depth Split must keep one back copy");
  assert(back.locked, "The current back copy must be locked");
  for (const field of ["TRANSLATION_X", "TRANSLATION_Y", "SCALE_X", "SCALE_Y", "ROTATION"]) {
    assert.deepEqual(
      back.manualKeyframeTracks[field],
      source.manualKeyframeTracks[field],
      `${field} must stay identical on front and back copies`,
    );
  }
};
assertSynchronizedPair(firstBack);
for (const node of [source, firstBack]) {
  const opacityKeys = node.manualKeyframeTracks.OPACITY.keyframes;
  assert(
    opacityKeys.slice(1).some((keyframe: any) => keyframe.easing.type === "HOLD"),
    "Depth handoffs must switch copies with HOLD instead of crossfading overlapping layers",
  );
}

settings.appearance.farBlur = 12;
// Figma can expose the playhead's animated opacity here. Refresh must retain
// the original base captured by the first Orbit Apply instead of persisting 0.
source.opacity = 0;
const insertCallsBeforeStableRefresh = insertChildCalls;
await onMessage({ type: "apply", settings });
assert.equal(
  insertChildCalls,
  insertCallsBeforeStableRefresh,
  "A stable Refresh must not perform redundant layer reordering",
);
assert.deepEqual(
  firstBack.effects.map((effect: any) => effect.radius),
  [7, 12],
  "Orbit blur must be added without replacing the source blur",
);
assert.equal(JSON.parse(source.getPluginData("orbit-motion")).baseOpacity, 1);
assert.equal((source.manualKeyframeTracks.OPACITY as any).baseValue.value, 1);
assert(
  generateNodeKeyframes(settings, 0, 1).some((frame) => (
    sampleTrack(source.manualKeyframeTracks.OPACITY, frame.time) > 0 &&
    sampleTrack(firstBack.manualKeyframeTracks.OPACITY, frame.time) > 0
  )),
  "Blur handoff must reveal the sharper layer before switching off the farther layer",
);
settings.appearance.farBlur = 4;
settings.appearance.frontShadow = 10;
await onMessage({ type: "apply", settings });
assert(source.effects.some((effect:any)=>effect.type==="DROP_SHADOW"&&effect.radius===10),"Front shadow must reach the exported front layer");
settings.appearance.frontShadow = 0;
assert.deepEqual(
  firstBack.effects.map((effect: any) => effect.radius),
  [7, 4],
  "Refreshing Orbit blur must replace only the previously managed effect",
);
settings.appearance.farBlur = 0;
await onMessage({ type: "apply", settings });
assert.deepEqual(firstBack.effects, [userBlur], "Disabling Orbit blur must preserve the source blur");

const foreignBack = makeNode("Foreign service copy");
foreignBack.setPluginData("orbit-motion", JSON.stringify({
  role: "back",
  sourceId: "another-source",
  service: true,
}));
parent.insertChild(0, foreignBack);
const sourceMarkerWithForeignId = JSON.parse(source.getPluginData("orbit-motion"));
source.setPluginData("orbit-motion", JSON.stringify({
  ...sourceMarkerWithForeignId,
  pairId: foreignBack.id,
  serviceIds: [foreignBack.id],
}));
await onMessage({ type: "apply", settings });
assert(!foreignBack.removed, "A stale service id must never steal a copy owned by another source");
assert(!firstBack.removed, "Refresh must retain the service copy with the matching source id");
assert.deepEqual(
  JSON.parse(source.getPluginData("orbit-motion")).serviceIds,
  [firstBack.id],
  "Refresh must repair stale service ids with the correctly owned copy",
);
foreignBack.remove();

const stalePair = makeNode("Detached stale pair");
stalePair.setPluginData("orbit-motion", JSON.stringify({ role: "back", sourceId: source.id }));
parent.children = parent.children.filter((node) => node !== stalePair);
const movedServiceParent={id:"moved-service-parent",type:"FRAME",children:[stalePair],getPluginData:()=>""};
nodes.set(movedServiceParent.id,movedServiceParent);
stalePair.parent=movedServiceParent;
stalePair.remove=()=>{stalePair.removed=true;movedServiceParent.children=[];nodes.delete(stalePair.id);};
source.setPluginData("orbit-motion", JSON.stringify({ role: "front", pairId: stalePair.id }));

const staleBack = source.clone();
staleBack.setPluginData("orbit-motion", JSON.stringify({ role: "back", sourceId: source.id }));
parent.insertChild(0, staleBack);
settings.motion.duration = 3;
settings.motion.fullCycle = { type: "easing", duration: 1, ease: [0.42, 0, 1, 1] };
proxyChildReads = true;
await onMessage({ type: "apply", settings });
proxyChildReads = false;
assert.equal(parent.children.length, 2, "Refresh must remove stale duplicate back copies");
const refreshedBack = currentBack();
assertSparseTrackAccuracy(settings);
assert.equal(refreshedBack.id, firstBack.id, "Refresh must preserve the existing back-copy id");
assert.deepEqual(
  refreshedBack.removedTrackNames,
  [],
  "Refresh must replace service tracks directly without redundant removals",
);
assert(!firstBack.removed, "Refresh must keep the existing paired back copy");
assert(staleBack.removed, "Refresh must remove stale unpaired back copies");
assert(stalePair.removed, "Refresh must remove moved stale service copies across the page");
assertSynchronizedPair(refreshedBack);
assert.equal(timeline.duration, 3, "Refresh must shorten the Motion timeline to the new duration");
assert.equal(
  source.manualKeyframeTracks.TRANSLATION_X.keyframes.at(-1).timelinePosition,
  3,
  "Refreshed source tracks must end at the new duration",
);
assert.equal(
  refreshedBack.manualKeyframeTracks.TRANSLATION_X.keyframes.at(-1).timelinePosition,
  3,
  "Refreshed back-copy tracks must end at the new duration",
);
for (const node of [source, refreshedBack]) {
  const keyframes = node.manualKeyframeTracks.TRANSLATION_X.keyframes;
  assert.equal(
    keyframes[0].easing.type,
    "HOLD",
    "Only the first key may use HOLD because it has no incoming segment",
  );
  assert.notEqual(
    keyframes.at(-1).easing.type,
    "HOLD",
    "The closing key must interpolate the final leg instead of jumping at loop end",
  );
  const easing = keyframes[1].easing;
  assert(
    easing.type === "CUSTOM_CUBIC_BEZIER" || easing.type === "LINEAR",
    "Sparse tracks must use supported interpolation",
  );
  assert(
    keyframes.length < settings.motion.keyframes + 1,
    "Sparse motion must use fewer keys than the generated source samples",
  );
}

const timingCases = [
  { duration: 0.4, ease: [0, 0, 1, 1], radiusX: 80, radiusY: 40, rotation: -135, tilt: -60 },
  { duration: 3, ease: [0.42, 0, 1, 1], radiusX: 260, radiusY: 120, rotation: 0, tilt: 0 },
  { duration: 5, ease: [0, 0, 0.58, 1], radiusX: 600, radiusY: 300, rotation: 75, tilt: 45 },
  { duration: 12, ease: [0.42, 0, 0.58, 1], radiusX: 1200, radiusY: 800, rotation: 180, tilt: 90 },
] as const;
let previousBack = refreshedBack;
for (const timing of timingCases) {
  settings.motion.duration = timing.duration;
  settings.motion.fullCycle = { type: "easing", duration: 1, ease: [...timing.ease] };
  settings.geometry.radiusX = timing.radiusX;
  settings.geometry.radiusY = timing.radiusY;
  settings.geometry.circleRotation = timing.rotation;
  settings.geometry.tilt = timing.tilt;
  await onMessage({ type: "apply", settings });
  assert.equal(timeline.duration, timing.duration, "Every supported duration must update the timeline");
  assert.equal(parent.children.length, 2, "Every refresh must leave exactly one back copy");
  const back = currentBack();
  assert.equal(back.id, previousBack.id, "Every refresh must preserve the paired back-copy id");
  assert(!previousBack.removed, "Refresh must not remove the paired back copy");
  assertSynchronizedPair(back);
  previousBack = back;
  for (const node of [source, back]) {
    const track = node.manualKeyframeTracks.TRANSLATION_X;
    assert.equal(
      track.keyframes.at(-1).timelinePosition,
      timing.duration,
      "Front and back tracks must end at every selected duration",
    );
    assert(
      track.keyframes.length < settings.motion.keyframes + 1,
      "Every built-in timing must retain sparse front and back tracks",
    );
  }
}

settings.other.depthSplit = false;
settings.other.serviceLayers = "0";
await onMessage({ type: "apply", settings });
assert.equal(parent.children.length, 1, "Disabling Depth Split must remove every back copy");
assert(previousBack.removed, "Disabling Depth Split must remove the current back copy");
assert(
  source.manualKeyframeTracks.OPACITY.keyframes.some((keyframe: any) => keyframe.value.value > 0),
  "The source must retain its normal opacity animation without Depth Split",
);

settings.other.depthSplit = true;
settings.other.serviceLayers = "2";
await onMessage({ type: "apply", settings });
assert.equal(parent.children.length, 2, "Re-enabling Depth Split must create exactly one fresh back copy");
const reenabledBack = currentBack();
assertSynchronizedPair(reenabledBack);
assert.equal(
  new Set(reenabledBack.removedTrackNames).size,
  0,
  "A recreated back copy must replace inherited tracks without removing them first",
);

settings.other.serviceLayers = "4";
failTrackWrite = { nodeId: source.id, field: "TRANSLATION_X" };
await onMessage({ type: "apply", settings });
assert.equal(
  parent.children.length,
  4,
  "A multi-copy refresh must recover from a transient source write failure without duplicate services",
);
assert.deepEqual(
  parent.children
    .filter((node) => node !== source)
    .map((node) => JSON.parse(node.getPluginData("orbit-motion")).depthLayer)
    .sort(),
  [0, 1, 2],
  "Every service copy must own one distinct depth band",
);

const fourLayerServices = parent.children.filter((node) => node !== source);
parent.children = [source, ...fourLayerServices.reverse()];
failInsertChildRemaining = 1;
await onMessage({ type: "apply", settings });
assert.deepEqual(
  parent.children.slice(0, 3).map((node) => JSON.parse(node.getPluginData("orbit-motion")).depthLayer),
  [0, 1, 2],
  "Refresh must retry stale insertChild proxies and verify the final service order",
);

remapServiceOnNextMarker=true;
const beforeRemap=postedMessages.length;
await onMessage({type:"apply",settings});
assert(!postedMessages.slice(beforeRemap).some(message=>message.type==="result"&&message.kind==="error"),"Refresh resolves remapped service IDs before ordering");
assert.deepEqual(parent.children.slice(0,3).map(node=>JSON.parse(node.getPluginData("orbit-motion")).depthLayer),[0,1,2]);
const aliasedService=parent.children[0];
nodeAliases.set("old-service-id",aliasedService);
nodes.set("old-service-id",new Proxy(aliasedService,{get(target,key){return key==="id"?"old-service-id":Reflect.get(target,key);}}));
const beforeAliasRefresh=postedMessages.length;
await onMessage({type:"apply",settings});
assert(!postedMessages.slice(beforeAliasRefresh).some(message=>message.type==="result"&&message.kind==="error"),"Stale scan aliases must not count as an extra service");
assert.equal(parent.children.length,4,"Aliased service IDs must not create or delete a depth band");
nodes.delete("old-service-id");nodeAliases.delete("old-service-id");
const detachedGhost=makeNode("Card · Orbit Depth 1 (service)");
detachedGhost.locked=true;
detachedGhost.setPluginData("orbit-motion",JSON.stringify({role:"back",sourceId:source.id,depthLayer:0}));
const beforeGhostRefresh=postedMessages.length;
await onMessage({type:"apply",settings});
assert(!postedMessages.slice(beforeGhostRefresh).some(message=>message.type==="result"&&message.kind==="error"),"A resolvable stale proxy absent from parent.children is not a fourth service");
assert.equal(parent.children.length,4,"Only attached source and three services remain");
nodes.delete(detachedGhost.id);
settings.other.serviceLayers = "2";
await onMessage({ type: "apply", settings });
assert.equal(parent.children.length, 2, "Reducing depth layers must remove surplus service copies on refresh");

const protectedBack = currentBack();
const relaunchBeforeFailedRefresh = source.getRelaunchData();
settings.other.serviceLayers = "0";
const messagesBeforeFailedUpdate = postedMessages.length;
failTrackWrite = { nodeId: source.id, field: "TRANSLATION_X", remaining: 2 };
await onMessage({ type: "apply", settings });
assert.equal(
  parent.children.length,
  2,
  "A failed two-attempt update must preserve old service layers",
);
assert(!protectedBack.removed, "A failed update must not delete the existing service copy");
assert.deepEqual(
  source.getRelaunchData(),
  relaunchBeforeFailedRefresh,
  "A failed update must retain the source relaunch action",
);
assert(
  postedMessages.slice(messagesBeforeFailedUpdate).some((message) =>
    message.type === "result" && message.kind === "error" &&
    message.message.startsWith("Update stopped; no old service layers were removed.")
  ),
  "A failed update must report an error instead of partial success",
);
await onMessage({ type: "apply", settings });
assert.equal(parent.children.length, 1, "A clean retry must finish the pending service removal");
settings.other.serviceLayers = "2";
await onMessage({ type: "apply", settings });
assert.equal(parent.children.length, 2, "The service pair must be recreated before Clear testing");

const markerBeforeFailedClear = source.getPluginData("orbit-motion");
failTrackRemoval = { nodeId: source.id, field: "ROTATION", remaining:2 };
await onMessage({ type: "clear", scope: "selection" });
assert.equal(parent.children.length, 2, "A partial Clear must retain the linked service copy");
assert.equal(
  source.getPluginData("orbit-motion"),
  markerBeforeFailedClear,
  "A partial Clear must retain its Orbit marker so the operation can be retried",
);
assert.deepEqual(
  parent.getRelaunchData(),
  relaunchBeforeFailedRefresh,
  "A partial Clear must retain the parent's Orbit relaunch action",
);
source.setPluginData("orbit-motion", "");

await onMessage({ type: "clear", scope: "selection" });
assert.equal(parent.children.length, 1, "Clear must remove every linked back copy");
assert.equal(Object.keys(source.manualKeyframeTracks).length, 0, "Clear must remove source motion tracks");
assert.equal(source.opacity, 1, "Clear must restore the original opacity after playhead-state refreshes");
assert.deepEqual(source.getRelaunchData(), {}, "Clear must remove the Orbit relaunch action");
assert.deepEqual(parent.getRelaunchData(), {}, "Clear must remove an empty parent's Orbit relaunch action");
assert(
  postedMessages.some((message) => message.type === "result" && message.kind === "success" && message.message === "Cleared 1 layer."),
  "Clear must report a successful result",
);

await onMessage({ type: "clear", scope: "selection" });
assert(
  postedMessages.some((message) => message.type === "result" && message.kind === "error" && message.message === "No Motion Loops motion in the current selection."),
  "Clearing an unchanged selection must report an error",
);

globalThis.figma.currentPage.selection = [parent];
settings.other.scope = "children";
source.absoluteBoundingBox = { x: 100, y: 40, width: 80, height: 100 };
await onMessage({ type: "apply", settings });
assert.deepEqual(
  globalThis.figma.currentPage.selection,
  [parent],
  "Applying to a top-level frame must preserve the user's frame selection",
);
assert.equal(parent.children.length, 2, "Frame Apply must create one back copy");
const frameApplyBack = currentBack();
const persistedCenter = JSON.parse(source.getPluginData("orbit-motion")).centerOffset;
assert.deepEqual(persistedCenter, { x: 220, y: 110 }, "Apply must persist the source's unanimated center offset");
source.absoluteBoundingBox = { x: -900, y: 740, width: 80, height: 100 };
await onMessage({ type: "apply", settings });
assert.deepEqual(
  globalThis.figma.currentPage.selection,
  [parent],
  "Refreshing must continue targeting the selected frame",
);
assert.equal(parent.children.length, 2, "Frame Refresh must not create extra copies");
assert.equal(currentBack().id, frameApplyBack.id, "Frame Refresh must preserve its paired copy");
assert.deepEqual(
  JSON.parse(source.getPluginData("orbit-motion")).centerOffset,
  persistedCenter,
  "Refresh must ignore the playhead-transformed absoluteBoundingBox and reuse the original center",
);
assert.equal(
  source.manualKeyframeTracks.TRANSLATION_X.baseValue.value,
  0,
  "The resting horizontal translation must remain zero for Clear",
);
assert.equal(
  source.manualKeyframeTracks.TRANSLATION_Y.baseValue.value,
  0,
  "The resting vertical translation must remain zero for Clear",
);

const interruptedClone = source.clone();
interruptedClone.name = "Card · Orbit Depth 99 (service)";
interruptedClone.setPluginData("orbit-motion", JSON.stringify({ role: "front", preset: settings.preset }));
interruptedClone.locked = true;
await onMessage({ type: "apply", settings });
assert.equal(
  parent.children.length,
  2,
  "Frame Refresh must adopt and remove an interrupted service clone instead of duplicating it",
);
assert(interruptedClone.removed, "Refresh must remove a service-named clone with an inherited front marker");

await onMessage({ type: "clear", scope: "selection" });
assert.equal(parent.children.length, 1, "Frame Clear must ignore scope and remove the paired copy");
assert.equal(Object.keys(source.manualKeyframeTracks).length, 0, "Frame Clear must remove descendant source tracks");
source.absoluteBoundingBox = { x: 320, y: 150, width: 80, height: 100 };

const orphanService = makeNode("Missing source · Orbit Depth 1 (service)");
orphanService.locked = true;
parent.insertChild(0, orphanService);
await onMessage({ type: "clear", scope: "selection" });
assert(orphanService.removed, "Frame Clear must remove an orphaned service layer without a source marker");

globalThis.figma.currentPage.selection = [source];
settings.other.scope = "selection";
await onMessage({ type: "apply", settings });
assert.equal(parent.children.length, 2, "Unlocked source must have a service copy before lock cleanup");
source.locked = true;
const messageCountBeforeLockedApply = postedMessages.length;
await onMessage({ type: "apply", settings });
assert.equal(
  Object.keys(source.manualKeyframeTracks).length,
  0,
  "Apply must ignore a user-locked source layer",
);
assert.equal(parent.children.length, 1, "Refreshing a locked Orbit source must remove its service copies");
assert.equal(source.getPluginData("orbit-motion"), "", "Refreshing a locked Orbit source must clear its marker");
assert(
  postedMessages.slice(messageCountBeforeLockedApply).some((message) =>
    message.type === "result" && message.kind === "error" && message.message === "Locked layers are ignored. Unlock a layer to animate it."
  ),
  "Ignoring a locked-only selection must return the normal no-target message",
);
source.locked = false;

const secondSource = makeNode("Second Card");
parent.insertChild(parent.children.length, secondSource);
source.setPluginData("orbit-motion", JSON.stringify({
  role: "back",
  sourceId: "stale-source-id",
  preset: settings.preset,
}));
globalThis.figma.currentPage.selection = [parent];
settings.other.scope = "selection";
settings.preset = "orbit-3d-vertical";
await onMessage({ type: "apply", settings });
assert.equal(
  parent.children.filter((node) => / \u00b7 Orbit Depth \d+ \(service\)$/.test(node.name)).length,
  2,
  "Parent Apply must create exactly one service layer for every source",
);
assert.equal(
  JSON.parse(source.getPluginData("orbit-motion")).role,
  "front",
  "Apply must recover an unlocked original carrying a stale back-role marker",
);
settings.preset = "orbit-3d-ring";
await onMessage({ type: "apply", settings });
assert.equal(
  parent.children.filter((node) => / \u00b7 Orbit Depth \d+ \(service\)$/.test(node.name)).length,
  2,
  "Changing a preset on a parent must reconcile existing services without duplicates",
);

// Real Figma can remap the owning frame and all of its children while writing
// the first source. Later sources then report the replacement parent id. They
// must still be grouped and ordered as one semantic service family.
const parentIdBeforeTreeRemap=parent.id;
const messagesBeforeTreeRemap=postedMessages.length;
remapTreeOnTrackWriteNodeId=source.id;
await onMessage({type:"apply",settings});
assert.notEqual(parent.id,parentIdBeforeTreeRemap,"The fixture must remap the owning frame");
assert(!postedMessages.slice(messagesBeforeTreeRemap).some(message=>message.type==="result"&&message.kind==="error"),"Parent and child ID remapping must not fail service ordering");
assert.equal(parent.children.filter(node=>/ \u00b7 Orbit Depth \d+ \(service\)$/.test(node.name)).length,2,"Tree remapping must retain one service per source");

// Reproduce a real document upgraded from an interrupted version: generated
// names still identify the sibling services, but their stored source ids are stale.
const servicesBeforeCatalogWalk = parent.children.filter((node) =>
  / \u00b7 Orbit Depth \d+ \(service\)$/.test(node.name)
);
for (const service of servicesBeforeCatalogWalk) {
  const marker = JSON.parse(service.getPluginData("orbit-motion"));
  service.setPluginData("orbit-motion", JSON.stringify({ ...marker, sourceId: "missing-old-source" }));
}
for (const preset of presetOptions) {
  const tuning = builtInPresetTunings[preset.value];
  settings.preset = preset.value;
  Object.assign(settings.motion, pulseDefaults, tuning.motion);
  Object.assign(settings.geometry, { pathScale: 1 }, tuning.geometry);
  Object.assign(settings.appearance, tuning.appearance);
  Object.assign(settings.other, tuning.other);
  await onMessage({ type: "apply", settings });
  const services = parent.children.filter((node) =>
    / \u00b7 Orbit Depth \d+ \(service\)$/.test(node.name)
  );
  const expectedServiceCount = Math.max(0, Number(settings.other.serviceLayers) - 1) * 2;
  assert.equal(
    services.length,
    expectedServiceCount,
    `${preset.label}: walking the entire preset catalog must keep the configured services per source`,
  );
  assert.equal(
    new Set(services.map((node) => node.id)).size,
    expectedServiceCount,
    `${preset.label}: service ids must stay unique`,
  );
  if (preset.value === "falling-stack") {
    for (const field of ["TRANSLATION_X", "TRANSLATION_Y", "SCALE_X", "SCALE_Y", "ROTATION"]) {
      const track = source.manualKeyframeTracks[field] as any;
      assert(track.keyframes.length <= 32, `Falling Stack ${field} must export compact curves, got ${track.keyframes.length}`);
      if (field === "TRANSLATION_X" || field === "ROTATION") {
        assert.equal(track.keyframes.length, 2, `Constant ${field} needs only loop endpoints`);
      }
    }
  }
}
await onMessage({ type: "clear", scope: "selection" });
assert.equal(parent.children.length, 2, "Parent Clear must leave only the two original sources");
assert.equal(Object.keys(source.manualKeyframeTracks).length, 0);
assert.equal(Object.keys(secondSource.manualKeyframeTracks).length, 0);

const stackCards = Array.from({ length: 5 }, (_, index) => makeNode(`Stack ${index}`));
for (const card of stackCards) parent.insertChild(parent.children.length, card);
globalThis.figma.currentPage.selection = stackCards;
const stackSettings = cloneData(settings);
stackSettings.preset = "falling-stack";
Object.assign(stackSettings.geometry, builtInPresetTunings["falling-stack"].geometry);
Object.assign(stackSettings.appearance, builtInPresetTunings["falling-stack"].appearance);
Object.assign(stackSettings.other, { serviceLayers: "4", scope: "selection", centerBeforeApply: true });
stackSettings.motion.fullCycle = { type: "easing", ease: [0, 0, 1, 1] };
const fittedStack = fitSettingsToFrame(stackSettings, 720, 400, 80, 100);
for (const direction of ["clockwise", "counterclockwise"]) {
  stackSettings.motion.direction = direction;
  fittedStack.motion.direction = direction;
  await onMessage({ type: "apply", settings: stackSettings });
  for (const [index, card] of stackCards.entries()) {
    const tracks = card.manualKeyframeTracks;
    for (const field of ["TRANSLATION_Y", "SCALE_X", "SCALE_Y", "OPACITY"]) {
      assert(tracks[field].keyframes.length <= 20, `${field}: expected at most 20 keys, got ${tracks[field].keyframes.length}`);
    }
    for (let sample = 0; sample < 1000; sample += 1) {
      const progress = (sample + 0.5) / 1000;
      const time = progress * stackSettings.motion.duration;
      const expected = pointForGeometry((progress - index / 5) * Math.PI * 2, fittedStack, index, 5);
      assert(Math.abs(sampleTrack(tracks.TRANSLATION_Y, time) - expected.y) < 0.01, "Sparse stack translation must match the continuous motion");
      assert(Math.abs(sampleTrack(tracks.SCALE_X, time) - expected.scaleX) < 0.0001, "Sparse stack scale must match the continuous motion");
      const expectedFrontOpacity = expected.stackOrder === 3 ? expected.opacity : 0;
      assert(Math.abs(sampleTrack(tracks.OPACITY, time) - expectedFrontOpacity) < 0.0001, "Sparse stack must preserve front-layer handoffs, including 5→1");
    }
  }
}

globalThis.figma.currentPage.selection = [];
await onMessage({ type: "apply", settings });
const diagnosticError = postedMessages.findLast(
  (message) => message.type === "result" && message.kind === "error" && message.message.startsWith("Select layers inside"),
);
assert(
  diagnosticError,
  "Applying with no selection must report an actionable error",
);
assert.equal(typeof diagnosticError.diagnostics, "string", "Operation errors must include copyable diagnostics");
assert(diagnosticError.diagnostics.startsWith("Motion Loops diagnostics\n"), "Diagnostics must use a recognizable envelope");
const diagnosticPayload = JSON.parse(diagnosticError.diagnostics.split("\n").slice(1).join("\n"));
assert.equal(diagnosticPayload.operation, "apply", "Diagnostics identify the failed operation");
assert.equal(diagnosticPayload.error, diagnosticError.message, "Diagnostics preserve the surfaced error");
assert(diagnosticPayload.events.some((event:any)=>event.step==="apply.route"), "Diagnostics include the engine route");
assert(diagnosticPayload.events.some((event:any)=>event.step==="operation.failed"), "Diagnostics include the terminal failure stage");

console.log("Orbit plugin doubling: all checks passed");

// Native reference compositions: actual exporter, with the Figma scene API
// mocked. This verifies track playback and shared-source cleanup, not Figma UI.
// Match the native Motion stale transform behavior: separate Y writes can
// restore the X value cached before the preceding X write.
nativeCoordinateWrites=true;
Object.assign(topFrame,{id:parent.id,width:720,height:400});
Object.assign(parent,{width:720,height:400,layoutMode:"NONE",appendChild(node:any){if(node.parent?.children)node.parent.children=node.parent.children.filter((child:any)=>child.id!==node.id);this.insertChild(this.children.length,node);}});
globalThis.figma.createFrame=()=>{
  const frame=makeNode("Frame");frame.type="FRAME";frame.children=[];
  frame.resize=(w:number,h:number)=>{frame.width=w;frame.height=h;};
  frame.appendChild=(node:any)=>{if(node.parent?.children)node.parent.children=node.parent.children.filter((child:any)=>child.id!==node.id);if(frame.name.includes("Orbit native")&&frame.children.length)frame.children.splice(1,0,node);else frame.children.push(node);node.parent=frame;};
  frame.insertChild=(index:number,node:any)=>{if(node.parent?.children)node.parent.children=node.parent.children.filter((child:any)=>child.id!==node.id);frame.children.splice(index,0,node);node.parent=frame;};
  frame.remove=()=>{for(const child of [...frame.children])child.remove();frame.parent.children=frame.parent.children.filter((child:any)=>child.id!==frame.id);frame.removed=true;nodes.delete(frame.id);};
  return frame;
};
globalThis.figma.createRectangle=()=>{const node=makeNode("Rectangle");node.resize=(w:number,h:number)=>{node.width=w;node.height=h;};return node;};
// Failed clone cleanup must abort before hiding originals or removing old output.
{
  const cards=[makeNode("Existing animated card A"),makeNode("Existing animated card B")];
  for(const card of cards)parent.insertChild(parent.children.length,card);
  globalThis.figma.currentPage.selection=cards;
  const legacy=freshPreset("circle");
  await onMessage({type:"apply",settings:legacy});
  const legacyCopies=parent.children.filter((node:any)=>node.name.includes("Orbit Depth")&&cards.some(card=>node.name.startsWith(card.name)));
  const settings=freshPreset("reference-carousel-05");
  await onMessage({type:"apply",settings});
  const oldRoot=nodes.get(JSON.parse(cards[0].getPluginData("orbit-motion")).serviceIds[0]);
  assert(oldRoot?.children.length>0,"Switching legacy motion to Row produces native output");
  for(const slot of oldRoot.children){
    const artwork=slot.children.find((child:any)=>child.name!=="Depth backing");
    for(const time of [0,settings.motion.duration/2,settings.motion.duration]){
      for(const field of ["TRANSLATION_X","TRANSLATION_Y","ROTATION","SCALE_X","SCALE_Y"]){
        // Missing tracks leave the previous Orbit transform cached in Figma's
        // live player, even though the server-side video export looks correct.
        const track=artwork.manualKeyframeTracks[field];
        const inheritedValue=field.startsWith("SCALE")?0.5:122;
        assert.equal(track?sampleTrack(track,time):inheritedValue,field.startsWith("SCALE")?1:0,
          `Orbit → Row: artwork ${field} stays neutral inside its clipping slot at ${time}s`);
      }
    }
  }
  assert(legacyCopies.every((node:any)=>!nodes.has(node.id)),"Legacy copies are removed only after Row is built");
  const clone=cards[0].clone;
  cards[0].clone=function(){const copy=clone.call(this);failTrackRemoval={nodeId:copy.id,field:"OPACITY"};return copy;};
  const start=postedMessages.length;
  await onMessage({type:"apply",settings});
  assert(postedMessages.slice(start).some(m=>m.kind==="error"),"Clone cleanup failure is reported");
  assert(nodes.has(oldRoot.id),"Previous output survives failed refresh");
  assert(cards.every(card=>JSON.parse(card.getPluginData("orbit-motion")).serviceIds[0]===oldRoot.id),"Original links survive failed refresh");
  cards[0].clone=clone;
  await onMessage({type:"clear",scope:"selection"});
}
for(const preset of [...referencePresets,{...referencePresets.find(p=>p.id==="reference-carousel-05")!,label:"Queue ellipse",queueShape:"ellipse"}]){
  const cards=Array.from({length:3},(_,i)=>makeNode(`${preset.label} card ${i}`));
  for(const [index,card] of cards.entries()){card.relativeTransform=[[1,0,301+index*139],[0,1,423]];parent.insertChild(parent.children.length,card);}
  globalThis.figma.currentPage.selection=cards;
  const settings=freshPreset(preset.id),messageStart=postedMessages.length;
  if("queueShape" in preset)settings.geometry.shape=preset.queueShape as MotionSettings["geometry"]["shape"];
  if(preset.id==="reference-carousel-01")settings.motion.duration=200;
  await onMessage({type:"apply",settings:toMotionDocument(settings)});
  const errors=postedMessages.slice(messageStart).filter(m=>m.kind==="error");
  assert.equal(errors.length,0,JSON.stringify(errors));
  const result=postedMessages.slice(messageStart).find(m=>m.type==="result"&&m.kind==="success");
  assert(result?.diagnostics, `${preset.label}: successful application includes downloadable diagnostics`);
  const report=JSON.parse(result.diagnostics.split("\n").slice(1).join("\n"));
  assert.equal(report.error,null);
  assert.equal(report.schemaVersion,2);
  assert(report.events.some((event:any)=>event.details?.settings), "Report preserves applied settings");
  const selectedState=postedMessages.slice(messageStart).filter(m=>m.type==="selection").at(-1)?.selection;
  assert.equal(selectedState.targets.selection.orbitCount,3,`${preset.label}: native service motion enables Refresh and Clear`);
  const marker=JSON.parse(cards[0].getPluginData("orbit-motion")),root=nodes.get(marker.serviceIds[0]);
  assert.equal(marker.settings.version,2,"Figma stores the canonical document");
  assert(!("reference" in marker.settings),"No parallel reference settings are persisted");
  assert(root&&root.clipsContent,"Reference output clips to the frame");
  if(preset.id==="reference-board")assert(root.children.length<100,"Board reuses offscreen tiles instead of exporting the full world grid");
  assert(cards.every(card=>card.opacity===1&&card.visible),"Design canvas retains the editable source cards");
  assert(cards.every((card,index)=>card.x===301+index*139&&card.y===423),"Apply preserves the source layout outside playback");
  assert.equal(root.opacity,0,"Centered service copies must not cover the design canvas");
  assert.equal(sampleTrack(root.manualKeyframeTracks.OPACITY,0),1,"Service composition is visible from the first playback frame");
  assert.equal(sampleTrack(root.manualKeyframeTracks.OPACITY,settings.motion.duration),1,"Service composition remains visible through the end of playback");
  for(const slot of root.children){
    const keys=slot.manualKeyframeTracks.OPACITY.keyframes;
    for(let i=1;i<keys.length;i++){
      assert(Math.round(keys[i].timelinePosition*1e6)>Math.round(keys[i-1].timelinePosition*1e6),`${preset.label}: visibility keys must stay distinct at native microsecond precision`);
      if(keys[i].value.value!==keys[i-1].value.value)assert.equal(keys[i].easing.type,"HOLD",`${preset.label}: service ownership must switch without ghost fades, including the loop seam`);
    }
  }
  assert(cards.every(card=>sampleTrack(card.manualKeyframeTracks.OPACITY,settings.motion.duration/2)===0),"Originals stay hidden during native playback");
  const sampleCount=preset.id==="reference-board"?500:100;
  for(let sample=0;sample<sampleCount;sample++){
    const time=(sample+.37)/sampleCount*settings.motion.duration;
    const expected=referenceScene(settings,cards,720,400,time);
    const visible=root.children.filter(slot=>sampleTrack(slot.manualKeyframeTracks.OPACITY,time)>.5);
    if(preset.id==="reference-board"){
      // Non-overlapping tiles can safely share offscreen service copies.
      const remaining=[...visible];
      for(let i=0;i<expected.length;i++){
        const card=expected[i];
        const index=remaining.findIndex(slot=>slot.name.startsWith(cards[card.source].name)&&Math.abs(slot.x+slot.width/2+sampleTrack(slot.manualKeyframeTracks.TRANSLATION_X,time)-card.x)<.06&&Math.abs(slot.y+slot.height/2+sampleTrack(slot.manualKeyframeTracks.TRANSLATION_Y,time)-card.y)<.06);
        assert(index>=0,`${preset.label}: pooled tile position at ${time}`);
        visible[i]=remaining.splice(index,1)[0];
      }
    }
    assert.equal(visible.length,expected.length,`${preset.label}: visible slots at ${time}`);
    for(let i=0;i<expected.length;i++){
      const slot=visible[i],card=expected[i];
      assert(slot.name.startsWith(cards[card.source].name),`${preset.label}: correct image order at ${time}: ${slot.name}, expected ${cards[card.source].name}`);
      assert(Math.abs(slot.x+slot.width/2+sampleTrack(slot.manualKeyframeTracks.TRANSLATION_X,time)-card.x)<.06,`${preset.label}: animated center X at ${time}`);
      assert(Math.abs(slot.y+slot.height/2+sampleTrack(slot.manualKeyframeTracks.TRANSLATION_Y,time)-card.y)<.06,`${preset.label}: animated center Y`);
      assert(Math.abs(sampleTrack(slot.manualKeyframeTracks.SCALE_X,time)*slot.width-card.width)<.06,`${preset.label}: width`);
      assert(Math.abs(sampleTrack(slot.manualKeyframeTracks.SCALE_Y,time)*slot.height-card.height)<.06,`${preset.label}: height`);
      const image=slot.children[slot.children.length-1];
      assert.equal(image.x,(slot.width-image.width)/2,"Cloned card is centered inside its clipping slot on X");
      assert.equal(image.y,(slot.height-image.height)/2,"Cloned card is centered inside its clipping slot on Y");
      const alpha=image.manualKeyframeTracks.OPACITY?sampleTrack(image.manualKeyframeTracks.OPACITY,time):image.opacity;
      assert(Math.abs(alpha-(1-(card.shade??0))*(card.opacity??1))<.001,`${preset.label}: image fade`);
    }
  }
  const before=[...root.children];
  // Native Figma can remap node IDs while persisted composition links retain
  // their previous values. Recover only a complete group in the same owner.
  for(const node of [...cards,root]){
    const marker=JSON.parse(node.getPluginData("orbit-motion"));
    marker.referenceSourceIds=marker.referenceSourceIds.map((id:string)=>`old:${id}`);
    if(marker.sourceId)marker.sourceId=`old:${marker.sourceId}`;
    if(marker.serviceIds)marker.serviceIds=marker.serviceIds.map((id:string)=>`old:${id}`);
    node.setPluginData("orbit-motion",JSON.stringify(marker));
  }
  await onMessage({type:"apply",settings});
  assert(!nodes.has(root.id),"Refresh replaces the previous native output");
  assert(before.every(node=>!nodes.has(node.id)),"Refresh removes old editable instances");
  const refreshed=nodes.get(JSON.parse(cards[0].getPluginData("orbit-motion")).serviceIds[0]);
  assert.equal(refreshed.opacity,0,"Refresh preserves the canvas/playback separation");
  assert(cards.every(card=>card.visible&&card.opacity===1&&sampleTrack(card.manualKeyframeTracks.OPACITY,0)===0),"Refreshed originals remain editable on canvas and hidden during playback");
  assert(refreshed.children.every((slot:any)=>{const card=slot.children.at(-1);return card.visible&&card.opacity===1&&card.manualKeyframeTracks.OPACITY?.baseValue.value===1;}),"Refresh restores visible copies and their opacity bases from hidden originals");
  globalThis.figma.currentPage.selection=[cards[1]];
  const currentRoot=nodes.get(JSON.parse(cards[0].getPluginData("orbit-motion")).serviceIds[0]);
  const removeCurrentRoot=currentRoot.remove.bind(currentRoot);
  currentRoot.remove=()=>{removeCurrentRoot();for(const card of cards)invalidatedSourceIds.add(card.id);};
  failTrackRemoval={nodeId:cards[1].id,field:"OPACITY"};
  const clearMessageStart=postedMessages.length;
  await onMessage({type:"clear",scope:"selection"});
  assert(!postedMessages.slice(clearMessageStart).some(message=>message.type==="result"&&message.kind==="error"),"One Clear recovers a transient native removal failure without reporting an error");
  assert(cards.every(card=>card.visible&&card.opacity===1&&!card.getPluginData("orbit-motion")),"Clearing one linked source restores every original");
}
console.log(`Native reference export: all ${referencePresets.length} presets, sampled tracks, refresh and linked Clear passed`);
for(const id of ["circle","orbit-3d-tilted","orbit-3d-helix","orbit-3d-eight"]){
  const card=makeNode("Unified "+id);
  parent.insertChild(parent.children.length,card);
  globalThis.figma.currentPage.selection=[card];
  const start=postedMessages.length;
  await onMessage({type:"apply",settings:toMotionDocument(freshPreset(id))});
  assert(!postedMessages.slice(start).some(m=>m.kind==="error"),id+": canonical Apply");
  assert.equal(JSON.parse(card.getPluginData("orbit-motion")).settings.version,2);
  await onMessage({type:"clear",scope:"selection"});
  assert(!card.getPluginData("orbit-motion"),id+": canonical Clear");
}

const refreshPair=[makeNode("Refresh pair A"),makeNode("Refresh pair B")];
for(const card of refreshPair)parent.insertChild(parent.children.length,card);
globalThis.figma.currentPage.selection=refreshPair;
const pairSettings=freshPreset("circle");
pairSettings.other.serviceLayers="3";
for(let pass=0;pass<2;pass++){
  const messageStart=postedMessages.length;
  await onMessage({type:"apply",settings:pairSettings});
  assert(!postedMessages.slice(messageStart).some(message=>message.kind==="error"),"Two-card Apply and Refresh succeed");
  for(const card of refreshPair){
    const marker=JSON.parse(card.getPluginData("orbit-motion"));
    const services=parent.children.filter((child:any)=>JSON.parse(child.getPluginData("orbit-motion")||"null")?.sourceId===card.id);
    assert.equal(services.length,2,"Reapplying two original cards keeps exactly the configured service count per card");
    assert.deepEqual(new Set(marker.serviceIds),new Set(services.map((service:any)=>service.id)),"Original links reference all and only live service layers");
  }
}
await onMessage({type:"clear",scope:"selection"});

const autoLayoutLead=makeNode("Auto layout lead");
autoLayoutLead.width=120;
const autoLayoutCard=makeNode("Auto layout card");
const autoLayoutTail=makeNode("Auto layout tail");
parent.children=[autoLayoutLead,autoLayoutCard,autoLayoutTail];
for(const child of parent.children)child.parent=parent;
parent.layoutMode="HORIZONTAL";
parent.reflow();
const originalCardX=autoLayoutCard.x;
const originalTailX=autoLayoutTail.x;
globalThis.figma.currentPage.selection=[autoLayoutCard];
const autoLayoutSettings=freshPreset("circle");
autoLayoutSettings.other.serviceLayers="2";
for(let pass=0;pass<2;pass++){
  const messageStart=postedMessages.length;
  await onMessage({type:"apply",settings:autoLayoutSettings});
  assert(!postedMessages.slice(messageStart).some(message=>message.kind==="error"),"Auto layout Apply and Refresh succeed");
  const result=postedMessages.slice(messageStart).find(message=>message.type==="result"&&message.kind==="success");
  const report=JSON.parse(result.diagnostics.split("\n").slice(1).join("\n"));
  if(pass===0)assert.equal(report.before.sources[0].x,originalCardX,"Diagnostics capture source position before Apply");
  else assert.notEqual(report.before.sources[0].x,originalCardX,"Diagnostics expose the legacy layout shift before Refresh");
  assert.equal(report.after.sources[0].x,originalCardX,"Diagnostics capture source position after Apply");
  if(pass===0)assert.deepEqual(report.before.sources[0].layoutCenterOffset,{x:168,y:150},"Diagnostics show the auto layout center offset");
  assert.deepEqual(report.after.sources[0].effectiveCenterOffset,{x:168,y:150},"Diagnostics show the applied center offset");
  if(pass===1)assert.deepEqual(report.before.sources[0].storedCenterOffset,{x:0,y:0},"Diagnostics expose a stale stored offset before Refresh");
  const fitted=fitSettingsToFrame(autoLayoutSettings,720,400,autoLayoutCard.width,autoLayoutCard.height,1);
  const firstFrame=generateNodeKeyframes({...fitted,motion:{...fitted.motion,keyframes:32}},0,1)[0];
  assert(Math.abs(report.after.sources[0].firstTranslation.x-(168+firstFrame.x))<.01,"Auto layout X track includes the settled center offset");
  assert(Math.abs(report.after.sources[0].firstTranslation.y-(150+firstFrame.y))<.01,"Auto layout Y track includes the settled center offset");
  const services=JSON.parse(autoLayoutCard.getPluginData("orbit-motion")).serviceIds;
  assert(services.length>0,"Auto layout test creates depth services");
  for(const id of services){
    const copy=nodes.get(id);
    assert.equal(copy.layoutPositioning,"ABSOLUTE","Depth service must not participate in parent auto layout");
    assert.deepEqual(copy.relativeTransform,autoLayoutCard.relativeTransform,"Depth service keeps the source position");
  }
  assert.equal(autoLayoutCard.x,originalCardX,"Depth services do not move the source in auto layout");
  assert.equal(autoLayoutTail.x,originalTailX,"Depth services do not move later siblings in auto layout");
  if(pass===0){
    const oldCopy=nodes.get(services[0]);
    oldCopy.layoutPositioning="AUTO";
    assert.notEqual(autoLayoutTail.x,originalTailX,"Legacy in-flow services reproduce the layout shift");
    const oldMarker=JSON.parse(autoLayoutCard.getPluginData("orbit-motion"));
    oldMarker.centerOffset={x:0,y:0};
    autoLayoutCard.setPluginData("orbit-motion",JSON.stringify(oldMarker));
  }
}
await onMessage({type:"clear",scope:"selection"});
parent.layoutMode="NONE";

const invalidMessageStart=postedMessages.length;
await onMessage({type:"apply",settings:{version:2,preset:"circle"}});
assert(postedMessages.slice(invalidMessageStart).some(message=>message.kind==="error"),"Malformed Apply returns an error instead of leaving UI busy");
const nextMessageStart=postedMessages.length;
await onMessage({type:"apply",settings:toMotionDocument(freshPreset("circle"))});
assert(postedMessages.slice(nextMessageStart).some(message=>message.type==="result"),"Apply operation lock is released after invalid input");
