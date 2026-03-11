import { useMemo } from "react";
import { Gauge, TriangleAlert, WandSparkles } from "lucide-react";

import { ContextPanel } from "./components/context-panel.js";
import { LogPanel } from "./components/log-panel.js";
import { PromptPanel } from "./components/prompt-panel.js";
import { ScriptPanel } from "./components/script-panel.js";
import { Badge } from "./components/ui/badge.js";
import { Button } from "./components/ui/button.js";
import { Input } from "./components/ui/input.js";
import { useMotionBuddy } from "./lib/use-motion-buddy.js";
import { openDesktopPath, revealDesktopPath, savePromptHistory } from "./lib/desktop-api.js";

export function App() {
  const motionBuddy = useMotionBuddy();

  const currentRun = motionBuddy.activeRun;
  const validationIssues = useMemo(
    () => currentRun?.generatedPlan.validation.issues.length ?? 0,
    [currentRun],
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.15),transparent_24%),radial-gradient(circle_at_top_right,rgba(249,115,22,0.12),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_20%)]" />
      <div className="pointer-events-none fixed inset-0 bg-panel-grid bg-[size:72px_72px] opacity-[0.08]" />

      <main className="relative mx-auto flex min-h-screen max-w-[1800px] flex-col gap-6 px-4 py-5 lg:px-6">
        <header className="rounded-3xl border border-white/10 bg-black/30 px-5 py-4 backdrop-blur">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10">
                  <WandSparkles className="h-5 w-5 text-cyan-100" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-cyan-200/70">Motion Buddy Studio</p>
                  <h1 className="text-2xl font-semibold text-white">After Effects planning with full script visibility</h1>
                </div>
              </div>
              <p className="max-w-3xl text-sm text-white/55">
                A desktop shell around the existing Motion Buddy engine. Load AE context, generate a typed ActionPlan, inspect JSX, then execute with explicit user confirmation.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[620px]">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-2 text-white/80">
                  <Gauge className="h-4 w-4 text-cyan-300" />
                  <span className="text-xs uppercase tracking-[0.22em]">Status</span>
                </div>
                <p className="mt-2 text-sm text-white">
                  {motionBuddy.isReady ? "Bridge online" : "Initializing desktop host"}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-2 text-white/80">
                  <TriangleAlert className="h-4 w-4 text-cyan-300" />
                  <span className="text-xs uppercase tracking-[0.22em]">Validation</span>
                </div>
                <p className="mt-2 text-sm text-white">{validationIssues} issues in the current run</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-2 text-white/80">
                  <WandSparkles className="h-4 w-4 text-cyan-300" />
                  <span className="text-xs uppercase tracking-[0.22em]">Source</span>
                </div>
                <p className="mt-2 text-sm text-white">{currentRun?.generatedPlan.source ?? "Not generated yet"}</p>
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-4 rounded-3xl border border-white/10 bg-black/25 p-4 backdrop-blur xl:grid-cols-[minmax(0,1fr)_280px_280px]">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.26em] text-white/45">Session Controls</p>
            <p className="text-sm text-white/55">
              The GUI uses the same planning engine as the CLI. Override the model or API key here for the current session if needed.
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-[11px] uppercase tracking-[0.22em] text-white/45">Model</label>
            <Input value={motionBuddy.model} onChange={(event) => motionBuddy.setModel(event.target.value)} placeholder="gpt-4.1-mini" />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] uppercase tracking-[0.22em] text-white/45">OpenAI API Key</label>
            <Input
              type="password"
              value={motionBuddy.apiKey}
              onChange={(event) => motionBuddy.setApiKey(event.target.value)}
              placeholder="Optional override"
            />
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_420px]">
          <ContextPanel
            runtime={motionBuddy.runtime}
            context={motionBuddy.context}
            onRefreshContext={() => motionBuddy.refreshContext()}
            onOpenExportScript={() => (motionBuddy.runtime ? openDesktopPath(motionBuddy.runtime.exportContextScriptPath) : Promise.resolve())}
            onRevealWorkspace={() => (motionBuddy.runtime ? revealDesktopPath(motionBuddy.runtime.exchangeDir) : Promise.resolve())}
          />
          <PromptPanel
            prompt={motionBuddy.prompt}
            onPromptChange={motionBuddy.setPrompt}
            onGeneratePlan={motionBuddy.generatePlan}
            isGenerating={motionBuddy.isGenerating}
            activeRun={motionBuddy.activeRun}
          />
          <ScriptPanel
            activeRun={motionBuddy.activeRun}
            isExecuting={motionBuddy.isExecuting}
            onDryRun={motionBuddy.dryRun}
            onExecute={motionBuddy.executeRun}
            onCancel={motionBuddy.cancelRun}
            onCopyScript={async () => {
              if (!motionBuddy.activeRun) {
                return;
              }
              await navigator.clipboard.writeText(motionBuddy.activeRun.generatedPlan.renderedScript);
              motionBuddy.addEvent("success", "JSX copied", "The rendered script is now on the clipboard.");
            }}
            onOpenLogFile={async () => {
              if (!motionBuddy.activeRun) {
                return;
              }
              await openDesktopPath(motionBuddy.activeRun.logPath);
            }}
            onSaveHistory={async () => {
              const path = await savePromptHistory(motionBuddy.history);
              if (path) {
                motionBuddy.addEvent("success", "Prompt history saved", path);
              }
            }}
            onOpenImportScript={() => (motionBuddy.runtime ? openDesktopPath(motionBuddy.runtime.importScriptPath) : Promise.resolve())}
          />
        </section>

        <LogPanel
          history={motionBuddy.history}
          events={motionBuddy.events}
          selectedLog={motionBuddy.selectedLog}
          selectedLogPath={motionBuddy.selectedLogPath}
          onSelectLog={motionBuddy.setSelectedLogPath}
        />

        <footer className="flex flex-wrap items-center justify-between gap-3 text-xs text-white/40">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{motionBuddy.runtime?.rootDir ?? "workspace unavailable"}</Badge>
            {currentRun ? <Badge variant="accent">{currentRun.generatedPlan.actionPlan.actions.length} planned actions</Badge> : null}
          </div>
          <Button variant="ghost" size="sm" onClick={motionBuddy.reloadHistory}>
            Reload Logs
          </Button>
        </footer>
      </main>
    </div>
  );
}
