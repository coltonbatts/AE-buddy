import OpenAI from "openai";

import type { AEContext, PlannedResponse } from "../types.js";
import { parseModelResponse } from "./action-plan-validator.js";
import { systemPrompt } from "./system-prompt.js";

function extractJsonObject(raw: string) {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model response did not contain a JSON object.");
  }

  return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
}

export async function generateWithOpenAi(params: {
  apiKey: string;
  model: string;
  prompt: string;
  context: AEContext;
}): Promise<PlannedResponse> {
  const client = new OpenAI({ apiKey: params.apiKey });
  const response = await client.chat.completions.create({
    model: params.model,
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          "User request:",
          params.prompt,
          "",
          "After Effects context JSON:",
          JSON.stringify(params.context, null, 2),
        ].join("\n"),
      },
    ],
  });

  const raw = response.choices[0]?.message?.content;

  if (!raw) {
    throw new Error("OpenAI returned an empty response.");
  }

  const parsed = parseModelResponse(extractJsonObject(raw));
  if (parsed.errors.length > 0 || !parsed.value) {
    throw new Error(`Model response failed validation: ${parsed.errors.join(" | ")}`);
  }

  return parsed.value;
}
