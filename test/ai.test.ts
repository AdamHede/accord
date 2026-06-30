import { describe, expect, it } from "vitest";
import { addAiEnvoy, aiEnvoys, humanEnvoys, planAiTurn, selectAiModel } from "../src/ai";
import { createInitialControl, createInitialUnits, FACTIONS, type Game, type StoredPlayer, validateOrders } from "../src/engine";

const host: StoredPlayer = { id: "host", name: "Host", token: "host-token", role: "envoy", faction: FACTIONS[0].id, joinedAt: 0 };

function lobby(): Game {
  return { roomCode: "AIROOM", hostPlayerId: host.id, status: "lobby", turn: 1, year: 1, season: "spring", players: [{ ...host }], units: [], control: {}, orders: {}, pendingRetreats: {}, adjustmentNeeds: {}, chats: [], activity: [], winnerId: null };
}

describe("agentic AI envoy", () => {
  it("selects the requested AI tier model and effort", () => {
    expect(selectAiModel("high", false)).toEqual({ model: "gpt-5.5", effort: "medium" });
    expect(selectAiModel("high", true)).toEqual({ model: "gpt-5.5", effort: "medium" });
    expect(selectAiModel("balanced", false)).toEqual({ model: "gpt-5.4-mini", effort: "low" });
    expect(selectAiModel("balanced", true)).toEqual({ model: "gpt-5.5", effort: "medium" });
    expect(selectAiModel("test", false)).toEqual({ model: "gpt-5.4-mini", effort: "low" });
    expect(selectAiModel("test", true)).toEqual({ model: "gpt-5.4-mini", effort: "low" });
  });

  it("joins as an envoy with a unique available faction without counting as a human", () => {
    const game = lobby();
    const ai = addAiEnvoy(game, 100);

    expect(ai.name).toBe(`Accord AI — ${FACTIONS[1].name}`);
    expect(ai.faction).toBe(FACTIONS[1].id);
    expect(aiEnvoys(game).map((player) => player.id)).toEqual([ai.id]);
    expect(humanEnvoys(game).map((player) => player.id)).toEqual([host.id]);
  });

  it("gives multiple AI envoys distinct names", () => {
    const game = lobby();
    const first = addAiEnvoy(game, 100);
    const second = addAiEnvoy(game, 101);

    expect(first.name).not.toBe(second.name);
    expect(aiEnvoys(game).map((player) => player.name)).toEqual([
      `Accord AI — ${FACTIONS[1].name}`,
      `Accord AI — ${FACTIONS[2].name}`
    ]);
  });

  it("can produce deterministic legal orders for simulator and API-key-free tests", async () => {
    const game = lobby();
    const ai = addAiEnvoy(game, 100);
    game.status = "orders";
    game.units = createInitialUnits(game);
    game.control = createInitialControl(game);

    const plan = await planAiTurn(game, ai, null, { forceDeterministic: true });

    expect(plan.orders).toHaveLength(3);
    expect(validateOrders(game, ai.id, plan.orders)).toEqual(plan.orders);
    expect(plan.memory.longTermGoals.join(" ")).toContain("10 supply centers");
  });
});
