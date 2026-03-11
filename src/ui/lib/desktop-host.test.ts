import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import type { MotionBuddyRuntimeConfig } from "../../shared/types.js";
import { emptyContext } from "../../shared/ae-context.js";
import { createDesktopEngineHost } from "./desktop-host.js";

async function createTempWorkspace() {
  return fs.mkdtemp(path.join(os.tmpdir(), "motion-buddy-ui-"));
}

function createRuntimeConfig(rootDir: string, openAiEnabled: boolean): MotionBuddyRuntimeConfig {
  const exchangeDir = path.join(rootDir, ".motion-buddy");
  const contextDir = path.join(exchangeDir, "context");
  const outDir = path.join(exchangeDir, "out");
  const logsDir = path.join(exchangeDir, "logs");
  const stateDir = path.join(exchangeDir, "state");

  return {
    rootDir,
    exchangeDir,
    contextDir,
    outDir,
    logsDir,
    stateDir,
    contextPath: path.join(contextDir, "ae-context.json"),
    generatedPlanPath: path.join(outDir, "generated-plan.json"),
    generatedScriptPath: path.join(outDir, "generated-script.jsx"),
    receiptPath: path.join(outDir, "receipt.json"),
    executionResultPath: path.join(outDir, "execution-result.json"),
    commandStorePath: path.join(stateDir, "command-store.json"),
    exportContextScriptPath: path.join(rootDir, "after-effects", "export-context.jsx"),
    importScriptPath: path.join(rootDir, "after-effects", "import-generated-script.jsx"),
    cepCommandUrl: "http://127.0.0.1:9123/motion-buddy/execute",
    cepHealthUrl: "http://127.0.0.1:9123/motion-buddy/health",
    cepContextExportUrl: "http://127.0.0.1:9123/motion-buddy/context/export",
    model: "gpt-4.1-mini",
    openAiEnabled,
  };
}

test("desktop host uses host-side model generation when OpenAI is enabled", async () => {
  const workspace = await createTempWorkspace();
  const config = createRuntimeConfig(workspace, true);
  let requestCount = 0;

  const host = await createDesktopEngineHost({
    getRuntimeConfig: async () => config,
    join: async (...parts: string[]) => path.join(...parts),
    fs: {
      exists: async (targetPath) => {
        try {
          await fs.access(targetPath);
          return true;
        } catch {
          return false;
        }
      },
      mkdir: async (targetPath, options) => {
        await fs.mkdir(targetPath, { recursive: options?.recursive });
      },
      readDir: async (targetPath) => {
        const entries = await fs.readdir(targetPath, { withFileTypes: true });
        return entries.map((entry: import("node:fs").Dirent) => ({
          name: entry.name,
          isFile: entry.isFile(),
        }));
      },
      readTextFile: async (targetPath) => fs.readFile(targetPath, "utf8"),
      remove: async (targetPath) => {
        await fs.rm(targetPath, { force: true, recursive: true });
      },
      rename: async (oldPath, newPath) => {
        await fs.rename(oldPath, newPath);
      },
      writeTextFile: async (targetPath, contents) => {
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.writeFile(targetPath, contents, "utf8");
      },
    },
    requestOpenAiPlan: async ({ model, prompt, context }) => {
      requestCount += 1;
      assert.equal(model, config.model);
      assert.equal(prompt, "Generate a safe no-op plan.");
      assert.equal((context as { projectName: string }).projectName, emptyContext().projectName);

      return {
        explanation: "Use the exported context.",
        actionPlan: {
          version: "1.0",
          intent: "No-op test plan",
          summary: "Return a safe no-op plan.",
          riskLevel: "low",
          assumptions: [],
          warnings: [],
          actions: [],
        },
      };
    },
  });

  const plan = await host.generatePlan({
    prompt: "Generate a safe no-op plan.",
    context: emptyContext(),
    model: config.model,
  });

  assert.equal(requestCount, 1);
  assert.equal(plan.source, "openai");
  assert.equal(plan.actionPlan.summary, "Return a safe no-op plan.");
  assert.equal(plan.resolution.kind, "generated");
});

test("desktop host reports invalid context snapshots without collapsing them to an empty context", async () => {
  const workspace = await createTempWorkspace();
  const config = createRuntimeConfig(workspace, false);

  await fs.mkdir(path.dirname(config.contextPath), { recursive: true });
  await fs.writeFile(config.contextPath, "{invalid-json", "utf8");

  const host = await createDesktopEngineHost({
    getRuntimeConfig: async () => config,
    join: async (...parts: string[]) => path.join(...parts),
    fs: {
      exists: async (targetPath) => {
        try {
          await fs.access(targetPath);
          return true;
        } catch {
          return false;
        }
      },
      mkdir: async (targetPath, options) => {
        await fs.mkdir(targetPath, { recursive: options?.recursive });
      },
      readDir: async (targetPath) => {
        const entries = await fs.readdir(targetPath, { withFileTypes: true });
        return entries.map((entry: import("node:fs").Dirent) => ({
          name: entry.name,
          isFile: entry.isFile(),
        }));
      },
      readTextFile: async (targetPath) => fs.readFile(targetPath, "utf8"),
      remove: async (targetPath) => {
        await fs.rm(targetPath, { force: true, recursive: true });
      },
      rename: async (oldPath, newPath) => {
        await fs.rename(oldPath, newPath);
      },
      writeTextFile: async (targetPath, contents) => {
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.writeFile(targetPath, contents, "utf8");
      },
    },
  });

  const snapshot = await host.readContextSnapshot();
  assert.equal(snapshot.status, "invalid");
});

test("desktop host reports missing context snapshots for no-CEP fallback", async () => {
  const workspace = await createTempWorkspace();
  const config = createRuntimeConfig(workspace, false);

  const host = await createDesktopEngineHost({
    getRuntimeConfig: async () => config,
    join: async (...parts: string[]) => path.join(...parts),
    fs: {
      exists: async (targetPath) => {
        try {
          await fs.access(targetPath);
          return true;
        } catch {
          return false;
        }
      },
      mkdir: async (targetPath, options) => {
        await fs.mkdir(targetPath, { recursive: options?.recursive });
      },
      readDir: async (targetPath) => {
        const entries = await fs.readdir(targetPath, { withFileTypes: true });
        return entries.map((entry: import("node:fs").Dirent) => ({
          name: entry.name,
          isFile: entry.isFile(),
        }));
      },
      readTextFile: async (targetPath) => fs.readFile(targetPath, "utf8"),
      remove: async (targetPath) => {
        await fs.rm(targetPath, { force: true, recursive: true });
      },
      rename: async (oldPath, newPath) => {
        await fs.rename(oldPath, newPath);
      },
      writeTextFile: async (targetPath, contents) => {
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.writeFile(targetPath, contents, "utf8");
      },
    },
  });

  const snapshot = await host.readContextSnapshot();
  assert.deepEqual(snapshot, { status: "missing" });
});
