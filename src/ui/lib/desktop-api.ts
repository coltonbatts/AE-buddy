import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";

import type { LoggedRun, MotionBuddyRuntimeConfig } from "../../shared/types.js";

export async function getRuntimeConfig() {
  return invoke<MotionBuddyRuntimeConfig>("get_runtime_config");
}

export async function generateOpenAiPlan(params: {
  model: string;
  systemPrompt: string;
  prompt: string;
  context: unknown;
}) {
  return invoke<unknown>("generate_openai_plan", params);
}

export async function triggerCepExecution(params: {
  runId: string;
  importScriptPath: string;
  commandUrl?: string;
}) {
  return invoke<{
    ok: boolean;
    message: string;
    runId?: string | null;
    endpoint?: string | null;
  }>("trigger_cep_execution", params);
}

export async function openDesktopPath(path: string) {
  await openPath(path);
}

export async function revealDesktopPath(path: string) {
  await revealItemInDir(path);
}

export async function savePromptHistory(logs: LoggedRun[]) {
  const filePath = await save({
    title: "Save Motion Buddy prompt history",
    defaultPath: "motion-buddy-prompt-history.json",
    filters: [{ name: "JSON", extensions: ["json"] }],
  });

  if (!filePath) {
    return null;
  }

  await writeTextFile(filePath, JSON.stringify(logs, null, 2));
  return filePath;
}
