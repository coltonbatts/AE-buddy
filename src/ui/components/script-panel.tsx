import { Clipboard, FileClock, Play, Save, ShieldAlert, SquareSlash, TerminalSquare } from "lucide-react";

import type { PreparedRun } from "@/engine/contracts.js";
import { lineCount } from "@/ui/lib/format.js";
import { Badge } from "./ui/badge.js";
import { Button } from "./ui/button.js";
import { Card, CardContent, CardHeader } from "./ui/card.js";
import { ScrollArea } from "./ui/scroll-area.js";
import { SectionHeading } from "./section-heading.js";

export function ScriptPanel(props: {
  activeRun: PreparedRun | null;
  isExecuting: boolean;
  onDryRun: () => void | Promise<void>;
  onExecute: () => void | Promise<void>;
  onCancel: () => void | Promise<void>;
  onCopyScript: () => void | Promise<void>;
  onOpenLogFile: () => void | Promise<void>;
  onSaveHistory: () => void | Promise<void>;
  onSaveRecipe: () => void | Promise<void>;
  onOpenImportScript: () => void | Promise<void>;
}) {
  const plan = props.activeRun?.generatedPlan;

  return (
    <Card className="h-full min-h-[420px]">
      <CardHeader>
        <SectionHeading
          eyebrow="Execution"
          title="Rendered JSX"
          subtitle="Inspect the exact ExtendScript output, explanation, validation, and bridge actions before AE touches anything."
        />
      </CardHeader>
      <CardContent className="flex h-[calc(100%-104px)] min-h-0 flex-col gap-4">
        <div className="grid gap-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-[11px] uppercase tracking-[0.26em] text-white/40">What will happen</p>
              {plan ? <Badge variant={plan.validation.ok ? "success" : "danger"}>{plan.validation.ok ? "Ready" : "Blocked"}</Badge> : null}
            </div>
            <p className="text-sm text-white/75">{plan?.explanation ?? "Generate a plan to inspect the rendered script and execution guardrails."}</p>
            {plan ? (
              <p className="mt-3 text-xs text-white/45">
                Resolved via {plan.resolution.title} ({plan.resolution.kind})
              </p>
            ) : null}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="outline" onClick={props.onDryRun} disabled={!plan}>
              <ShieldAlert className="h-4 w-4" />
              Dry Run
            </Button>
            <Button onClick={props.onExecute} disabled={!plan || props.isExecuting}>
              <Play className="h-4 w-4" />
              {props.isExecuting ? "Waiting for AE..." : "Execute in After Effects"}
            </Button>
            <Button variant="ghost" onClick={props.onCancel} disabled={!plan && !props.isExecuting}>
              <SquareSlash className="h-4 w-4" />
              Cancel
            </Button>
            <Button variant="ghost" onClick={props.onOpenImportScript}>
              <TerminalSquare className="h-4 w-4" />
              Open Import Bridge
            </Button>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <Button variant="ghost" size="sm" onClick={props.onCopyScript} disabled={!plan}>
              <Clipboard className="h-4 w-4" />
              Copy Script
            </Button>
            <Button variant="ghost" size="sm" onClick={props.onOpenLogFile} disabled={!plan}>
              <FileClock className="h-4 w-4" />
              Open Log File
            </Button>
            <Button variant="ghost" size="sm" onClick={props.onSaveRecipe} disabled={!plan}>
              <Save className="h-4 w-4" />
              Save Recipe
            </Button>
          </div>

          <div className="grid gap-2 sm:grid-cols-1">
            <Button variant="ghost" size="sm" onClick={props.onSaveHistory}>
              <Save className="h-4 w-4" />
              Save Prompt History
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 text-xs text-white/45">
          <span>Rendered output</span>
          <span>{plan ? `${lineCount(plan.renderedScript)} lines of JSX` : "Waiting for generation"}</span>
        </div>

        <ScrollArea className="min-h-0 flex-1 rounded-2xl border border-white/10 bg-[#05070d]">
          <pre className="p-4 font-mono text-xs leading-6 text-cyan-100">
            {plan?.renderedScript ?? "// JSX output appears here after generation."}
          </pre>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
