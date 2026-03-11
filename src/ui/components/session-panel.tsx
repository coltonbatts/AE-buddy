import { Activity, Clapperboard, FolderOpen, Layers3, RefreshCw, Radio, TimerReset } from "lucide-react";

import type { AELiveState } from "@/shared/types.js";
import { formatTimestamp } from "@/ui/lib/format.js";

function statusClasses(status: AELiveState["status"]) {
  switch (status) {
    case "connected":
      return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
    case "stale":
      return "border-amber-400/30 bg-amber-500/10 text-amber-100";
    case "disconnected":
    default:
      return "border-white/10 bg-white/5 text-white/70";
  }
}

function statusLabel(status: AELiveState["status"]) {
  switch (status) {
    case "connected":
      return "Live sync";
    case "stale":
      return "Snapshot stale";
    case "disconnected":
    default:
      return "Bridge offline";
  }
}

export function SessionPanel(props: {
  liveState: AELiveState;
  selectedSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onRefreshContext: () => void | Promise<void>;
  onOpenExportScript: () => void | Promise<void>;
  onRevealWorkspace: () => void | Promise<void>;
}) {
  const activeSession = props.liveState.sessions.find((session) => session.isActive) ?? props.liveState.sessions[0] ?? null;
  const focusLabel = props.liveState.status === "connected" ? "Active project" : "Last observed project";

  return (
    <aside className="flex min-h-[680px] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-black/35 shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
      <div className="border-b border-white/10 px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-200/55">Live Control Room</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">After Effects Context</h2>
            <p className="mt-2 text-sm leading-6 text-white/55">
              AE scripting exposes one project context at a time. AE Buddy tracks the current project snapshot and a
              short history of recently observed projects.
            </p>
          </div>
          <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${statusClasses(props.liveState.status)}`}>
            <Radio className="h-3.5 w-3.5" />
            {statusLabel(props.liveState.status)}
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => void props.onRefreshContext()}
            className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white/80 transition hover:border-cyan-300/30 hover:bg-white/10"
          >
            <RefreshCw className="h-4 w-4 text-cyan-200" />
            Sync now
          </button>
          <button
            type="button"
            onClick={() => void props.onOpenExportScript()}
            className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white/80 transition hover:border-cyan-300/30 hover:bg-white/10"
          >
            <Clapperboard className="h-4 w-4 text-cyan-200" />
            Export script
          </button>
          <button
            type="button"
            onClick={() => void props.onRevealWorkspace()}
            className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white/80 transition hover:border-cyan-300/30 hover:bg-white/10"
          >
            <FolderOpen className="h-4 w-4 text-cyan-200" />
            Exchange folder
          </button>
        </div>
      </div>

      <div className="grid gap-3 border-b border-white/10 px-5 py-5">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-2 text-sm text-white/70">
            <Activity className="h-4 w-4 text-cyan-200" />
            {focusLabel}
          </div>
          <p className="mt-3 text-lg font-medium text-white">{activeSession?.projectName ?? "No project detected"}</p>
          <p className="mt-1 text-sm text-white/45">{activeSession?.activeCompName ?? "No active comp"}</p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-white/60">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">Layers</p>
              <p className="mt-1 text-base text-white">{activeSession?.selectedLayerCount ?? 0}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">Keyframes</p>
              <p className="mt-1 text-base text-white">{activeSession?.selectedKeyframeCount ?? 0}</p>
            </div>
          </div>
        </div>

        {props.liveState.lastError ? (
          <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4">
            <p className="text-[11px] uppercase tracking-[0.2em] text-amber-100/70">Sync warning</p>
            <p className="mt-2 text-sm leading-6 text-amber-50/85">{props.liveState.lastError}</p>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 text-sm text-white/70">
              <TimerReset className="h-4 w-4 text-cyan-200" />
              Last export
            </div>
            <p className="mt-2 text-sm text-white">
              {props.liveState.lastContextExportAt ? formatTimestamp(props.liveState.lastContextExportAt) : "No snapshot yet"}
            </p>
            <p className="mt-1 text-xs text-white/40">{props.liveState.syncMode === "cep-polling" ? "CEP polling" : "File fallback"}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 text-sm text-white/70">
              <Layers3 className="h-4 w-4 text-cyan-200" />
              Last sync attempt
            </div>
            <p className="mt-2 text-sm text-white">
              {props.liveState.lastSyncAttemptAt ? formatTimestamp(props.liveState.lastSyncAttemptAt) : "Not started"}
            </p>
            <p className="mt-1 truncate text-xs text-white/40">{props.liveState.lastError ?? "Bridge healthy"}</p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 px-3 py-4">
        <div className="mb-3 flex items-center justify-between px-2">
          <h3 className="text-sm font-medium text-white/80">Recent Observed Projects</h3>
          <span className="text-xs uppercase tracking-[0.18em] text-white/35">{props.liveState.sessions.length}</span>
        </div>

        <div className="space-y-2 overflow-y-auto pr-2">
          {props.liveState.sessions.length ? (
            props.liveState.sessions.map((session) => {
              const isSelected = props.selectedSessionId === session.id;
              return (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => props.onSelectSession(session.id)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                    isSelected
                      ? "border-cyan-300/35 bg-cyan-400/10"
                      : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">{session.projectName}</p>
                      <p className="mt-1 truncate text-xs text-white/45">
                        {session.projectPath ?? "Unsaved project in current AE session"}
                      </p>
                    </div>
                    <div className="shrink-0 rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-white/60">
                      {session.isActive ? "Current" : "Observed"}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3 text-xs text-white/50">
                    <span className="truncate">{session.activeCompName ?? "No active comp"}</span>
                    <span>{formatTimestamp(session.lastSeenAt)}</span>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-8 text-center">
              <p className="text-sm text-white/70">No project has been observed yet.</p>
              <p className="mt-2 text-xs text-white/40">
                Open AE, keep the Motion Buddy Bridge panel running, then let AE Buddy poll a fresh context snapshot.
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
