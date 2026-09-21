import {
  depthSplitOpacity,
  fitPreviewFrame,
  fitPreviewItem,
  fitSettingsToFrame,
  generateNodeKeyframes,
  pointForGeometry,
  sampleGeneratedKeyframes,
  supportsOrbitOrientation,
  supportsPathGeometry,
} from "./engine";
import { builtInPresetTunings } from "./presets";
import { parseSettingsJson } from "./settings-json";
// Fixtures intentionally exercise backwards-compatible, pre-v2 JSON import.
const serializeSettingsJson=(settings:unknown)=>JSON.stringify(settings,null,2);
import { presetOptions, type MotionSettings } from "./types";

const settings: MotionSettings = {
  preset: "orbit-3d-ring",
  motion: {
    duration: 3.2,
    stagger: 0.12,
    keyframes: 16,
    direction: "clockwise",
    fullCycle: { type: "easing", duration: 1, ease: [0, 0, 1, 1] },
  },
  geometry: {
    units: "pixels",
    shape: "parametric",
    dynamicScale: true,
    customPath: "[[0.5,0],[1,0.5],[0.5,1],[0,0.5]]",
    radiusX: 360,
    radiusY: 160,
    circleRotation: 0,
    depth: 260,
    tilt: 28,
    turns: 1,
    rotation: 8,
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
    nearScale: 1.25,
    farScale: 0.55,
    farOpacity: 0.28,
    fadeStart: 0,
    fadeEnd: 100,
    opacityCurve: "linear",
    farBlur: 0,
    frontShadow: 0,
    facePath: false,
  },
  other: {
    centerBeforeApply: true,
    serviceLayers: "2",
    depthSplit: true,
    scope: "selection",
  },
};

function settingsForPreset(preset: typeof presetOptions[number]["value"]): MotionSettings {
  const tuning = builtInPresetTunings[preset];
  return {
    ...settings,
    preset,
    motion: { ...settings.motion, ...tuning.motion },
    geometry: { ...settings.geometry, ...tuning.geometry },
    appearance: { ...settings.appearance, ...tuning.appearance },
    other: { ...settings.other, ...tuning.other },
  };
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertThrows(run: () => unknown, message: string): void {
  try {
    run();
  } catch {
    return;
  }
  throw new Error(message);
}

function trajectoryDistance(left: MotionSettings, right: MotionSettings): number {
  let squaredDistance = 0;
  const samples = 64;
  for (let step = 0; step < samples; step += 1) {
    const angle = step / samples * Math.PI * 2;
    const leftPoint = pointForGeometry(angle, left, 3, 9);
    const rightPoint = pointForGeometry(angle, right, 3, 9);
    squaredDistance +=
      ((leftPoint.x - rightPoint.x) / Math.max(left.geometry.radiusX, 1)) ** 2 +
      ((leftPoint.y - rightPoint.y) / Math.max(left.geometry.radiusY, 1)) ** 2;
  }
  return Math.sqrt(squaredDistance / samples);
}

assert(presetOptions.length === 23, "Expected supported presets including legacy ids and two new motions");
assert(!presetOptions.some((preset) => String(preset.value) === "tunnel"), "Tunnel preset must not remain in the catalog");
assert(
  presetOptions.filter((preset) => preset.value.startsWith("orbit-3d")).length === 6,
  "Expected six 3D orbit presets",
);
assert(
  !presetOptions.some((preset) => String(preset.value) === "album-wall"),
  "Album Wall must not remain in the preset list",
);
assert(
  JSON.stringify(parseSettingsJson(serializeSettingsJson(settings), settings)) === JSON.stringify(settings),
  "Settings JSON must round-trip without changing values",
);
const legacySettingsJson = JSON.parse(serializeSettingsJson(settings));
delete legacySettingsJson.geometry.units;
const migratedLegacySettings = parseSettingsJson(JSON.stringify(legacySettingsJson), {
  ...settings,
  geometry: { ...settings.geometry, units: "percent" },
});
assert(
  Math.abs(migratedLegacySettings.geometry.radiusX - 50) < 1e-9 &&
    Math.abs(migratedLegacySettings.geometry.radiusY - 40) < 1e-9 &&
    Math.abs(migratedLegacySettings.geometry.depth - 65) < 1e-9,
  "Legacy pixel settings JSON must migrate to reference percentages",
);
assertThrows(
  () => parseSettingsJson('{"preset":"missing"}', settings),
  "Settings JSON must reject unrelated or incomplete objects",
);
assertThrows(
  () => parseSettingsJson(serializeSettingsJson({ ...settings, preset: "missing" as never }), settings),
  "Settings JSON must reject unsupported presets",
);
assert(
  trajectoryDistance(settingsForPreset("vision"), settingsForPreset("orbit-3d-eight")) > 0.2,
  "Vision Focus and Figure Eight must keep visibly distinct trajectories",
);
assert(
  trajectoryDistance(settingsForPreset("orbit-3d-ring"), settingsForPreset("orbit-3d-tilted")) > 0.2,
  "Turntable and Saturn Tilt must keep visibly distinct trajectories",
);

const coverFlowPoint = pointForGeometry(Math.PI / 3, settingsForPreset("cover-flow"), 2, 9);
assert(coverFlowPoint.rotation === 0, "Cover Flow must not rotate layers");

const customPathStart = pointForGeometry(0, {
  ...settings,
  geometry: {
    ...settings.geometry,
    shape: "custom-path",
    customPath: "[[0,0.5],[0.5,0],[1,0.5],[0.5,1]]",
  },
});
assert(customPathStart.x < 0, "Curve mode must replace the preset X/Y path");
assert(
  supportsPathGeometry("ellipse") && supportsPathGeometry("custom-path"),
  "Ellipse and Custom Path must expose editable path geometry",
);
assert(
  !supportsPathGeometry("parametric") && !supportsPathGeometry("vortex"),
  "Other geometry shapes must not expose path drawing",
);
assert(
  supportsOrbitOrientation(settingsForPreset("orbit-3d-ring").geometry) &&
    supportsOrbitOrientation(settingsForPreset("orbit-3d-sphere").geometry) &&
    !supportsOrbitOrientation(settingsForPreset("fan").geometry),
  "3D orientation must be controlled by geometry settings",
);

const tiltedTurntable = pointForGeometry(Math.PI / 2, {
  ...settings,
  geometry: { ...settings.geometry, tilt: 45, circleRotation: 0 },
});
const flatTurntable = pointForGeometry(Math.PI / 2, {
  ...settings,
  geometry: { ...settings.geometry, tilt: 0, circleRotation: 0 },
});
assert(
  Math.abs(tiltedTurntable.y - flatTurntable.y) > 1 &&
    Math.abs(tiltedTurntable.z - flatTurntable.z) > 1,
  "Turntable tilt must rotate its orbit plane",
);
const rotatedTurntable = pointForGeometry(0, {
  ...settings,
  geometry: { ...settings.geometry, tilt: 0, circleRotation: 90 },
});
assert(
  Math.abs(rotatedTurntable.x) < 1e-6 &&
    Math.abs(rotatedTurntable.y - settings.geometry.radiusX) < 1e-6,
  "Turntable orbit rotation must rotate its path around the center",
);

const rotatedCircle = pointForGeometry(0, {
  ...settings,
  geometry: { ...settings.geometry, shape: "ellipse", orient3d: false, circleRotation: 90 },
});
assert(
  Math.abs(rotatedCircle.x) < 1e-6 && Math.abs(rotatedCircle.y - settings.geometry.radiusX) < 1e-6,
  "Circle rotation must rotate the path geometry around its center",
);

const waveDefaults = builtInPresetTunings["path-wave"].geometry;
const waveLoop = generateNodeKeyframes({
  ...settings,
  preset: "path-wave",
  geometry: { ...settings.geometry, ...waveDefaults },
}, 0, 1);
assert(
  waveDefaults.shape === "custom-path" && waveLoop[0].opacity === 0 && waveLoop.at(-1)!.opacity === 0,
  "Path Wave must default to an open path with hidden wraparound",
);
assert(
  waveLoop[1].opacity < waveLoop[2].opacity &&
    waveLoop.at(-2)!.opacity < waveLoop.at(-3)!.opacity,
  "Path Wave must ease invisibly through its open-path wrap instead of popping",
);

const vortexLoop = generateNodeKeyframes(settingsForPreset("vortex"), 0, 1);
const vortexPeakOpacity = Math.max(...vortexLoop.map((frame) => frame.opacity));
assert(
  vortexLoop[0].opacity === 0 && vortexLoop.at(-1)!.opacity === 0 &&
    vortexLoop[1].opacity > 0 && vortexLoop.at(-2)!.opacity > 0 &&
    vortexLoop[1].opacity < vortexPeakOpacity && vortexLoop.at(-2)!.opacity < vortexPeakOpacity,
  "Vortex must fade smoothly before each item wraps back to its start",
);

const fallingStackSettings = settingsForPreset("falling-stack");
const fallingStackCount = 5;
const fallingStackInterval = 1 / fallingStackCount;
const fallingStackStart = pointForGeometry(0, fallingStackSettings, 0, fallingStackCount);
const fallingStackLanded = pointForGeometry(Math.PI * 2 * fallingStackInterval * 0.5, fallingStackSettings, 0, fallingStackCount);
const fallingStackFront = pointForGeometry(Math.PI * 2 * fallingStackInterval * 0.9, fallingStackSettings, 0, fallingStackCount);
const fallingStackMiddle = pointForGeometry(Math.PI * 2 * fallingStackInterval * 1.5, fallingStackSettings, 0, fallingStackCount);
const fallingStackBack = pointForGeometry(Math.PI * 2 * fallingStackInterval * 2.5, fallingStackSettings, 0, fallingStackCount);
const fallingStackExit = pointForGeometry(Math.PI * 2 * fallingStackInterval * 3.2, fallingStackSettings, 0, fallingStackCount);
const fallingStackReset = pointForGeometry(Math.PI * 2 * fallingStackInterval * 4.5, fallingStackSettings, 0, fallingStackCount);
assert(
  fallingStackStart.opacity === 0 && fallingStackStart.y < fallingStackLanded.y &&
    fallingStackStart.z === fallingStackLanded.z && fallingStackLanded.opacity > 0.95,
  "Falling Stack cards must fall onto the top/front of the stack",
);
assert(
  fallingStackFront.y > fallingStackMiddle.y && fallingStackMiddle.y > fallingStackBack.y &&
    fallingStackFront.scaleX > fallingStackMiddle.scaleX &&
    fallingStackMiddle.scaleX > fallingStackBack.scaleX,
  "Falling Stack must push older cards through front, middle, and rear slots",
);
assert(
  fallingStackExit.y < fallingStackBack.y &&
    fallingStackExit.opacity < fallingStackBack.opacity,
  "Falling Stack must fade the rear card under the stack",
);
assert(
  fallingStackReset.opacity === 0,
  "Falling Stack must remain invisible until its next top-card entry",
);
const clockwiseStack = generateNodeKeyframes(fallingStackSettings, 1, 5);
for (const direction of ["clockwise", "counterclockwise"] as const) {
  const loopSettings = { ...fallingStackSettings, motion: { ...fallingStackSettings.motion, direction } };
  const tracks = Array.from({ length: 5 }, (_, index) => generateNodeKeyframes(loopSettings, index, 5));
  for (let incoming = 0; incoming < 5; incoming += 1) {
    for (const phase of [0.01, 0.1, 0.3]) {
      const time = (incoming + phase) / 5 * loopSettings.motion.duration;
      const top = sampleGeneratedKeyframes(tracks[incoming], time, loopSettings.motion.fullCycle);
      const previous = sampleGeneratedKeyframes(tracks[(incoming + 4) % 5], time, loopSettings.motion.fullCycle);
      assert(top.stackOrder! > previous.stackOrder!,
        `Incoming card ${incoming} must be above its predecessor during the entire handoff (${direction})`);
    }
  }
  for (const track of tracks) {
    for (const key of ["x", "y", "scaleX", "opacity", "stackOrder"] as const) {
      assert(Math.abs(track[0][key]! - track.at(-1)![key]!) < 1e-8,
        `Falling Stack loop endpoints must match for ${key}`);
    }
  }
}
const counterclockwiseStack = generateNodeKeyframes({
  ...fallingStackSettings,
  motion: { ...fallingStackSettings.motion, direction: "counterclockwise" },
}, 1, 5);
const stackSampleTransition: MotionSettings["motion"]["fullCycle"] = {
  type: "easing",
  ease: [0, 0, 1, 1],
};
const clockwiseLanding = sampleGeneratedKeyframes(
  clockwiseStack,
  fallingStackSettings.motion.duration * 0.9,
  stackSampleTransition,
);
const counterclockwiseLanding = sampleGeneratedKeyframes(
  counterclockwiseStack,
  fallingStackSettings.motion.duration * 0.9,
  stackSampleTransition,
);
assert(
  Math.abs(Math.abs(clockwiseLanding.y) - Math.abs(counterclockwiseLanding.y)) < 1e-6 &&
    Math.abs(clockwiseLanding.opacity - counterclockwiseLanding.opacity) < 1e-6,
  "Falling Stack direction must not reverse the falling timeline",
);
assert(
  Math.abs(clockwiseLanding.y + counterclockwiseLanding.y) < 1e-6 &&
    clockwiseLanding.x === 0 && counterclockwiseLanding.x === 0 &&
    clockwiseLanding.rotation === 0 && counterclockwiseLanding.rotation === 0,
  "Falling Stack direction must mirror vertical motion without rotation",
);
assert(
  pointForGeometry(Math.PI, {
    ...fallingStackSettings,
    geometry: { ...fallingStackSettings.geometry, rotation: 90 },
  }, 0, 5).rotation === 0,
  "Falling Stack must ignore stale rotation settings",
);
for (const direction of ["clockwise", "counterclockwise"] as const) {
  const directionalSettings: MotionSettings = {
    ...fallingStackSettings,
    motion: { ...fallingStackSettings.motion, direction },
  };
  const tracks = Array.from({ length: 5 }, (_, index) =>
    generateNodeKeyframes(directionalSettings, index, 5));
  let minimumVisibleStack = 5;
  let maximumVisibleStack = 0;
  for (let step = 0; step < 200; step += 1) {
    const time = directionalSettings.motion.duration * step / 200;
    const points = tracks.map((track) => sampleGeneratedKeyframes(
      track,
      time,
      stackSampleTransition,
    ));
    const visibleStack = points.filter((point) => point.opacity > 0.05);
    minimumVisibleStack = Math.min(minimumVisibleStack, visibleStack.length);
    maximumVisibleStack = Math.max(maximumVisibleStack, visibleStack.length);
  }
  assert(
    minimumVisibleStack >= 2 && maximumVisibleStack <= 4,
    `Falling Stack ${direction} must maintain a compact two-to-four card stack`,
  );
}

const racetrackDefaults = builtInPresetTunings.racetrack.geometry;
const racetrackLoop = generateNodeKeyframes({
  ...settings,
  preset: "racetrack",
  geometry: { ...settings.geometry, ...racetrackDefaults },
}, 0, 1);
assert(
  racetrackDefaults.shape === "racetrack" &&
    Math.abs(racetrackLoop[0].x - racetrackLoop.at(-1)!.x) < 1e-6 &&
    racetrackLoop[0].opacity > 0,
  "Racetrack must default to a closed visible path",
);

const openPathLoop = generateNodeKeyframes({
  ...settings,
  preset: "circle",
  geometry: {
    ...settings.geometry,
    shape: "custom-path",
    customPath: "[[0,0.5],[0.5,0.2],[1,0.5]]",
  },
}, 0, 1);
assert(
  openPathLoop[0].opacity === 0 && openPathLoop.at(-1)!.opacity === 0 &&
    openPathLoop[Math.floor(openPathLoop.length / 2)].opacity > 0,
  "Open paths must disappear at the end before returning to the start",
);

const fanLoopLeft = generateNodeKeyframes(settingsForPreset("fan"), 0, 9);
const fanLoopRight = generateNodeKeyframes(settingsForPreset("fan"), 8, 9);
assert(
  fanLoopLeft[8].rotation > 0 && fanLoopRight[8].rotation < 0,
  "Fan layers must tilt outward in the expected direction",
);
const reversedFan = generateNodeKeyframes({
  ...settingsForPreset("fan"),
  motion: { ...settings.motion, direction: "counterclockwise" },
}, 0, 9);
assert(
  Math.sign(reversedFan[8].x) === -Math.sign(fanLoopLeft[8].x) &&
    Math.sign(reversedFan[8].rotation) === -Math.sign(fanLoopLeft[8].rotation),
  "Fan direction must mirror its position and rotation",
);

const sphereSettings = fitSettingsToFrame(
  settingsForPreset("orbit-3d-sphere"),
  720,
  400,
  80,
  80,
);
const spherePoints = Array.from({ length: 9 }, (_, index) =>
  generateNodeKeyframes(sphereSettings, index, 9)[0]);
assert(
  new Set(spherePoints.map((point) => point.y.toFixed(3))).size === 9,
  "Sphere layers must be distributed across distinct latitudes",
);
const sphereRadius = Math.min(sphereSettings.geometry.radiusX, sphereSettings.geometry.radiusY);
const sphereDepth = sphereSettings.geometry.depth;
assert(
  spherePoints.every((point) => Math.abs(
    (point.x / sphereRadius) ** 2 +
    (point.y / sphereRadius) ** 2 +
    (point.z / sphereDepth) ** 2 - 1
  ) < 1e-6),
  "Every Sphere layer must lie on the same spherical surface",
);
const sphereLongitudes = spherePoints.map((point) => Math.atan2(
  point.z / sphereDepth,
  point.x / sphereRadius,
));
const longitudeSteps = sphereLongitudes.slice(1).map((longitude, index) => (
  ((longitude - sphereLongitudes[index]) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2)
));
assert(
  new Set(longitudeSteps.map((step) => step.toFixed(3))).size > 2,
  "Sphere layers must not follow one visible spiral",
);
for (const count of [2, 4, 9, 32, 65]) {
  const points = Array.from({ length: count }, (_, index) =>
    generateNodeKeyframes(sphereSettings, index, count)[0]);
  assert(
    points.some((point) => point.y > 0) && points.some((point) => point.y < 0) &&
      points.some((point) => point.z > 0) && points.some((point) => point.z < 0),
    `Sphere must cover both hemispheres with ${count} layers`,
  );
}

const loop = generateNodeKeyframes(settings, 0, 8);
assert(loop.length === 17, "Expected the configured number of keyframes plus the closing key");
assert(Math.abs(loop[0].x - loop.at(-1)!.x) < 1e-6, "Loop X must close");
assert(Math.abs(loop[0].y - loop.at(-1)!.y) < 1e-6, "Loop Y must close");
assert(Math.abs(loop[0].scaleX - loop.at(-1)!.scaleX) < 1e-6, "Loop X scale must close");
assert(Math.abs(loop[0].scaleY - loop.at(-1)!.scaleY) < 1e-6, "Loop Y scale must close");

const renamedGeometry = generateNodeKeyframes({ ...settings, preset: "fan" }, 2, 8);
assert(
  JSON.stringify(renamedGeometry) === JSON.stringify(generateNodeKeyframes(settings, 2, 8)),
  "Preset identity must not affect animation when all settings are identical",
);

const firstSegmentMiddle = (loop[0].time + loop[1].time) / 2;
const sampled = sampleGeneratedKeyframes(
  loop,
  firstSegmentMiddle,
  { type: "easing", duration: 1, ease: [0, 0, 1, 1] },
);
assert(sampled.x !== loop[0].x && sampled.x !== loop[1].x, "Preview sampling must interpolate keys");

const easedSample = sampleGeneratedKeyframes(
  loop,
  firstSegmentMiddle,
  { type: "easing", duration: 1, ease: [0.42, 0, 1, 1] },
);
assert(
  Math.abs(easedSample.x - sampled.x) > 0.01,
  "Preview sampling must apply the selected easing between keyframes",
);

const easedCycle = generateNodeKeyframes({
  ...settings,
  motion: {
    ...settings.motion,
    fullCycle: { type: "easing", duration: 1, ease: [0.4, 0, 0.2, 1] },
  },
}, 0, 8);
assert(
  Math.abs(easedCycle[8].x - loop[8].x) > 1,
  "Full-cycle easing must change the generated path timing",
);

const middleDepth = pointForGeometry(0, settings);
const lateFade = pointForGeometry(0, {
  ...settings,
  appearance: { ...settings.appearance, fadeStart: 50, fadeEnd: 100 },
});
assert(
  Math.abs(lateFade.opacity - settings.appearance.farOpacity) < 1e-6,
  "Fade range must control where opacity starts increasing",
);

const easedFade = pointForGeometry(0, {
  ...settings,
  appearance: {
    ...settings.appearance,
    opacityCurve: "late",
  },
});
assert(
  easedFade.opacity < middleDepth.opacity,
  "Opacity easing must reshape the depth fade",
);

assert(
  depthSplitOpacity({ z: 1, opacity: 0.7 }, "front") === 0.7 &&
    depthSplitOpacity({ z: 1, opacity: 0.7 }, "back") === 0,
  "The front depth layer must only be visible in front",
);
assert(
  depthSplitOpacity({ z: -1, opacity: 0.7 }, "back") === 0.7 &&
    depthSplitOpacity({ z: -1, opacity: 0.7 }, "front") === 0,
  "The back depth layer must only be visible behind",
);

const fitted = fitSettingsToFrame(settings, 320, 240, 280, 200);
assert(
  fitted.geometry.radiusX < settings.geometry.radiusX &&
    fitted.geometry.radiusY < settings.geometry.radiusY,
  "Dynamic scale must fit X/Y movement to the frame",
);
assert(
  fitted.appearance.nearScale < settings.appearance.nearScale,
  "Dynamic scale must shrink oversized layers",
);
const fittedWithDifferentManualRadii = fitSettingsToFrame({
  ...settings,
  geometry: { ...settings.geometry, radiusX: 10, radiusY: 10 },
}, 320, 240, 280, 200);
assert(
  fittedWithDifferentManualRadii.geometry.radiusX === fitted.geometry.radiusX &&
    fittedWithDifferentManualRadii.geometry.radiusY === fitted.geometry.radiusY,
  "Dynamic scale must derive radii from the frame instead of disabled manual controls",
);
const fittedRotatedCircle = fitSettingsToFrame({
  ...settings,
  preset: "circle",
  geometry: { ...settings.geometry, circleRotation: 45 },
}, 320, 240, 80, 80);
const rotatedBoundsX = Math.hypot(
  fittedRotatedCircle.geometry.radiusX / Math.sqrt(2),
  fittedRotatedCircle.geometry.radiusY / Math.sqrt(2),
);
assert(
  rotatedBoundsX <= (240 - 80 * fittedRotatedCircle.appearance.nearScale) / 2 - 4.8 + 1e-6,
  "Dynamic scale must keep a rotated circle inside the selected frame",
);
const manualGeometry = fitSettingsToFrame({
  ...settings,
  geometry: { ...settings.geometry, dynamicScale: false, radiusX: 123, radiusY: 77 },
}, 320, 240, 280, 200);
assert(
  manualGeometry.geometry.radiusX === 123 && manualGeometry.geometry.radiusY === 77,
  "Manual radii must be preserved when Dynamic Scale is disabled",
);
const overRangeRadiusA=fitSettingsToFrame({
  ...settingsForPreset("circle"),
  geometry:{...settingsForPreset("circle").geometry,radiusY:120},
},320,240,80,80);
const overRangeRadiusB=fitSettingsToFrame({
  ...settingsForPreset("circle"),
  geometry:{...settingsForPreset("circle").geometry,radiusY:180},
},320,240,80,80);
assert(
  overRangeRadiusB.geometry.radiusY>overRangeRadiusA.geometry.radiusY,
  "Typed radii beyond the slider range must keep affecting the trajectory",
);

const largeCardStack = fitSettingsToFrame(
  settingsForPreset("falling-stack"),
  3987,
  2813,
  1908,
  1908,
);
const largeCardBack = pointForGeometry(0, largeCardStack, 0, 5);
assert(
  Math.abs(largeCardBack.y) > 350,
  "Falling Stack must remain visible when cards occupy most of the frame",
);
assert(
  1908 * largeCardStack.appearance.nearScale + Math.abs(largeCardBack.y) * 2 <= 2813 + 1e-6,
  "Falling Stack must reserve enough room for large-card vertical travel",
);
const smallCardStack = fitSettingsToFrame(
  settingsForPreset("falling-stack"),
  400,
  300,
  100,
  100,
);
const smallCardBack = pointForGeometry(0, smallCardStack, 0, 5);
assert(
  Math.abs(
    Math.abs(largeCardBack.y) / (1908 * largeCardStack.appearance.nearScale) -
    Math.abs(smallCardBack.y) / (100 * smallCardStack.appearance.nearScale)
  ) < 1e-9,
  "Falling Stack travel must use the same card-height percentage at every size",
);

const widePreview = fitPreviewFrame(1600, 900);
assert(
  Math.abs(widePreview.width - 300) < 1e-9 && Math.abs(widePreview.height - 168.75) < 1e-9,
  "Wide previews must preserve frame proportions within the width limit",
);
const tallPreview = fitPreviewFrame(400, 800);
assert(
  Math.abs(tallPreview.width - 110) < 1e-9 && Math.abs(tallPreview.height - 220) < 1e-9,
  "Tall previews must preserve frame proportions within the height limit",
);
const squareThumbnail = fitPreviewItem(1908, 1908, 0.05, 18, 24);
assert(
  squareThumbnail.width === 18 && squareThumbnail.height === 18,
  "Large square cards must remain square in preset thumbnails",
);
const wideThumbnail = fitPreviewItem(1908, 954, 0.05, 18, 24);
assert(
  Math.abs(wideThumbnail.width / wideThumbnail.height - 2) < 1e-9,
  "Preset thumbnails must preserve source-card aspect ratios",
);

for (const preset of presetOptions) {
  const presetSettings = settingsForPreset(preset.value);
  const presetLoop = generateNodeKeyframes(presetSettings, 3, 9);
  assert(
    Math.abs(presetLoop[0].x - presetLoop.at(-1)!.x) < 1e-5 &&
      Math.abs(presetLoop[0].y - presetLoop.at(-1)!.y) < 1e-5,
    `${preset.label} loop must close`,
  );
  const sampledPoints = [];
  for (let step = 0; step < 32; step += 1) {
    const point = pointForGeometry(
      (step / 32) * Math.PI * 2,
      presetSettings,
      3,
      9,
    );
    assert(point.opacity >= 0 && point.opacity <= 1, `${preset.label} opacity is invalid`);
    assert(point.scaleX > 0, `${preset.label} X scale is invalid`);
    assert(point.scaleY > 0, `${preset.label} Y scale is invalid`);
    assert(
      [point.x, point.y, point.z, point.scaleX, point.scaleY, point.opacity, point.rotation].every(Number.isFinite),
      `${preset.label} contains a non-finite animation value`,
    );
    sampledPoints.push(point);
  }
  const xRange = Math.max(...sampledPoints.map((point) => point.x)) - Math.min(...sampledPoints.map((point) => point.x));
  const yRange = Math.max(...sampledPoints.map((point) => point.y)) - Math.min(...sampledPoints.map((point) => point.y));
  assert(xRange > 1 || yRange > 1, `${preset.label} must produce visible movement`);

  const smallResponsive = fitSettingsToFrame(presetSettings, 720, 400, 80, 100);
  const largeResponsive = fitSettingsToFrame(presetSettings, 1440, 800, 160, 200);
  for (let step = 0; step < 16; step += 1) {
    const angle = step / 16 * Math.PI * 2;
    const smallPoint = pointForGeometry(angle, smallResponsive, 2, 7);
    const largePoint = pointForGeometry(angle, largeResponsive, 2, 7);
    assert(
      Math.abs(largePoint.x - smallPoint.x * 2) < 1e-5 &&
        Math.abs(largePoint.y - smallPoint.y * 2) < 1e-5 &&
        Math.abs(largePoint.z - smallPoint.z * 2) < 1e-5 &&
        Math.abs(largePoint.scaleX - smallPoint.scaleX) < 1e-9 &&
        Math.abs(largePoint.opacity - smallPoint.opacity) < 1e-9,
      `${preset.label} must preserve its normalized motion when the frame doubles`,
    );
  }
}

console.log("Orbit engine: all checks passed");
