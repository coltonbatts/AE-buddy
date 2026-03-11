import test from "node:test";
import assert from "node:assert/strict";

import { createEmptyLiveState, deriveSyncStatus, reduceLiveState } from "./ae-live.js";
import type { AEContext } from "./types.js";

function isoOffset(offsetMs = 0): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

function makeContext(overrides: Partial<AEContext> = {}): AEContext {
  return {
    exportedAt: isoOffset(0),
    projectName: "Demo Project.aep",
    projectPath: "/tmp/Demo Project.aep",
    activeComp: {
      name: "Hero",
      width: 1920,
      height: 1080,
      duration: 10,
      frameRate: 24,
      workAreaStart: 0,
      workAreaDuration: 10,
      displayStartTime: 0,
      currentTime: 1.25,
      numLayers: 4,
      hasCamera: false,
      activeCameraName: null,
      backgroundColor: [0, 0, 0],
    },
    selectedLayers: [],
    notes: [],
    ...overrides,
  };
}

test("reduceLiveState tracks the active session and preserves recent sessions", () => {
  const initial = createEmptyLiveState();
  const firstTimestamp = isoOffset(0);
  const secondTimestamp = isoOffset(4_000);
  const firstContext = makeContext();
  const secondContext = makeContext({
    projectName: "Second Project.aep",
    projectPath: "/tmp/Second Project.aep",
    exportedAt: secondTimestamp,
  });

  const firstState = reduceLiveState(initial, {
    context: { ...firstContext, exportedAt: firstTimestamp },
    bridgeOk: true,
    attemptedAt: firstTimestamp,
    successfulSyncAt: firstTimestamp,
    syncMode: "cep-polling",
    error: null,
  });

  const secondState = reduceLiveState(firstState, {
    context: secondContext,
    bridgeOk: true,
    attemptedAt: secondTimestamp,
    successfulSyncAt: secondTimestamp,
    syncMode: "cep-polling",
    error: null,
  });

  assert.equal(firstState.activeSessionId, firstContext.projectPath);
  assert.equal(secondState.activeSessionId, secondContext.projectPath);
  assert.equal(secondState.sessions.length, 2);
  assert.equal(secondState.sessions[0]?.projectName, "Second Project.aep");
  assert.equal(secondState.sessions[0]?.isActive, true);
  assert.equal(secondState.sessions[1]?.projectName, "Demo Project.aep");
  assert.equal(secondState.sessions[1]?.isActive, false);
});

test("reduceLiveState deduplicates repeated snapshots for the same observed project", () => {
  const initial = createEmptyLiveState();
  const firstTimestamp = isoOffset(0);
  const secondTimestamp = isoOffset(4_000);
  const context = makeContext({ exportedAt: firstTimestamp });

  const firstState = reduceLiveState(initial, {
    context,
    bridgeOk: true,
    attemptedAt: firstTimestamp,
    successfulSyncAt: firstTimestamp,
    syncMode: "cep-polling",
    error: null,
  });

  const secondState = reduceLiveState(firstState, {
    context: { ...context, exportedAt: secondTimestamp },
    bridgeOk: true,
    attemptedAt: secondTimestamp,
    successfulSyncAt: secondTimestamp,
    syncMode: "cep-polling",
    error: null,
  });

  assert.equal(secondState.sessions.length, 1);
  assert.equal(secondState.sessions[0]?.lastSeenAt, secondTimestamp);
});

test("stale fallback preserves the last observed project without labeling it current", () => {
  const initial = createEmptyLiveState();
  const liveTimestamp = isoOffset(0);
  const staleTimestamp = isoOffset(-15_000);
  const context = makeContext({ exportedAt: liveTimestamp });

  const connectedState = reduceLiveState(initial, {
    context,
    bridgeOk: true,
    attemptedAt: liveTimestamp,
    successfulSyncAt: liveTimestamp,
    syncMode: "cep-polling",
    error: null,
  });

  const staleState = reduceLiveState(connectedState, {
    context: { ...context, exportedAt: staleTimestamp },
    bridgeOk: false,
    attemptedAt: liveTimestamp,
    successfulSyncAt: null,
    syncMode: "file-fallback",
    error: "CEP bridge unavailable",
  });

  assert.equal(staleState.status, "stale");
  assert.equal(staleState.activeSessionId, null);
  assert.equal(staleState.sessions[0]?.projectName, context.projectName);
  assert.equal(staleState.sessions[0]?.isActive, false);
});

test("disconnected fallback keeps observed history while clearing current-project labeling", () => {
  const initial = createEmptyLiveState();
  const liveTimestamp = isoOffset(0);
  const disconnectedTimestamp = isoOffset(-120_000);
  const context = makeContext({ exportedAt: liveTimestamp });

  const connectedState = reduceLiveState(initial, {
    context,
    bridgeOk: true,
    attemptedAt: liveTimestamp,
    successfulSyncAt: liveTimestamp,
    syncMode: "cep-polling",
    error: null,
  });

  const disconnectedState = reduceLiveState(connectedState, {
    context: { ...context, exportedAt: disconnectedTimestamp },
    bridgeOk: false,
    attemptedAt: liveTimestamp,
    successfulSyncAt: null,
    syncMode: "file-fallback",
    error: "No readable snapshot available",
  });

  assert.equal(disconnectedState.status, "disconnected");
  assert.equal(disconnectedState.activeSessionId, null);
  assert.equal(disconnectedState.sessions.length, 1);
  assert.equal(disconnectedState.sessions[0]?.isActive, false);
});

test("saved projects replace matching unsaved observed entries", () => {
  const initial = createEmptyLiveState();
  const unsavedTimestamp = isoOffset(0);
  const savedTimestamp = isoOffset(10_000);
  const unsavedContext = makeContext({
    projectName: "Unsaved Project",
    projectPath: null,
    exportedAt: unsavedTimestamp,
  });
  const savedContext = makeContext({
    projectName: "Unsaved Project",
    projectPath: "/tmp/Unsaved Project.aep",
    exportedAt: savedTimestamp,
  });

  const unsavedState = reduceLiveState(initial, {
    context: unsavedContext,
    bridgeOk: true,
    attemptedAt: unsavedTimestamp,
    successfulSyncAt: unsavedTimestamp,
    syncMode: "cep-polling",
    error: null,
  });

  const savedState = reduceLiveState(unsavedState, {
    context: savedContext,
    bridgeOk: true,
    attemptedAt: savedTimestamp,
    successfulSyncAt: savedTimestamp,
    syncMode: "cep-polling",
    error: null,
  });

  assert.equal(savedState.sessions.length, 1);
  assert.equal(savedState.sessions[0]?.projectPath, "/tmp/Unsaved Project.aep");
});

test("deriveSyncStatus marks recent file snapshots stale when the bridge is unavailable", () => {
  const exportedAt = isoOffset(-30_000);
  const context = makeContext({ exportedAt });
  const status = deriveSyncStatus({
    context,
    bridgeOk: false,
    now: Date.now(),
  });

  assert.equal(status, "stale");
});

test("deriveSyncStatus marks old snapshots disconnected", () => {
  const context = makeContext({ exportedAt: isoOffset(-150_000) });
  const status = deriveSyncStatus({
    context,
    bridgeOk: false,
    now: Date.now(),
  });

  assert.equal(status, "disconnected");
});
