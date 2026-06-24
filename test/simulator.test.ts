import { describe, expect, it } from "vitest";
import {
  chooseOrders,
  createSeededRandom,
  resolveSimulationOptions,
  runSimulation,
  spawnSimulationGame
} from "../src/simulator";

describe("headless simulator", () => {
  it("randomly assigns strategies with replacement when spawning players", () => {
    const options = resolveSimulationOptions({ games: 1, strategies: ["random", "expansionist"] });
    const game = spawnSimulationGame(options, () => 0);

    expect(Object.values(game.strategiesByPlayerId)).toEqual(["random", "random", "random", "random", "random", "random"]);
  });

  it("produces complete orders without sending two of one player's units to the same destination", () => {
    const options = resolveSimulationOptions({ games: 1 });
    const { game } = spawnSimulationGame(options, createSeededRandom("orders"));
    const player = game.players[0];
    const orders = chooseOrders(game, player.id, "expansionist", createSeededRandom("moves"));
    const destinations = orders.filter((order) => order.type === "move").map((order) => order.destination);

    expect(orders).toHaveLength(2);
    expect(new Set(destinations).size).toBe(destinations.length);
  });

  it("aggregates one result per game and one strategy appearance per simulated player", () => {
    const report = runSimulation({ games: 12, maxTurns: 30, seed: "repeatable" });
    const strategyAppearances = Object.values(report.strategies).reduce((total, stats) => total + stats.appearances, 0);
    const strategyWins = Object.values(report.strategies).reduce((total, stats) => total + stats.wins, 0);

    expect(report.completedGames).toBe(12);
    expect(report.wins + report.draws).toBe(12);
    expect(strategyAppearances).toBe(12 * 6);
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
