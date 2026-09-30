// Ported from the sibling Motion Stagger (Cascade Shifter) conversion module.
// Explicit preset baking. No preset creation or definition lookup is permitted.
// Overlapping scalar offsets are composed exactly when their curves permit it.
import { mergeOffsetTracks } from "./merge-offset-tracks";
type ConversionNode = SceneNode;
interface PlannedTrack { field: KeyframeField; input: ManualKeyframeTrackInput }
interface Plan { node: ConversionNode; styles: AppliedAnimationStyle[]; tracks: PlannedTrack[] }

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
export function sameMotion(a: unknown, b: unknown): boolean {
  if (typeof a === "number" && typeof b === "number") return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 0.0001;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((item, i) => sameMotion(item, b[i]));
  if (a && b && typeof a === "object" && typeof b === "object") {
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every(key => key in b && sameMotion((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
  }
  return a === b;
}

function resolvedBindings(value: unknown, path: string[] = []): Array<{ field: KeyframeField; binding: KeyframeBinding }> {
  if (!value || typeof value !== "object") throw new Error("Figma returned incomplete animation data.");
  const result: Array<{ field: KeyframeField; binding: KeyframeBinding }> = [];
  for (const [key, item] of Object.entries(value)) {
    if (item === undefined) continue;
    const next = [...path, key];
    if (item && typeof item === "object" && "tracks" in item) {
      const binding = item as KeyframeBinding;
      if (!Array.isArray(binding.tracks) || !binding.baseValue) throw new Error("Figma returned an incomplete track.");
      let field: KeyframeField;
      if (next.length === 1) field = { type: "PROPERTY", name: key as KeyframePropertyFieldName };
      else {
        const [collection, indexText] = next;
        if (!["fills", "strokes", "effects"].includes(collection) || !/^\d+$/.test(indexText)) throw new Error("Unsupported animation field.");
        const index = Number(indexText);
        if (next.length === 4 && next[2] === "properties") {
          field = { type: "INDEXED_ITEM", collection: collection as "effects", index, propertyId: key };
        } else if (collection === "effects" && next.length === 3) {
          field = { type: "INDEXED_ITEM", collection, index, field: key as EffectKeyframeFieldName };
        } else if (collection !== "effects" && next.length === 2) {
          field = { type: "INDEXED_ITEM", collection: collection as "fills" | "strokes", index };
        } else throw new Error("Unsupported animation field.");
      }
      result.push({ field, binding });
    } else result.push(...resolvedBindings(item, next));
  }
  return result;
}

export function manualAt(node: ConversionNode, field: KeyframeField): ManualKeyframeBinding | undefined {
  const all = node.manualKeyframeTracks;
  if (field.type === "PROPERTY") return all[field.name];
  const entry = all[field.collection]?.[field.index];
  if (!entry) return;
  if ("propertyId" in field) return (entry as { properties?: ComponentPropKeyframeTracks }).properties?.[field.propertyId];
  if ("field" in field) return (entry as EffectManualKeyframeTracks)[field.field];
  return entry as ManualKeyframeBinding;
}

function combine(base: KeyframeValue, value: KeyframeValue, operation: ManualKeyframeTrack["keyframeOperation"]): KeyframeValue {
  if (operation === "SET") return copy(value);
  const calc = (a: number, b: number) => operation === "OFFSET" ? a + b : a * b;
  if (base.type === "FLOAT" && value.type === "FLOAT") return { type: "FLOAT", value: calc(base.value, value.value) };
  if (base.type === "VECTOR" && value.type === "VECTOR") return { type: "VECTOR", value: { x: calc(base.value.x, value.value.x), y: calc(base.value.y, value.value.y) } };
  throw new Error("This track operation cannot be converted exactly.");
}

function neutral(value: KeyframeValue, operation: ManualKeyframeTrack["keyframeOperation"]): boolean {
  const n = operation === "OFFSET" ? 0 : 1;
  return value.type === "FLOAT" ? value.value === n : value.type === "VECTOR" && value.value.x === n && value.value.y === n;
}

// Resolved preset keyframes can be relative to the applied style, while manual
// keyframes always use the containing timeline. Never guess a style association
// when several different offsets could place the same resolved track.
function placePresetTrack(track: ManualKeyframeTrack, styles: AppliedAnimationStyle[]): ManualKeyframeTrack {
  const times = track.keyframes.map(frame => frame.timelinePosition);
  if (!times.length || times.some(time => !Number.isFinite(time))) throw new Error("Preset keyframes have invalid timing.");
  // Current Figma readbacks include the originating preset. It is not yet in
  // plugin-typings, so narrow it before use and retain the conservative fallback.
  const source = (track as ManualKeyframeTrack & { animationPreset?: { id?: string } }).animationPreset;
  const matchingId = styles.find(style => style.id === (source?.id ?? track.id));
  if (source?.id && !matchingId) throw new Error("The source preset changed. Select the layers again.");
  const candidates = matchingId ? [matchingId] : styles;
  const positions: number[][] = [];
  const tolerance = 0.0001;
  for (const style of candidates) {
    const offset = style.timelineOffset ?? 0;
    const duration = style.duration;
    if (!Number.isFinite(offset) || offset < 0 || !Number.isFinite(duration) || !duration || duration < 0) {
      if (styles.length === 1 && offset === 0) positions.push(times);
      continue;
    }
    // Figma exposes each resolved preset track across the applied style's
    // duration. A short fade must not be assigned to a longer slide/scale
    // merely because both keyframe times fit within the longer interval.
    if (Math.abs(Math.max(...times) - Math.min(...times) - duration) > tolerance) continue;
    if (times.every(time => time >= -tolerance && time <= duration + tolerance)) {
      positions.push(times.map(time => time + offset));
    }
    if (times.every(time => time >= offset - tolerance && time <= offset + duration + tolerance)) {
      positions.push(times);
    }
  }
  const unique = positions.filter((value, index) => positions.findIndex(other => same(value, other)) === index);
  if (unique.length !== 1) throw new Error("Preset timing is ambiguous. The plugin cannot safely associate these tracks with their presets.");
  return { ...track, keyframes: track.keyframes.map((frame, index) => ({ ...frame, timelinePosition: unique[0][index] })) };
}

function bake(field: KeyframeField, binding: KeyframeBinding, tracks: ManualKeyframeTrack[]): ManualKeyframeTrackInput {
  const validated = tracks.map(track => {
    if (!["SET", "OFFSET", "SCALE"].includes(track.keyframeOperation) || track.keyframes.length < 2) throw new Error("Figma did not expose a complete preset track.");
    const frames = [...track.keyframes].sort((a, b) => a.timelinePosition - b.timelinePosition);
    frames.forEach((frame, i) => {
      if (!Number.isFinite(frame.timelinePosition) || frame.timelinePosition < 0 || !frame.easing || !frame.value ||
        (i > 0 && frame.timelinePosition <= frames[i - 1].timelinePosition)) throw new Error("Preset keyframes have invalid or ambiguous timing.");
      if (frame.value.type !== binding.baseValue.type) throw new Error("Preset values do not match their field.");
    });
    return { ...track, keyframes: frames };
  }).sort((a, b) => a.keyframes[0].timelinePosition - b.keyframes[0].timelinePosition);
  // Presets can emit identity tracks for axes they do not animate (e.g. a
  // 1→1 spring scale alongside a 1.4→1 scale-in). Their contribution is zero
  // for OFFSET and one for SCALE, regardless of easing or overlap. Validate
  // every track first, then remove only these exact identities. SET is never
  // an identity: it still replaces the value supplied by another track.
  const contributing = validated.filter(track => track.keyframeOperation === "SET" ||
    !track.keyframes.every(frame => neutral(frame.value, track.keyframeOperation)));
  const sorted = contributing.length ? contributing : [validated[0]];
  const preserveSpan = (keyframes: ManualKeyframeInput[]): ManualKeyframeTrackInput => {
    const first = keyframes[0], last = keyframes[keyframes.length - 1];
    const start = validated[0].keyframes[0].timelinePosition;
    const end = Math.max(...validated.map(track => track.keyframes[track.keyframes.length - 1].timelinePosition));
    // Retain the authored interval even when an identity started earlier or
    // ended later. The same value holds across the extra interval, so curves
    // on the contributing keys are not resampled or stretched.
    if (start < first.timelinePosition) keyframes.unshift({ timelinePosition: start, value: copy(first.value), easing: { type: "HOLD" } });
    if (end > last.timelinePosition) keyframes.push({ timelinePosition: end, value: copy(last.value), easing: { type: "HOLD" } });
    return { baseValue: copy(binding.baseValue), keyframes };
  };
  const operation = sorted[0].keyframeOperation;
  if (sorted.some(track => track.keyframeOperation !== operation)) throw new Error("The plugin cannot combine different preset track operations exactly.");
  const frames: ManualKeyframeInput[] = [];
  // Resolved bindings expose the layout pose as baseValue, but manual Motion
  // transforms are deltas/factors around that pose. Adding node.x/y here moves
  // the artwork twice. Appearance/layout properties still use their real base.
  const relative = field.type === "PROPERTY" && ["TRANSLATION_X", "TRANSLATION_Y", "TRANSLATION_XY", "ROTATION"].includes(field.name);
  const scale = field.type === "PROPERTY" && ["SCALE_X", "SCALE_Y", "SCALE_XY"].includes(field.name);
  let base = copy(binding.baseValue);
  if (relative || scale) {
    const value = scale ? 1 : 0;
    if (base.type === "FLOAT") base = { type: "FLOAT", value };
    else if (base.type === "VECTOR") base = { type: "VECTOR", value: { x: value, y: value } };
    else throw new Error("Unsupported Motion transform value.");
  }
  const overlaps = sorted.some((track, i) => sorted.slice(0, i).some(previous => track.keyframes[0].timelinePosition < previous.keyframes[previous.keyframes.length - 1].timelinePosition));
  if (overlaps) {
    if (operation !== "OFFSET") throw new Error("The plugin currently combines overlapping offset presets only.");
    return preserveSpan(mergeOffsetTracks(sorted, base));
  }
  for (const track of sorted) {
    const previous = frames[frames.length - 1];
    const first = track.keyframes[0];
    if (previous && operation !== "SET" && !neutral(first.value, operation)) throw new Error("This preset combination cannot be joined exactly.");
    const segment = track.keyframes.map(frame => ({
      timelinePosition: frame.timelinePosition, easing: copy(frame.easing), value: combine(base, frame.value, operation),
    }));
    if (previous && !same(previous.value, segment[0].value)) throw new Error("These preset segments have a value discontinuity and cannot be joined exactly.");
    // Figma holds the first value backwards to t=0. A synthetic base-value key
    // makes a delayed fade flash before its start. Easing belongs to the
    // arriving key: keep the preceding endpoint's easing at shared boundaries.
    if (previous && first.timelinePosition > previous.timelinePosition) segment[0].easing = { type: "HOLD" };
    frames.push(...(previous && first.timelinePosition === previous.timelinePosition ? segment.slice(1) : segment));
    if (operation !== "SET") base = copy(segment[segment.length - 1].value);
  }
  return preserveSpan(frames);
}

export function planPresetConversion(node: ConversionNode, allowedFields: ReadonlySet<string>): Plan {
  const styles = copy(node.animationStyles);
  const tracks: PlannedTrack[] = [];
  const bindings = resolvedBindings(node.animations);
  for (const { field, binding } of bindings) {
    const manual = manualAt(node, field);
    const presetTracks = binding.tracks.filter(track => track.id !== manual?.id);
    if (!presetTracks.length) continue;
    if (field.type === "PROPERTY" && !allowedFields.has(field.name)) throw new Error(`${node.name}: unsupported animated field ${field.name}.`);
    if (manual) {
      const label = field.type === "PROPERTY" ? field.name : `${field.collection}[${field.index}]`;
      throw new Error(`${node.name}: ${label} contains both manual keyframes and a preset. The plugin cannot preserve both during conversion.`);
    }
    try {
      tracks.push({ field, input: bake(field, binding, presetTracks.map(track => placePresetTrack(track, styles))) });
    } catch (error) {
      const label = field.type === "PROPERTY" ? field.name : `${field.collection}[${field.index}]`;
      throw new Error(`${node.name} (${node.id}), ${label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (!tracks.length) throw new Error(`${node.name}: Figma has not exposed the preset keyframes, so the plugin cannot convert them.`);
  return { node, styles, tracks };
}

const state = (node: ConversionNode) => copy({ styles: node.animationStyles, tracks: node.manualKeyframeTracks, timelines: node.timelines });
export const trackContents = (track: ManualKeyframeTrackInput): ManualKeyframeTrackInput => copy({ baseValue: track.baseValue, keyframes: track.keyframes.map(({ timelinePosition, easing, value }) => ({ timelinePosition, easing, value })) });

// Desktop can defer Motion readback until the next event-loop turn, even though
// the write methods are synchronous. Flush before verification AND rollback.
const flushMotion = () => new Promise<void>(resolve => setTimeout(resolve, 0));

export async function convertPresetSelection(nodes: ConversionNode[], allowedFields: ReadonlySet<string>) {
  const styled = nodes.filter(node => !node.removed && node.animationStyles.length > 0);
  if (!styled.length) throw new Error("Select layers with presets to convert.");
  // Finish planning the ENTIRE selection before any undo boundary or write.
  const plans = styled.map(node => planPresetConversion(node, allowedFields));
  const before = styled.map(state);
  figma.commitUndo();
  try {
    // Materialize and verify all manual data before removing any source preset.
    for (const plan of plans) for (const { field, input } of plan.tracks) {
      plan.node.applyManualKeyframeTrack(field, input);
    }
    await flushMotion();
    for (const plan of plans) for (const { field, input } of plan.tracks) {
      const written = manualAt(plan.node, field);
      if (!written || !sameMotion(trackContents(written), trackContents(input))) throw new Error(`${plan.node.name}: Figma did not preserve the converted keyframes.`);
    }
    for (const plan of plans) {
      for (const style of plan.styles) {
        plan.node.removeAnimationStyle(style.id);
      }
    }
    await flushMotion();
    for (const plan of plans) {
      if (plan.node.animationStyles.length) throw new Error("Figma retained unexpected presets.");
      for (const { field, input } of plan.tracks) {
        const written = manualAt(plan.node, field);
        if (!written || !sameMotion(trackContents(written), trackContents(input))) throw new Error(`${plan.node.name}: converted keyframes changed while removing presets.`);
      }
    }
  } catch (error) {
    // Native undo restores original identities. Never re-apply a preset to roll
    // back, and never undo an earlier user action if this attempt wrote nothing.
    await flushMotion();
    if (styled.some((node, i) => !same(state(node), before[i]))) {
      figma.triggerUndo();
      await flushMotion();
    }
    throw error;
  }
  figma.commitUndo();
  return { nodeIds: styled.map(node => node.id), convertedStyles: plans.reduce((n, p) => n + p.styles.length, 0), convertedTracks: plans.reduce((n, p) => n + p.tracks.length, 0) };
}
