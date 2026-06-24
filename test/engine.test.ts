import { describe, expect, it } from "vitest";
import { Game, resolveTurn, StoredPlayer, Unit, validateOrders } from "../src/engine";

const alice: StoredPlayer = { id: "alice", name: "Alice", token: "a", role: "envoy", faction: "ivory", joinedAt: 0 };
const bruno: StoredPlayer = { id: "bruno", name: "Bruno", token: "b", role: "envoy", faction: "azure", joinedAt: 0 };

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
    const game = gameWith([{ id: "a1", ownerId: alice.id, faction: "ivory", provinceId: "pass" }]);
    game.orders[alice.id] = [{ unitId: "a1", type: "move", destination: "crossroads" }];

    resolveTurn(game, () => "event-1");

    expect(game.units[0].provinceId).toBe("crossroads");
    expect(game.control.crossroads).toBe(alice.id);
    expect(game.turn).toBe(2);
  });

  it("bounces a direct swap", () => {
    const game = gameWith([
      { id: "a1", ownerId: alice.id, faction: "ivory", provinceId: "pass" },
      { id: "b1", ownerId: bruno.id, faction: "azure", provinceId: "crossroads" }
    ]);
    game.orders[alice.id] = [{ unitId: "a1", type: "move", destination: "crossroads" }];
    game.orders[bruno.id] = [{ unitId: "b1", type: "move", destination: "pass" }];

    resolveTurn(game, () => "event-2");

    expect(game.units.map((unit) => unit.provinceId)).toEqual(["pass", "crossroads"]);
  });

  it("bounces competing moves into the same province", () => {
    const game = gameWith([
      { id: "a1", ownerId: alice.id, faction: "ivory", provinceId: "pass" },
      { id: "b1", ownerId: bruno.id, faction: "azure", provinceId: "briarwatch" }
    ]);
    game.orders[alice.id] = [{ unitId: "a1", type: "move", destination: "crossroads" }];
    game.orders[bruno.id] = [{ unitId: "b1", type: "move", destination: "crossroads" }];

    resolveTurn(game, () => "event-3");

    expect(game.units.map((unit) => unit.provinceId)).toEqual(["pass", "briarwatch"]);
  });

  it("rejects a move beyond a neighboring province", () => {
    const game = gameWith([{ id: "a1", ownerId: alice.id, faction: "ivory", provinceId: "pass" }]);
    expect(() => validateOrders(game, alice.id, [{ unitId: "a1", type: "move", destination: "shrine" }])).toThrow("neighboring province");
  });
});
