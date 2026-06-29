import {
  factionById,
  FACTIONS,
  type Game,
  type Order,
  type StoredPlayer,
  validateOrders
} from "./engine";

export const AI_NAME = "Accord AI";
export const AI_FAST_MODEL = "gpt-5.4-mini";
export const AI_DEEP_MODEL = "gpt-5.5";

type ReasoningEffort = "low" | "medium";
export type AiTier = "high" | "balanced" | "test";

export interface AiModelChoice {
  model: string;
  effort: ReasoningEffort;
}

export interface AiMemory {
  playerId: string;
  updatedAt: number;
  turn: number;
  trustedPartners: Record<string, number>;
  betrayedBy: Record<string, number>;
  alliances: string[];
  shortTermGoals: string[];
  longTermGoals: string[];
  notes: string[];
}

export interface AiPlan {
  chatMessages: { recipientId: string | null; body: string }[];
  orders: Order[];
  memory: Omit<AiMemory, "playerId" | "updatedAt" | "turn">;
  sleepMs: number;
}

export interface AiRuntimeConfig {
  apiKey?: string;
  fetch?: typeof fetch;
  forceDeterministic?: boolean;
  tier?: AiTier | string;
  finalPlanning?: boolean;
}

export function isAiPlayer(player: Pick<StoredPlayer, "token"> & { ai?: boolean }): boolean {
  return player.ai === true || player.token.startsWith("ai-token-");
}

export function humanEnvoys(game: Game): StoredPlayer[] {
  return game.players.filter((player) => player.role !== "spectator" && !isAiPlayer(player));
}

export function aiEnvoys(game: Game): StoredPlayer[] {
  return game.players.filter((player) => player.role !== "spectator" && isAiPlayer(player));
}

export function resolveAiTier(value: string | undefined): AiTier {
  if (value === "high" || value === "balanced" || value === "test") return value;
  return "balanced";
}

function humansHaveSubmitted(game: Game): boolean {
  if (!["orders", "retreats", "adjustments"].includes(game.status)) return false;
  return humanEnvoys(game).every((candidate) => game.orders[candidate.id]);
}

export function selectAiModel(tier: AiTier | string | undefined, humansDone: boolean): AiModelChoice {
  const resolved = resolveAiTier(typeof tier === "string" ? tier : undefined);
  if (resolved === "high") return { model: AI_DEEP_MODEL, effort: "medium" };
  if (resolved === "test") return { model: AI_FAST_MODEL, effort: "low" };
  return humansDone ? { model: AI_DEEP_MODEL, effort: "medium" } : { model: AI_FAST_MODEL, effort: "low" };
}

export function addAiEnvoy(game: Game, now = Date.now()): StoredPlayer {
  if (game.status !== "lobby") throw new Error("AI envoys can only join before the council begins.");
  const taken = new Set(game.players.map((player) => player.faction).filter(Boolean));
  const faction = FACTIONS.find((candidate) => !taken.has(candidate.id));
  if (!faction) throw new Error("No faction is available for another AI envoy.");
  const player: StoredPlayer & { ai: true } = {
    id: crypto.randomUUID(),
    token: `ai-token-${crypto.randomUUID()}`,
    name: AI_NAME,
    role: "envoy",
    faction: faction.id,
    joinedAt: now,
    ai: true
  };
  game.players.push(player);
  game.activity.unshift({ id: crypto.randomUUID(), text: `${player.name} joined as the ${faction.name}.`, createdAt: now });
  game.activity = game.activity.slice(0, 8);
  return player;
}

function visibleChats(game: Game, aiPlayerId: string) {
  return game.chats.filter((message) => message.recipientId === null || message.recipientId === aiPlayerId || message.authorId === aiPlayerId).slice(-40);
}

function redact(game: Game, aiPlayerId: string, memory: AiMemory | null) {
  return {
    roomCode: game.roomCode,
    status: game.status,
    turn: game.turn,
    year: game.year,
    season: game.season,
    players: game.players.map(({ token: _token, ...player }) => player),
    myPlayerId: aiPlayerId,
    myFaction: game.players.find((player) => player.id === aiPlayerId)?.faction ?? null,
    units: game.units,
    control: game.control,
    pendingRetreats: game.pendingRetreats,
    adjustmentNeeds: game.adjustmentNeeds,
    visibleChats: visibleChats(game, aiPlayerId),
    memory
  };
}

function defaultMemory(playerId: string, now: number, turn: number): AiMemory {
  return { playerId, updatedAt: now, turn, trustedPartners: {}, betrayedBy: {}, alliances: [], shortTermGoals: [], longTermGoals: ["Reach 10 supply centers without revealing hidden orders."], notes: [] };
}

function deterministicOrders(game: Game, aiPlayerId: string): Order[] {
  const units = game.units.filter((unit) => unit.ownerId === aiPlayerId && !game.pendingRetreats[unit.id]);
  if (game.status === "orders") return units.map((unit) => ({ unitId: unit.id, type: "hold" }));
  if (game.status === "retreats") return Object.values(game.pendingRetreats)
    .filter((retreat) => units.some((unit) => unit.id === retreat.unitId))
    .map((retreat) => retreat.destinations[0] ? { unitId: retreat.unitId, type: "retreat", destination: retreat.destinations[0] } : { unitId: retreat.unitId, type: "disband" });
  if (game.status === "adjustments") {
    const need = game.adjustmentNeeds[aiPlayerId] ?? 0;
    if (need > 0) return Array.from({ length: need }, () => ({ type: "waive" as const }));
    if (need < 0) return units.slice(0, Math.abs(need)).map((unit) => ({ type: "disband", unitId: unit.id }));
  }
  return [];
}

function fallbackPlan(game: Game, aiPlayer: StoredPlayer, memory: AiMemory | null, now: number): AiPlan {
  const faction = aiPlayer.faction ? factionById(aiPlayer.faction)?.name : "unclaimed faction";
  return {
    chatMessages: visibleChats(game, aiPlayer.id).some((message) => message.recipientId === aiPlayer.id && message.authorId !== aiPlayer.id)
      ? [{ recipientId: null, body: `${faction} acknowledges the latest proposal. I will consider it before final orders.` }]
      : [],
    orders: deterministicOrders(game, aiPlayer.id),
    memory: memory ?? defaultMemory(aiPlayer.id, now, game.turn),
    sleepMs: 0
  };
}

function coercePlan(value: unknown): Partial<AiPlan> {
  if (typeof value !== "object" || value === null) return {};
  return value as Partial<AiPlan>;
}

async function openaiJson(config: Required<Pick<AiRuntimeConfig, "fetch">> & Pick<AiRuntimeConfig, "apiKey">, model: string, effort: ReasoningEffort, system: string, state: unknown): Promise<unknown> {
  if (!config.apiKey) throw new Error("OPENAI_API_KEY is not configured.");
  const response = await config.fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Authorization": `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      reasoning: { effort },
      input: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(state) }
      ],
      text: { format: { type: "json_object" } }
    })
  });
  if (!response.ok) throw new Error(`OpenAI request failed with ${response.status}.`);
  const payload = await response.json() as { output_text?: string; output?: { content?: { text?: string }[] }[] };
  const text = payload.output_text ?? payload.output?.flatMap((item) => item.content ?? []).find((content) => typeof content.text === "string")?.text;
  if (!text) throw new Error("OpenAI response did not include JSON text.");
  return JSON.parse(text);
}

export async function planAiTurn(game: Game, aiPlayer: StoredPlayer, memory: AiMemory | null, config: AiRuntimeConfig = {}): Promise<AiPlan> {
  const now = Date.now();
  if (config.forceDeterministic) return fallbackPlan(game, aiPlayer, memory, now);
  const system = [
    "You are playing Accord, a chatroom diplomacy game, as one envoy.",
    "You can negotiate, but do not spam: send at most two concise chat messages unless directly addressed.",
    "You only know public board state, visible chats, your submitted orders, and your memory. Do not assume hidden human orders.",
    "When all humans have submitted actions, produce final legal orders and update memory about betrayals, trust, alliances, and goals.",
    "Return JSON with chatMessages, orders, memory, and sleepMs. Use sleepMs to wait for humans during live games."
  ].join(" ");
  try {
    const { model, effort } = selectAiModel(config.tier, config.finalPlanning ?? humansHaveSubmitted(game));
    const raw = await openaiJson({ fetch: config.fetch ?? fetch, apiKey: config.apiKey }, model, effort, system, redact(game, aiPlayer.id, memory));
    const planned = coercePlan(raw);
    const orders = validateOrders(game, aiPlayer.id, planned.orders ?? []);
    return {
      chatMessages: (planned.chatMessages ?? []).slice(0, 2).filter((message) => typeof message.body === "string" && message.body.trim()),
      orders,
      memory: planned.memory ?? (memory ?? defaultMemory(aiPlayer.id, now, game.turn)),
      sleepMs: Math.max(0, Math.min(Number(planned.sleepMs ?? 0), 30 * 60 * 1000))
    };
  } catch {
    return fallbackPlan(game, aiPlayer, memory, now);
  }
}
