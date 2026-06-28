import { describe, expect, it } from "vitest";
import {
  type AgentProfile,
  chooseOrders,
  createSeededRandom,
  resolveSimulationOptions,
  runSimulation,
  spawnSimulationGame
} from "../src/simulator";
import { FACTIONS, validateOrders } from "../src/engine";

describe("headless simulator", () => {
  it("randomly assigns strategies with replacement when spawning players", () => {
    const options = resolveSimulationOptions({ games: 1, strategies: ["random", "expansionist"] });
    const game = spawnSimulationGame(options, () => 0);

    expect(Object.values(game.strategiesByPlayerId)).toEqual(Array.from({ length: FACTIONS.length }, () => "random"));
    expect(Object.values(game.profilesByPlayerId)).toHaveLength(FACTIONS.length);
    expect(Object.values(game.profilesByPlayerId).every((profile) => profile.rivalId && profile.boldness > 0)).toBe(true);
  });

  it("produces complete orders without sending two of one player's units to the same destination", () => {
    const options = resolveSimulationOptions({ games: 1 });
    const { game } = spawnSimulationGame(options, createSeededRandom("orders"));
    const player = game.players[0];
    const orders = chooseOrders(game, player.id, "expansionist", createSeededRandom("moves"));
    const destinations = orders.filter((order) => order.type === "move").map((order) => order.destination);

    expect(orders).toHaveLength(game.units.filter((unit) => unit.ownerId === player.id).length);
    expect(new Set(destinations).size).toBe(destinations.length);
  });

  it("uses a profile-weighted supported attack against an occupied rival province", () => {
    const options = resolveSimulationOptions({ games: 1, playerCount: 2, strategies: ["expansionist"] });
    const { game } = spawnSimulationGame(options, createSeededRandom("supported-attack"));
    const attacker = game.players[0];
    const rival = game.players[1];
    game.units = [
      { id: "attacker-1", ownerId: attacker.id, faction: attacker.faction as NonNullable<typeof attacker.faction>, provinceId: "yuc", type: "army" },
      { id: "attacker-2", ownerId: attacker.id, faction: attacker.faction as NonNullable<typeof attacker.faction>, provinceId: "and", type: "army" },
      { id: "rival-1", ownerId: rival.id, faction: rival.faction as NonNullable<typeof rival.faction>, provinceId: "pan", type: "army" }
    ];
    game.control = { pan: rival.id };
    const profile: AgentProfile = { strategy: "expansionist", boldness: 1.45, paranoia: 1, grudge: 1.15, rivalId: rival.id };
    const orders = chooseOrders(game, attacker.id, "expansionist", () => 0, profile);

    expect(orders).toEqual(expect.arrayContaining([
      { unitId: "attacker-1", type: "move", destination: "pan" },
      { unitId: "attacker-2", type: "support", targetUnitId: "attacker-1", destination: "pan" }
    ]));
    expect(validateOrders(game, attacker.id, orders)).toEqual(orders);
  });

  it("aggregates one result per game and one strategy appearance per simulated player", () => {
    const report = runSimulation({ games: 12, maxTurns: 30, seed: "repeatable" });
    const strategyAppearances = Object.values(report.strategies).reduce((total, stats) => total + stats.appearances, 0);
    const strategyWins = Object.values(report.strategies).reduce((total, stats) => total + stats.wins, 0);

    expect(report.completedGames).toBe(12);
    expect(report.wins + report.draws).toBe(12);
    expect(strategyAppearances).toBe(12 * FACTIONS.length);
    expect(strategyWins).toBe(report.wins);
  });

  it("is reproducible for the same seed apart from elapsed timing", () => {
    const first = runSimulation({ games: 20, maxTurns: 40, seed: "same-seed" });
    const second = runSimulation({ games: 20, maxTurns: 40, seed: "same-seed" });
    const { elapsedMs: _firstElapsed, gamesPerSecond: _firstSpeed, ...firstStable } = first;
    const { elapsedMs: _secondElapsed, gamesPerSecond: _secondSpeed, ...secondStable } = second;

    expect(firstStable).toEqual(secondStable);
  });
});
