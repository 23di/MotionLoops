// @ts-ignore Test runner bundles Node builtins.
import assert from "node:assert/strict";
// @ts-ignore Test runner bundles Node builtins.
import {createHash} from "node:crypto";
import baseline from "./preset-visual-baseline.json";
import {capturePresetVisuals} from "./preset-visual-capture";

function normalize(value:unknown):unknown{
  if(typeof value==="number")return Math.round(value*1e5)/1e5;
  if(Array.isArray(value))return value.map(normalize);
  if(value&&typeof value==="object")return Object.fromEntries(
    Object.entries(value).map(([key,item])=>[key,normalize(item)]));
  return value;
}

const traces=capturePresetVisuals();
assert.deepEqual(Object.keys(traces),Object.keys(baseline),"Preset visual audit covers every saved preset");
for(const [id,trace] of Object.entries(traces)){
  const actual=createHash("sha256").update(JSON.stringify(normalize(trace))).digest("hex");
  assert.equal(actual,baseline[id as keyof typeof baseline],id+": default appearance or motion changed");
}
console.log(`Visual baseline: ${Object.keys(traces).length} preset traces match`);
