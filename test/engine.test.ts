import { describe, expect, it } from "vitest";
import {
  FACTIONS,
  Game,
  LAND_PROVINCE_COUNT,
  PROVINCES,
  resolveTurn,
  scoreFor,
  SEA_PROVINCE_COUNT,
  StoredPlayer,
  Unit,
  validateOrders,
  VICTORY_SCORE
} from "../src/engine";

const alice: StoredPlayer = { id: "alice", name: "Alice", token: "a", role: "envoy", faction: "north-american-union", joinedAt: 0 };
const bruno: StoredPlayer = { id: "bruno", name: "Bruno", token: "b", role: "envoy", faction: "european-compact", joinedAt: 0 };
const cyra: StoredPlayer = { id: "cyra", name: "Cyra", token: "c", role: "envoy", faction: "afro-arabian-league", joinedAt: 0 };

const nextId = (() => {
  let id = 0;
  return () => `event-${++id}`;
})();

function unit(id: string, owner: StoredPlayer, provinceId: string, type: Unit["type"] = "army"): Unit {
  return { id, ownerId: owner.id, faction: owner.faction as Unit["faction"], provinceId, type };
}

function gameWith(units: Unit[], overrides: Partial<Game> = {}): Game {
  return {
    roomCode: "ABC123",
    hostPlayerId: alice.id,
    status: "orders",
    turn: 1,
    year: 1,
    season: "spring",
    players: [alice, bruno, cyra],
    units,
    control: Object.fromEntries(units.filter((candidate) => PROVINCES[candidate.provinceId].supplyCenter).map((candidate) => [candidate.provinceId, candidate.ownerId])),
    orders: {},
    pendingRetreats: {},
    adjustmentNeeds: {},
    chats: [],
    activity: [],
    winnerId: null,
    ...overrides
  };
}

function positions(game: Game): Record<string, string> {
  return Object.fromEntries(game.units.map((candidate) => [candidate.id, candidate.provinceId]));
}

describe("world board graph", () => {
  it("keeps the 42 land territories and converts maritime routes into explicit sea spaces", () => {
    const territories = Object.values(PROVINCES);
    const seaSpaces = territories.filter((territory) => territory.kind === "sea");
    const supplyCenters = territories.filter((territory) => territory.supplyCenter);

    expect(LAND_PROVINCE_COUNT).toBe(42);
    expect(SEA_PROVINCE_COUNT).toBe(17);
    expect(territories).toHaveLength(59);
    expect(seaSpaces).toHaveLength(17);
    expect(PROVINCES.water_awc_sib.neighbors).toEqual(expect.arrayContaining(["awc", "sib"]));
    expect(PROVINCES.ena.neighbors).toContain("gla");
    expect(PROVINCES.ena.neighbors).toContain("water_car_ena");
    expect(supplyCenters.every((province) => province.kind === "home" || province.kind === "neutral")).toBe(true);
    expect(FACTIONS).toHaveLength(5);
    expect(FACTIONS.every((faction) => faction.homes.length === 3)).toBe(true);
    expect(VICTORY_SCORE).toBe(16);
  });
});

describe("movement adjudication", () => {
  it("dislodges a defender with a supported attack and creates a retreat when one is available", () => {
    const game = gameWith([
      unit("a1", alice, "yuc"),
      unit("a2", alice, "and"),
      unit("b1", bruno, "pan")
    ]);
    game.orders[alice.id] = [
      { unitId: "a1", type: "move", destination: "pan" },
      { unitId: "a2", type: "support", targetUnitId: "a1", destination: "pan" }
    ];
    game.orders[bruno.id] = [{ unitId: "b1", type: "hold" }];

    resolveTurn(game, nextId);

    expect(positions(game).a1).toBe("pan");
    expect(game.status).toBe("retreats");
    expect(game.pendingRetreats.b1.destinations).toEqual(["ama"]);
  });

  it("uses defensive support to bounce an equally supported attack", () => {
    const game = gameWith([
      unit("a1", alice, "yuc"),
      unit("a2", alice, "and"),
      unit("b1", bruno, "pan"),
      unit("b2", bruno, "ama")
    ]);
    game.orders[alice.id] = [
      { unitId: "a1", type: "move", destination: "pan" },
      { unitId: "a2", type: "support", targetUnitId: "a1", destination: "pan" }
    ];
    game.orders[bruno.id] = [
      { unitId: "b1", type: "hold" },
      { unitId: "b2", type: "support", targetUnitId: "b1" }
    ];

    resolveTurn(game, nextId);

    expect(positions(game)).toMatchObject({ a1: "yuc", a2: "and", b1: "pan", b2: "ama" });
    expect(game.status).toBe("orders");
    expect(game.season).toBe("fall");
  });

  it("cuts support when the supporter is attacked from outside the supported province", () => {
    const game = gameWith([
      unit("a1", alice, "yuc"),
      unit("a2", alice, "and"),
      unit("a3", alice, "bra"),
      unit("b1", bruno, "pan"),
      unit("b2", bruno, "ama")
    ]);
    game.orders[alice.id] = [
      { unitId: "a1", type: "move", destination: "pan" },
      { unitId: "a2", type: "support", targetUnitId: "a1", destination: "pan" },
      { unitId: "a3", type: "move", destination: "ama" }
    ];
    game.orders[bruno.id] = [
      { unitId: "b1", type: "hold" },
      { unitId: "b2", type: "support", targetUnitId: "b1" }
    ];

    resolveTurn(game, nextId);

    expect(positions(game).a1).toBe("pan");
    expect(game.units.map((candidate) => candidate.id)).not.toContain("b1");
  });

  it("does not cut support with an attack from the province against which support is given unless the supporter is dislodged", () => {
    const game = gameWith([
      unit("a1", alice, "yuc"),
      unit("a2", alice, "ama"),
      unit("b1", bruno, "pan")
    ]);
    game.orders[alice.id] = [
      { unitId: "a1", type: "move", destination: "pan" },
      { unitId: "a2", type: "support", targetUnitId: "a1", destination: "pan" }
    ];
    game.orders[bruno.id] = [{ unitId: "b1", type: "move", destination: "ama" }];

    resolveTurn(game, nextId);

    expect(positions(game).a1).toBe("pan");
    expect(positions(game).a2).toBe("ama");
    expect(game.pendingRetreats.b1).toBeDefined();
  });

  it("bounces an unsupported direct swap", () => {
    const game = gameWith([
      unit("a1", alice, "mex"),
      unit("b1", bruno, "yuc")
    ]);
    game.orders[alice.id] = [{ unitId: "a1", type: "move", destination: "yuc" }];
    game.orders[bruno.id] = [{ unitId: "b1", type: "move", destination: "mex" }];

    resolveTurn(game, nextId);

    expect(positions(game)).toMatchObject({ a1: "mex", b1: "yuc" });
  });

  it("prevents a player from dislodging their own unit", () => {
    const game = gameWith([
      unit("a1", alice, "yuc"),
      unit("a2", alice, "and"),
      unit("a3", alice, "pan")
    ]);
    game.orders[alice.id] = [
      { unitId: "a1", type: "move", destination: "pan" },
      { unitId: "a2", type: "support", targetUnitId: "a1", destination: "pan" },
      { unitId: "a3", type: "hold" }
    ];

    resolveTurn(game, nextId);

    expect(positions(game)).toMatchObject({ a1: "yuc", a2: "and", a3: "pan" });
  });

  it("rejects direct movement that is not legal for the unit type", () => {
    const game = gameWith([unit("a1", alice, "mex")]);
    expect(() => validateOrders(game, alice.id, [{ unitId: "a1", type: "move", destination: "aus" }])).toThrow("cannot move");
  });
});

describe("convoys", () => {
  it("moves an army through a complete ordered convoy route", () => {
    const game = gameWith([
      unit("a1", alice, "pan"),
      unit("f1", alice, "water_car_pan", "fleet"),
      unit("f2", alice, "water_bra_car", "fleet")
    ]);
    game.orders[alice.id] = [
      { unitId: "a1", type: "move", destination: "bra", viaConvoy: true },
      { unitId: "f1", type: "convoy", targetUnitId: "a1", destination: "bra" },
      { unitId: "f2", type: "convoy", targetUnitId: "a1", destination: "bra" }
    ];

    resolveTurn(game, nextId);

    expect(positions(game).a1).toBe("bra");
  });

  it("fails a convoyed move when the convoy route is incomplete", () => {
    const game = gameWith([
      unit("a1", alice, "pan"),
      unit("f1", alice, "water_car_pan", "fleet"),
      unit("f2", alice, "water_bra_car", "fleet")
    ]);
    game.orders[alice.id] = [
      { unitId: "a1", type: "move", destination: "bra", viaConvoy: true },
      { unitId: "f1", type: "convoy", targetUnitId: "a1", destination: "bra" },
      { unitId: "f2", type: "hold" }
    ];

    resolveTurn(game, nextId);

    expect(positions(game).a1).toBe("pan");
  });

  it("disrupts a convoy when all convoy routes include a dislodged fleet", () => {
    const game = gameWith([
      unit("a1", alice, "pan"),
      unit("f1", alice, "water_car_pan", "fleet"),
      unit("f2", alice, "water_bra_car", "fleet"),
      unit("b1", bruno, "car", "fleet"),
      unit("b2", bruno, "water_car_ena", "fleet")
    ]);
    game.orders[alice.id] = [
      { unitId: "a1", type: "move", destination: "bra", viaConvoy: true },
      { unitId: "f1", type: "convoy", targetUnitId: "a1", destination: "bra" },
      { unitId: "f2", type: "convoy", targetUnitId: "a1", destination: "bra" }
    ];
    game.orders[bruno.id] = [
      { unitId: "b1", type: "move", destination: "water_car_pan" },
      { unitId: "b2", type: "support", targetUnitId: "b1", destination: "water_car_pan" }
    ];

    resolveTurn(game, nextId);

    expect(positions(game).a1).toBe("pan");
    expect(positions(game).b1).toBe("water_car_pan");
  });

  it("keeps a convoy alive when at least one complete route survives disruption", () => {
    const game = gameWith([
      unit("a1", alice, "mal"),
      unit("f1", alice, "water_aus_mal", "fleet"),
      unit("f2", alice, "water_mal_png", "fleet"),
      unit("f3", alice, "water_aus_png", "fleet"),
      unit("b1", bruno, "water_mal_sea", "fleet"),
      unit("b2", bruno, "water_ind_mal", "fleet")
    ]);
    game.orders[alice.id] = [
      { unitId: "a1", type: "move", destination: "aus", viaConvoy: true },
      { unitId: "f1", type: "convoy", targetUnitId: "a1", destination: "aus" },
      { unitId: "f2", type: "convoy", targetUnitId: "a1", destination: "aus" },
      { unitId: "f3", type: "convoy", targetUnitId: "a1", destination: "aus" }
    ];
    game.orders[bruno.id] = [
      { unitId: "b1", type: "move", destination: "water_mal_png" },
      { unitId: "b2", type: "support", targetUnitId: "b1", destination: "water_mal_png" }
    ];

    resolveTurn(game, nextId);

    expect(positions(game).a1).toBe("aus");
    expect(positions(game).b1).toBe("water_mal_png");
  });
});

describe("retreats and ownership timing", () => {
  it("resolves a legal retreat after dislodgement", () => {
    const game = gameWith([
      unit("a1", alice, "yuc"),
      unit("a2", alice, "and"),
      unit("b1", bruno, "pan")
    ]);
    game.orders[alice.id] = [
      { unitId: "a1", type: "move", destination: "pan" },
      { unitId: "a2", type: "support", targetUnitId: "a1", destination: "pan" }
    ];
    game.orders[bruno.id] = [{ unitId: "b1", type: "hold" }];
    resolveTurn(game, nextId);

    game.orders[bruno.id] = [{ unitId: "b1", type: "retreat", destination: "ama" }];
    resolveTurn(game, nextId);

    expect(positions(game).b1).toBe("ama");
    expect(game.status).toBe("orders");
    expect(game.season).toBe("fall");
  });

  it("disbands all units that attempt conflicting retreats", () => {
    const game = gameWith([
      unit("a1", alice, "pan"),
      unit("b1", bruno, "and"),
      unit("c1", cyra, "bra")
    ], {
      status: "retreats",
      pendingRetreats: {
        b1: { unitId: "b1", from: "and", attackerFrom: "pan", destinations: ["ama"] },
        c1: { unitId: "c1", from: "bra", attackerFrom: "pat", destinations: ["ama"] }
      }
    });
    game.orders[bruno.id] = [{ unitId: "b1", type: "retreat", destination: "ama" }];
    game.orders[cyra.id] = [{ unitId: "c1", type: "retreat", destination: "ama" }];

    resolveTurn(game, nextId);

    expect(game.units.map((candidate) => candidate.id)).not.toContain("b1");
    expect(game.units.map((candidate) => candidate.id)).not.toContain("c1");
  });

  it("updates supply-center ownership only after Fall resolution", () => {
    const game = gameWith([unit("a1", alice, "yuc")], { control: {} });
    game.orders[alice.id] = [{ unitId: "a1", type: "move", destination: "pan" }];
    resolveTurn(game, nextId);

    expect(game.season).toBe("fall");
    expect(game.control.pan).toBeUndefined();

    game.orders[alice.id] = [{ unitId: "a1", type: "hold" }];
    resolveTurn(game, nextId);

    expect(game.control.pan).toBe(alice.id);
  });

  it("scores only controlled supply centers", () => {
    const game = gameWith([], {
      control: {
        pan: alice.id,
        yuc: alice.id,
        water_car_pan: alice.id
      }
    });

    expect(scoreFor(game, alice.id)).toBe(1);
  });
});

describe("winter adjustments", () => {
  it("builds in vacant owned home centers and allows excess capacity to be waived", () => {
    const game = gameWith([], {
      status: "adjustments",
      season: "winter",
      control: { gla: alice.id, cal: alice.id },
      adjustmentNeeds: { [alice.id]: 2 }
    });
    game.orders[alice.id] = [
      { type: "build", provinceId: "gla", unitType: "army" },
      { type: "waive" }
    ];

    resolveTurn(game, nextId);

    expect(game.units).toHaveLength(1);
    expect(game.units[0]).toMatchObject({ ownerId: alice.id, provinceId: "gla", type: "army" });
    expect(game.status).toBe("orders");
    expect(game.season).toBe("spring");
    expect(game.year).toBe(2);
  });

  it("requires surplus players to disband enough units", () => {
    const game = gameWith([
      unit("a1", alice, "gla"),
      unit("a2", alice, "cal")
    ], {
      status: "adjustments",
      season: "winter",
      control: { gla: alice.id },
      adjustmentNeeds: { [alice.id]: -1 }
    });

    expect(() => validateOrders(game, alice.id, [])).toThrow("must disband 1 unit");
    game.orders[alice.id] = validateOrders(game, alice.id, [{ unitId: "a2", type: "disband" }]);
    resolveTurn(game, nextId);

    expect(game.units.map((candidate) => candidate.id)).toEqual(["a1"]);
    expect(game.status).toBe("orders");
  });
});
