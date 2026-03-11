import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { getConfig } from "./config.js";
import { createNodeEngineHost } from "./node-host.js";
import { loadRunHistory, prepareRun, readExecutionFeedback } from "./workflow.js";
import { emptyContext } from "../shared/ae-context.js";

async function createTempWorkspace() {
  return fs.mkdtemp(path.join(os.tmpdir(), "motion-buddy-"));
}

test("runId is carried from run creation through receipt, execution result, and log finalization", async () => {
  const workspace = await createTempWorkspace();
  const host = createNodeEngineHost(getConfig(workspace), "");
  const run = await prepareRun({
    host,
    prompt: "Create a camera if one does not exist.",
  });

  await host.writeExecutionBundle({
    runId: run.runId,
    generatedPlan: run.generatedPlan,
    context: run.context,
  });

  const receipt = JSON.parse(await fs.readFile(host.config.receiptPath, "utf8")) as { runId: string };
  assert.equal(receipt.runId, run.runId);

  await fs.writeFile(
    host.config.executionResultPath,
    JSON.stringify(
      {
        runId: run.runId,
        status: "ok",
        message: "Executed.",
        executedAt: new Date().toISOString(),
        result: {
          status: "ok",
          summary: "Executed.",
          message: "Executed.",
          warnings: [],
          actionsExecuted: ["ensure_camera"],
          affectedTargets: ["comp:Main"],
        },
      },
      null,
      2,
    ),
    "utf8",
  );

  const feedback = await readExecutionFeedback({ host, run });
  assert.equal(feedback.status, "ready");
  if (feedback.status !== "ready") {
    return;
  }

  assert.equal(feedback.result.runId, run.runId);

  const storedLog = JSON.parse(await fs.readFile(run.logPath, "utf8")) as {
    runId: string;
    executionResult: { runId: string } | null;
  };
  assert.equal(storedLog.runId, run.runId);
  assert.equal(storedLog.executionResult?.runId, run.runId);
});

test("stale execution-result files are ignored for the active run", async () => {
  const workspace = await createTempWorkspace();
  const host = createNodeEngineHost(getConfig(workspace), "");
  const run = await prepareRun({
    host,
    prompt: "Create a camera if one does not exist.",
  });

  await fs.writeFile(
    host.config.executionResultPath,
    JSON.stringify(
      {
        runId: "older-run",
        status: "ok",
        message: "Old result.",
        executedAt: new Date().toISOString(),
        result: null,
      },
      null,
      2,
    ),
    "utf8",
  );

  const feedback = await readExecutionFeedback({ host, run });
  assert.deepEqual(feedback, {
    status: "stale",
    runId: "older-run",
  });

  const storedLog = JSON.parse(await fs.readFile(run.logPath, "utf8")) as { executionResult: unknown };
  assert.equal(storedLog.executionResult, null);
});

test("malformed JSON bridge files do not crash history or feedback loading", async () => {
  const workspace = await createTempWorkspace();
  const config = getConfig(workspace);
  const host = createNodeEngineHost(config, "");

  await host.ensureWorkspace();
  await fs.writeFile(config.contextPath, "{broken", "utf8");
  const context = await host.loadContext();
  assert.equal(context.projectName, emptyContext().projectName);

  const run = await prepareRun({
    host,
    prompt: "Create a camera if one does not exist.",
  });

  await fs.writeFile(path.join(config.logsDir, "broken.json"), "{broken", "utf8");
  const history = await loadRunHistory(host);
  assert.equal(history.length, 1);
  assert.equal(history[0]?.runId, run.runId);

  await fs.writeFile(config.executionResultPath, "{broken", "utf8");
  const feedback = await readExecutionFeedback({ host, run });
  assert.equal(feedback.status, "invalid");
  if (feedback.status === "invalid") {
    assert.match(feedback.message, /JSON|Unexpected|expected/i);
  }
});

test("prepareRun uses the provided verified context instead of re-reading the bridge file", async () => {
  const workspace = await createTempWorkspace();
  const config = getConfig(workspace);
  const host = createNodeEngineHost(config, "");
  const verifiedContext = {
    ...emptyContext(),
    exportedAt: "2026-03-11T18:00:00.000Z",
    projectName: "Verified Project.aep",
    projectPath: "/tmp/Verified Project.aep",
  };

  await host.ensureWorkspace();
  await fs.writeFile(config.contextPath, "{broken", "utf8");

  const run = await prepareRun({
    host,
    prompt: "Create a camera if one does not exist.",
    context: verifiedContext,
  });

  assert.equal(run.context.projectName, "Verified Project.aep");
  assert.equal(run.context.projectPath, "/tmp/Verified Project.aep");
});
