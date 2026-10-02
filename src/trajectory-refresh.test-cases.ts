// @ts-nocheck
import assert from "node:assert/strict";
import { freshPreset } from "./catalog";
import { toMotionDocument } from "./motion-system";

// Switching trajectories must replace inherited tracks on newly cloned depth
// layers, even when Desktop restores stale tracks after reordering.
export async function runTrajectoryRefreshTests({ onMessage, postedMessages, makeNode, parent, topFrame, nodes, cloneData, sampleTrack, selectionChange }) {
  const originalInsert = parent.insertChild;
  const originalChildren = parent.children;
  const originalSelection = figma.currentPage.selection;
  const originalSize = { width: parent.width, height: parent.height };
  const originalFrame = cloneData(topFrame);
  const originalPost = figma.ui.postMessage;
  const createdIds = [];
  let restoreInheritedOnOrder = false;
  let rejectTrackUpdates = false;
  let revertedCopies = 0;
  const cards = Array.from({ length: 6 }, (_, index) => {
    const card = makeNode(`Orbit refresh ${index}`);
    card.type = "FRAME"; card.width = 400; card.height = 460;
    card.relativeTransform = [[1, 0, 280 + index % 3 * 480], [0, 1, index < 3 ? 140 : 680]];
    card.absoluteBoundingBox = { x: card.x, y: card.y, width: 400, height: 460 };
    card.children = [makeNode(`Unanimated artwork ${index}`)];
    card.children[0].parent = card;
    createdIds.push(card.id, card.children[0].id);
    const originalClone = card.clone;
    card.clone = function () {
      const copy = originalClone.call(this);
      copy._inheritedTracks = cloneData(copy.manualKeyframeTracks);
      const write = copy.applyManualKeyframeTrack;
      copy.applyManualKeyframeTrack = function (field, track) {
        if (rejectTrackUpdates && field.name === "TRANSLATION_X") return;
        // Native readback stores float32 values and adds first-key HOLD and
        // redundant identity Béziers to LINEAR segments.
        const native = cloneData(track);
        if (native.baseValue?.type === "FLOAT") native.baseValue.value = Math.fround(native.baseValue.value);
        native.keyframes.forEach((key, index) => {
          if (key.value.type === "FLOAT") key.value.value = Math.fround(key.value.value);
          if (!index) key.easing = { type: "HOLD" };
          else if (key.easing?.type === "LINEAR") key.easing.easingFunctionCubicBezier = { x1: 0, y1: 0, x2: 1, y2: 1 };
        });
        write.call(this, field, native);
      };
      return copy;
    };
    return card;
  });
  const run = async settings => {
    const start = postedMessages.length;
    await onMessage({ type: "apply", settings: toMotionDocument(settings) });
    const results = postedMessages.slice(start).filter(message => message.type === "result");
    assert.equal(results.length, 1, "Apply emits one terminal result");
    return { result: results[0], messages: postedMessages.slice(start) };
  };
  try {
    Object.assign(parent, { width: 1920, height: 1280 });
    Object.assign(topFrame, { width: 1920, height: 1280, absoluteBoundingBox: { x: 0, y: 0, width: 1920, height: 1280 } });
    parent.children = cards;
    figma.currentPage.selection = [parent];
    const first = freshPreset("orbit-3d-eight");
    const next = freshPreset("orbit-3d-tilted");
    for (const settings of [first, next]) Object.assign(settings.other, { serviceLayers: "4", startOnEntry: true, loopCardAnimation: false });
    assert.equal((await run(first)).result.kind, "success");
    parent.insertChild = function (index, node) {
      originalInsert.call(this, index, node);
      if (restoreInheritedOnOrder && node._inheritedTracks && !node._restoredInheritedTracks && node.getPluginData("orbit-motion")) {
        node.manualKeyframeTracks = cloneData(node._inheritedTracks);
        node._restoredInheritedTracks = true;
        revertedCopies++;
      }
    };
    restoreInheritedOnOrder = true;
    // Motion writes can produce a burst of selection events even though the
    // same container remains selected. They must not repeatedly rebuild UI.
    figma.ui.postMessage = message => {
      originalPost(message);
      if (message.type === "result") for (let i = 0; i < 100; i++) selectionChange();
    };
    for (let pass = 0; pass < 2; pass++) {
      const pending = run(next);
      for (let i = 0; i < 100; i++) selectionChange();
      const { result, messages } = await pending;
      assert.equal(result.kind, "success", result.message);
      assert.equal(messages.filter(message => message.type === "selection").length, 1, "Apply publishes one settled selection");
      for (const card of cards) {
        const marker = JSON.parse(card.getPluginData("orbit-motion"));
        const copies = parent.children.filter(node => node.name.startsWith(`${card.name} · Orbit Depth `));
        assert.equal(copies.length, 3);
        for (const copy of copies) for (const field of ["TRANSLATION_X", "TRANSLATION_Y", "SCALE_X", "SCALE_Y", "ROTATION"]) {
          for (let sample = 0; sample <= 120; sample++) assert(Math.abs(sampleTrack(copy.manualKeyframeTracks[field], sample / 24) - sampleTrack(card.manualKeyframeTracks[field], sample / 24)) < .001,
            `${field}: source and depth copies share the refreshed path throughout playback`);
        }
        assert.equal(marker.preset, next.preset);
      }
      const report = JSON.parse(result.diagnostics.slice(result.diagnostics.indexOf("\n") + 1));
      assert(report.state.marked.every(node => node.marker.role === "back" || cards.some(card => card.id === node.id)), "Diagnostics omit unrelated animation frames");
      assert(result.diagnostics.length < 160000, `Completion report stays small for the reported six-card scene (${result.diagnostics.length} bytes)`);
      const translation = report.state.marked.find(node => node.translationTracks?.x)?.translationTracks.x;
      assert(translation.keyframeCount > 0 && !translation.keyframes, "Diagnostics summarize tracks without serializing every key");
    }
    assert(revertedCopies >= 18, "Fault injection reproduced inherited tracks after reordering");
    restoreInheritedOnOrder = false;
    rejectTrackUpdates = true;
    const failed = await run(first);
    assert.equal(failed.result.kind, "error", "Persistent native track loss cannot report success");
    assert.match(failed.result.message, /did not preserve TRANSLATION_X/);
    rejectTrackUpdates = false;
    await onMessage({ type: "clear", scope: "selection" });
    assert.deepEqual(parent.children, cards);
    assert(cards.every(card => Object.keys(card.manualKeyframeTracks).length === 0));

    figma.ui.postMessage = originalPost;
    const start = postedMessages.length;
    for (let i = 0; i < 100; i++) selectionChange();
    await new Promise(resolve => setTimeout(resolve, 70));
    assert.equal(postedMessages.slice(start).filter(message => message.type === "selection").length, 1, "Idle selection bursts coalesce into one update");
    console.log("Trajectory refresh: inherited stale depth tracks, native readback, 21780 playback probes, bounded repair, compact diagnostics and selection bursts passed");
  } finally {
    parent.insertChild = originalInsert;
    parent.children = originalChildren;
    Object.assign(parent, originalSize);
    Object.assign(topFrame, originalFrame);
    figma.currentPage.selection = originalSelection;
    figma.ui.postMessage = originalPost;
    for (const id of createdIds) nodes.delete(id);
  }
}
