function assert(value: boolean, message = "Assertion failed"): void { if (!value) throw new Error(message); }
assert.equal = (a: unknown, b: unknown, message: string) => assert(a === b, message);
assert.deepEqual = (a: unknown, b: unknown, message: string) => assert(JSON.stringify(a) === JSON.stringify(b), message);
import { families, freshPreset, visibleGeometry } from "./catalog";
import { fitSettingsToFrame, generateNodeKeyframes } from "./engine";
import { presetOptions, type MotionSettings } from "./types";
import { parseSettingsJson, serializeSettingsJson } from "./settings-json";

const ids = families.flatMap((family) => family.variants.map((variant) => variant.id));
assert.equal(new Set(ids).size, presetOptions.length, "Every existing preset needs one family");
assert.equal(ids.length, presetOptions.length, "Variants must not repeat between families");

function trace(settings: MotionSettings, count = 5, width = 720, height = 400) {
  const fitted = fitSettingsToFrame(settings, width, height, width / 9, height / 4);
  return Array.from({ length: count }, (_, index) => generateNodeKeyframes(fitted, index, count));
}
function differs(a: MotionSettings, b: MotionSettings) {
  return JSON.stringify(trace(a)) !== JSON.stringify(trace(b));
}

for (const id of ids) {
  const settings = freshPreset(id);
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
  assert(differs(settings, { ...settings, motion: { ...settings.motion, duration: 8 } }), `${id}: duration must change timing`);
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
