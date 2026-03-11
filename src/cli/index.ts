import { ask, confirm } from "../cli.js";
import { describeValidation, affectedTargetsLabel, formatAction } from "../core/action-plan-validator.js";
import { summarizeContext } from "../shared/ae-context.js";
import { createNodeEngineHost } from "../engine/node-host.js";
import { commitPreparedRun, prepareRun, readExecutionFeedback } from "../engine/workflow.js";

function parseArgs(argv: string[]) {
  const args = new Map<string, string | boolean>();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args.set(key, true);
      continue;
    }

    args.set(key, next);
    index += 1;
  }

  return args;
}

function printSection(title: string, body: string) {
  console.log(`\n=== ${title} ===`);
  console.log(body);
}

function formatAssumptions(assumptions: string[]) {
  return assumptions.length > 0 ? assumptions.join("\n") : "No explicit assumptions.";
}

function formatWarnings(warnings: string[]) {
  return warnings.length > 0 ? warnings.join("\n") : "No plan warnings.";
}

export async function main() {
  const host = createNodeEngineHost();
  const args = parseArgs(process.argv.slice(2));

  const promptArg = args.get("prompt");
  const yes = args.get("yes") === true;
  const dryRun = args.get("dry-run") === true;
  const prompt =
    typeof promptArg === "string" && promptArg.trim().length > 0
      ? promptArg
      : await ask("Motion request: ");

  const run = await prepareRun({
    host,
    prompt,
  });

  printSection("After Effects Context", summarizeContext(run.context));
  printSection("Explanation", run.generatedPlan.explanation);
  printSection(
    "Dry Run",
    [
      `Summary: ${run.generatedPlan.actionPlan.summary}`,
      `Risk level: ${run.generatedPlan.actionPlan.riskLevel}`,
      `Source: ${run.generatedPlan.source}`,
      `Affected targets: ${affectedTargetsLabel(run.generatedPlan.validation)}`,
    ].join("\n"),
  );
  printSection("Assumptions", formatAssumptions(run.generatedPlan.actionPlan.assumptions));
  printSection("Warnings", formatWarnings(run.generatedPlan.actionPlan.warnings));
  printSection(
    "Actions",
    run.generatedPlan.actionPlan.actions.length > 0
      ? run.generatedPlan.actionPlan.actions.map((action, index) => `${index + 1}. ${formatAction(action)}`).join("\n")
      : "No executable actions.",
  );
  printSection("Validation", describeValidation(run.generatedPlan.validation));
  printSection("Action Plan JSON", JSON.stringify(run.generatedPlan.actionPlan, null, 2));
  printSection("Rendered JSX", run.generatedPlan.renderedScript);

  if (!run.generatedPlan.validation.ok) {
    console.log("\nExecution blocked by validation errors. Review the dry-run output and refresh AE context if needed.");
    console.log(`Run log: ${run.logPath}`);
    return;
  }

  if (dryRun) {
    console.log(`\nDry run complete. No files were written for execution.\nRun log: ${run.logPath}`);
    return;
  }

  const approved = yes || (await confirm("Write this execution bundle for After Effects?"));
  if (!approved) {
    console.log(`\nExecution cancelled.\nRun log: ${run.logPath}`);
    return;
  }

  await commitPreparedRun({
    host,
    run,
  });

  printSection(
    "Next Step",
    [
      `1. In After Effects, run ${host.config.importScriptPath}`,
      `2. The action plan lives at ${host.config.generatedPlanPath}`,
      `3. The rendered script lives at ${host.config.generatedScriptPath}`,
      `4. After AE finishes, Motion Buddy will read ${host.config.executionResultPath}`,
      `5. This run is being logged at ${run.logPath}`,
    ].join("\n"),
  );

  if (!yes) {
    await ask("Press Enter after running the AE bridge script...");
  }

  const result = await readExecutionFeedback({
    host,
    run,
  });

  if (!result) {
    console.log("\nNo execution result found yet. The execution bundle is ready.");
    return;
  }

  const detail = result.result
    ? [
        `${result.status.toUpperCase()}: ${result.message}`,
        result.executedAt,
        `Summary: ${result.result.summary}`,
        `Actions: ${result.result.actionsExecuted.join(", ") || "None"}`,
        `Targets: ${result.result.affectedTargets.join(", ") || "None"}`,
      ].join("\n")
    : `${result.status.toUpperCase()}: ${result.message}\n${result.executedAt}`;

  printSection("After Effects Feedback", detail);
}
