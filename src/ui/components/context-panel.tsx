import { Activity, Aperture, Clapperboard, FolderOpen, Layers3, RefreshCw } from "lucide-react";

import type { AEContext, MotionBuddyRuntimeConfig } from "@/shared/types.js";
import { formatTimestamp } from "@/ui/lib/format.js";
import { Badge } from "./ui/badge.js";
import { Button } from "./ui/button.js";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card.js";
import { ScrollArea } from "./ui/scroll-area.js";
import { Separator } from "./ui/separator.js";
import { SectionHeading } from "./section-heading.js";

function InfoRow(props: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-white/45">{props.label}</span>
      <span className="text-right text-white/80">{props.value}</span>
    </div>
  );
}

export function ContextPanel(props: {
  runtime: MotionBuddyRuntimeConfig | null;
  context: AEContext | null;
  onRefreshContext: () => void | Promise<void>;
  onOpenExportScript: () => void | Promise<void>;
  onRevealWorkspace: () => void | Promise<void>;
}) {
  const context = props.context;
  const activeComp = context?.activeComp;

  return (
    <Card className="h-full min-h-[420px]">
      <CardHeader>
        <SectionHeading
          eyebrow="Workspace"
          title="After Effects Context"
          subtitle="Live snapshot of the active comp, selected layers, and bridge files."
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={props.onRefreshContext}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button variant="ghost" size="sm" onClick={props.onOpenExportScript}>
            <Clapperboard className="h-4 w-4" />
            Export Script
          </Button>
          <Button variant="ghost" size="sm" onClick={props.onRevealWorkspace}>
            <FolderOpen className="h-4 w-4" />
            Exchange
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex h-[calc(100%-112px)] flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="mb-2 flex items-center gap-2 text-white">
              <Activity className="h-4 w-4 text-cyan-300" />
              <span className="text-sm font-medium">Project</span>
            </div>
            <p className="text-sm text-white/80">{context?.projectName ?? "Loading..."}</p>
            <p className="mt-2 text-xs text-white/45">
              Exported {context ? formatTimestamp(context.exportedAt) : "waiting for bridge"}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="mb-2 flex items-center gap-2 text-white">
              <Aperture className="h-4 w-4 text-cyan-300" />
              <span className="text-sm font-medium">Model</span>
            </div>
            <p className="text-sm text-white/80">{props.runtime?.model ?? "Unavailable"}</p>
            <p className="mt-2 text-xs text-white/45">{props.runtime?.openAiEnabled ? "OpenAI enabled via host bridge" : "Rules fallback only"}</p>
          </div>
        </div>

        <Separator />

        <div className="grid gap-2">
          <InfoRow label="Composition" value={activeComp?.name ?? "No active comp"} />
          <InfoRow label="Frame rate" value={activeComp ? `${activeComp.frameRate} fps` : "Unavailable"} />
          <InfoRow label="Playhead" value={activeComp ? `${activeComp.currentTime.toFixed(2)} s` : "Unavailable"} />
          <InfoRow
            label="Resolution"
            value={activeComp ? `${activeComp.width} × ${activeComp.height}` : "Unavailable"}
          />
          <InfoRow label="Camera" value={activeComp?.hasCamera ? activeComp.activeCameraName ?? "Present" : "None"} />
          <InfoRow label="Selected layers" value={`${context?.selectedLayers.length ?? 0}`} />
          <InfoRow
            label="Selected keyframes"
            value={`${context?.selectedLayers.reduce((count, layer) => count + layer.selectedKeyframeCount, 0) ?? 0}`}
          />
        </div>

        <Separator />

        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <CardTitle className="text-xs tracking-[0.22em] text-white/55">Layer Inspector</CardTitle>
          <ScrollArea className="min-h-0 flex-1 rounded-xl border border-white/10 bg-black/20">
            <div className="space-y-3 p-3">
              {context?.selectedLayers.length ? (
                context.selectedLayers.map((layer) => (
                  <div key={`${layer.index}-${layer.name}`} className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-white">{layer.name}</p>
                        <p className="text-xs text-white/45">Layer {layer.index}</p>
                      </div>
                      <div className="flex gap-2">
                        <Badge>{layer.type}</Badge>
                        <Badge variant={layer.threeD ? "accent" : "default"}>{layer.threeD ? "3D" : "2D"}</Badge>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-white/50">
                      Properties: {layer.selectedProperties.join(", ") || "None selected"}
                    </p>
                  </div>
                ))
              ) : (
                <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-dashed border-white/10 text-center">
                  <Layers3 className="mb-3 h-5 w-5 text-white/30" />
                  <p className="text-sm text-white/65">No selected layers in the latest export.</p>
                  <p className="mt-1 max-w-[220px] text-xs text-white/40">
                    Run the AE export bridge to update the selection and comp metadata.
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}
