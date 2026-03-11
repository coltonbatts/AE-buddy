import { Activity, Aperture, Clock3, Layers3, RefreshCw, Sparkles, WandSparkles } from "lucide-react";

import { useMotionBuddy } from "./lib/use-motion-buddy.js";
import { revealDesktopPath } from "./lib/desktop-api.js";
import { formatTimestamp } from "./lib/format.js";
import { SessionPanel } from "./components/session-panel.js";

function statusCopy(status: ReturnType<typeof useMotionBuddy>["liveState"]["status"]) {
  switch (status) {
    case "connected":
      return "After Effects is actively syncing through the CEP bridge.";
    case "stale":
      return "AE Buddy is showing the last readable snapshot. The bridge or snapshot export path needs a fresh update.";
    case "disconnected":
    default:
      return "AE Buddy cannot confirm the current AE context. It will keep polling and preserve the last readable snapshot.";
  }
}

function statusLabel(status: ReturnType<typeof useMotionBuddy>["liveState"]["status"]) {
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

export function App() {
  const motionBuddy = useMotionBuddy();
  const activeContext = motionBuddy.context;
  const inspectedSession = motionBuddy.inspectedSession;
  const inspectedContext = inspectedSession?.lastContext ?? activeContext;
  const isConnected = motionBuddy.liveState.status === "connected";
  const projectLabel = isConnected ? "Active project" : "Last observed project";
  const selectedKeyframes =
    inspectedContext?.selectedLayers.reduce((count, layer) => count + layer.selectedKeyframeCount, 0) ?? 0;

  return (
    <div className="min-h-screen bg-[#07111A] font-sans text-white antialiased">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_36%),radial-gradient(circle_at_78%_12%,rgba(249,115,22,0.15),transparent_22%),linear-gradient(135deg,rgba(3,7,18,0.98),rgba(5,15,23,0.96))]" />
        <div className="absolute left-[-12%] top-[18%] h-[420px] w-[420px] rounded-full bg-cyan-400/10 blur-[120px]" />
        <div className="absolute bottom-[-12%] right-[-8%] h-[520px] w-[520px] rounded-full bg-orange-400/10 blur-[160px]" />
      </div>

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1480px] flex-col gap-6 px-5 py-6 lg:px-8">
        <header className="flex flex-col gap-4 rounded-[28px] border border-white/10 bg-black/25 px-6 py-5 backdrop-blur-2xl lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-200/55">AE Buddy</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight text-white lg:text-4xl">Live After Effects Companion</h1>
              <div
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${
                  isConnected
                    ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                    : motionBuddy.liveState.status === "stale"
                      ? "border-amber-400/30 bg-amber-500/10 text-amber-100"
                      : "border-white/10 bg-white/5 text-white/70"
                }`}
              >
                <Activity className="h-3.5 w-3.5" />
                {statusLabel(motionBuddy.liveState.status)}
              </div>
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/60">{statusCopy(motionBuddy.liveState.status)}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[360px]">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/35">{projectLabel}</p>
              <p className="mt-2 truncate text-sm text-white">{activeContext?.projectName ?? "Waiting for AE"}</p>
              <p className="mt-1 truncate text-xs text-white/40">{activeContext?.projectPath ?? "Unsaved or unavailable"}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/35">Last Context Export</p>
              <p className="mt-2 text-sm text-white">
                {motionBuddy.liveState.lastContextExportAt ? formatTimestamp(motionBuddy.liveState.lastContextExportAt) : "No snapshot yet"}
              </p>
              <p className="mt-1 text-xs text-white/40">{motionBuddy.liveState.syncMode === "cep-polling" ? "CEP polling" : "File fallback"}</p>
            </div>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <SessionPanel
            liveState={motionBuddy.liveState}
            selectedSessionId={motionBuddy.selectedSessionId}
            onSelectSession={motionBuddy.setSelectedSessionId}
            onRefreshContext={motionBuddy.refreshContext}
            onOpenExportScript={async () => {
              if (!motionBuddy.runtime) {
                return;
              }

              try {
                await revealDesktopPath(motionBuddy.runtime.exportContextScriptPath);
              } catch (error) {
                motionBuddy.addEvent("error", "Failed to reveal export script", error instanceof Error ? error.message : String(error));
              }
            }}
            onRevealWorkspace={async () => {
              if (!motionBuddy.runtime) {
                return;
              }

              try {
                await revealDesktopPath(motionBuddy.runtime.exchangeDir);
              } catch (error) {
                motionBuddy.addEvent("error", "Failed to reveal exchange folder", error instanceof Error ? error.message : String(error));
              }
            }}
          />

          <section className="grid min-h-0 gap-6">
            <div className="rounded-[32px] border border-white/10 bg-black/30 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur-2xl">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-200/55">Command Deck</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Prompt the current AE context</h2>
                </div>
                <button
                  type="button"
                  onClick={() => void motionBuddy.refreshContext()}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/75 transition hover:border-cyan-300/30 hover:bg-white/10"
                >
                  <RefreshCw className="h-4 w-4" />
                  Sync context
                </button>
              </div>

              <div className="group relative transition-all duration-300 ease-out focus-within:scale-[1.01]">
                <div className="absolute -inset-1 rounded-[32px] bg-[linear-gradient(90deg,rgba(34,211,238,0.24),rgba(249,115,22,0.2),rgba(34,211,238,0.18))] opacity-0 blur-xl transition duration-500 group-focus-within:opacity-100" />

                <div className="relative flex min-h-[96px] w-full items-center overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] shadow-2xl backdrop-blur-2xl transition-colors group-focus-within:border-white/20 group-focus-within:bg-black/50">
                  <div className="flex h-full pl-6 pr-4">
                    <WandSparkles className="h-7 w-7 text-cyan-300/85" />
                  </div>

                  <input
                    autoFocus
                    value={motionBuddy.prompt}
                    onChange={(event) => motionBuddy.setPrompt(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        if (!motionBuddy.isGenerating && !motionBuddy.isExecuting) {
                          motionBuddy.runPrompt();
                        }
                      }
                    }}
                    placeholder={isConnected ? "What do you want to animate?" : "AE Buddy will enable commands when a live context is available"}
                    className="h-[96px] w-full bg-transparent pr-4 text-xl text-white placeholder-white/20 outline-none"
                    disabled={!activeContext?.activeComp}
                  />

                  <div className="px-5">
                    <button
                      type="button"
                      onClick={motionBuddy.runPrompt}
                      disabled={
                        !activeContext?.activeComp ||
                        !motionBuddy.prompt.trim() ||
                        motionBuddy.isGenerating ||
                        motionBuddy.isExecuting
                      }
                      className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white transition hover:bg-white/20 active:scale-95 disabled:opacity-30 disabled:hover:bg-white/10"
                    >
                      {motionBuddy.isGenerating || motionBuddy.isExecuting ? (
                        <RefreshCw className="h-5 w-5 animate-spin" />
                      ) : (
                        <Sparkles className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-white/45">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                  {activeContext?.activeComp ? `Current comp: ${activeContext.activeComp.name}` : "No active comp in AE"}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                  {motionBuddy.liveState.lastSuccessfulSyncAt
                    ? `Last live sync ${formatTimestamp(motionBuddy.liveState.lastSuccessfulSyncAt)}`
                    : "Waiting for first successful live sync"}
                </span>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="rounded-[28px] border border-white/10 bg-black/25 p-5 backdrop-blur-2xl">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-200/55">Project Snapshot</p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">
                      {inspectedSession?.projectName ?? activeContext?.projectName ?? "No context detected"}
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm text-white/50">
                      {inspectedSession && inspectedSession.id !== motionBuddy.liveState.activeSessionId && motionBuddy.liveState.activeSessionId
                        ? "Inspecting a previously observed project. Commands still execute against the current live AE context."
                        : isConnected
                          ? "The inspector reflects the current project, comp, and selection data from After Effects."
                          : "The inspector reflects the last readable project snapshot AE Buddy captured from After Effects."}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-right">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-white/35">Snapshot time</p>
                    <p className="mt-2 text-sm text-white">
                      {inspectedContext ? formatTimestamp(inspectedContext.exportedAt) : "Unavailable"}
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center gap-2 text-sm text-white/65">
                      <Aperture className="h-4 w-4 text-cyan-200" />
                      Active comp
                    </div>
                    <p className="mt-3 text-lg text-white">{inspectedContext?.activeComp?.name ?? "No comp"}</p>
                    <p className="mt-1 text-xs text-white/40">
                      {inspectedContext?.activeComp
                        ? `${inspectedContext.activeComp.width} × ${inspectedContext.activeComp.height} · ${inspectedContext.activeComp.frameRate} fps`
                        : "Select a composition in After Effects"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center gap-2 text-sm text-white/65">
                      <Clock3 className="h-4 w-4 text-cyan-200" />
                      Playhead
                    </div>
                    <p className="mt-3 text-lg text-white">
                      {inspectedContext?.activeComp ? `${inspectedContext.activeComp.currentTime.toFixed(2)} s` : "Unavailable"}
                    </p>
                    <p className="mt-1 text-xs text-white/40">
                      {inspectedContext?.activeComp
                        ? `Work area ${inspectedContext.activeComp.workAreaStart.toFixed(2)}s to ${(
                            inspectedContext.activeComp.workAreaStart + inspectedContext.activeComp.workAreaDuration
                          ).toFixed(2)}s`
                        : "No active timeline"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center gap-2 text-sm text-white/65">
                      <Layers3 className="h-4 w-4 text-cyan-200" />
                      Selected layers
                    </div>
                    <p className="mt-3 text-lg text-white">{inspectedContext?.selectedLayers.length ?? 0}</p>
                    <p className="mt-1 text-xs text-white/40">Current multi-select in the active comp</p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center gap-2 text-sm text-white/65">
                      <Activity className="h-4 w-4 text-cyan-200" />
                      Selected keyframes
                    </div>
                    <p className="mt-3 text-lg text-white">{selectedKeyframes}</p>
                    <p className="mt-1 text-xs text-white/40">Summed across the current layer selection</p>
                  </div>
                </div>

                <div className="mt-6 rounded-[24px] border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-medium text-white/75">Layer inspector</h3>
                    <span className="text-xs uppercase tracking-[0.18em] text-white/35">
                      {inspectedContext?.selectedLayers.length ?? 0} selected
                    </span>
                  </div>

                  <div className="mt-4 space-y-3">
                    {inspectedContext?.selectedLayers.length ? (
                      inspectedContext.selectedLayers.map((layer) => (
                        <div key={`${layer.index}-${layer.name}`} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-white">{layer.name}</p>
                              <p className="mt-1 text-xs text-white/45">
                                Layer {layer.index} · {layer.type} · {layer.threeD ? "3D" : "2D"}
                              </p>
                            </div>
                            <div className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/55">
                              {layer.selectedKeyframeCount} keys
                            </div>
                          </div>
                          <p className="mt-3 text-xs text-white/45">
                            Selected properties: {layer.selectedProperties.join(", ") || "None"}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-10 text-center">
                        <p className="text-sm text-white/70">No selected layers in this snapshot.</p>
                        <p className="mt-2 text-xs text-white/40">
                          Change the selection in After Effects and let the live bridge export a fresh context snapshot.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-6">
                <div className="rounded-[28px] border border-white/10 bg-black/25 p-5 backdrop-blur-2xl">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-200/55">Project Notes</p>
                  <div className="mt-4 space-y-3">
                    {(inspectedContext?.notes.length ? inspectedContext.notes : ["No warnings in the latest snapshot."]).map((note) => (
                      <div key={note} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/65">
                        {note}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[28px] border border-white/10 bg-black/25 p-5 backdrop-blur-2xl">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-200/55">Event Feed</p>
                  <div className="mt-4 space-y-3">
                    {motionBuddy.events.length ? (
                      motionBuddy.events.slice(0, 5).map((event) => (
                        <div key={event.id} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium text-white">{event.title}</p>
                            <span className="text-[11px] uppercase tracking-[0.18em] text-white/35">
                              {formatTimestamp(event.timestamp)}
                            </span>
                          </div>
                          {event.detail ? <p className="mt-2 text-xs leading-5 text-white/50">{event.detail}</p> : null}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-10 text-center text-sm text-white/55">
                        No activity yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
