import { useDeferredValue, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { exists, mkdir, readTextFile, rename, writeTextFile } from "@tauri-apps/plugin-fs";

import { commitPreparedRun, loadRunHistory, prepareRun, readExecutionFeedback } from "@/engine/workflow.js";
import type { EngineHost, PreparedRun } from "@/engine/contracts.js";
import { getMotionRegistry, searchMotionRegistry } from "@/domain/commands/registry.js";
import {
  createEmptyCommandStore,
  ensureCommandStore,
  loadCommandStore,
  recordRecentCommand,
  saveCommandStore,
  saveGeneratedPlanAsRecipe,
  toggleFavorite,
} from "@/domain/persistence/command-store.js";
import { createEmptyLiveState, isEmptyContextSnapshot, reduceLiveState } from "@/shared/ae-live.js";
import { emptyContext } from "@/shared/ae-context.js";
import type {
  AEContext,
  AEContextSnapshotReadResult,
  AELiveState,
  CommandStore,
  LoggedRun,
  MotionBuddyRuntimeConfig,
} from "@/shared/types.js";
import { createDesktopEngineHost } from "./desktop-host.js";
import { triggerCepContextExport, triggerCepExecution } from "./desktop-api.js";

export interface UiEvent {
  id: string;
  timestamp: string;
  level: "info" | "success" | "warning" | "error";
  title: string;
  detail?: string;
}

function createEvent(level: UiEvent["level"], title: string, detail?: string): UiEvent {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    timestamp: new Date().toISOString(),
    level,
    title,
    detail,
  };
}

const desktopStoreFs = {
  exists,
  mkdir,
  readTextFile,
  rename,
  writeTextFile,
};

const CONTEXT_SYNC_INTERVAL_MS = 4000;

export function useMotionBuddy() {
  const [host, setHost] = useState<EngineHost | null>(null);
  const [runtime, setRuntime] = useState<MotionBuddyRuntimeConfig | null>(null);
  const [context, setContext] = useState<AEContext | null>(null);
  const [liveState, setLiveState] = useState<AELiveState>(createEmptyLiveState());
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [commandStore, setCommandStore] = useState<CommandStore>(createEmptyCommandStore());
  const [history, setHistory] = useState<LoggedRun[]>([]);
  const [selectedLogPath, setSelectedLogPath] = useState<string | null>(null);
  const [activeRun, setActiveRun] = useState<PreparedRun | null>(null);
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("");
  const [events, setEvents] = useState<UiEvent[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const pollingRef = useRef<number | null>(null);
  const contextPollingRef = useRef<number | null>(null);
  const contextSyncInFlightRef = useRef(false);
  const runRef = useRef<PreparedRun | null>(null);
  const feedbackNoticeRef = useRef<string | null>(null);
  const commandStoreRef = useRef<CommandStore>(createEmptyCommandStore());
  const liveStateRef = useRef<AELiveState>(createEmptyLiveState());
  const contextRef = useRef<AEContext | null>(null);
  const mountedRef = useRef(true);

  function addEvent(level: UiEvent["level"], title: string, detail?: string) {
    setEvents((current) => [createEvent(level, title, detail), ...current].slice(0, 40));
  }

  async function syncCommandStore(nextStore: CommandStore, nextRuntime = runtime) {
    commandStoreRef.current = nextStore;
    setCommandStore(nextStore);

    if (!nextRuntime) {
      return;
    }

    await saveCommandStore(desktopStoreFs, nextRuntime.commandStorePath, nextStore);
  }

  async function refreshHistory(engineHost: EngineHost) {
    const logs = await loadRunHistory(engineHost);
    setHistory(logs);
    setSelectedLogPath((current) => current ?? logs[0]?.logPath ?? null);
  }

  function stopPolling() {
    if (pollingRef.current !== null) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }

  function stopContextPolling() {
    if (contextPollingRef.current !== null) {
      window.clearInterval(contextPollingRef.current);
      contextPollingRef.current = null;
    }
  }

  const syncAeContext = useEffectEvent(async (reason: "boot" | "poll" | "manual" | "planning") => {
    const engineHost = host;
    if (!engineHost || contextSyncInFlightRef.current || !mountedRef.current) {
      return;
    }

    contextSyncInFlightRef.current = true;
    const attemptedAt = new Date().toISOString();
    let bridgeOk = false;
    let errorMessage: string | null = null;
    let snapshot: AEContextSnapshotReadResult = { status: "missing" };

    try {
      await triggerCepContextExport({
        exportScriptPath: engineHost.config.exportContextScriptPath,
        commandUrl: engineHost.config.cepCommandUrl,
      });
      bridgeOk = true;
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    }

    try {
      snapshot = await engineHost.readContextSnapshot();
      const previousContext = contextRef.current;
      const nextContext = snapshot.status === "ok" ? snapshot.context : previousContext;
      const nextBridgeOk = bridgeOk && snapshot.status === "ok";
      const nextSyncMode = nextBridgeOk ? "cep-polling" : "file-fallback";

      if (snapshot.status === "missing") {
        errorMessage = errorMessage ?? "AE Buddy could not find a context snapshot yet.";
      } else if (snapshot.status === "invalid") {
        errorMessage = errorMessage ?? `AE Buddy could not read the latest context snapshot: ${snapshot.message}`;
      }

      if (!mountedRef.current) {
        return;
      }

      const provisionalLiveState = reduceLiveState(liveStateRef.current, {
        context: nextContext,
        bridgeOk: nextBridgeOk,
        attemptedAt,
        successfulSyncAt: null,
        syncMode: nextSyncMode,
        error: errorMessage,
      });
      const nextLiveState =
        provisionalLiveState.status === "connected"
          ? {
              ...provisionalLiveState,
              lastSuccessfulSyncAt: attemptedAt,
            }
          : provisionalLiveState;

      const previousLiveState = liveStateRef.current;
      liveStateRef.current = nextLiveState;
      contextRef.current = nextContext;
      setLiveState(nextLiveState);
      setContext(nextContext);
      setSelectedSessionId((current) => {
        if (current && nextLiveState.sessions.some((session) => session.id === current)) {
          return current;
        }

        return nextLiveState.activeSessionId ?? current;
      });

      if (reason === "manual") {
        if (nextBridgeOk && nextContext && !isEmptyContextSnapshot(nextContext)) {
          addEvent("success", "AE context refreshed", `${nextContext.projectName} is synced from the live bridge.`);
        } else if (!nextBridgeOk) {
          addEvent(
            "warning",
            "Live sync unavailable",
            [
              errorMessage ?? "The Motion Buddy CEP bridge did not respond.",
              nextContext
                ? `AE Buddy is showing the last readable snapshot from ${engineHost.config.contextPath}.`
                : `No readable snapshot is available at ${engineHost.config.contextPath}.`,
            ].join(" "),
          );
        }
      } else if (previousLiveState.status !== nextLiveState.status) {
        if (nextLiveState.status === "connected" && nextContext && !isEmptyContextSnapshot(nextContext)) {
          addEvent("success", "Live AE sync connected", `${nextContext.projectName} is now updating through the CEP bridge.`);
        } else if (nextLiveState.status === "stale") {
          addEvent(
            "warning",
            "AE context is stale",
            errorMessage ?? "AE Buddy is showing the last exported snapshot while it waits for a fresh bridge sync.",
          );
        } else if (nextLiveState.status === "disconnected") {
          addEvent(
            "warning",
            "After Effects disconnected",
            errorMessage ?? "Open the Motion Buddy Bridge panel in After Effects to resume live context updates.",
          );
        }
      }
    } finally {
      contextSyncInFlightRef.current = false;
    }
  });

  async function refreshContext() {
    await syncAeContext("manual");
  }

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const engineHost = await createDesktopEngineHost();
        if (cancelled) {
          return;
        }

        setHost(engineHost);
        setRuntime(engineHost.config);
        setModel(engineHost.config.model);
        await ensureCommandStore(desktopStoreFs, engineHost.config.stateDir, engineHost.config.commandStorePath);
        const loadedStore = await loadCommandStore(desktopStoreFs, engineHost.config.commandStorePath);
        commandStoreRef.current = loadedStore;
        setCommandStore(loadedStore);
        await refreshHistory(engineHost);
        addEvent("success", "Desktop session ready", "Motion Buddy Studio loaded the workspace and current AE bridge files.");
        setIsReady(true);
      } catch (error) {
        addEvent("error", "Failed to initialize desktop host", error instanceof Error ? error.message : String(error));
      }
    }

    void boot();

    return () => {
      cancelled = true;
      mountedRef.current = false;
      stopPolling();
      stopContextPolling();
    };
  }, []);

  useEffect(() => {
    if (!host) {
      return;
    }

    void syncAeContext("boot");
    stopContextPolling();
    contextPollingRef.current = window.setInterval(() => {
      void syncAeContext("poll");
    }, CONTEXT_SYNC_INTERVAL_MS);

    return () => {
      stopContextPolling();
    };
  }, [host, syncAeContext]);

  const selectedLog = useMemo(
    () => history.find((entry) => entry.logPath === selectedLogPath) ?? history[0] ?? null,
    [history, selectedLogPath],
  );
  const deferredPrompt = useDeferredValue(prompt);
  const paletteResults = useMemo(
    () =>
      searchMotionRegistry({
        prompt: deferredPrompt,
        context: context ?? emptyContext(),
        store: commandStore,
      }),
    [commandStore, context, deferredPrompt],
  );
  const recentCommands = useMemo(() => commandStore.recentCommands.slice(0, 6), [commandStore.recentCommands]);
  const frequentCommands = useMemo(() => commandStore.usageStats.slice(0, 6), [commandStore.usageStats]);
  const inspectedSession = useMemo(
    () => liveState.sessions.find((session) => session.id === selectedSessionId) ?? liveState.sessions[0] ?? null,
    [liveState.sessions, selectedSessionId],
  );

  async function generatePlan() {
    if (!host || isGenerating || isExecuting) {
      return;
    }

    setIsGenerating(true);
    addEvent("info", "Refreshing AE context", "Using the latest exported context snapshot before planning.");

    try {
      await syncAeContext("planning");
      const run = await prepareRun({
        host,
        prompt,
        model,
        store: commandStoreRef.current,
        context: contextRef.current ?? context ?? undefined,
      });

      runRef.current = run;
      setActiveRun(run);
      contextRef.current = run.context;
      setContext(run.context);
      await refreshHistory(host);
      setSelectedLogPath(run.logPath);
      addEvent(
        "success",
        "ActionPlan generated",
        `${run.generatedPlan.actionPlan.summary} via ${run.generatedPlan.resolution.title} (${run.generatedPlan.actionPlan.riskLevel} risk).`,
      );
    } catch (error) {
      addEvent("error", "Plan generation failed", error instanceof Error ? error.message : String(error));
    } finally {
      setIsGenerating(false);
    }
  }

  async function runPrompt() {
    if (!host || !prompt.trim() || isGenerating || isExecuting) {
      return;
    }

    setIsGenerating(true);
    addEvent("info", "Running command", "Resolving the current palette input and validating before execution.");

    try {
      await syncAeContext("planning");
      const run = await prepareRun({
        host,
        prompt,
        model,
        store: commandStoreRef.current,
        context: contextRef.current ?? context ?? undefined,
      });

      runRef.current = run;
      setActiveRun(run);
      contextRef.current = run.context;
      setContext(run.context);
      await refreshHistory(host);
      setSelectedLogPath(run.logPath);

      if (!run.generatedPlan.validation.ok) {
        stopPolling();
        setIsExecuting(false);
        addEvent(
          "warning",
          "Execution blocked by validation",
          run.generatedPlan.validation.issues.map((issue) => issue.message).join(" | "),
        );
        return;
      }

      setIsExecuting(true);
      feedbackNoticeRef.current = null;

      await commitPreparedRun({
        host,
        run,
      });
      await syncCommandStore(recordRecentCommand(commandStoreRef.current, run.generatedPlan), host.config);
      addEvent(
        "success",
        "Execution bundle written",
        `${run.generatedPlan.resolution.title} is executing through the AE bridge.`,
      );

      try {
        const cepResult = await triggerCepExecution({
          runId: run.runId,
          importScriptPath: host.config.importScriptPath,
          commandUrl: host.config.cepCommandUrl,
        });

        addEvent(
          cepResult.ok ? "success" : "warning",
          "CEP auto-execution dispatched",
          cepResult.message || `After Effects accepted run ${run.runId} for execution.`,
        );
      } catch (error) {
        addEvent(
          "warning",
          "CEP bridge unavailable",
          [
            error instanceof Error ? error.message : String(error),
            `Manual fallback: run ${host.config.importScriptPath} inside After Effects.`,
          ].join(" "),
        );
      }

      stopPolling();
      pollingRef.current = window.setInterval(() => {
        void pollExecutionResult(host, run);
      }, 2500);
    } catch (error) {
      stopPolling();
      setIsExecuting(false);
      addEvent("error", "Run failed", error instanceof Error ? error.message : String(error));
    } finally {
      setIsGenerating(false);
    }
  }

  async function dryRun() {
    const run = runRef.current;
    if (!run) {
      return;
    }

    addEvent(
      run.generatedPlan.validation.ok ? "info" : "warning",
      "Dry run reviewed",
      run.generatedPlan.validation.ok
        ? "The ActionPlan passed validation and is ready to be written for After Effects."
        : "The ActionPlan is blocked by validation issues. Refresh context or adjust the prompt.",
    );
  }

  async function pollExecutionResult(engineHost: EngineHost, run: PreparedRun) {
    const result = await readExecutionFeedback({
      host: engineHost,
      run,
    });

    if (result.status === "missing" || result.status === "stale") {
      return;
    }

    if (result.status === "invalid") {
      if (feedbackNoticeRef.current !== result.message) {
        feedbackNoticeRef.current = result.message;
        addEvent("warning", "Execution feedback not readable yet", result.message);
      }
      return;
    }

    feedbackNoticeRef.current = null;
    stopPolling();
    setIsExecuting(false);
    await refreshHistory(engineHost);
    addEvent(
      result.result.status === "ok" ? "success" : "error",
      "After Effects feedback received",
      result.result.result?.summary ?? result.result.message,
    );
  }

  async function executeRun() {
    const engineHost = host;
    const run = runRef.current;

    if (!engineHost || !run) {
      return;
    }

    if (!run.generatedPlan.validation.ok) {
      addEvent("warning", "Execution blocked", "Resolve validation errors before sending the bundle to After Effects.");
      return;
    }

    setIsExecuting(true);
    feedbackNoticeRef.current = null;
    await commitPreparedRun({
      host: engineHost,
      run,
    });
    await syncCommandStore(recordRecentCommand(commandStoreRef.current, run.generatedPlan), engineHost.config);

    await refreshHistory(engineHost);
    addEvent(
      "info",
      "Execution bundle written",
      `Run ${run.generatedPlan.actionPlan.summary}. Motion Buddy is pinging the CEP bridge for auto-apply.`,
    );

    try {
      const cepResult = await triggerCepExecution({
        runId: run.runId,
        importScriptPath: engineHost.config.importScriptPath,
        commandUrl: engineHost.config.cepCommandUrl,
      });

      addEvent(
        cepResult.ok ? "success" : "warning",
        "CEP auto-execution dispatched",
        cepResult.message || `After Effects accepted run ${run.runId} for execution.`,
      );
    } catch (error) {
      addEvent(
        "warning",
        "CEP bridge unavailable",
        [
          error instanceof Error ? error.message : String(error),
          `Manual fallback: run ${engineHost.config.importScriptPath} inside After Effects.`,
        ].join(" "),
      );
    }

    stopPolling();
    pollingRef.current = window.setInterval(() => {
      void pollExecutionResult(engineHost, run);
    }, 2500);
  }

  function cancelRun() {
    stopPolling();
    setIsExecuting(false);
    feedbackNoticeRef.current = null;
    setActiveRun(null);
    runRef.current = null;
    addEvent("warning", "Run cleared", "The current plan was dismissed from the execution panel.");
  }

  async function toggleFavoriteCommand(entityId: string) {
    await syncCommandStore(toggleFavorite(commandStoreRef.current, entityId));
  }

  async function saveCurrentPlanAsRecipe() {
    const run = runRef.current;
    if (!run) {
      return;
    }

    await syncCommandStore(saveGeneratedPlanAsRecipe(commandStoreRef.current, run.generatedPlan));
    addEvent("success", "Recipe saved locally", `Saved "${run.generatedPlan.actionPlan.summary}" to the local recipe library.`);
  }

  function applySuggestion(entityId: string) {
    const savedRecipe = commandStoreRef.current.savedRecipes.find((recipe) => recipe.id === entityId);
    if (savedRecipe) {
      setPrompt(savedRecipe.prompt);
      return;
    }

    const registryItem = getMotionRegistry().find((entry) => entry.id === entityId);
    if (registryItem) {
      setPrompt(registryItem.aliases[0] ?? registryItem.title);
    }
  }

  return {
    runtime,
    context,
    liveState,
    inspectedSession,
    selectedSessionId,
    setSelectedSessionId,
    commandStore,
    paletteResults,
    recentCommands,
    frequentCommands,
    history,
    selectedLog,
    selectedLogPath,
    setSelectedLogPath,
    activeRun,
    prompt,
    setPrompt,
    model,
    setModel,
    events,
    isReady,
    isGenerating,
    isExecuting,
    refreshContext,
    generatePlan,
    runPrompt,
    dryRun,
    executeRun,
    cancelRun,
    toggleFavoriteCommand,
    applySuggestion,
    saveCurrentPlanAsRecipe,
    reloadHistory: async () => {
      if (host) {
        await refreshHistory(host);
      }
    },
    addEvent,
  };
}
