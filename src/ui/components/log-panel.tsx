import { AlertTriangle, Clock3, ListFilter, Logs } from "lucide-react";

import type { LoggedRun } from "@/shared/types.js";
import type { UiEvent } from "@/ui/lib/use-motion-buddy.js";
import { formatTimestamp, summarizeRun } from "@/ui/lib/format.js";
import { Badge } from "./ui/badge.js";
import { Card, CardContent, CardHeader } from "./ui/card.js";
import { ScrollArea } from "./ui/scroll-area.js";
import { SectionHeading } from "./section-heading.js";

export function LogPanel(props: {
  history: LoggedRun[];
  events: UiEvent[];
  selectedLog: LoggedRun | null;
  selectedLogPath: string | null;
  onSelectLog: (logPath: string) => void;
}) {
  return (
    <Card className="min-h-[360px]">
      <CardHeader>
        <SectionHeading
          eyebrow="Logs"
          title="Execution Feed"
          subtitle="Prompt history, run artifacts, validation state, warnings, and AE execution feedback."
        />
      </CardHeader>
      <CardContent className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="rounded-2xl border border-white/10 bg-black/20">
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3 text-sm text-white/70">
            <ListFilter className="h-4 w-4 text-cyan-300" />
            Prompt History
          </div>
          <ScrollArea className="h-[280px]">
            <div className="space-y-2 p-3">
              {props.history.length ? (
                props.history.map((log) => (
                  <button
                    key={log.logPath}
                    type="button"
                    onClick={() => props.onSelectLog(log.logPath)}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      props.selectedLogPath === log.logPath
                        ? "border-cyan-400/30 bg-cyan-400/10"
                        : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-medium text-white">{log.prompt}</p>
                      <Badge
                        variant={
                          log.actionPlan.riskLevel === "high"
                            ? "danger"
                            : log.actionPlan.riskLevel === "medium"
                              ? "warning"
                              : "success"
                        }
                      >
                        {log.actionPlan.riskLevel}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs text-white/50">{summarizeRun(log)}</p>
                    <p className="mt-2 text-xs text-white/35">{formatTimestamp(log.timestamp)}</p>
                  </button>
                ))
              ) : (
                <div className="flex h-[240px] flex-col items-center justify-center text-center">
                  <Logs className="mb-3 h-5 w-5 text-white/30" />
                  <p className="text-sm text-white/65">No prompt history yet.</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="rounded-2xl border border-white/10 bg-black/20">
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3 text-sm text-white/70">
              <Clock3 className="h-4 w-4 text-cyan-300" />
              Execution Timeline
            </div>
            <ScrollArea className="h-[280px]">
              <div className="space-y-3 p-4">
                {props.events.length ? (
                  props.events.map((event) => (
                    <div key={event.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-white">{event.title}</p>
                        <Badge
                          variant={
                            event.level === "error"
                              ? "danger"
                              : event.level === "warning"
                                ? "warning"
                                : event.level === "success"
                                  ? "success"
                                  : "accent"
                          }
                        >
                          {event.level}
                        </Badge>
                      </div>
                      {event.detail ? <p className="mt-2 text-sm text-white/60">{event.detail}</p> : null}
                      <p className="mt-2 text-xs text-white/35">{formatTimestamp(event.timestamp)}</p>
                    </div>
                  ))
                ) : (
                  <div className="flex h-[240px] flex-col items-center justify-center text-center">
                    <Clock3 className="mb-3 h-5 w-5 text-white/30" />
                    <p className="text-sm text-white/65">Run events appear here immediately.</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="mb-4 flex items-center gap-2 text-sm text-white/70">
              <AlertTriangle className="h-4 w-4 text-cyan-300" />
              Selected Log Summary
            </div>
            {props.selectedLog ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">Prompt</p>
                  <p className="mt-2 text-sm text-white/85">{props.selectedLog.prompt}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">Result</p>
                  <p className="mt-2 text-sm text-white/85">
                    {props.selectedLog.executionResult?.result?.summary ??
                      props.selectedLog.executionResult?.message ??
                      "Execution result not received yet."}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">Validation</p>
                  <ul className="mt-2 space-y-2 text-sm text-white/70">
                    {props.selectedLog.validation.issues.length ? (
                      props.selectedLog.validation.issues.map((issue) => <li key={issue.message}>• {issue.message}</li>)
                    ) : (
                      <li>No validation issues.</li>
                    )}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-sm text-white/55">Pick a history item to inspect its stored execution summary.</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
