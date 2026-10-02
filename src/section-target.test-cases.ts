// @ts-nocheck
import assert from "node:assert/strict";
import { freshPreset } from "./catalog";
import { toMotionDocument } from "./motion-system";

export async function runSectionTargetTests({ onMessage, postedMessages, makeNode, parent, topFrame, nodes }) {
  const host = globalThis.figma;
  const originalParent = parent.parent;
  const originalChildren = parent.children;
  const originalSelection = host.currentPage.selection;
  const createdIds = [];
  const selectionPreview = async () => {
    await onMessage({ type: "refresh-selection" });
    return postedMessages.findLast(message => message.type === "selection").selection;
  };
  const perform = async message => {
    const start = postedMessages.length;
    await onMessage(message);
    const result = postedMessages.slice(start).findLast(message => message.type === "result");
    assert.equal(result?.kind, "success", result?.message ?? "Missing completion");
  };
  try {
    for (const sectionDepth of [1, 2]) {
      let ancestor = originalParent;
      for (let index = 0; index < sectionDepth; index++) {
        ancestor = { id: `section-target-${sectionDepth}-${index}`, type: "SECTION", parent: ancestor };
      }
      parent.parent = ancestor;
      for (const presetId of ["circle", "reference-carousel-05"]) {
        const cards = Array.from({ length: 4 }, (_, index) => {
          const card = makeNode(`Section ${sectionDepth} ${presetId} card ${index}`);
          card.type = "FRAME";
          card.children = Array.from({ length: 2 }, (_, childIndex) => {
            const child = makeNode(`Artwork ${index}-${childIndex}`);
            child.parent = card;
            createdIds.push(child.id);
            return child;
          });
          createdIds.push(card.id);
          return card;
        });
        cards[3].locked = true;
        parent.children = cards;
        host.currentPage.selection = [parent];
        const preview = await selectionPreview();
        assert.equal(preview.targets.selection.count, 3, "Frame inside sections targets its unlocked cards");
        assert.equal(preview.targets.children.count, 3);
        assert.equal(preview.targets.deep.count, 6, "Explicit Deep mode still targets artwork");
        assert.equal(preview.targets.selection.frameWidth, topFrame.absoluteBoundingBox.width);
        assert.equal(preview.targets.selection.frameHeight, topFrame.absoluteBoundingBox.height);

        // A card nested in the real frame remains an individual motion target.
        host.currentPage.selection = [cards[0]];
        assert.equal((await selectionPreview()).targets.selection.count, 1);
        host.currentPage.selection = [parent];
        const settings = freshPreset(presetId);
        Object.assign(settings.other, { scope: "selection", serviceLayers: "0", startOnEntry: false, loopCardAnimation: false });
        for (let pass = 0; pass < 2; pass++) {
          await perform({ type: "apply", settings: toMotionDocument(settings) });
          for (const card of cards.slice(0, 3)) {
            const marker = JSON.parse(card.getPluginData("orbit-motion"));
            assert.equal(marker.role, "front", "Apply and Refresh animate the cards");
            assert.equal(marker.preset, presetId);
          }
          assert.equal(cards[3].getPluginData("orbit-motion"), "", "Locked cards stay excluded");
          for (const child of cards.flatMap(card => card.children)) {
            assert.equal(child.getPluginData("orbit-motion"), "", "Nested artwork is not a composition target");
            assert.deepEqual(child.manualKeyframeTracks, {}, "Nested source artwork stays untouched");
          }
          assert.deepEqual(host.currentPage.selection, [parent], "The container stays selected after Apply and Refresh");
          assert.equal((await selectionPreview()).targets.selection.orbitCount, 3);
        }
        await perform({ type: "clear", scope: "selection" });
        assert.deepEqual(parent.children, cards, "Clear restores the original children within the section's frame");
        for (const card of cards) {
          assert.equal(card.getPluginData("orbit-motion"), "");
          assert.deepEqual(card.manualKeyframeTracks, {});
          assert.equal(card.opacity, 1);
        }
      }
    }
  } finally {
    parent.parent = originalParent;
    parent.children = originalChildren;
    host.currentPage.selection = originalSelection;
    for (const id of createdIds) nodes.delete(id);
  }
  console.log("Section frames: selection preview, nested cards, locked layers, trajectory/native Apply, Refresh and Clear passed");
}
