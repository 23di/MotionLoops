function assert(value: boolean, message = "Assertion failed"): void { if (!value) throw new Error(message); }
assert.equal = (a: unknown, b: unknown, message: string) => assert(a === b, message);
assert.deepEqual = (a: unknown, b: unknown, message: string) => assert(JSON.stringify(a) === JSON.stringify(b), message);
import { families, familyFor, freshPreset, visibleGeometry, motionFingerprint, settingsFromSaved, editorFor } from "./catalog";
import { editorPaths, selectControls } from "./editor-schema";
import { controls } from "./control-schema";
import { fitSettingsToFrame, generateNodeKeyframes } from "./engine";
import { presetOptions, type MotionSettings } from "./types";
import { parseSettingsJson } from "./settings-json";
// Fixtures intentionally exercise backwards-compatible, pre-v2 JSON import.
const serializeSettingsJson=(settings:unknown)=>JSON.stringify(settings,null,2);
import { preferredNumber, preferredSettings } from "./preferred-numbers";

assert.equal(familyFor("reference-carousel-05").name,"Row 01","Saved native presets use current gallery names");
assert.equal(familyFor("reference-stack-04").name,"Stack 02","Saved stack uses current gallery name");

for (const id of ["orbit-3d-tilted", "orbit-3d-helix", "orbit-3d-eight", "path-wave", "orbit-3d-sphere", "vortex", "racetrack"] as const) {
  assert.equal(freshPreset(id).appearance.cardSize, 30, `${id}: shared default card size`);
}

for(const [input,expected] of [[1,1],[1.5,1.5],[1.53,1.54],[1.55,1.55],[1.57,1.58],[1.59,1.6],[1.578,1.58],[-1.53,-1.52],[0,0]]){
  assert.equal(preferredNumber(input),expected,"Preferred hundredths: "+input);
}
for(let i=-10000;i<=10000;i++){
  const value=preferredNumber(i/1000);
  assert.equal(preferredNumber(value),value,"Preferred numbers must be idempotent");
}
assert.deepEqual(preferredSettings({value:1.53,path:"[[0.153,0.257]]"}),{value:1.54,path:"[[0.153,0.257]]"},"Do not rewrite path geometry strings");

const ids = families.flatMap((family) => family.variants.map((variant) => variant.id));
const baseline = freshPreset("falling-stack");
for(const id of ids){
  const settings=freshPreset(id);
  const small=fitSettingsToFrame(settings,720,400,6,8,5);
  const large=fitSettingsToFrame(settings,720,400,6000,8000,5);
  if(settings.appearance.cardSize===0){
    assert.equal(small.appearance.nearScale,settings.appearance.nearScale,id+": zero card size preserves source-relative scale");
    continue;
  }
  assert(Math.abs(small.appearance.nearScale*8-large.appearance.nearScale*8000)<1e-8, id+": card size depends on frame, not source dimensions");
  const a=generateNodeKeyframes(small,0,5),b=generateNodeKeyframes(large,0,5);
  for(let i=0;i<a.length;i++){
    assert(Math.abs(a[i].scaleX*6-b[i].scaleX*6000)<1e-7,id+": frame-relative scale survives animation");
  }
}
function hasControl(path: string): boolean {
  let cursor: unknown = controls;
  const parts=path.split(".");
  if(parts[0]==="geometry"&&parts.length===2&&controls.geometry.advanced[parts[1] as keyof typeof controls.geometry.advanced]!==undefined)
    parts.splice(1,0,"advanced");
  for (const part of parts) {
    if (!cursor || typeof cursor !== "object") return false;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return cursor !== undefined;
}
for (const option of presetOptions) {
  const schema = editorFor(freshPreset(option.value));
  for (const path of editorPaths(schema)) assert(hasControl(path), `${option.value}: missing control ${path}`);
}
const pathSettings = { ...baseline, geometry: { ...baseline.geometry, shape: "custom-path" as const } };
assert(editorFor(pathSettings).pathEditor === true, "Changing shape enables the path editor without changing preset");
assert(editorPaths(editorFor(pathSettings)).has("geometry.customPath"), "Custom path remains editable and serializable");
assert(!editorPaths(editorFor(baseline)).has("geometry.customPath"), "Stack does not expose an unused path");
assert.deepEqual(selectControls([
  { type: "folder", path: "geometry", label: "Renamed folder", children: [
    { type: "slider", path: "geometry.radiusX", label: "Translated label" },
    { type: "slider", path: "geometry.tilt", label: "Tilt" },
  ] },
], new Set(["geometry.radiusX"]))[0].children?.map(control => control.path), ["geometry.radiusX"], "Schema selection uses stable paths, not UI labels");
const recovered = settingsFromSaved({ "appearance.cardSize":baseline.appearance.cardSize, "motion.fullCycle": { type: "easing", ease: [0, 0, 1, 1] } }, baseline);
assert.equal(motionFingerprint(recovered), motionFingerprint(baseline), "Saved easing without duration must be repaired before opening DialKit");
assert(motionFingerprint({...baseline, motion: {...baseline.motion, duration: 9}}) !== motionFingerprint(baseline), "Edited motion must become Current");
assert.equal(motionFingerprint({...baseline, other: {...baseline.other, scope: "children"}}), motionFingerprint(baseline), "Changing selection scope is not a new preset");
assert.equal(new Set(ids).size, ids.length, "Variants must not repeat between families");
assert(!ids.includes("pendulum"), "Swing must be retired from the active catalog");
assert.equal(families.length, 10, "Orbit 04 is added to the active catalog");
assert(!ids.includes("crosscurrent"), "Counterflow must be retired from the active gallery");
assert(!ids.includes("tile-wave"), "Ripple must be retired from the active gallery");
assert(ids.includes("bloom"), "Bloom must appear in the active gallery");
assert(!presetOptions.some(option=>String(option.value)==="tile-wave"), "Ripple must not be an active built-in preset");
const retiredRipple=freshPreset("tile-wave");
assert.deepEqual(parseSettingsJson(serializeSettingsJson(retiredRipple),retiredRipple),retiredRipple,"Existing Ripple JSON remains readable");
assert.equal(families.find(f=>f.variants.some(v=>v.id==="orbit-3d-ring"))?.name,"Cilinder","Circuit is renamed");
for(const id of ["orbit-3d-tilted","orbit-3d-helix","orbit-3d-eight"] as const)assert(ids.includes(id),"Restored orbit: "+id);
assert(!ids.includes("cover-flow")&&!ids.includes("falling-stack"), "Focus and Cascade are retired from the gallery");

const bloom=freshPreset("bloom");
const fittedBloom=fitSettingsToFrame(bloom,576,264,120,120,8);
for(let index=0;index<8;index++){
  const frames=generateNodeKeyframes(fittedBloom,index,8);
  for(const frame of frames){
    assert(Math.abs(frame.x)+frame.scaleX*60<=288+1e-6,"Bloom stays inside the flag frame horizontally");
    assert(Math.abs(frame.y)+frame.scaleY*60<=132+1e-6,"Bloom stays inside the flag frame vertically");
  }
}
assert(Math.abs(generateNodeKeyframes(fittedBloom,0,8)[0].x)<25,"Bloom starts gathered around the center");
const bloomTurn=generateNodeKeyframes(fittedBloom,0,8);
assert.equal(bloom.geometry.turns,1,"Bloom defaults to one complete turn");
assert(Math.hypot(bloomTurn[0].x,bloomTurn[0].y)<1e-9&&Math.hypot(bloomTurn[32].x,bloomTurn[32].y)<1e-9,
  "User Bloom radius collapses to the center at both cycle endpoints");
const staggeredBloom={...bloom,motion:{...bloom.motion,stagger:0.8}};
const staggeredFrame=generateNodeKeyframes(fitSettingsToFrame(staggeredBloom,576,264,120,120,8),1,8)[4];
const regularFrame=generateNodeKeyframes(fittedBloom,1,8)[4];
assert(Math.hypot(staggeredFrame.x-regularFrame.x,staggeredFrame.y-regularFrame.y)>5,
  "Bloom Stagger visibly shifts the next card's phase");
const doubledBloom={...bloom,geometry:{...bloom.geometry,turns:2}};
const doubledFrame=generateNodeKeyframes(fitSettingsToFrame(doubledBloom,576,264,120,120,8),0,8)[8];
assert(Math.hypot(doubledFrame.x-bloomTurn[8].x,doubledFrame.y-bloomTurn[8].y)>10,
  "Bloom Turns changes the number of revolutions");

function trace(settings: MotionSettings, count = 5, width = 720, height = 400) {
  const fitted = fitSettingsToFrame(settings, width, height, width / 9, height / 4, count);
  return Array.from({ length: count }, (_, index) => generateNodeKeyframes(fitted, index, count));
}
function differs(a: MotionSettings, b: MotionSettings) {
  return JSON.stringify(trace(a)) !== JSON.stringify(trace(b));
}

for (const id of ids) {
  const settings = freshPreset(id);
  assert(settings.motion.fullCycle.type === "easing" && Number.isFinite(settings.motion.fullCycle.duration), `${id}: DialKit requires a numeric easing duration`);
  const shown = visibleGeometry(settings);
  const geometryControls: (readonly [keyof MotionSettings["geometry"], number])[] = [
    ...(shown.width ? [["radiusX", 12] as const] : []),
    ...(shown.height ? [["radiusY", 10] as const] : []),
    ...(shown.angle ? [["circleRotation", 65] as const] : []),
    ...(shown.spread ? [["itemSpread", 0.2] as const] : []),
    ...(shown.amount ? [["shapeAmount", 0.2] as const] : []),
  ];
  for (const [key, value] of geometryControls) {
    assert(differs(settings, { ...settings, geometry: { ...settings.geometry, [key]: value } }), `${id}: visible ${key} must change motion`);
  }
  for (const key of ["nearScale", "farScale", "farOpacity"] as const) {
    assert(differs(settings, { ...settings, appearance: { ...settings.appearance, [key]: 0.1 } }), `${id}: visible ${key} must change motion`);
  }
  assert(differs(settings, { ...settings, motion: { ...settings.motion, direction: "counterclockwise" } }), `${id}: direction must change motion`);
  assert(differs(settings, { ...settings, motion: { ...settings.motion, duration: settings.motion.duration * 1.5 } }), `${id}: duration must change timing`);
  assert.deepEqual(parseSettingsJson(serializeSettingsJson(settings), settings), settings, `${id}: JSON round trip`);
  for (const previousId of ids) {
    assert.deepEqual(freshPreset(id, freshPreset(previousId)), settings, `${id}: must not inherit ${previousId} settings`);
  }
  for (const count of [1, 2, 5, 12]) {
    for (const [width, height] of [[720, 400], [3987, 2813], [400, 720]]) {
      for (const frames of trace(settings, count, width, height)) {
        for (const frame of frames) {
          for (const key of ["x", "y", "z", "scaleX", "scaleY", "opacity", "rotation"] as const) {
            assert(Number.isFinite(frame[key]), `${id}: ${key} must be finite`);
          }
          assert(frame.opacity >= 0 && frame.opacity <= 1);
        }
        for (const key of ["x", "y", "scaleX", "scaleY", "opacity", "rotation"] as const) {
          assert(Math.abs(frames[0][key] - frames.at(-1)![key]) < 1e-7, `${id}: ${key} must close the loop`);
        }
      }
    }
  }
}
console.log(`Catalog audit: ${families.length} families, ${ids.length} variants; visible controls, switches, sizes and loop endpoints passed`);
