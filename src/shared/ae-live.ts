import type { AEContext, AELiveState, AESessionRecord, AESyncMode, AESyncStatus } from "./types.js";

const EMPTY_CONTEXT_EXPORTED_AT = new Date(0).toISOString();
const LIVE_THRESHOLD_MS = 12_000;
const STALE_THRESHOLD_MS = 60_000;
const MAX_TRACKED_SESSIONS = 8;
const UNSAVED_PROJECT_ID = "unsaved:active-project";

function parseTimestamp(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function createEmptyLiveState(): AELiveState {
  return {
    sessions: [],
    activeSessionId: null,
    status: "disconnected",
    syncMode: "file-fallback",
    lastSyncAttemptAt: null,
    lastSuccessfulSyncAt: null,
    lastContextExportAt: null,
    lastError: null,
  };
}

export function isEmptyContextSnapshot(context: AEContext | null | undefined): boolean {
  if (!context) {
    return true;
  }

  return (
    context.exportedAt === EMPTY_CONTEXT_EXPORTED_AT &&
    context.projectName === "Untitled Project" &&
    context.projectPath === null &&
    context.activeComp === null &&
    context.selectedLayers.length === 0
  );
}

export function getSessionId(context: AEContext): string {
  const normalizedPath = context.projectPath?.trim();
  if (normalizedPath) {
    return normalizedPath.replace(/\\/g, "/");
  }

  return UNSAVED_PROJECT_ID;
}

export function getSelectedKeyframeCount(context: AEContext): number {
  return context.selectedLayers.reduce((count, layer) => count + layer.selectedKeyframeCount, 0);
}

function toSessionRecord(context: AEContext, isActive: boolean): AESessionRecord {
  return {
    id: getSessionId(context),
    projectName: context.projectName,
    projectPath: context.projectPath,
    activeCompName: context.activeComp?.name ?? null,
    selectedLayerCount: context.selectedLayers.length,
    selectedKeyframeCount: getSelectedKeyframeCount(context),
    isActive,
    isUnsaved: !context.projectPath,
    lastSeenAt: context.exportedAt,
    lastContext: context,
  };
}

function sortSessions(sessions: AESessionRecord[]): AESessionRecord[] {
  return [...sessions]
    .sort((left, right) => {
      if (left.isActive !== right.isActive) {
        return left.isActive ? -1 : 1;
      }

      return (parseTimestamp(right.lastSeenAt) ?? 0) - (parseTimestamp(left.lastSeenAt) ?? 0);
    })
    .slice(0, MAX_TRACKED_SESSIONS);
}

export function deriveSyncStatus(params: {
  context: AEContext | null;
  bridgeOk: boolean;
  now?: number;
}): AESyncStatus {
  if (!params.context || isEmptyContextSnapshot(params.context)) {
    return params.bridgeOk ? "stale" : "disconnected";
  }

  const now = params.now ?? Date.now();
  const exportedAt = parseTimestamp(params.context.exportedAt);
  if (exportedAt === null) {
    return params.bridgeOk ? "stale" : "disconnected";
  }

  const ageMs = Math.max(0, now - exportedAt);

  if (params.bridgeOk && ageMs <= LIVE_THRESHOLD_MS) {
    return "connected";
  }

  if (ageMs <= STALE_THRESHOLD_MS) {
    return "stale";
  }

  return "disconnected";
}

export function reduceLiveState(
  previous: AELiveState,
  params: {
    context: AEContext | null;
    bridgeOk: boolean;
    attemptedAt: string;
    successfulSyncAt: string | null;
    syncMode: AESyncMode;
    error: string | null;
  },
): AELiveState {
  const nextStatus = deriveSyncStatus({
    context: params.context,
    bridgeOk: params.bridgeOk,
  });

  const context = params.context;
  const activeSessionId =
    nextStatus === "connected" && context && !isEmptyContextSnapshot(context) ? getSessionId(context) : null;
  const nextSessions = previous.sessions
    .map((session) => ({
      ...session,
      isActive: activeSessionId !== null && session.id === activeSessionId,
    }))
    .filter((session) => !isEmptyContextSnapshot(session.lastContext));

  if (context && !isEmptyContextSnapshot(context)) {
    const nextRecord = toSessionRecord(context, activeSessionId === getSessionId(context));
    const dedupedSessions = nextSessions.filter((session) => {
      if (session.id === nextRecord.id) {
        return false;
      }

      if (context.projectPath && session.isUnsaved && session.projectName === context.projectName) {
        return false;
      }

      return true;
    });

    dedupedSessions.unshift(nextRecord);
    nextSessions.splice(0, nextSessions.length, ...dedupedSessions);
  }

  return {
    sessions: sortSessions(nextSessions),
    activeSessionId,
    status: nextStatus,
    syncMode: params.syncMode,
    lastSyncAttemptAt: params.attemptedAt,
    lastSuccessfulSyncAt: params.successfulSyncAt ?? previous.lastSuccessfulSyncAt,
    lastContextExportAt: context && !isEmptyContextSnapshot(context) ? context.exportedAt : previous.lastContextExportAt,
    lastError: params.error,
  };
}
