import { Bot, Braces, Command, Sparkles, Star } from "lucide-react";
import { useState } from "react";

import type { RegistrySearchResult } from "@/domain/commands/registry.js";
import type { PreparedRun } from "@/engine/contracts.js";
import type { CommandStore, CommandUsageStat } from "@/shared/types.js";
import { Badge } from "./ui/badge.js";
import { Button } from "./ui/button.js";
import { Card, CardContent, CardHeader } from "./ui/card.js";
import { ScrollArea } from "./ui/scroll-area.js";
import { SectionHeading } from "./section-heading.js";
import { Textarea } from "./ui/textarea.js";

export function PromptPanel(props: {
  prompt: string;
  onPromptChange: (value: string) => void;
  onGeneratePlan: () => void | Promise<void>;
  isGenerating: boolean;
  isExecuting?: boolean;
  activeRun: PreparedRun | null;
  paletteResults: RegistrySearchResult[];
  recentCommands: CommandStore["recentCommands"];
  frequentCommands: CommandUsageStat[];
  onApplySuggestion: (entityId: string) => void;
  onToggleFavorite: (entityId: string) => void | Promise<void>;
  onRunPrompt: () => void | Promise<void>;
}) {
  const [view, setView] = useState<"structured" | "json">("structured");
  const actionPlan = props.activeRun?.generatedPlan.actionPlan;
  const bestMatch = props.paletteResults[0] ?? null;

  return (
    <Card className="h-full min-h-[420px]">
      <CardHeader>
        <SectionHeading
          eyebrow="Palette"
          title="Command Palette"
          subtitle="Type natural language or command shorthand. Deterministic matches are preferred before falling back to generation."
        />
      </CardHeader>
      <CardContent className="flex h-[calc(100%-104px)] min-h-0 flex-col gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <Textarea
            value={props.prompt}
            onChange={(event) => props.onPromptChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (!props.isGenerating && !props.isExecuting) {
                  void props.onRunPrompt();
                }
              }
            }}
            placeholder="Try: camera push, overshoot scale, apply palette, or describe the motion task in plain language."
            className="min-h-[112px] resize-none border-0 bg-transparent px-0 py-0 text-base"
          />
          <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-white/40">
                <Command className="h-3.5 w-3.5" />
                Matches
              </div>
              <div className="space-y-2">
                {props.paletteResults.length ? (
                  props.paletteResults.slice(0, 5).map((result) => (
                    <div
                      key={result.id}
                      className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                    >
                      <button
                        type="button"
                        onClick={() => props.onApplySuggestion(result.id)}
                        className="min-w-0 flex-1 text-left transition hover:text-cyan-100"
                      >
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-white">{result.title}</p>
                          <Badge variant={result.kind === "recipe" || result.kind === "saved-recipe" ? "accent" : "default"}>
                            {result.kind}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-white/50">{result.description}</p>
                        {!result.available && result.unavailableReason ? (
                          <p className="mt-1 text-xs text-amber-300/80">{result.unavailableReason}</p>
                        ) : null}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void props.onToggleFavorite(result.id);
                        }}
                        className="rounded-lg border border-white/10 p-2 text-white/55 transition hover:border-white/20 hover:text-white"
                        aria-label={result.favorite ? "Remove favorite" : "Add favorite"}
                      >
                        <Star className={`h-4 w-4 ${result.favorite ? "fill-current text-amber-300" : ""}`} />
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-white/50">Start typing to search built-in commands, recipes, and saved recipes.</p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-white/40">
                <Sparkles className="h-3.5 w-3.5" />
                Preview
              </div>
              {bestMatch ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-white">{bestMatch.title}</p>
                    <p className="mt-1 text-xs text-white/50">{bestMatch.description}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge>{bestMatch.category}</Badge>
                    <Badge variant={bestMatch.available ? "success" : "warning"}>
                      {bestMatch.available ? "available" : "needs context"}
                    </Badge>
                    <Badge variant="accent">{Math.round(bestMatch.score * 100)}% match</Badge>
                  </div>
                  <p className="text-xs text-white/45">
                    {bestMatch.aliases.length ? `Aliases: ${bestMatch.aliases.slice(0, 3).join(", ")}` : "No aliases"}
                  </p>
                </div>
              ) : props.recentCommands.length ? (
                <div className="space-y-2">
                  <p className="text-sm text-white/70">Recent launches</p>
                  {props.recentCommands.slice(0, 4).map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => props.onApplySuggestion(entry.entityId)}
                      className="block w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left transition hover:border-white/20 hover:bg-white/10"
                    >
                      <p className="text-sm text-white">{entry.title}</p>
                      <p className="mt-1 text-xs text-white/45">{entry.prompt}</p>
                    </button>
                  ))}
                </div>
              ) : props.frequentCommands.length ? (
                <div className="space-y-2">
                  <p className="text-sm text-white/70">Frequently used</p>
                  {props.frequentCommands.slice(0, 4).map((entry) => (
                    <button
                      key={entry.entityId}
                      type="button"
                      onClick={() => props.onApplySuggestion(entry.entityId)}
                      className="block w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left transition hover:border-white/20 hover:bg-white/10"
                    >
                      <p className="text-sm text-white">{entry.title}</p>
                      <p className="mt-1 text-xs text-white/45">{entry.count} runs</p>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-white/50">Recent commands and match previews appear here.</p>
              )}
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-4">
            <p className="text-xs text-white/45">
              The resolver checks the local command registry first, then recipes, then falls back to the existing planner when needed.
            </p>
            <Button onClick={props.onGeneratePlan} disabled={props.isGenerating || props.isExecuting || !props.prompt.trim()}>
              <Sparkles className="h-4 w-4" />
              {props.isGenerating ? "Generating..." : "Generate Plan"}
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-white/35">Press Enter to run. Use Shift+Enter for a newline.</p>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-2">
            <Button variant={view === "structured" ? "secondary" : "ghost"} size="sm" onClick={() => setView("structured")}>
              <Bot className="h-4 w-4" />
              Structured
            </Button>
            <Button variant={view === "json" ? "secondary" : "ghost"} size="sm" onClick={() => setView("json")}>
              <Braces className="h-4 w-4" />
              JSON
            </Button>
          </div>
          {actionPlan ? <Badge variant={actionPlan.riskLevel === "high" ? "danger" : actionPlan.riskLevel === "medium" ? "warning" : "success"}>{actionPlan.riskLevel} risk</Badge> : null}
        </div>

        <ScrollArea className="min-h-0 flex-1 rounded-2xl border border-white/10 bg-black/20">
          <div className="space-y-4 p-4">
            {!props.activeRun ? (
              <div className="flex h-full min-h-[280px] flex-col items-center justify-center text-center">
                <p className="text-base text-white/72">No ActionPlan yet.</p>
                <p className="mt-2 max-w-lg text-sm text-white/45">
                  The center pane stays transparent: summary, assumptions, actions, warnings, and raw JSON all appear here after generation.
                </p>
              </div>
            ) : view === "json" ? (
              <pre className="overflow-x-auto rounded-xl border border-white/10 bg-[#07090f] p-4 font-mono text-xs leading-6 text-cyan-100">
                {JSON.stringify(props.activeRun.generatedPlan.actionPlan, null, 2)}
              </pre>
            ) : (
              <>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-[11px] uppercase tracking-[0.26em] text-white/40">Intent</p>
                  <p className="mt-2 text-sm text-white/85">{actionPlan?.intent}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-[11px] uppercase tracking-[0.26em] text-white/40">Summary</p>
                  <p className="mt-2 text-sm text-white/85">{actionPlan?.summary}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-[11px] uppercase tracking-[0.26em] text-white/40">Resolution</p>
                  <p className="mt-2 text-sm text-white/85">
                    {props.activeRun.generatedPlan.resolution.title} · {props.activeRun.generatedPlan.resolution.kind}
                  </p>
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-[11px] uppercase tracking-[0.26em] text-white/40">Assumptions</p>
                    <ul className="mt-3 space-y-2 text-sm text-white/75">
                      {actionPlan?.assumptions.length ? (
                        actionPlan.assumptions.map((assumption) => <li key={assumption}>• {assumption}</li>)
                      ) : (
                        <li>No explicit assumptions.</li>
                      )}
                    </ul>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-[11px] uppercase tracking-[0.26em] text-white/40">Warnings</p>
                    <ul className="mt-3 space-y-2 text-sm text-white/75">
                      {actionPlan?.warnings.length ? (
                        actionPlan.warnings.map((warning) => <li key={warning}>• {warning}</li>)
                      ) : (
                        <li>No plan warnings.</li>
                      )}
                    </ul>
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-[11px] uppercase tracking-[0.26em] text-white/40">Actions</p>
                  <div className="mt-3 space-y-3">
                    {actionPlan?.actions.length ? (
                      actionPlan.actions.map((action, index) => (
                        <div key={`${action.type}-${index}`} className="rounded-xl border border-white/10 bg-black/25 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-mono text-xs uppercase tracking-[0.18em] text-cyan-100">{action.type}</p>
                            <Badge>{index + 1}</Badge>
                          </div>
                          <pre className="mt-2 overflow-x-auto font-mono text-xs leading-6 text-white/70">
                            {JSON.stringify(action, null, 2)}
                          </pre>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-white/55">No executable actions.</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
