import type { ActionPlan, CommandStore, GeneratedPlan, SavedRecipeRecord } from "../../shared/types.js";

export interface StoreFs {
  exists(path: string): Promise<boolean>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  readTextFile(path: string): Promise<string>;
  rename(oldPath: string, newPath: string): Promise<void>;
  writeTextFile(path: string, contents: string): Promise<void>;
}

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix: string) {
  const suffix =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : Math.random().toString(16).slice(2, 10);

  return `${prefix}-${suffix}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseSavedRecipe(value: unknown): SavedRecipeRecord | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.id !== "string" ||
    typeof value.title !== "string" ||
    typeof value.description !== "string" ||
    typeof value.prompt !== "string" ||
    !Array.isArray(value.keywords) ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string" ||
    (value.source !== "registry" && value.source !== "openai" && value.source !== "rules") ||
    !isRecord(value.actionPlan)
  ) {
    return null;
  }

  return {
    id: value.id,
    title: value.title,
    description: value.description,
    prompt: value.prompt,
    keywords: value.keywords.filter((item): item is string => typeof item === "string"),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    source: value.source,
    actionPlan: value.actionPlan as unknown as ActionPlan,
  };
}

export function createEmptyCommandStore(): CommandStore {
  return {
    version: "1.0",
    updatedAt: nowIso(),
    favoriteIds: [],
    recentCommands: [],
    usageStats: [],
    savedRecipes: [],
  };
}

export function parseCommandStore(raw: unknown): CommandStore {
  if (!isRecord(raw) || raw.version !== "1.0") {
    return createEmptyCommandStore();
  }

  return {
    version: "1.0",
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : nowIso(),
    favoriteIds: Array.isArray(raw.favoriteIds) ? raw.favoriteIds.filter((item): item is string => typeof item === "string") : [],
    recentCommands: Array.isArray(raw.recentCommands)
      ? raw.recentCommands
          .filter(isRecord)
          .filter(
            (entry) =>
              typeof entry.id === "string" &&
              typeof entry.entityId === "string" &&
              typeof entry.title === "string" &&
              typeof entry.kind === "string" &&
              typeof entry.prompt === "string" &&
              typeof entry.source === "string" &&
              typeof entry.recordedAt === "string",
          )
          .map((entry) => ({
            id: entry.id as string,
            entityId: entry.entityId as string,
            commandId: typeof entry.commandId === "string" ? entry.commandId : (entry.entityId as string),
            title: entry.title as string,
            kind: entry.kind as CommandStore["recentCommands"][number]["kind"],
            resolutionType:
              typeof entry.resolutionType === "string"
                ? (entry.resolutionType as CommandStore["recentCommands"][number]["resolutionType"])
                : (entry.kind as CommandStore["recentCommands"][number]["resolutionType"]),
            prompt: entry.prompt as string,
            source: entry.source as CommandStore["recentCommands"][number]["source"],
            recordedAt: entry.recordedAt as string,
          }))
      : [],
    usageStats: Array.isArray(raw.usageStats)
      ? raw.usageStats
          .filter(isRecord)
          .filter(
            (entry) =>
              typeof entry.entityId === "string" &&
              typeof entry.commandId === "string" &&
              typeof entry.title === "string" &&
              typeof entry.kind === "string" &&
              typeof entry.count === "number" &&
              typeof entry.lastRecordedAt === "string",
          )
          .map((entry) => ({
            entityId: entry.entityId as string,
            commandId: entry.commandId as string,
            title: entry.title as string,
            kind: entry.kind as CommandStore["usageStats"][number]["kind"],
            count: entry.count as number,
            lastRecordedAt: entry.lastRecordedAt as string,
          }))
      : [],
    savedRecipes: Array.isArray(raw.savedRecipes) ? raw.savedRecipes.map(parseSavedRecipe).filter((entry): entry is SavedRecipeRecord => entry !== null) : [],
  };
}

async function atomicWrite(fs: StoreFs, filePath: string, contents: string) {
  const tempPath = `${filePath}.tmp-${Date.now()}`;
  await fs.writeTextFile(tempPath, contents);
  await fs.rename(tempPath, filePath);
}

export async function loadCommandStore(fs: StoreFs, filePath: string): Promise<CommandStore> {
  if (!(await fs.exists(filePath))) {
    return createEmptyCommandStore();
  }

  try {
    const raw = await fs.readTextFile(filePath);
    return parseCommandStore(JSON.parse(raw) as unknown);
  } catch {
    return createEmptyCommandStore();
  }
}

export async function saveCommandStore(fs: StoreFs, filePath: string, store: CommandStore) {
  await atomicWrite(fs, filePath, JSON.stringify({ ...store, updatedAt: nowIso() }, null, 2));
}

export async function ensureCommandStore(fs: StoreFs, dirPath: string, filePath: string) {
  await fs.mkdir(dirPath, { recursive: true });
  if (!(await fs.exists(filePath))) {
    await saveCommandStore(fs, filePath, createEmptyCommandStore());
  }
}

export function recordRecentCommand(store: CommandStore, plan: GeneratedPlan): CommandStore {
  const resolutionId = plan.resolution.id ?? `${plan.resolution.kind}:${plan.resolution.title}`;
  const commandId = plan.resolution.id ?? resolutionId;
  const now = nowIso();
  const nextEntry = {
    id: createId("recent"),
    entityId: resolutionId,
    commandId,
    title: plan.resolution.title,
    kind: plan.resolution.kind,
    resolutionType: plan.resolution.kind,
    prompt: plan.prompt,
    source: plan.source,
    recordedAt: now,
  } satisfies CommandStore["recentCommands"][number];

  const filtered = store.recentCommands.filter((entry) => entry.entityId !== resolutionId);
  const existingUsage = store.usageStats.find((entry) => entry.entityId === resolutionId);
  const usageStat = existingUsage
    ? {
        ...existingUsage,
        count: existingUsage.count + 1,
        lastRecordedAt: now,
      }
    : {
        entityId: resolutionId,
        commandId,
        title: plan.resolution.title,
        kind: plan.resolution.kind,
        count: 1,
        lastRecordedAt: now,
      };

  return {
    ...store,
    updatedAt: now,
    recentCommands: [nextEntry, ...filtered].slice(0, 20),
    usageStats: [usageStat, ...store.usageStats.filter((entry) => entry.entityId !== resolutionId)]
      .sort((left, right) => right.count - left.count || right.lastRecordedAt.localeCompare(left.lastRecordedAt))
      .slice(0, 50),
  };
}

export function toggleFavorite(store: CommandStore, entityId: string): CommandStore {
  const favoriteIds = store.favoriteIds.includes(entityId)
    ? store.favoriteIds.filter((id) => id !== entityId)
    : [entityId, ...store.favoriteIds];

  return {
    ...store,
    updatedAt: nowIso(),
    favoriteIds,
  };
}

function inferRecipeKeywords(plan: GeneratedPlan) {
  return Array.from(
    new Set(
      [
        ...plan.actionPlan.summary.toLowerCase().split(/[^a-z0-9]+/),
        ...plan.actionPlan.actions.map((action) => action.type),
      ].filter(Boolean),
    ),
  ).slice(0, 12);
}

export function saveGeneratedPlanAsRecipe(store: CommandStore, plan: GeneratedPlan): CommandStore {
  const now = nowIso();
  const existing = store.savedRecipes.find((recipe) => recipe.title === plan.actionPlan.summary);
  const savedRecipe: SavedRecipeRecord = existing
    ? {
        ...existing,
        description: plan.explanation,
        prompt: plan.prompt,
        keywords: inferRecipeKeywords(plan),
        updatedAt: now,
        source: plan.source,
        actionPlan: plan.actionPlan,
      }
    : {
        id: createId("recipe"),
        title: plan.actionPlan.summary,
        description: plan.explanation,
        prompt: plan.prompt,
        keywords: inferRecipeKeywords(plan),
        createdAt: now,
        updatedAt: now,
        source: plan.source,
        actionPlan: plan.actionPlan,
      };

  const savedRecipes = [
    savedRecipe,
    ...store.savedRecipes.filter((recipe) => recipe.id !== savedRecipe.id),
  ].slice(0, 50);

  return {
    ...store,
    updatedAt: now,
    savedRecipes,
  };
}
