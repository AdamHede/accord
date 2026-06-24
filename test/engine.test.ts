import { describe, expect, it } from "vitest";
import { FACTIONS, Game, PROVINCES, resolveTurn, StoredPlayer, Unit, validateOrders, VICTORY_SCORE } from "../src/engine";

const alice: StoredPlayer = { id: "alice", name: "Alice", token: "a", faction: "north-american-union", joinedAt: 0 };
const bruno: StoredPlayer = { id: "bruno", name: "Bruno", token: "b", faction: "european-compact", joinedAt: 0 };

function gameWith(units: Unit[]): Game {
  return {
    roomCode: "ABC123",
    hostPlayerId: alice.id,
    status: "orders",
    turn: 1,
    players: [alice, bruno],
    units,
    control: Object.fromEntries(units.map((unit) => [unit.provinceId, unit.ownerId])),
    orders: {},
    chats: [],
    activity: [],
    winnerId: null
  };
}

describe("simultaneous order resolution", () => {
  it("captures an empty neighboring province", () => {
    const game = gameWith([{ id: "a1", ownerId: alice.id, faction: "north-american-union", provinceId: "mex" }]);
    game.orders[alice.id] = [{ unitId: "a1", type: "move", destination: "yuc" }];

    resolveTurn(game, () => "event-1");

    expect(game.units[0].provinceId).toBe("yuc");
    expect(game.control.yuc).toBe(alice.id);
    expect(game.turn).toBe(2);
  });

  it("bounces a direct swap", () => {
    const game = gameWith([
      { id: "a1", ownerId: alice.id, faction: "north-american-union", provinceId: "mex" },
      { id: "b1", ownerId: bruno.id, faction: "european-compact", provinceId: "yuc" }
    ]);
    game.orders[alice.id] = [{ unitId: "a1", type: "move", destination: "yuc" }];
    game.orders[bruno.id] = [{ unitId: "b1", type: "move", destination: "mex" }];

    resolveTurn(game, () => "event-2");

    expect(game.units.map((unit) => unit.provinceId)).toEqual(["mex", "yuc"]);
  });

  it("bounces competing moves into the same province", () => {
    const game = gameWith([
      { id: "a1", ownerId: alice.id, faction: "north-american-union", provinceId: "mex" },
      { id: "b1", ownerId: bruno.id, faction: "european-compact", provinceId: "pan" }
    ]);
    game.orders[alice.id] = [{ unitId: "a1", type: "move", destination: "yuc" }];
    game.orders[bruno.id] = [{ unitId: "b1", type: "move", destination: "yuc" }];

    resolveTurn(game, () => "event-3");

    expect(game.units.map((unit) => unit.provinceId)).toEqual(["mex", "pan"]);
  });

  it("rejects a move beyond a neighboring province", () => {
    const game = gameWith([{ id: "a1", ownerId: alice.id, faction: "north-american-union", provinceId: "mex" }]);
    expect(() => validateOrders(game, alice.id, [{ unitId: "a1", type: "move", destination: "aus" }])).toThrow("neighboring province");
  });
});

describe("world board graph", () => {
  it("preserves the 42-territory world graph and its maritime routes", () => {
    const territories = Object.values(PROVINCES);
    const connectionCount = territories.reduce((count, territory) => count + territory.neighbors.length, 0) / 2;
    const seaConnectionCount = territories.reduce((count, territory) => count + territory.seaNeighbors.length, 0) / 2;

    expect(territories).toHaveLength(42);
    expect(connectionCount).toBe(63);
    expect(seaConnectionCount).toBe(17);
    expect(PROVINCES.sib.neighbors).toContain("awc");
    expect(PROVINCES.awc.seaNeighbors).toContain("sib");
    expect(PROVINCES.ena.neighbors).toContain("gla");
    expect(FACTIONS).toHaveLength(5);
    expect(FACTIONS.every((faction) => faction.homes.length === 3)).toBe(true);
    expect(VICTORY_SCORE).toBe(16);
  });
});
