export const FACTIONS = [
  { id: "ivory", name: "Ivory Compact", color: "#dce9f1", homes: ["frosthold", "wintermere"] },
  { id: "azure", name: "Azure League", color: "#4da1d8", homes: ["tidewatch", "seabreak"] },
  { id: "verdant", name: "Verdant Pact", color: "#70bd76", homes: ["greenfall", "briarwatch"] },
  { id: "violet", name: "Violet Court", color: "#a789d4", homes: ["moonbridge", "duskford"] },
  { id: "aurum", name: "Aurum Assembly", color: "#e5b84d", homes: ["amberfield", "stonegate"] },
  { id: "cinder", name: "Cinder Dominion", color: "#db6e58", homes: ["ashfen", "redreach"] }
] as const;

export type FactionId = (typeof FACTIONS)[number]["id"];
export type PlayerRole = "envoy" | "spectator";

export interface Province {
  id: string;
  name: string;
  x: number;
  y: number;
  neighbors: string[];
}

const provinceRows = [
  ["frosthold", "Frosthold"], ["wintermere", "Wintermere"], ["pass", "King's Pass"], ["tidewatch", "Tidewatch"], ["seabreak", "Seabreak"], ["cape", "Cape Solace"],
  ["greenfall", "Greenfall"], ["briarwatch", "Briarwatch"], ["crossroads", "The Crossroads"], ["moonbridge", "Moonbridge"], ["duskford", "Duskford"], ["rivergate", "Rivergate"],
  ["amberfield", "Amberfield"], ["stonegate", "Stonegate"], ["furnace", "Old Furnace"], ["ashfen", "Ashfen"], ["redreach", "Redreach"], ["shrine", "Sunken Shrine"]
] as const;

function createMap(): Record<string, Province> {
  const map: Record<string, Province> = {};
  provinceRows.forEach(([id, name], index) => {
    const row = Math.floor(index / 6);
    const column = index % 6;
    const neighbors: string[] = [];
    if (column > 0) neighbors.push(provinceRows[index - 1][0]);
    if (column < 5) neighbors.push(provinceRows[index + 1][0]);
    if (row > 0) neighbors.push(provinceRows[index - 6][0]);
    if (row < 2) neighbors.push(provinceRows[index + 6][0]);
    map[id] = { id, name, x: 10 + column * 16, y: 18 + row * 32, neighbors };
  });
  return map;
}

export const PROVINCES = createMap();
export const VICTORY_SCORE = 7;

export interface StoredPlayer {
  id: string;
  name: string;
  token: string;
  role: PlayerRole;
  faction: FactionId | null;
  joinedAt: number;
}

export interface PublicPlayer {
  id: string;
  name: string;
  role: PlayerRole;
  faction: FactionId | null;
  joinedAt: number;
}

export interface Unit {
  id: string;
  ownerId: string;
  faction: FactionId;
  provinceId: string;
}

export type Order =
  | { unitId: string; type: "hold" }
  | { unitId: string; type: "move"; destination: string };

export interface ChatMessage {
  id: string;
  authorId: string;
  authorName: string;
  recipientId: string | null;
  body: string;
  createdAt: number;
}

export interface Activity {
  id: string;
  text: string;
  createdAt: number;
}

export interface Game {
  roomCode: string;
  hostPlayerId: string;
  status: "lobby" | "orders" | "finished";
  turn: number;
  players: StoredPlayer[];
  units: Unit[];
  control: Record<string, string>;
  orders: Record<string, Order[]>;
  chats: ChatMessage[];
  activity: Activity[];
  winnerId: string | null;
}

export interface GameView {
  roomCode: string;
  hostPlayerId: string;
  status: Game["status"];
  turn: number;
  players: PublicPlayer[];
  units: Unit[];
  control: Record<string, string>;
  ordersSubmitted: string[];
  chats: ChatMessage[];
  activity: Activity[];
  winnerId: string | null;
  myOrders: Order[];
  map: Province[];
  factions: typeof FACTIONS;
  victoryScore: number;
}

export function playerRole(player: Pick<StoredPlayer, "role"> | Pick<PublicPlayer, "role">): PlayerRole {
  // Rooms created before spectator support did not store a role. Treat those
  // records as envoys so persisted games continue to work after deployment.
  return player.role === "spectator" ? "spectator" : "envoy";
}

export function isEnvoy(player: Pick<StoredPlayer, "role"> | Pick<PublicPlayer, "role">): boolean {
  return playerRole(player) === "envoy";
}

export function publicView(game: Game, playerId: string): GameView {
  return {
    roomCode: game.roomCode,
    hostPlayerId: game.hostPlayerId,
    status: game.status,
    turn: game.turn,
    players: game.players.map(({ token: _token, ...player }) => ({ ...player, role: playerRole(player) })),
    units: game.units,
    control: game.control,
    ordersSubmitted: Object.keys(game.orders),
    chats: game.chats.filter((message) => message.recipientId === null || message.recipientId === playerId || message.authorId === playerId),
    activity: game.activity,
    winnerId: game.winnerId,
    myOrders: game.orders[playerId] ?? [],
    map: Object.values(PROVINCES),
    factions: FACTIONS,
    victoryScore: VICTORY_SCORE
  };
}

export function normalizeName(value: unknown): string {
  if (typeof value !== "string") return "Envoy";
  const cleaned = value.replace(/[\u0000-\u001F\u007F]/g, "").trim().replace(/\s+/g, " ");
  return cleaned.slice(0, 24) || "Envoy";
}

export function normalizeMessage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[\u0000-\u001F\u007F]/g, "").trim().replace(/\s+/g, " ");
  return cleaned.length > 0 ? cleaned.slice(0, 400) : null;
}

export function factionById(id: string): (typeof FACTIONS)[number] | undefined {
  return FACTIONS.find((faction) => faction.id === id);
}

export function scoreFor(game: Game, playerId: string): number {
  return Object.values(game.control).filter((controller) => controller === playerId).length;
}

export function createInitialUnits(game: Game): Unit[] {
  return game.players.flatMap((player) => {
    if (!player.faction) return [];
    const faction = factionById(player.faction);
    if (!faction) return [];
    return faction.homes.map((provinceId, index) => ({
      id: `${player.id.slice(0, 8)}-${index + 1}`,
      ownerId: player.id,
      faction: player.faction as FactionId,
      provinceId
    }));
  });
}

function isOrder(value: unknown): value is Order {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.unitId !== "string") return false;
  return candidate.type === "hold" || (candidate.type === "move" && typeof candidate.destination === "string");
}

export function validateOrders(game: Game, playerId: string, submitted: unknown): Order[] {
  if (!Array.isArray(submitted) || submitted.length > game.units.length) throw new Error("Orders must be an array of valid unit orders.");
  const ownedUnits = game.units.filter((unit) => unit.ownerId === playerId);
  const ownedIds = new Set(ownedUnits.map((unit) => unit.id));
  const seen = new Set<string>();
  const orders: Order[] = [];

  for (const rawOrder of submitted) {
    if (!isOrder(rawOrder) || !ownedIds.has(rawOrder.unitId) || seen.has(rawOrder.unitId)) {
      throw new Error("One or more orders are invalid.");
    }
    seen.add(rawOrder.unitId);
    const unit = ownedUnits.find((candidate) => candidate.id === rawOrder.unitId);
    if (!unit) throw new Error("Unknown unit.");
    if (rawOrder.type === "move") {
      if (!PROVINCES[unit.provinceId].neighbors.includes(rawOrder.destination)) {
        throw new Error("Units can only move to a neighboring province.");
      }
      orders.push({ unitId: rawOrder.unitId, type: "move", destination: rawOrder.destination });
    } else {
      orders.push({ unitId: rawOrder.unitId, type: "hold" });
    }
  }

  for (const unit of ownedUnits) {
    if (!seen.has(unit.id)) orders.push({ unitId: unit.id, type: "hold" });
  }
  return orders;
}

export function resolveTurn(game: Game, id: () => string): void {
  const allOrders = new Map<string, Order>();
  for (const unit of game.units) {
    const submitted = game.orders[unit.ownerId]?.find((order) => order.unitId === unit.id);
    allOrders.set(unit.id, submitted ?? { unitId: unit.id, type: "hold" });
  }

  const contenders = new Map<string, Unit[]>();
  for (const unit of game.units) {
    const order = allOrders.get(unit.id);
    if (order?.type !== "move") continue;
    const list = contenders.get(order.destination) ?? [];
    list.push(unit);
    contenders.set(order.destination, list);
  }

  const successful = new Set<string>();
  for (const [destination, units] of contenders) {
    if (units.length === 1 && PROVINCES[units[0].provinceId].neighbors.includes(destination)) {
      successful.add(units[0].id);
    }
  }

  const unitAtProvince = new Map(game.units.map((unit) => [unit.provinceId, unit]));
  for (const unit of game.units) {
    const order = allOrders.get(unit.id);
    if (order?.type !== "move" || !successful.has(unit.id)) continue;
    const occupant = unitAtProvince.get(order.destination);
    const occupantOrder = occupant ? allOrders.get(occupant.id) : undefined;
    if (occupant && occupantOrder?.type === "move" && occupantOrder.destination === unit.provinceId && successful.has(occupant.id)) {
      successful.delete(unit.id);
      successful.delete(occupant.id);
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const unit of game.units) {
      if (!successful.has(unit.id)) continue;
      const order = allOrders.get(unit.id);
      if (order?.type !== "move") continue;
      const occupant = unitAtProvince.get(order.destination);
      if (occupant && !successful.has(occupant.id)) {
        successful.delete(unit.id);
        changed = true;
      }
    }
  }

  let movements = 0;
  for (const unit of game.units) {
    const order = allOrders.get(unit.id);
    if (order?.type === "move" && successful.has(unit.id)) {
      unit.provinceId = order.destination;
      game.control[order.destination] = unit.ownerId;
      movements += 1;
    }
  }

  game.turn += 1;
  game.orders = {};
  const winner = game.players.find((player) => scoreFor(game, player.id) >= VICTORY_SCORE);
  if (winner) {
    game.status = "finished";
    game.winnerId = winner.id;
    game.activity.unshift({ id: id(), text: `${winner.name} controls ${VICTORY_SCORE} provinces and wins the council.`, createdAt: Date.now() });
  } else {
    game.activity.unshift({ id: id(), text: `Turn ${game.turn - 1} resolved: ${movements} successful movement${movements === 1 ? "" : "s"}.`, createdAt: Date.now() });
  }
  game.activity = game.activity.slice(0, 8);
}
