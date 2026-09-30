// Exact addition in time/value space. A cubic plus a linear function of time
// is still a cubic with the same time controls. Different time parameterizations
// cannot generally be added this way; reject them rather than resample silently.
type Cubic = [number, number, number, number];
interface Segment { x: Cubic; y: Cubic; linear: boolean }
// Desktop materializes this curve even for LINEAR; include it so verification
// compares the full readback without weakening the equality check.
const LINEAR_EASING: MotionEasing = { type: "LINEAR", easingFunctionCubicBezier: { x1: 0, y1: 0, x2: 1, y2: 1 } };
const near = (a: number, b: number) => Math.abs(a - b) <= 1e-10;
const linear = (a: number, b: number): Cubic => [a, a + (b - a) / 3, a + 2 * (b - a) / 3, b];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function split(p: Cubic, t: number): [Cubic, Cubic] {
  const a = lerp(p[0], p[1], t), b = lerp(p[1], p[2], t), c = lerp(p[2], p[3], t);
  const d = lerp(a, b, t), e = lerp(b, c, t), f = lerp(d, e, t);
  return [[p[0], a, d, f], [f, e, c, p[3]]];
}

function parameterAt(x: Cubic, time: number): number {
  if (time <= x[0]) return 0;
  if (time >= x[3]) return 1;
  let lo = 0, hi = 1;
  for (let i = 0; i < 52; i++) {
    const mid = (lo + hi) / 2;
    if (split(x, mid)[0][3] < time) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function restrict(p: Cubic, from: number, to: number): Cubic {
  const left = to === 1 ? p : split(p, to)[0];
  return from === 0 ? left : split(left, from / to)[1];
}

function scalar(value: KeyframeValue): number {
  if (value.type !== "FLOAT" || !Number.isFinite(value.value)) {
    throw new Error("Overlapping presets currently require finite scalar offset values.");
  }
  return value.value;
}

function segmentAt(track: ManualKeyframeTrack, start: number, end: number): Segment {
  const keys = track.keyframes;
  const constant = (value: number): Segment => ({ x: [0, 1 / 3, 2 / 3, 1], y: [value, value, value, value], linear: true });
  if (end <= keys[0].timelinePosition) return constant(scalar(keys[0].value));
  if (start >= keys[keys.length - 1].timelinePosition) return constant(scalar(keys[keys.length - 1].value));
  const index = keys.findIndex((key, i) => i > 0 && key.timelinePosition >= end && keys[i - 1].timelinePosition <= start);
  if (index < 1) throw new Error("Preset segments could not be aligned.");
  const first = keys[index - 1], last = keys[index];
  const a = scalar(first.value), b = scalar(last.value);
  if (a === b) return constant(a);
  const easing = last.easing;
  if (easing.type === "LINEAR") {
    const duration = last.timelinePosition - first.timelinePosition;
    return { x: [0, 1 / 3, 2 / 3, 1], y: linear(lerp(a, b, (start - first.timelinePosition) / duration), lerp(a, b, (end - first.timelinePosition) / duration)), linear: true };
  }
  const curve = "easingFunctionCubicBezier" in easing ? easing.easingFunctionCubicBezier : undefined;
  if (!curve || easing.type === "HOLD" || ("easingFunctionSpring" in easing && easing.easingFunctionSpring)) {
    throw new Error("These overlapping presets need explicit cubic or linear easing to convert exactly.");
  }
  const { x1, y1, x2, y2 } = curve;
  if (![x1, y1, x2, y2].every(Number.isFinite) || x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) {
    throw new Error("Overlapping presets contain an invalid easing curve.");
  }
  const duration = last.timelinePosition - first.timelinePosition;
  const x: Cubic = [first.timelinePosition, first.timelinePosition + x1 * duration, first.timelinePosition + x2 * duration, last.timelinePosition];
  const y: Cubic = [a, lerp(a, b, y1), lerp(a, b, y2), b];
  const from = parameterAt(x, start), to = parameterAt(x, end);
  const clippedX = restrict(x, from, to).map(value => (value - start) / (end - start)) as Cubic;
  // Avoid endpoint drift from solving X; all tracks share these exact boundaries.
  clippedX[0] = 0;
  clippedX[3] = 1;
  return { x: clippedX, y: restrict(y, from, to), linear: near(x1, y1) && near(x2, y2) };
}

export function mergeOffsetTracks(tracks: ManualKeyframeTrack[], base: KeyframeValue): ManualKeyframeInput[] {
  const baseValue = scalar(base);
  for (const track of tracks) for (const key of track.keyframes) scalar(key.value);
  const times = [...new Set(tracks.flatMap(track => track.keyframes.map(key => key.timelinePosition)))].sort((a, b) => a - b);
  if (times.length > 2048) throw new Error("Too many preset segments to combine safely.");
  const frames: ManualKeyframeInput[] = [];
  for (let i = 1; i < times.length; i++) {
    const segments = tracks.map(track => segmentAt(track, times[i - 1], times[i]));
    const curved = segments.filter(segment => !segment.linear);
    const x: Cubic = curved[0]?.x ?? [0, 1 / 3, 2 / 3, 1];
    if (curved.some(segment => !near(segment.x[1], x[1]) || !near(segment.x[2], x[2]))) {
      throw new Error("These overlapping curves cannot be combined exactly into one manual track.");
    }
    const y = x.map((position, j) => baseValue + segments.reduce((sum, segment) => sum + (segment.linear ? lerp(segment.y[0], segment.y[3], position) : segment.y[j]), 0));
    const delta = y[3] - y[0];
    let easing: MotionEasing = LINEAR_EASING;
    if (delta === 0) {
      if (!near(y[1], y[0]) || !near(y[2], y[0])) throw new Error("This combined curve needs additional turning-point keys before it can be converted.");
    } else if (curved.length) {
      easing = { type: "CUSTOM_CUBIC_BEZIER", easingFunctionCubicBezier: { x1: Math.max(0, Math.min(1, x[1])), y1: (y[1] - y[0]) / delta, x2: Math.max(0, Math.min(1, x[2])), y2: (y[2] - y[0]) / delta } };
      if (!Object.values(easing.easingFunctionCubicBezier!).every(Number.isFinite)) throw new Error("The combined preset curve is not finite.");
    }
    if (!y.every(Number.isFinite)) throw new Error("The combined preset values are not finite.");
    if (!frames.length) frames.push({ timelinePosition: times[0], value: { type: "FLOAT", value: y[0] }, easing: LINEAR_EASING });
    // Easing belongs to the arriving key, including at a shared preset boundary.
    frames.push({ timelinePosition: times[i], value: { type: "FLOAT", value: y[3] }, easing });
  }
  return frames;
}
