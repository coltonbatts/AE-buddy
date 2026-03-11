import type { LoggedRun, RiskLevel } from "@/shared/types.js";

export function formatTimestamp(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function formatRiskTone(riskLevel: RiskLevel) {
  switch (riskLevel) {
    case "high":
      return "text-rose-200 border-rose-500/40 bg-rose-500/10";
    case "medium":
      return "text-amber-200 border-amber-500/40 bg-amber-500/10";
    case "low":
    default:
      return "text-emerald-200 border-emerald-500/40 bg-emerald-500/10";
  }
}

export function lineCount(value: string) {
  return value.split("\n").length;
}

export function summarizeRun(log: LoggedRun) {
  return `${log.actionPlan.summary} · ${log.actionPlan.actions.length} actions`;
}
