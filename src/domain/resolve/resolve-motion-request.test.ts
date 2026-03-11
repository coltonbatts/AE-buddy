import assert from "node:assert/strict";
import test from "node:test";

import { emptyContext } from "../../shared/ae-context.js";
import { resolveMotionRequest } from "./resolve-motion-request.js";

test("resolver prefers deterministic registry commands before planner fallback", async () => {
  const plan = await resolveMotionRequest({
    prompt: "camera push",
    context: emptyContext(),
    requestModelPlan: async () => {
      throw new Error("planner should not run for deterministic registry matches");
    },
  });

  assert.equal(plan.source, "registry");
  assert.equal(plan.resolution.kind, "recipe");
  assert.equal(plan.resolution.title, "Camera Push In");
  assert.equal(plan.actionPlan.actions[1]?.type, "ensure_camera");
});

test("resolver falls back to planner when the registry does not match strongly", async () => {
  const plan = await resolveMotionRequest({
    prompt: "invent a weird but safe thing",
    context: emptyContext(),
    requestModelPlan: async () => ({
      explanation: "Planner fallback",
      source: "openai",
      actionPlan: {
        version: "1.0",
        intent: "No-op",
        summary: "Planner no-op",
        riskLevel: "low",
        assumptions: [],
        warnings: [],
        actions: [],
      },
    }),
  });

  assert.equal(plan.source, "openai");
  assert.equal(plan.resolution.kind, "generated");
});
