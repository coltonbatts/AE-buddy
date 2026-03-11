import { useEffect, useMemo, useRef, useState } from "react";

import { commitPreparedRun, loadRunHistory, prepareRun, readExecutionFeedback } from "@/engine/workflow.js";
import type { EngineHost, PreparedRun } from "@/engine/contracts.js";
import type { AEContext, LoggedRun, MotionBuddyRuntimeConfig } from "@/shared/types.js";
import { createDesktopEngineHost } from "./desktop-host.js";

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

export function useMotionBuddy() {
  const [host, setHost] = useState<EngineHost | null>(null);
  const [runtime, setRuntime] = useState<MotionBuddyRuntimeConfig | null>(null);
  const [context, setContext] = useState<AEContext | null>(null);
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
  const runRef = useRef<PreparedRun | null>(null);
  const feedbackNoticeRef = useRef<string | null>(null);

  function addEvent(level: UiEvent["level"], title: string, detail?: string) {
    setEvents((current) => [createEvent(level, title, detail), ...current].slice(0, 40));
  }

  async function refreshHistory(engineHost: EngineHost) {
    const logs = await loadRunHistory(engineHost);
    setHistory(logs);
    setSelectedLogPath((current) => current ?? logs[0]?.logPath ?? null);
  }

  async function refreshContext(engineHost = host) {
    if (!engineHost) {
      return;
    }

    const nextContext = await engineHost.loadContext();
    setContext(nextContext);
  }

  function stopPolling() {
    if (pollingRef.current !== null) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
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
        await refreshContext(engineHost);
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
      stopPolling();
    };
  }, []);

  const selectedLog = useMemo(
    () => history.find((entry) => entry.logPath === selectedLogPath) ?? history[0] ?? null,
    [history, selectedLogPath],
  );

  async function generatePlan() {
    if (!host) {
      return;
    }

    setIsGenerating(true);
    addEvent("info", "Refreshing AE context", "Using the latest exported context snapshot before planning.");

    try {
      const run = await prepareRun({
        host,
        prompt,
        model,
      });

      runRef.current = run;
      setActiveRun(run);
      setContext(run.context);
      await refreshHistory(host);
      setSelectedLogPath(run.logPath);
      addEvent("success", "ActionPlan generated", `${run.generatedPlan.actionPlan.summary} (${run.generatedPlan.actionPlan.riskLevel} risk).`);
    } catch (error) {
      addEvent("error", "Plan generation failed", error instanceof Error ? error.message : String(error));
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

    await refreshHistory(engineHost);
    addEvent(
      "info",
      "Execution bundle written",
      `Run ${run.generatedPlan.actionPlan.summary}. Open the AE import bridge to execute the generated JSX.`,
    );

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

  return {
    runtime,
    context,
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
    dryRun,
    executeRun,
    cancelRun,
    reloadHistory: async () => {
      if (host) {
        await refreshHistory(host);
      }
    },
    addEvent,
  };
}
