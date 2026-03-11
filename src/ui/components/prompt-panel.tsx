import { Bot, Braces, Sparkles } from "lucide-react";
import { useState } from "react";

import type { PreparedRun } from "@/engine/contracts.js";
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
  activeRun: PreparedRun | null;
}) {
  const [view, setView] = useState<"structured" | "json">("structured");
  const actionPlan = props.activeRun?.generatedPlan.actionPlan;

  return (
    <Card className="h-full min-h-[420px]">
      <CardHeader>
        <SectionHeading
          eyebrow="Prompt"
          title="Plan Composer"
          subtitle="Describe the motion task in natural language, then inspect the deterministic ActionPlan."
        />
      </CardHeader>
      <CardContent className="flex h-[calc(100%-104px)] min-h-0 flex-col gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <Textarea
            value={props.prompt}
            onChange={(event) => props.onPromptChange(event.target.value)}
            placeholder="Example: Create a soft camera push and stagger the selected title layers by 4 frames."
            className="min-h-[170px] resize-none border-0 bg-transparent px-0 py-0 text-base"
          />
          <div className="mt-4 flex items-center justify-between gap-4">
            <p className="text-xs text-white/45">
              Motion Buddy will load the latest AE context, generate a plan, validate it, and render JSX before execution.
            </p>
            <Button onClick={props.onGeneratePlan} disabled={props.isGenerating || !props.prompt.trim()}>
              <Sparkles className="h-4 w-4" />
              {props.isGenerating ? "Generating..." : "Generate Plan"}
            </Button>
          </div>
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
