export const FACTIONS = [
  { id: "north-american-union", name: "North American Union", color: "#3b82f6", homes: ["ena", "gla", "cal"] },
  { id: "european-compact", name: "European Compact", color: "#a855f7", homes: ["bri", "weu", "ceu"] },
  { id: "afro-arabian-league", name: "Afro-Arabian League", color: "#d97706", homes: ["waf", "egy", "ara"] },
  { id: "asian-coalition", name: "Asian Coalition", color: "#ef4444", homes: ["ind", "chi", "jak"] },
  { id: "southern-maritime-league", name: "Southern Maritime League", color: "#22c55e", homes: ["cap", "mal", "aus"] }
] as const;

export type FactionId = (typeof FACTIONS)[number]["id"];
export type PlayerRole = "envoy" | "spectator";

export interface Province {
  id: string;
  name: string;
  x: number;
  y: number;
  kind: "home" | "neutral" | "buffer";
  seaNeighbors: string[];
  neighbors: string[];
}

type ProvinceDefinition = readonly [id: string, name: string, x: number, y: number, kind: Province["kind"]];
type ConnectionDefinition = readonly [a: string, b: string, kind: "land" | "sea"];

// Coordinates are deliberately laid out as a world map rather than a grid.  The
// graph below is the game rule: the visual board is only a projection of it.
const provinceDefinitions: ProvinceDefinition[] = [
  ["ena", "Eastern North America", 29.17, 24.44, "home"], ["gla", "Great Lakes", 25.56, 22.22, "home"], ["cal", "California", 16.67, 28.15, "home"], ["awc", "Alaska & Western Canada", 12.5, 11.11, "buffer"], ["mex", "Mexico", 21.67, 39.26, "neutral"], ["yuc", "Yucatán & Central Mexico", 25.56, 41.48, "buffer"], ["pan", "Panama Canal", 27.78, 48.89, "neutral"], ["car", "Caribbean Islands", 30, 40.74, "neutral"],
  ["ama", "Amazon Basin", 32.5, 59.26, "buffer"], ["bra", "Brazil", 36.94, 66.67, "neutral"], ["and", "Andes", 30, 67.41, "neutral"], ["pat", "Patagonia & Southern Cone", 31.11, 88.89, "buffer"],
  ["bri", "Britain & Ireland", 49.17, 15.56, "home"], ["weu", "Western Europe", 50.56, 20.74, "home"], ["ceu", "Central Europe", 53.89, 18.52, "home"], ["sca", "Scandinavia", 54.44, 8.89, "neutral"], ["ibe", "Iberia", 48.89, 25.93, "neutral"], ["bal", "Balkans", 55.83, 23.7, "buffer"], ["ana", "Anatolia", 59.72, 26.67, "buffer"], ["eeu", "Eastern Europe & Ukraine", 58.89, 18.52, "buffer"],
  ["mag", "Maghreb", 48.61, 32.59, "neutral"], ["lib", "Libya & North Africa", 55, 34.07, "buffer"], ["waf", "West Africa", 49.72, 49.63, "home"], ["con", "Congo & Sahel", 56.11, 55.56, "buffer"], ["egy", "Egypt & Suez", 58.33, 35.56, "home"], ["lev", "Levant", 60, 31.85, "buffer"], ["ara", "Arabia", 62.5, 40, "home"], ["per", "Mesopotamia & Persia", 64.72, 31.85, "neutral"], ["eaf", "East Africa & Horn", 61.67, 52.59, "neutral"], ["cap", "Southern Africa & Cape", 56.94, 77.78, "home"],
  ["ind", "India", 71.67, 39.26, "home"], ["cas", "Central Asia", 68.61, 22.22, "neutral"], ["ste", "Kazakh Steppe", 67.5, 17.78, "buffer"], ["sib", "Siberia", 76.39, 11.11, "neutral"], ["mon", "Mongolia", 78.61, 20.74, "buffer"], ["chi", "China", 80.56, 30.37, "home"], ["man", "Manchuria", 84.44, 22.22, "buffer"], ["jak", "Japan & Korea", 88.06, 27.41, "home"], ["sea", "Southeast Asia", 79.17, 45.93, "neutral"], ["mal", "Indonesia & Malacca", 81.11, 57.04, "home"],
  ["png", "New Guinea & Arafura", 90.28, 59.26, "buffer"], ["aus", "Australia", 87.5, 74.07, "home"]
] as const;

const connectionDefinitions: ConnectionDefinition[] = [
  ["ena", "gla", "land"], ["gla", "cal", "land"], ["cal", "awc", "land"], ["ena", "mex", "land"], ["cal", "mex", "land"], ["mex", "yuc", "land"], ["yuc", "pan", "land"], ["pan", "car", "sea"], ["car", "ena", "sea"], ["pan", "and", "land"], ["pan", "ama", "land"],
  ["and", "ama", "land"], ["ama", "bra", "land"], ["bra", "pat", "land"], ["and", "pat", "land"], ["car", "bra", "sea"],
  ["bri", "weu", "sea"], ["bri", "sca", "sea"], ["weu", "ceu", "land"], ["weu", "ibe", "land"], ["ceu", "sca", "land"], ["ceu", "eeu", "land"], ["ceu", "bal", "land"], ["eeu", "bal", "land"], ["bal", "ana", "land"], ["ana", "lev", "land"], ["eeu", "ste", "land"],
  ["ibe", "mag", "sea"], ["mag", "lib", "land"], ["lib", "egy", "land"], ["mag", "waf", "land"], ["waf", "con", "land"], ["con", "eaf", "land"], ["con", "cap", "land"], ["egy", "lev", "land"], ["egy", "eaf", "land"], ["lev", "ara", "land"], ["lev", "per", "land"], ["ara", "per", "land"], ["ara", "eaf", "sea"], ["eaf", "cap", "land"], ["mag", "egy", "sea"],
  ["per", "ind", "land"], ["per", "cas", "land"], ["ind", "cas", "land"], ["ind", "sea", "land"], ["sea", "chi", "land"], ["sea", "mal", "land"], ["chi", "mon", "land"], ["chi", "man", "land"], ["man", "jak", "sea"], ["mon", "sib", "land"], ["mon", "cas", "land"], ["ste", "cas", "land"], ["ste", "sib", "land"], ["sib", "awc", "sea"], ["sib", "jak", "sea"],
  ["mal", "png", "sea"], ["png", "aus", "sea"], ["mal", "aus", "sea"], ["cap", "aus", "sea"], ["mal", "ind", "sea"], ["mal", "sea", "sea"]
] as const;

function createMap(): Record<string, Province> {
  const map = Object.fromEntries(provinceDefinitions.map(([id, name, x, y, kind]) => [id, { id, name, x, y, kind, neighbors: [], seaNeighbors: [] }])) as Record<string, Province>;
  for (const [a, b, kind] of connectionDefinitions) {
    map[a].neighbors.push(b);
    map[b].neighbors.push(a);
    if (kind === "sea") {
      map[a].seaNeighbors.push(b);
      map[b].seaNeighbors.push(a);
    }
  }
  return map;
}

export const PROVINCES = createMap();
export const VICTORY_SCORE = 16;

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
