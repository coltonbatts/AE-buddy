import assert from "node:assert/strict";
import test from "node:test";

import type { GeneratedPlan } from "../../shared/types.js";
import { createEmptyCommandStore, recordRecentCommand, saveGeneratedPlanAsRecipe, toggleFavorite } from "./command-store.js";

test("recordRecentCommand deduplicates by resolved entity id", () => {
  const baseStore = createEmptyCommandStore();
  const plan: GeneratedPlan = {
    prompt: "camera push",
    explanation: "deterministic",
    actionPlan: {
      version: "1.0",
      intent: "Push camera",
      summary: "Ensure a camera and animate a short push-in.",
      riskLevel: "medium",
      assumptions: [],
      warnings: [],
      actions: [],
    },
    validation: {
      ok: true,
      issues: [],
      affectedTargets: [],
    },
    renderedScript: "",
    source: "registry",
    resolution: {
      kind: "recipe",
      id: "camera-push-in",
      title: "Camera Push In",
      matchedQuery: "camera push",
      confidence: 0.92,
    },
  };

  const withRecent = recordRecentCommand(baseStore, plan);
  const deduped = recordRecentCommand(withRecent, plan);

  assert.equal(deduped.recentCommands.length, 1);
  assert.equal(deduped.recentCommands[0]?.entityId, "camera-push-in");
  assert.equal(deduped.recentCommands[0]?.commandId, "camera-push-in");
  assert.equal(deduped.recentCommands[0]?.resolutionType, "recipe");
  assert.equal(deduped.usageStats[0]?.count, 2);
});

test("toggleFavorite and saveGeneratedPlanAsRecipe update local palette state", () => {
  const baseStore = createEmptyCommandStore();
  const favoriteStore = toggleFavorite(baseStore, "camera-push-in");
  assert.deepEqual(favoriteStore.favoriteIds, ["camera-push-in"]);

  const savedStore = saveGeneratedPlanAsRecipe(favoriteStore, {
    prompt: "camera push",
    explanation: "deterministic",
    actionPlan: {
      version: "1.0",
      intent: "Push camera",
      summary: "Ensure a camera and animate a short push-in.",
      riskLevel: "medium",
      assumptions: [],
      warnings: [],
      actions: [],
    },
    validation: {
      ok: true,
      issues: [],
      affectedTargets: [],
    },
    renderedScript: "",
    source: "registry",
    resolution: {
      kind: "recipe",
      id: "camera-push-in",
      title: "Camera Push In",
      matchedQuery: "camera push",
      confidence: 0.92,
    },
  } satisfies GeneratedPlan);

  assert.equal(savedStore.savedRecipes.length, 1);
  assert.equal(savedStore.savedRecipes[0]?.title, "Ensure a camera and animate a short push-in.");
});
