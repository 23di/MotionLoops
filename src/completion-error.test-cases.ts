// @ts-nocheck
import assert from "node:assert/strict";

// Integration checks run against the actual plugin handler and shared host mock.
export async function runCompletionErrorTests({ onMessage, postedMessages, makeNode, parent, nodes, freshPreset }) {
  const host = globalThis.figma;
  const originalLookup = host.getNodeByIdAsync;
  const originalResize = host.ui.resize;
  const originalPost = host.ui.postMessage;
  const originalTimer = globalThis.setTimeout;
  const originalClear = globalThis.clearTimeout;
  const originalWarn = console.warn;
  const liveTimers = new Set();
  const lateReads = [];
  let snapshotCount = 0;
  let lateNodeReads = 0;
  let lookupMode = "normal";
  let staleSource = false;
  let staleSourceReads = 0;
  let holdMutation = null;
  let mutationWasHeld = false;
  const results = () => postedMessages.filter(message => message.type === "result");
  const diagnostics = result => JSON.parse(result.diagnostics.slice(result.diagnostics.indexOf("\n") + 1));
  const bounded = async promise => {
    let timer;
    try {
      return await Promise.race([promise, new Promise((_, reject) => {
        timer = originalTimer(() => reject(new Error("Plugin completion timed out")), 2000);
      })]);
    } finally { originalClear(timer); }
  };
  globalThis.setTimeout = (callback, delay, ...args) => {
    // Exercise production timeout behavior without making every regression take 1.5s.
    let timer;
    timer = originalTimer(() => { liveTimers.delete(timer); callback(...args); }, delay === 1500 ? 5 : delay);
    liveTimers.add(timer);
    return timer;
  };
  globalThis.clearTimeout = timer => { liveTimers.delete(timer); return originalClear(timer); };
  host.getNodeByIdAsync = async id => {
    // Esbuild preserves this function name in the non-minified test bundle. This
    // isolates optional diagnostics from document reads without a production hook.
    const isSnapshot = new Error().stack.includes("captureDiagnosticScene");
    if (isSnapshot) {
      snapshotCount++;
      if (lookupMode === "service-stall") {
        if (id === card.id) {
          const source = await originalLookup(id);
          return new Proxy(source, { get(target, key) {
            if (key === "then") return undefined;
            if (staleSource) { staleSourceReads++; throw new Error("Source invalidated while awaiting service"); }
            return Reflect.get(target, key);
          } });
        }
        return new Promise(resolve => lateReads.push(() => resolve(null)));
      }
      if (lookupMode === "snapshot-reject") throw new Error("Snapshot host rejection");
      if (lookupMode === "snapshot-stall" || lookupMode === "mutation-reject") {
        return new Promise(resolve => lateReads.push(() => resolve(new Proxy(nodes.get(id) ?? {}, { get(_target, key) { if (key === "then") return undefined; lateNodeReads++; throw new Error("Stale diagnostic node accessed"); } }))));
      }
    } else {
      if (lookupMode === "mutation-reject") throw new Error("Document host rejection");
      if (lookupMode === "hold-mutation" && !mutationWasHeld) {
        mutationWasHeld = true;
        await new Promise(resolve => { holdMutation = resolve; });
      }
    }
    return originalLookup(id);
  };
  const card = makeNode("Completion regression card");
  parent.children = [card];
  host.currentPage.selection = [card];
  const settings = freshPreset("circle");
  settings.other.serviceLayers = "0";
  try {
    lookupMode = "snapshot-stall";
    let start = results().length;
    await bounded(onMessage({ type: "apply", settings }));
    assert.equal(results().length, start + 1, "Stalled before/after snapshots produce exactly one completion");
    assert.equal(results().at(-1).kind, "success", "Optional diagnostics do not turn verified mutation success into failure");
    let report = diagnostics(results().at(-1));
    assert(report.events.some(event => event.step === "snapshot.before.timed-out"));
    assert(report.events.some(event => event.step === "snapshot.after.timed-out"));
    assert.equal(report.before, null);
    assert.equal(report.after, null);
    assert(snapshotCount >= 2, "Fault injection reached actual diagnostic host reads");
    assert.equal(liveTimers.size, 0, "All snapshot timers are cleared on completion");

    lookupMode = "normal";
    await bounded(onMessage({ type: "apply", settings }));
    const currentReport = results().at(-1).diagnostics;
    const messagesBeforeLate = postedMessages.length;
    const readsBeforeLate = snapshotCount;
    for (const resolve of lateReads.splice(0)) resolve();
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    assert.equal(postedMessages.length, messagesBeforeLate, "Late snapshot completion does not emit a stale result");
    assert.equal(results().at(-1).diagnostics, currentReport, "Late snapshot cannot overwrite newer diagnostics");
    assert.equal(snapshotCount, readsBeforeLate, "Timed-out capture stops additional host reads");
    assert.equal(lateNodeReads, 0, "Late capture must not inspect stale node proxies");

    lookupMode = "snapshot-reject";
    start = results().length;
    await bounded(onMessage({ type: "clear", scope: "selection" }));
    assert.equal(results().length, start + 1);
    assert.equal(results().at(-1).kind, "success");
    report = diagnostics(results().at(-1));
    assert(report.events.some(event => event.step === "snapshot.before.failed"));
    assert(report.events.some(event => event.step === "snapshot.after.failed"));
    assert.equal(liveTimers.size, 0, "Rejected snapshots clear timers");

    lookupMode = "mutation-reject";
    start = results().length;
    await bounded(onMessage({ type: "apply", settings }));
    assert.equal(results().length, start + 1);
    assert.equal(results().at(-1).kind, "error", "Host mutation failure must not fabricate success");
    assert.match(results().at(-1).message, /Document host rejection/);
    report = diagnostics(results().at(-1));
    assert(report.events.some(event => event.step === "operation.failed"));
    assert(report.events.some(event => event.step === "snapshot.after.timed-out"), "Even error-path diagnostics are bounded");

    lookupMode = "hold-mutation";
    start = results().length;
    const pending = onMessage({ type: "apply", settings });
    for (let i = 0; i < 30 && !holdMutation; i++) await Promise.resolve();
    assert(holdMutation, "Operation reaches a real document read");
    await onMessage({ type: "clear", scope: "selection" });
    await onMessage({ type: "apply", settings });
    assert.equal(results().length, start, "Real pending mutations keep the lock and never report timeout success");
    host.ui.resize = () => { throw new Error("Resize failed"); };
    console.warn = () => {};
    await onMessage({ type: "resize", height: 580 });
    assert.equal(results().length, start, "Unrelated UI errors must not signal operation completion");
    const selectionDescriptor = Object.getOwnPropertyDescriptor(host.currentPage, "selection");
    try {
      Object.defineProperty(host.currentPage, "selection", { configurable: true, get() { throw new Error("Selection read failed"); } });
      await onMessage({ type: "refresh-selection" });
      assert.equal(results().length, start, "Selection errors cannot unlock an active mutation");
    } finally {
      Object.defineProperty(host.currentPage, "selection", selectionDescriptor);
    }
    holdMutation();
    await bounded(pending);
    assert.equal(results().length, start + 1);
    assert.equal(results().at(-1).kind, "success");
    lookupMode = "normal";
    await bounded(onMessage({ type: "clear", scope: "selection" }));
    assert.equal(results().at(-1).kind, "success", "Operation lock releases after successful/error completion");
    assert.equal(liveTimers.size, 0);

    settings.other.serviceLayers = "2";
    await bounded(onMessage({ type: "apply", settings }));
    lookupMode = "service-stall";
    start = results().length;
    await bounded(onMessage({ type: "apply", settings }));
    assert.equal(results().length, start + 1);
    assert.equal(results().at(-1).kind, "success");
    assert(lateReads.length >= 2, "Both snapshots reach a stalled service lookup");
    lookupMode = "normal";
    await bounded(onMessage({ type: "apply", settings }));
    staleSource = true;
    const beforeLateService = postedMessages.length;
    for (const resolve of lateReads.splice(0)) resolve();
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    assert.equal(staleSourceReads, 0, "Expired service lookup cannot continue reading its captured source proxy");
    assert.equal(postedMessages.length, beforeLateService);
    assert.equal(liveTimers.size, 0);
    await bounded(onMessage({ type: "clear", scope: "selection" }));
    settings.other.serviceLayers = "0";

    // The document operation is already verified when its result is posted.
    // Failure to update the selection widget must not replace it with an error.
    start = results().length;
    let successPosted = false;
    host.ui.postMessage = message => {
      if (successPosted && message.type === "selection") throw new Error("Selection widget unavailable");
      originalPost(message);
      if (message.type === "result" && message.kind === "success") successPosted = true;
    };
    await bounded(onMessage({ type: "apply", settings }));
    assert(successPosted);
    assert.equal(results().length, start + 1, "Selection refresh failure cannot emit a contradictory second result");
    host.ui.postMessage = originalPost;
    await bounded(onMessage({ type: "clear", scope: "selection" }));
  } finally {
    holdMutation?.();
    for (const resolve of lateReads) resolve();
    host.getNodeByIdAsync = originalLookup;
    host.ui.resize = originalResize;
    host.ui.postMessage = originalPost;
    globalThis.setTimeout = originalTimer;
    globalThis.clearTimeout = originalClear;
    console.warn = originalWarn;
    for (const timer of liveTimers) originalClear(timer);
  }
  console.log("Plugin completion: diagnostic stalls/rejections, late reads, mutation failures, UI errors and serialization passed");
}
