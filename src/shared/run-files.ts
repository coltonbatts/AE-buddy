import { parseAeContext } from "./ae-context.js";
import type {
  AEContext,
  ExecutionReceipt,
  ExecutionResult,
  GeneratedPlan,
  PlanValidationResult,
  RunLogEntry,
  ScriptExecutionResult,
  SourceType,
} from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSourceType(value: unknown): value is SourceType {
  return value === "openai" || value === "rules";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isScriptExecutionResult(value: unknown): value is ScriptExecutionResult {
  return (
    isRecord(value) &&
    (value.status === "ok" || value.status === "error") &&
    typeof value.summary === "string" &&
    typeof value.message === "string" &&
    isStringArray(value.warnings) &&
    isStringArray(value.actionsExecuted) &&
    isStringArray(value.affectedTargets)
  );
}

function isPlanValidationResult(value: unknown): value is PlanValidationResult {
  return (
    isRecord(value) &&
    typeof value.ok === "boolean" &&
    Array.isArray(value.issues) &&
    isStringArray(value.affectedTargets)
  );
}

function baseRunFileChecks(value: Record<string, unknown>) {
  const errors: string[] = [];

  if (typeof value.runId !== "string" || !value.runId.trim()) {
    errors.push("runId must be a non-empty string.");
  }

  if (typeof value.prompt !== "string") {
    errors.push("prompt must be a string.");
  }

  if (typeof value.explanation !== "string") {
    errors.push("explanation must be a string.");
  }

  if (!isSourceType(value.source)) {
    errors.push('source must be "openai" or "rules".');
  }

  if (!isPlanValidationResult(value.validation)) {
    errors.push("validation must be present.");
  }

  if (!isRecord(value.actionPlan)) {
    errors.push("actionPlan must be an object.");
  }

  return errors;
}

export function createRunId(timestamp = new Date()): string {
  const timePart = timestamp.toISOString().replace(/[:.]/g, "-");
  const uuidPart =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : Math.random().toString(16).slice(2, 10);

  return `${timePart}-${uuidPart}`;
}

export function createRunLogEntry(params: {
  runId: string;
  timestamp?: string;
  prompt: string;
  generatedPlan: GeneratedPlan;
  context: AEContext;
}): RunLogEntry {
  return {
    runId: params.runId,
    timestamp: params.timestamp ?? new Date().toISOString(),
    prompt: params.prompt,
    exportedContext: params.context,
    explanation: params.generatedPlan.explanation,
    source: params.generatedPlan.source,
    actionPlan: params.generatedPlan.actionPlan,
    validation: params.generatedPlan.validation,
    renderedScript: params.generatedPlan.renderedScript,
    executionResult: null,
  };
}

export function createExecutionReceipt(params: {
  runId: string;
  createdAt?: string;
  generatedPlan: GeneratedPlan;
  context: AEContext;
}): ExecutionReceipt {
  return {
    runId: params.runId,
    prompt: params.generatedPlan.prompt,
    explanation: params.generatedPlan.explanation,
    source: params.generatedPlan.source,
    createdAt: params.createdAt ?? new Date().toISOString(),
    context: params.context,
    actionPlan: params.generatedPlan.actionPlan,
    validation: params.generatedPlan.validation,
  };
}

export function parseExecutionReceipt(raw: unknown): { value?: ExecutionReceipt; errors: string[] } {
  if (!isRecord(raw)) {
    return { errors: ["Execution receipt must be an object."] };
  }

  const errors = baseRunFileChecks(raw);
  if (typeof raw.createdAt !== "string") {
    errors.push("createdAt must be a string.");
  }

  if (errors.length > 0) {
    return { errors };
  }

  return {
    value: {
      runId: raw.runId as string,
      prompt: raw.prompt as string,
      explanation: raw.explanation as string,
      source: raw.source as SourceType,
      createdAt: raw.createdAt as string,
      context: parseAeContext(raw.context),
      actionPlan: raw.actionPlan as ExecutionReceipt["actionPlan"],
      validation: raw.validation as PlanValidationResult,
    },
    errors: [],
  };
}

export function parseExecutionResult(raw: unknown): { value?: ExecutionResult; errors: string[] } {
  if (!isRecord(raw)) {
    return { errors: ["Execution result must be an object."] };
  }

  const errors: string[] = [];

  if (typeof raw.runId !== "string" || !raw.runId.trim()) {
    errors.push("runId must be a non-empty string.");
  }

  if (raw.status !== "ok" && raw.status !== "error") {
    errors.push('status must be "ok" or "error".');
  }

  if (typeof raw.message !== "string") {
    errors.push("message must be a string.");
  }

  if (typeof raw.executedAt !== "string") {
    errors.push("executedAt must be a string.");
  }

  if (raw.result !== undefined && raw.result !== null && !isScriptExecutionResult(raw.result)) {
    errors.push("result must be null or a structured execution result.");
  }

  if (errors.length > 0) {
    return { errors };
  }

  return {
    value: {
      runId: raw.runId as string,
      status: raw.status as ExecutionResult["status"],
      message: raw.message as string,
      executedAt: raw.executedAt as string,
      result: (raw.result as ScriptExecutionResult | null | undefined) ?? null,
    },
    errors: [],
  };
}

export function parseRunLogEntry(raw: unknown): { value?: RunLogEntry; errors: string[] } {
  if (!isRecord(raw)) {
    return { errors: ["Run log entry must be an object."] };
  }

  const errors = baseRunFileChecks(raw);

  if (typeof raw.timestamp !== "string") {
    errors.push("timestamp must be a string.");
  }

  if (typeof raw.renderedScript !== "string") {
    errors.push("renderedScript must be a string.");
  }

  if (raw.executionResult !== null && raw.executionResult !== undefined) {
    const parsedExecutionResult = parseExecutionResult(raw.executionResult);
    errors.push(...parsedExecutionResult.errors.map((error) => `executionResult ${error}`));
  }

  if (errors.length > 0) {
    return { errors };
  }

  return {
    value: {
      runId: raw.runId as string,
      timestamp: raw.timestamp as string,
      prompt: raw.prompt as string,
      exportedContext: parseAeContext(raw.exportedContext),
      explanation: raw.explanation as string,
      source: raw.source as SourceType,
      actionPlan: raw.actionPlan as RunLogEntry["actionPlan"],
      validation: raw.validation as PlanValidationResult,
      renderedScript: raw.renderedScript as string,
      executionResult:
        raw.executionResult === null || raw.executionResult === undefined
          ? null
          : (parseExecutionResult(raw.executionResult).value ?? null),
    },
    errors: [],
  };
}
