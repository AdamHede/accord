export const FACTIONS = [
  { id: "north-american-union", name: "North American Union", color: "#3b82f6", homes: ["ena", "gla", "cal"] },
  { id: "european-compact", name: "European Compact", color: "#a855f7", homes: ["bri", "weu", "ceu"] },
  { id: "afro-arabian-league", name: "Afro-Arabian League", color: "#d97706", homes: ["waf", "egy", "ara"] },
  { id: "asian-coalition", name: "Asian Coalition", color: "#ef4444", homes: ["ind", "chi", "jak"] },
  { id: "southern-maritime-league", name: "Southern Maritime League", color: "#22c55e", homes: ["cap", "mal", "aus"] }
] as const;

export type FactionId = (typeof FACTIONS)[number]["id"];
export type PlayerRole = "envoy" | "spectator";
export type UnitType = "army" | "fleet";
export type Season = "spring" | "fall" | "winter";
export type GameStatus = "lobby" | "orders" | "retreats" | "adjustments" | "finished";
export type ProvinceKind = "home" | "neutral" | "buffer" | "sea";
export type SupplyCenterKind = "home" | "neutral";

export interface SeaProvinceDisplayMetadata {
  name: string;
  abbreviation: string;
  labelAnchor: { x: number; y: number };
  fleetAnchor: { x: number; y: number };
  lanePath: { bend: number; wrap?: boolean };
  priority: number;
  region?: string;
  endpoints: [string, string];
}

export interface Province {
  id: string;
  name: string;
  x: number;
  y: number;
  kind: ProvinceKind;
  supplyCenter: SupplyCenterKind | null;
  homeFactionId: FactionId | null;
  seaNeighbors: string[];
  neighbors: string[];
  seaDisplay: SeaProvinceDisplayMetadata | null;
}

type LandProvinceKind = Exclude<ProvinceKind, "sea">;
type ProvinceDefinition = readonly [id: string, name: string, x: number, y: number, kind: LandProvinceKind];
type ConnectionDefinition = readonly [a: string, b: string, kind: "land" | "sea"];
type SeaDisplayDefinition = Omit<SeaProvinceDisplayMetadata, "labelAnchor" | "fleetAnchor" | "lanePath" | "endpoints"> & {
  labelAnchor?: { x: number; y: number };
  fleetAnchor?: { x: number; y: number };
  lanePath?: { bend: number; wrap?: boolean };
};

// Coordinates are deliberately laid out as a world map rather than a grid. The
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
  ["ena", "gla", "land"], ["gla", "cal", "land"], ["gla", "awc", "land"], ["cal", "awc", "land"], ["ena", "mex", "land"], ["ena", "yuc", "land"], ["cal", "mex", "land"], ["gla", "mex", "land"], ["mex", "yuc", "land"], ["mex", "car", "land"], ["yuc", "pan", "land"], ["yuc", "car", "land"], ["pan", "car", "sea"], ["car", "ena", "sea"], ["pan", "and", "land"], ["pan", "ama", "land"],
  ["and", "ama", "land"], ["ama", "bra", "land"], ["ama", "pat", "land"], ["bra", "pat", "land"], ["and", "pat", "land"], ["car", "bra", "sea"],
  ["bri", "weu", "sea"], ["bri", "sca", "sea"], ["weu", "ceu", "land"], ["weu", "ibe", "land"], ["ceu", "sca", "land"], ["sca", "eeu", "land"], ["ceu", "eeu", "land"], ["ceu", "bal", "land"], ["weu", "bal", "land"], ["ibe", "bal", "land"], ["eeu", "bal", "land"], ["eeu", "ana", "land"], ["bal", "ana", "land"], ["ana", "lev", "land"], ["ana", "per", "land"], ["eeu", "ste", "land"],
  ["ibe", "mag", "sea"], ["mag", "lib", "land"], ["lib", "egy", "land"], ["mag", "waf", "land"], ["mag", "con", "land"], ["lib", "waf", "land"], ["lib", "con", "land"], ["lib", "lev", "land"], ["waf", "con", "land"], ["con", "eaf", "land"], ["con", "cap", "land"], ["egy", "lev", "land"], ["egy", "eaf", "land"], ["lev", "ara", "land"], ["lev", "per", "land"], ["ara", "per", "land"], ["ara", "eaf", "sea"], ["eaf", "cap", "land"], ["mag", "egy", "sea"],
  ["per", "ind", "land"], ["per", "cas", "land"], ["ind", "cas", "land"], ["ind", "chi", "land"], ["ind", "sea", "land"], ["sea", "chi", "land"], ["sea", "mal", "land"], ["chi", "mon", "land"], ["chi", "cas", "land"], ["chi", "man", "land"], ["man", "jak", "sea"], ["mon", "sib", "land"], ["mon", "cas", "land"], ["mon", "ste", "land"], ["ste", "cas", "land"], ["cas", "sib", "land"], ["ste", "sib", "land"], ["sib", "man", "land"], ["sib", "awc", "sea"], ["sib", "jak", "sea"],
  ["mal", "png", "sea"], ["png", "aus", "sea"], ["mal", "aus", "sea"], ["cap", "aus", "sea"], ["mal", "ind", "sea"], ["mal", "sea", "sea"]
] as const;


const seaDisplayDefinitions: Record<string, SeaDisplayDefinition> = {
  water_awc_sib: { name: "Bering Sea", abbreviation: "BER", labelAnchor: { x: 98.2, y: 12.4 }, fleetAnchor: { x: 1.8, y: 12.4 }, priority: 2, region: "North Pacific", lanePath: { bend: -70, wrap: true } },
  water_car_ena: { name: "Western Atlantic", abbreviation: "WAT", labelAnchor: { x: 29.7, y: 30.8 }, fleetAnchor: { x: 29.2, y: 29.2 }, priority: 3, region: "Atlantic" },
  water_car_pan: { name: "Caribbean Sea", abbreviation: "CAR", labelAnchor: { x: 29.2, y: 42.6 }, fleetAnchor: { x: 29.2, y: 43.9 }, priority: 4, region: "Atlantic" },
  water_bra_car: { name: "South Atlantic", abbreviation: "SAT", labelAnchor: { x: 38.7, y: 56.8 }, fleetAnchor: { x: 37.1, y: 54.0 }, priority: 3, region: "Atlantic" },
  water_bri_sca: { name: "North Sea", abbreviation: "NTH", priority: 5, region: "Atlantic" },
  water_bri_weu: { name: "English Channel", abbreviation: "ENG", priority: 5, region: "Atlantic" },
  water_ibe_mag: { name: "Western Mediterranean", abbreviation: "WMS", priority: 4, region: "Mediterranean" },
  water_mag_egy: { name: "Eastern Mediterranean", abbreviation: "EMS", priority: 4, region: "Mediterranean" },
  water_ara_eaf: { name: "Red Sea", abbreviation: "RED", priority: 4, region: "Indian Ocean" },
  water_cap_aus: { name: "Indian Ocean", abbreviation: "INDO", labelAnchor: { x: 65.0, y: 83.4 }, fleetAnchor: { x: 65.0, y: 79.5 }, priority: 5, region: "Indian Ocean" },
  water_ind_mal: { name: "Andaman Sea", abbreviation: "AND", priority: 4, region: "Indian Ocean" },
  water_mal_sea: { name: "Malacca Strait", abbreviation: "MAL", priority: 5, region: "Indo-Pacific" },
  water_aus_mal: { name: "Timor Sea", abbreviation: "TIM", priority: 4, region: "Indo-Pacific" },
  water_mal_png: { name: "Banda Sea", abbreviation: "BAN", priority: 3, region: "Indo-Pacific" },
  water_aus_png: { name: "Coral Sea", abbreviation: "COR", priority: 3, region: "South Pacific" },
  water_man_jak: { name: "East China Sea", abbreviation: "ECS", priority: 4, region: "North Pacific" },
  water_jak_sib: { name: "North Pacific", abbreviation: "NPO", priority: 3, region: "North Pacific" }
};

const homeFactionByProvince = new Map<string, FactionId>();
for (const faction of FACTIONS) for (const home of faction.homes) homeFactionByProvince.set(home, faction.id);

function seaRouteId(a: string, b: string): string {
  return `water_${[a, b].sort().join("_")}`;
}

function routeMidpoint(a: Province, b: Province): { x: number; y: number } {
  const deltaX = Math.abs(a.x - b.x);
  const x = deltaX > 50 ? ((a.x + b.x + 100) / 2) % 100 : (a.x + b.x) / 2;
  return { x, y: (a.y + b.y) / 2 };
}

function addNeighbor(map: Record<string, Province>, a: string, b: string, seaRoute: boolean): void {
  if (!map[a] || !map[b]) throw new Error(`Unknown map connection: ${a} - ${b}`);
  if (!map[a].neighbors.includes(b)) map[a].neighbors.push(b);
  if (!map[b].neighbors.includes(a)) map[b].neighbors.push(a);
  if (seaRoute) {
    if (!map[a].seaNeighbors.includes(b)) map[a].seaNeighbors.push(b);
    if (!map[b].seaNeighbors.includes(a)) map[b].seaNeighbors.push(a);
  }
}

function createMap(): Record<string, Province> {
  const map = Object.fromEntries(provinceDefinitions.map(([id, name, x, y, kind]) => {
    const supplyCenter = kind === "home" || kind === "neutral" ? kind : null;
    return [id, { id, name, x, y, kind, supplyCenter, homeFactionId: homeFactionByProvince.get(id) ?? null, neighbors: [], seaNeighbors: [], seaDisplay: null }];
  })) as Record<string, Province>;
  const seaRoutes: { id: string; endpoints: [string, string] }[] = [];

  for (const [a, b, kind] of connectionDefinitions) {
    if (kind === "land") {
      addNeighbor(map, a, b, false);
      continue;
    }

    const id = seaRouteId(a, b);
    const midpoint = routeMidpoint(map[a], map[b]);
    const display = seaDisplayDefinitions[id];
    const fallbackName = `${map[a].name}–${map[b].name} Sea Route`;
    map[id] = {
      id,
      name: display?.name ?? fallbackName,
      x: midpoint.x,
      y: midpoint.y,
      kind: "sea",
      supplyCenter: null,
      homeFactionId: null,
      neighbors: [],
      seaNeighbors: [],
      seaDisplay: {
        name: display?.name ?? fallbackName.replace(/ Sea Route$/, " Sea"),
        abbreviation: display?.abbreviation ?? id.replace(/^water_/, "").toUpperCase(),
        labelAnchor: display?.labelAnchor ?? midpoint,
        fleetAnchor: display?.fleetAnchor ?? midpoint,
        lanePath: display?.lanePath ?? { bend: midpoint.y > 60 ? 34 : midpoint.y < 22 ? -28 : 24, wrap: Math.abs(map[a].x - map[b].x) > 50 },
        priority: display?.priority ?? 1,
        region: display?.region,
        endpoints: [a, b]
      }
    };
    addNeighbor(map, a, id, true);
    addNeighbor(map, id, b, true);
    seaRoutes.push({ id, endpoints: [a, b] });
  }

  for (let left = 0; left < seaRoutes.length; left += 1) {
    for (let right = left + 1; right < seaRoutes.length; right += 1) {
      if (seaRoutes[left].endpoints.some((endpoint) => seaRoutes[right].endpoints.includes(endpoint))) {
        addNeighbor(map, seaRoutes[left].id, seaRoutes[right].id, true);
      }
    }
  }

  for (const province of Object.values(map)) {
    province.neighbors.sort();
    province.seaNeighbors.sort();
  }
  return map;
}

export const PROVINCES = createMap();
export const LAND_PROVINCE_COUNT = provinceDefinitions.length;
export const SEA_PROVINCE_COUNT = connectionDefinitions.filter(([, , kind]) => kind === "sea").length;
export const VICTORY_SCORE = 10;

export interface StoredPlayer {
  id: string;
  name: string;
  token: string;
  role: PlayerRole;
  faction: FactionId | null;
  joinedAt: number;
  ai?: boolean;
}

export interface PublicPlayer {
  id: string;
  name: string;
  role: PlayerRole;
  faction: FactionId | null;
  joinedAt: number;
  ai?: boolean;
}

export interface Unit {
  id: string;
  ownerId: string;
  faction: FactionId;
  provinceId: string;
  type: UnitType;
}

export type MovementOrder =
  | { unitId: string; type: "hold" }
  | { unitId: string; type: "move"; destination: string; viaConvoy?: boolean }
  | { unitId: string; type: "support"; targetUnitId: string; destination?: string }
  | { unitId: string; type: "convoy"; targetUnitId: string; destination: string };

export type RetreatOrder =
  | { unitId: string; type: "retreat"; destination: string }
  | { unitId: string; type: "disband" };

export type AdjustmentOrder =
  | { type: "build"; provinceId: string; unitType: UnitType }
  | { type: "disband"; unitId: string }
  | { type: "waive" };

export type Order = MovementOrder | RetreatOrder | AdjustmentOrder;

export interface PendingRetreat {
  unitId: string;
  from: string;
  attackerFrom: string;
  destinations: string[];
}

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
  status: GameStatus;
  turn: number;
  year: number;
  season: Season;
  players: StoredPlayer[];
  units: Unit[];
  control: Record<string, string>;
  orders: Record<string, Order[]>;
  pendingRetreats: Record<string, PendingRetreat>;
  adjustmentNeeds: Record<string, number>;
  chats: ChatMessage[];
  activity: Activity[];
  winnerId: string | null;
}

export interface GameView {
  roomCode: string;
  hostPlayerId: string;
  status: Game["status"];
  turn: number;
  year: number;
  season: Season;
  players: PublicPlayer[];
  units: Unit[];
  control: Record<string, string>;
  ordersSubmitted: string[];
  ordersRequired: string[];
  pendingRetreats: Record<string, PendingRetreat>;
  adjustmentNeeds: Record<string, number>;
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

function isSeaProvince(provinceId: string): boolean {
  return PROVINCES[provinceId]?.kind === "sea";
}

function isLandProvince(provinceId: string): boolean {
  return !!PROVINCES[provinceId] && PROVINCES[provinceId].kind !== "sea";
}

export function isSupplyCenter(provinceId: string): boolean {
  return !!PROVINCES[provinceId]?.supplyCenter;
}

export function canProvinceHostUnit(provinceId: string, unitType: UnitType): boolean {
  const province = PROVINCES[provinceId];
  if (!province) return false;
  if (unitType === "army") return province.kind !== "sea";
  return province.kind === "sea" || province.neighbors.some((neighbor) => PROVINCES[neighbor]?.kind === "sea");
}

function hasSeaAccess(provinceId: string): boolean {
  return canProvinceHostUnit(provinceId, "fleet");
}

function canMoveDirect(unit: Pick<Unit, "provinceId" | "type">, destination: string): boolean {
  const origin = PROVINCES[unit.provinceId];
  const target = PROVINCES[destination];
  if (!origin || !target || !origin.neighbors.includes(destination)) return false;
  if (unit.type === "army") return origin.kind !== "sea" && target.kind !== "sea";
  return canProvinceHostUnit(destination, "fleet") && (origin.kind === "sea" || target.kind === "sea");
}

function canSupportProvince(unit: Pick<Unit, "provinceId" | "type">, destination: string): boolean {
  return canMoveDirect(unit, destination);
}

function activeUnitIds(game: Game): Set<string> {
  return new Set(game.units.filter((unit) => !game.pendingRetreats[unit.id]).map((unit) => unit.id));
}

function activeUnits(game: Game): Unit[] {
  const activeIds = activeUnitIds(game);
  return game.units.filter((unit) => activeIds.has(unit.id));
}

function occupiedActiveProvinces(game: Game): Set<string> {
  return new Set(activeUnits(game).map((unit) => unit.provinceId));
}

function unitAt(game: Game, provinceId: string): Unit | undefined {
  return activeUnits(game).find((unit) => unit.provinceId === provinceId);
}

function ownedSupplyCenters(game: Game, playerId: string): string[] {
  return Object.entries(game.control).filter(([provinceId, ownerId]) => ownerId === playerId && isSupplyCenter(provinceId)).map(([provinceId]) => provinceId);
}

export function publicView(game: Game, playerId: string): GameView {
  normalizeGame(game);
  const viewer = game.players.find((player) => player.id === playerId);
  const visiblePendingRetreats = Object.fromEntries(Object.entries(game.pendingRetreats).map(([unitId, retreat]) => {
    const unit = game.units.find((candidate) => candidate.id === retreat.unitId);
    const canSeeDestinations = viewer && isEnvoy(viewer) && unit?.ownerId === playerId;
    return [unitId, canSeeDestinations ? retreat : { ...retreat, destinations: [] }];
  }));
  return {
    roomCode: game.roomCode,
    hostPlayerId: game.hostPlayerId,
    status: game.status,
    turn: game.turn,
    year: game.year,
    season: game.season,
    players: game.players.map(({ token: _token, ...player }) => ({ ...player, role: playerRole(player) })),
    units: game.units,
    control: game.control,
    ordersSubmitted: Object.keys(game.orders),
    ordersRequired: requiredSubmitterIds(game),
    pendingRetreats: visiblePendingRetreats,
    adjustmentNeeds: game.adjustmentNeeds,
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

export function normalizeGame(game: Game): Game {
  const mutable = game as Game & {
    year?: number;
    season?: Season;
    pendingRetreats?: Record<string, PendingRetreat>;
    adjustmentNeeds?: Record<string, number>;
  };
  mutable.year = Number.isInteger(mutable.year) && mutable.year > 0 ? mutable.year : 1;
  mutable.season = mutable.season ?? (mutable.status === "adjustments" ? "winter" : "spring");
  mutable.pendingRetreats = mutable.pendingRetreats ?? {};
  mutable.adjustmentNeeds = mutable.adjustmentNeeds ?? {};
  mutable.orders = mutable.orders ?? {};
  mutable.control = Object.fromEntries(Object.entries(mutable.control ?? {}).filter(([provinceId]) => isSupplyCenter(provinceId)));
  mutable.players = mutable.players.map((player) => ({ ...player, role: playerRole(player) }));
  mutable.units = mutable.units.map((unit) => ({
    ...unit,
    type: unit.type === "fleet" ? "fleet" : "army"
  }));
  return mutable;
}

export function scoreFor(game: Game, playerId: string): number {
  normalizeGame(game);
  return ownedSupplyCenters(game, playerId).length;
}

export function createInitialUnits(game: Game): Unit[] {
  return game.players.flatMap((player) => {
    if (!player.faction || !isEnvoy(player)) return [];
    const faction = factionById(player.faction);
    if (!faction) return [];
    return faction.homes.map((provinceId, index) => ({
      id: `${player.id.slice(0, 8)}-${index + 1}`,
      ownerId: player.id,
      faction: player.faction as FactionId,
      provinceId,
      type: hasSeaAccess(provinceId) ? "fleet" : "army"
    }));
  });
}

export function createInitialControl(game: Game): Record<string, string> {
  const control: Record<string, string> = {};
  for (const player of game.players) {
    if (!player.faction || !isEnvoy(player)) continue;
    const faction = factionById(player.faction);
    if (!faction) continue;
    for (const provinceId of faction.homes) control[provinceId] = player.id;
  }
  return control;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMovementOrder(value: unknown): value is MovementOrder {
  if (!isRecord(value) || typeof value.unitId !== "string") return false;
  if (value.type === "hold") return true;
  if (value.type === "move") return typeof value.destination === "string" && (value.viaConvoy === undefined || typeof value.viaConvoy === "boolean");
  if (value.type === "support") return typeof value.targetUnitId === "string" && (value.destination === undefined || typeof value.destination === "string");
  if (value.type === "convoy") return typeof value.targetUnitId === "string" && typeof value.destination === "string";
  return false;
}

function isRetreatOrder(value: unknown): value is RetreatOrder {
  if (!isRecord(value) || typeof value.unitId !== "string") return false;
  return value.type === "disband" || (value.type === "retreat" && typeof value.destination === "string");
}

function isAdjustmentOrder(value: unknown): value is AdjustmentOrder {
  if (!isRecord(value) || typeof value.type !== "string") return false;
  if (value.type === "waive") return true;
  if (value.type === "build") return typeof value.provinceId === "string" && (value.unitType === "army" || value.unitType === "fleet");
  if (value.type === "disband") return typeof value.unitId === "string";
  return false;
}

function occupiedFleetSeaProvinces(game: Game): Set<string> {
  return new Set(activeUnits(game).filter((unit) => unit.type === "fleet" && isSeaProvince(unit.provinceId)).map((unit) => unit.provinceId));
}

function hasPotentialConvoyRoute(game: Game, army: Unit, destination: string): boolean {
  if (army.type !== "army" || !isLandProvince(army.provinceId) || !isLandProvince(destination) || army.provinceId === destination) return false;
  const fleetSeas = occupiedFleetSeaProvinces(game);
  const queue = PROVINCES[army.provinceId].neighbors.filter((neighbor) => fleetSeas.has(neighbor));
  const seen = new Set(queue);
  while (queue.length > 0) {
    const current = queue.shift() as string;
    if (PROVINCES[current].neighbors.includes(destination)) return true;
    for (const neighbor of PROVINCES[current].neighbors) {
      if (!fleetSeas.has(neighbor) || seen.has(neighbor)) continue;
      seen.add(neighbor);
      queue.push(neighbor);
    }
  }
  return false;
}

function seaCanParticipateInConvoy(game: Game, seaProvinceId: string, army: Unit, destination: string): boolean {
  if (!isSeaProvince(seaProvinceId) || army.type !== "army" || !isLandProvince(army.provinceId) || !isLandProvince(destination)) return false;
  const fleetSeas = occupiedFleetSeaProvinces(game);
  if (!fleetSeas.has(seaProvinceId)) return false;
  const queue = [seaProvinceId];
  const seen = new Set(queue);
  let reachesOrigin = PROVINCES[seaProvinceId].neighbors.includes(army.provinceId);
  let reachesDestination = PROVINCES[seaProvinceId].neighbors.includes(destination);
  while (queue.length > 0) {
    const current = queue.shift() as string;
    reachesOrigin ||= PROVINCES[current].neighbors.includes(army.provinceId);
    reachesDestination ||= PROVINCES[current].neighbors.includes(destination);
    if (reachesOrigin && reachesDestination) return true;
    for (const neighbor of PROVINCES[current].neighbors) {
      if (!fleetSeas.has(neighbor) || seen.has(neighbor)) continue;
      seen.add(neighbor);
      queue.push(neighbor);
    }
  }
  return false;
}

function validateMovementOrders(game: Game, playerId: string, submitted: unknown[]): MovementOrder[] {
  const ownedUnits = activeUnits(game).filter((unit) => unit.ownerId === playerId);
  if (submitted.length > ownedUnits.length) throw new Error("Orders must include at most one order per active unit.");
  const ownedIds = new Set(ownedUnits.map((unit) => unit.id));
  const activeById = new Map(activeUnits(game).map((unit) => [unit.id, unit]));
  const seen = new Set<string>();
  const orders: MovementOrder[] = [];

  for (const rawOrder of submitted) {
    if (!isMovementOrder(rawOrder) || !ownedIds.has(rawOrder.unitId) || seen.has(rawOrder.unitId)) {
      throw new Error("One or more orders are invalid.");
    }
    seen.add(rawOrder.unitId);
    const unit = activeById.get(rawOrder.unitId);
    if (!unit) throw new Error("Unknown unit.");

    if (rawOrder.type === "move") {
      if (!PROVINCES[rawOrder.destination]) throw new Error("Unknown destination.");
      const direct = canMoveDirect(unit, rawOrder.destination);
      const convoy = unit.type === "army" && hasPotentialConvoyRoute(game, unit, rawOrder.destination);
      if ((!direct && !convoy) || (rawOrder.viaConvoy && !convoy)) throw new Error("That unit cannot move to the requested province.");
      orders.push({ unitId: rawOrder.unitId, type: "move", destination: rawOrder.destination, ...(rawOrder.viaConvoy ? { viaConvoy: true } : {}) });
    } else if (rawOrder.type === "support") {
      const target = activeById.get(rawOrder.targetUnitId);
      if (!target || target.id === unit.id) throw new Error("Support orders must name another active unit.");
      const destination = rawOrder.destination ?? target.provinceId;
      if (!PROVINCES[destination] || !canSupportProvince(unit, destination)) throw new Error("Supporters must be able to reach the supported province.");
      if (rawOrder.destination) {
        const targetCanMove = canMoveDirect(target, destination) || (target.type === "army" && hasPotentialConvoyRoute(game, target, destination));
        if (!targetCanMove) throw new Error("Support-move orders must name a legal target move.");
      }
      orders.push(rawOrder.destination ? { unitId: unit.id, type: "support", targetUnitId: target.id, destination } : { unitId: unit.id, type: "support", targetUnitId: target.id });
    } else if (rawOrder.type === "convoy") {
      const target = activeById.get(rawOrder.targetUnitId);
      if (unit.type !== "fleet" || !isSeaProvince(unit.provinceId) || !target || target.type !== "army" || !PROVINCES[rawOrder.destination]) {
        throw new Error("Convoy orders require a fleet at sea and an active army target.");
      }
      if (!seaCanParticipateInConvoy(game, unit.provinceId, target, rawOrder.destination)) throw new Error("That fleet is not on a possible convoy route.");
      orders.push({ unitId: unit.id, type: "convoy", targetUnitId: target.id, destination: rawOrder.destination });
    } else {
      orders.push({ unitId: unit.id, type: "hold" });
    }
  }

  for (const unit of ownedUnits) {
    if (!seen.has(unit.id)) orders.push({ unitId: unit.id, type: "hold" });
  }
  return orders;
}

function validateRetreatOrders(game: Game, playerId: string, submitted: unknown[]): RetreatOrder[] {
  const pendingForPlayer = Object.values(game.pendingRetreats).filter((retreat) => game.units.find((unit) => unit.id === retreat.unitId)?.ownerId === playerId);
  if (submitted.length > pendingForPlayer.length) throw new Error("Orders must include at most one order per retreating unit.");
  const pendingById = new Map(pendingForPlayer.map((retreat) => [retreat.unitId, retreat]));
  const seen = new Set<string>();
  const orders: RetreatOrder[] = [];

  for (const rawOrder of submitted) {
    if (!isRetreatOrder(rawOrder) || !pendingById.has(rawOrder.unitId) || seen.has(rawOrder.unitId)) throw new Error("One or more retreat orders are invalid.");
    seen.add(rawOrder.unitId);
    const pending = pendingById.get(rawOrder.unitId) as PendingRetreat;
    if (rawOrder.type === "retreat") {
      if (!pending.destinations.includes(rawOrder.destination)) throw new Error("That unit cannot retreat to the requested province.");
      orders.push({ unitId: rawOrder.unitId, type: "retreat", destination: rawOrder.destination });
    } else {
      orders.push({ unitId: rawOrder.unitId, type: "disband" });
    }
  }

  for (const pending of pendingForPlayer) {
    if (!seen.has(pending.unitId)) orders.push({ unitId: pending.unitId, type: "disband" });
  }
  return orders;
}

function buildOptionsFor(game: Game, player: StoredPlayer): { provinceId: string; unitType: UnitType }[] {
  if (!player.faction) return [];
  const occupied = occupiedActiveProvinces(game);
  return Object.values(PROVINCES)
    .filter((province) => province.supplyCenter === "home" && province.homeFactionId === player.faction && game.control[province.id] === player.id && !occupied.has(province.id))
    .flatMap((province) => ([
      { provinceId: province.id, unitType: "army" as const },
      ...(canProvinceHostUnit(province.id, "fleet") ? [{ provinceId: province.id, unitType: "fleet" as const }] : [])
    ]));
}

function validateAdjustmentOrders(game: Game, playerId: string, submitted: unknown[]): AdjustmentOrder[] {
  const player = game.players.find((candidate) => candidate.id === playerId);
  if (!player) throw new Error("Unknown player.");
  const need = game.adjustmentNeeds[playerId] ?? 0;
  if (need === 0) {
    if (submitted.length > 0) throw new Error("This player has no winter adjustment.");
    return [];
  }

  if (need > 0) {
    if (submitted.length > need) throw new Error("Too many build orders.");
    const legalOptions = new Set(buildOptionsFor(game, player).map((option) => `${option.provinceId}:${option.unitType}`));
    const seenBuilds = new Set<string>();
    const orders: AdjustmentOrder[] = [];
    for (const rawOrder of submitted) {
      if (!isAdjustmentOrder(rawOrder) || (rawOrder.type !== "build" && rawOrder.type !== "waive")) throw new Error("Build adjustments must be builds or waives.");
      if (rawOrder.type === "waive") {
        orders.push({ type: "waive" });
        continue;
      }
      const key = `${rawOrder.provinceId}:${rawOrder.unitType}`;
      if (!legalOptions.has(key) || seenBuilds.has(rawOrder.provinceId)) throw new Error("One or more build orders are invalid.");
      seenBuilds.add(rawOrder.provinceId);
      orders.push({ type: "build", provinceId: rawOrder.provinceId, unitType: rawOrder.unitType });
    }
    while (orders.length < need) orders.push({ type: "waive" });
    return orders;
  }

  const deficit = Math.abs(need);
  if (submitted.length !== deficit) throw new Error(`You must disband ${deficit} unit${deficit === 1 ? "" : "s"}.`);
  const ownedIds = new Set(activeUnits(game).filter((unit) => unit.ownerId === playerId).map((unit) => unit.id));
  const seen = new Set<string>();
  const orders: AdjustmentOrder[] = [];
  for (const rawOrder of submitted) {
    if (!isAdjustmentOrder(rawOrder) || rawOrder.type !== "disband" || !ownedIds.has(rawOrder.unitId) || seen.has(rawOrder.unitId)) {
      throw new Error("One or more disband orders are invalid.");
    }
    seen.add(rawOrder.unitId);
    orders.push({ type: "disband", unitId: rawOrder.unitId });
  }
  return orders;
}

export function validateOrders(game: Game, playerId: string, submitted: unknown): Order[] {
  normalizeGame(game);
  if (!Array.isArray(submitted)) throw new Error("Orders must be an array of valid orders.");
  if (game.status === "orders") return validateMovementOrders(game, playerId, submitted);
  if (game.status === "retreats") return validateRetreatOrders(game, playerId, submitted);
  if (game.status === "adjustments") return validateAdjustmentOrders(game, playerId, submitted);
  throw new Error("The council is not accepting orders.");
}

export function requiredSubmitterIds(game: Game): string[] {
  normalizeGame(game);
  if (game.status === "orders") return game.players.filter(isEnvoy).map((player) => player.id);
  if (game.status === "retreats") {
    const ids = new Set<string>();
    for (const pending of Object.values(game.pendingRetreats)) {
      const unit = game.units.find((candidate) => candidate.id === pending.unitId);
      if (unit) ids.add(unit.ownerId);
    }
    return [...ids];
  }
  if (game.status === "adjustments") return Object.entries(game.adjustmentNeeds).filter(([, need]) => need !== 0).map(([playerId]) => playerId);
  return [];
}

interface MoveIntent {
  unit: Unit;
  origin: string;
  destination: string;
  convoyed: boolean;
}

interface SupportCandidate {
  supporterId: string;
  targetUnitId: string;
  destination: string;
  cutExceptionOrigin: string;
  moveSupport: boolean;
}

interface MovementAdjudication {
  success: Set<string>;
  dislodged: Map<string, { attackerId: string; attackerFrom: string }>;
  standoffs: Set<string>;
  convoyRoutesByUnit: Map<string, string[][]>;
}

function movementOrdersByUnit(game: Game): Map<string, MovementOrder> {
  const orders = new Map<string, MovementOrder>();
  for (const unit of activeUnits(game)) {
    const submitted = game.orders[unit.ownerId]?.find((order): order is MovementOrder => isMovementOrder(order) && order.unitId === unit.id);
    orders.set(unit.id, submitted ?? { unitId: unit.id, type: "hold" });
  }
  return orders;
}

function convoyFleetOrders(game: Game, orders: Map<string, MovementOrder>, targetUnitId: string, destination: string): Map<string, Unit> {
  const fleets = new Map<string, Unit>();
  for (const unit of activeUnits(game)) {
    const order = orders.get(unit.id);
    if (unit.type === "fleet" && isSeaProvince(unit.provinceId) && order?.type === "convoy" && order.targetUnitId === targetUnitId && order.destination === destination) {
      fleets.set(unit.provinceId, unit);
    }
  }
  return fleets;
}

function findConvoyRoutes(game: Game, army: Unit, destination: string, orders: Map<string, MovementOrder>): string[][] {
  if (army.type !== "army" || !isLandProvince(army.provinceId) || !isLandProvince(destination) || army.provinceId === destination) return [];
  const fleetsBySea = convoyFleetOrders(game, orders, army.id, destination);
  const starts = PROVINCES[army.provinceId].neighbors.filter((neighbor) => fleetsBySea.has(neighbor));
  const routes: string[][] = [];

  const search = (seaProvinceId: string, seen: Set<string>, fleetIds: string[]): void => {
    if (PROVINCES[seaProvinceId].neighbors.includes(destination)) routes.push(fleetIds);
    if (routes.length >= 48) return;
    for (const neighbor of PROVINCES[seaProvinceId].neighbors) {
      if (!isSeaProvince(neighbor) || seen.has(neighbor) || !fleetsBySea.has(neighbor)) continue;
      search(neighbor, new Set([...seen, neighbor]), [...fleetIds, (fleetsBySea.get(neighbor) as Unit).id]);
    }
  };

  for (const start of starts) {
    const fleet = fleetsBySea.get(start) as Unit;
    search(start, new Set([start]), [fleet.id]);
  }
  return routes;
}

function buildMoveIntents(game: Game, orders: Map<string, MovementOrder>, invalidConvoys: Set<string>): { intents: Map<string, MoveIntent>; convoyRoutesByUnit: Map<string, string[][]> } {
  const intents = new Map<string, MoveIntent>();
  const convoyRoutesByUnit = new Map<string, string[][]>();

  for (const unit of activeUnits(game)) {
    const order = orders.get(unit.id);
    if (order?.type !== "move" || !PROVINCES[order.destination]) continue;
    const direct = canMoveDirect(unit, order.destination);
    let convoyed = false;
    if (unit.type === "army" && isLandProvince(unit.provinceId) && isLandProvince(order.destination) && (order.viaConvoy || !direct)) {
      const routes = findConvoyRoutes(game, unit, order.destination, orders);
      convoyRoutesByUnit.set(unit.id, routes);
      if (!invalidConvoys.has(unit.id) && routes.length > 0) convoyed = true;
      else if (order.viaConvoy || !direct) continue;
    }
    if (!direct && !convoyed) continue;
    intents.set(unit.id, { unit, origin: unit.provinceId, destination: order.destination, convoyed });
  }

  return { intents, convoyRoutesByUnit };
}

function buildSupportCandidates(game: Game, orders: Map<string, MovementOrder>, intents: Map<string, MoveIntent>): SupportCandidate[] {
  const units = new Map(activeUnits(game).map((unit) => [unit.id, unit]));
  const candidates: SupportCandidate[] = [];
  for (const supporter of activeUnits(game)) {
    const order = orders.get(supporter.id);
    if (order?.type !== "support") continue;
    const target = units.get(order.targetUnitId);
    if (!target || target.id === supporter.id) continue;
    const destination = order.destination ?? target.provinceId;
    if (!PROVINCES[destination] || !canSupportProvince(supporter, destination)) continue;
    if (order.destination) {
      const targetIntent = intents.get(target.id);
      if (!targetIntent || targetIntent.destination !== destination) continue;
      candidates.push({ supporterId: supporter.id, targetUnitId: target.id, destination, cutExceptionOrigin: destination, moveSupport: true });
    } else if (!intents.has(target.id)) {
      candidates.push({ supporterId: supporter.id, targetUnitId: target.id, destination: target.provinceId, cutExceptionOrigin: target.provinceId, moveSupport: false });
    }
  }
  return candidates;
}

function resolveWithSupportCuts(game: Game, orders: Map<string, MovementOrder>, intents: Map<string, MoveIntent>, forcedCutSupporters: Set<string>): Omit<MovementAdjudication, "convoyRoutesByUnit"> & { supportCandidates: SupportCandidate[] } {
  const occupants = new Map(activeUnits(game).map((unit) => [unit.provinceId, unit]));
  const supportCandidates = buildSupportCandidates(game, orders, intents);
  const cutSupporters = new Set(forcedCutSupporters);

  for (const support of supportCandidates) {
    const supporter = game.units.find((unit) => unit.id === support.supporterId);
    if (!supporter) continue;
    for (const attack of intents.values()) {
      if (attack.destination !== supporter.provinceId) continue;
      if (attack.unit.ownerId === supporter.ownerId) continue;
      if (attack.origin === support.cutExceptionOrigin) continue;
      cutSupporters.add(support.supporterId);
    }
  }

  const attackSupport = new Map<string, number>();
  const holdSupport = new Map<string, number>();
  for (const support of supportCandidates) {
    if (cutSupporters.has(support.supporterId)) continue;
    const target = support.moveSupport ? attackSupport : holdSupport;
    target.set(support.targetUnitId, (target.get(support.targetUnitId) ?? 0) + 1);
  }

  const attackStrength = (unitId: string): number => 1 + (attackSupport.get(unitId) ?? 0);
  const defenseStrength = (unitId: string): number => 1 + (intents.has(unitId) ? 0 : (holdSupport.get(unitId) ?? 0));
  const attacksByDestination = new Map<string, MoveIntent[]>();
  for (const intent of intents.values()) {
    const attacks = attacksByDestination.get(intent.destination) ?? [];
    attacks.push(intent);
    attacksByDestination.set(intent.destination, attacks);
  }

  const forcedFailures = new Set<string>();
  const checkedHeadToHead = new Set<string>();
  for (const intent of intents.values()) {
    const targetOccupant = occupants.get(intent.destination);
    const opposingIntent = targetOccupant ? intents.get(targetOccupant.id) : undefined;
    if (!opposingIntent || opposingIntent.destination !== intent.origin || intent.convoyed || opposingIntent.convoyed) continue;
    const key = [intent.unit.id, opposingIntent.unit.id].sort().join(":");
    if (checkedHeadToHead.has(key)) continue;
    checkedHeadToHead.add(key);

    if (intent.unit.ownerId === opposingIntent.unit.ownerId) {
      forcedFailures.add(intent.unit.id);
      forcedFailures.add(opposingIntent.unit.id);
      continue;
    }

    const leftStrength = attackStrength(intent.unit.id);
    const rightStrength = attackStrength(opposingIntent.unit.id);
    if (leftStrength === rightStrength) {
      forcedFailures.add(intent.unit.id);
      forcedFailures.add(opposingIntent.unit.id);
    } else if (leftStrength > rightStrength) {
      forcedFailures.add(opposingIntent.unit.id);
    } else {
      forcedFailures.add(intent.unit.id);
    }
  }

  const success = new Set<string>();
  const standoffs = new Set<string>();
  for (const [destination, attacks] of attacksByDestination) {
    const strongest = Math.max(...attacks.map((attack) => attackStrength(attack.unit.id)));
    const strongestAttacks = attacks.filter((attack) => attackStrength(attack.unit.id) === strongest);
    if (strongestAttacks.length !== 1) {
      standoffs.add(destination);
      continue;
    }
    const winner = strongestAttacks[0];
    if (!forcedFailures.has(winner.unit.id)) success.add(winner.unit.id);
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const unitId of [...success]) {
      const intent = intents.get(unitId) as MoveIntent;
      const occupant = occupants.get(intent.destination);
      if (!occupant) continue;
      const occupantIntent = intents.get(occupant.id);
      const directHeadToHead = occupantIntent?.destination === intent.origin && !intent.convoyed && !occupantIntent.convoyed;
      const occupantVacates = !!occupantIntent && success.has(occupant.id) && !directHeadToHead;
      if (occupantVacates) continue;
      if (occupant.ownerId === intent.unit.ownerId || attackStrength(unitId) <= defenseStrength(occupant.id)) {
        success.delete(unitId);
        changed = true;
      }
    }
  }

  const dislodged = new Map<string, { attackerId: string; attackerFrom: string }>();
  for (const unitId of success) {
    const intent = intents.get(unitId) as MoveIntent;
    const occupant = occupants.get(intent.destination);
    if (!occupant || success.has(occupant.id) || occupant.ownerId === intent.unit.ownerId) continue;
    dislodged.set(occupant.id, { attackerId: intent.unit.id, attackerFrom: intent.origin });
  }

  return { success, dislodged, standoffs, supportCandidates };
}

function adjudicateMovement(game: Game, invalidConvoys: Set<string>): MovementAdjudication {
  const orders = movementOrdersByUnit(game);
  const { intents, convoyRoutesByUnit } = buildMoveIntents(game, orders, invalidConvoys);
  let forcedCutSupporters = new Set<string>();
  let resolved = resolveWithSupportCuts(game, orders, intents, forcedCutSupporters);

  for (let iteration = 0; iteration < 8; iteration += 1) {
    const nextForcedCuts = new Set(forcedCutSupporters);
    for (const support of resolved.supportCandidates) {
      if (resolved.dislodged.has(support.supporterId)) nextForcedCuts.add(support.supporterId);
    }
    if (nextForcedCuts.size === forcedCutSupporters.size) break;
    forcedCutSupporters = nextForcedCuts;
    resolved = resolveWithSupportCuts(game, orders, intents, forcedCutSupporters);
  }

  return {
    success: resolved.success,
    dislodged: resolved.dislodged,
    standoffs: resolved.standoffs,
    convoyRoutesByUnit
  };
}

function finalMovementAdjudication(game: Game): MovementAdjudication {
  let invalidConvoys = new Set<string>();
  let adjudication = adjudicateMovement(game, invalidConvoys);

  for (let iteration = 0; iteration < 8; iteration += 1) {
    const nextInvalid = new Set(invalidConvoys);
    for (const [unitId, routes] of adjudication.convoyRoutesByUnit) {
      if (routes.length === 0 || invalidConvoys.has(unitId)) continue;
      const routeSurvives = routes.some((route) => route.every((fleetId) => !adjudication.dislodged.has(fleetId)));
      if (!routeSurvives) nextInvalid.add(unitId);
    }
    if (nextInvalid.size === invalidConvoys.size) return adjudication;
    invalidConvoys = nextInvalid;
    adjudication = adjudicateMovement(game, invalidConvoys);
  }
  return adjudication;
}

function retreatDestinations(game: Game, unit: Unit, attackerFrom: string, standoffs: Set<string>): string[] {
  const occupied = occupiedActiveProvinces(game);
  return PROVINCES[unit.provinceId].neighbors
    .filter((provinceId) => provinceId !== attackerFrom)
    .filter((provinceId) => !occupied.has(provinceId) && !standoffs.has(provinceId))
    .filter((provinceId) => canMoveDirect(unit, provinceId));
}

function updateSupplyCenterOwnership(game: Game): void {
  for (const unit of activeUnits(game)) {
    if (isSupplyCenter(unit.provinceId)) game.control[unit.provinceId] = unit.ownerId;
  }
  game.control = Object.fromEntries(Object.entries(game.control).filter(([provinceId]) => isSupplyCenter(provinceId)));
}

function winner(game: Game): StoredPlayer | undefined {
  return game.players.find((player) => scoreFor(game, player.id) >= VICTORY_SCORE);
}

function calculateAdjustmentNeeds(game: Game): Record<string, number> {
  const needs: Record<string, number> = {};
  for (const player of game.players.filter(isEnvoy)) {
    const centerCount = scoreFor(game, player.id);
    const unitCount = activeUnits(game).filter((unit) => unit.ownerId === player.id).length;
    const delta = centerCount - unitCount;
    if (delta !== 0) needs[player.id] = delta;
  }
  return needs;
}

function pushActivity(game: Game, id: () => string, text: string): void {
  game.activity.unshift({ id: id(), text, createdAt: Date.now() });
  game.activity = game.activity.slice(0, 8);
}

function beginNextSeason(game: Game, id: () => string): void {
  if (game.season === "spring") {
    game.season = "fall";
    game.status = "orders";
    pushActivity(game, id, `Spring ${game.year} is complete. Fall orders are open.`);
    return;
  }

  updateSupplyCenterOwnership(game);
  const victor = winner(game);
  if (victor) {
    game.status = "finished";
    game.winnerId = victor.id;
    pushActivity(game, id, `${victor.name} controls ${VICTORY_SCORE} supply centers and wins the council.`);
    return;
  }

  game.adjustmentNeeds = calculateAdjustmentNeeds(game);
  if (Object.keys(game.adjustmentNeeds).length > 0) {
    game.status = "adjustments";
    game.season = "winter";
    pushActivity(game, id, `Fall ${game.year} is complete. Winter adjustments are due.`);
  } else {
    game.year += 1;
    game.season = "spring";
    game.status = "orders";
    pushActivity(game, id, `Fall ${game.year - 1} is complete. Spring ${game.year} orders are open.`);
  }
}

function resolveMovementPhase(game: Game, id: () => string): void {
  const adjudication = finalMovementAdjudication(game);
  const originalProvinces = new Map(game.units.map((unit) => [unit.id, unit.provinceId]));
  const movementOrders = movementOrdersByUnit(game);

  for (const unit of game.units) {
    const order = movementOrders.get(unit.id);
    if (order?.type === "move" && adjudication.success.has(unit.id)) unit.provinceId = order.destination;
  }

  const nextPending: Record<string, PendingRetreat> = {};
  const autoDisbanded = new Set<string>();
  for (const [unitId, dislodgement] of adjudication.dislodged) {
    const unit = game.units.find((candidate) => candidate.id === unitId);
    const from = originalProvinces.get(unitId);
    if (!unit || !from) continue;
    unit.provinceId = from;
    const destinations = retreatDestinations(game, unit, dislodgement.attackerFrom, adjudication.standoffs);
    if (destinations.length === 0) {
      autoDisbanded.add(unit.id);
    } else {
      nextPending[unit.id] = { unitId: unit.id, from, attackerFrom: dislodgement.attackerFrom, destinations };
    }
  }
  if (autoDisbanded.size > 0) game.units = game.units.filter((unit) => !autoDisbanded.has(unit.id));

  const successfulMoves = adjudication.success.size;
  game.pendingRetreats = nextPending;
  game.orders = {};
  game.turn += 1;

  if (Object.keys(game.pendingRetreats).length > 0) {
    game.status = "retreats";
    pushActivity(game, id, `${game.season[0].toUpperCase()}${game.season.slice(1)} ${game.year} orders resolved: ${successfulMoves} move${successfulMoves === 1 ? "" : "s"} succeeded; retreats are due.`);
  } else {
    pushActivity(game, id, `${game.season[0].toUpperCase()}${game.season.slice(1)} ${game.year} orders resolved: ${successfulMoves} move${successfulMoves === 1 ? "" : "s"} succeeded.`);
    beginNextSeason(game, id);
  }
}

function resolveRetreatPhase(game: Game, id: () => string): void {
  const retreatOrders = new Map<string, RetreatOrder>();
  for (const orders of Object.values(game.orders)) {
    for (const order of orders) if (isRetreatOrder(order)) retreatOrders.set(order.unitId, order);
  }

  const destinations = new Map<string, string[]>();
  const disbanded = new Set<string>();
  for (const pending of Object.values(game.pendingRetreats)) {
    const order = retreatOrders.get(pending.unitId) ?? { unitId: pending.unitId, type: "disband" as const };
    if (order.type === "disband") {
      disbanded.add(pending.unitId);
      continue;
    }
    const contenders = destinations.get(order.destination) ?? [];
    contenders.push(pending.unitId);
    destinations.set(order.destination, contenders);
  }

  for (const [destination, unitIds] of destinations) {
    if (unitIds.length !== 1) {
      for (const unitId of unitIds) disbanded.add(unitId);
      continue;
    }
    const unit = game.units.find((candidate) => candidate.id === unitIds[0]);
    if (unit) unit.provinceId = destination;
  }

  game.units = game.units.filter((unit) => !disbanded.has(unit.id));
  const disbandCount = disbanded.size;
  game.pendingRetreats = {};
  game.orders = {};
  game.turn += 1;
  pushActivity(game, id, `Retreats resolved: ${disbandCount} unit${disbandCount === 1 ? "" : "s"} disbanded.`);
  beginNextSeason(game, id);
}

function resolveAdjustmentPhase(game: Game, id: () => string): void {
  const builds: AdjustmentOrder[] = [];
  const disbands = new Set<string>();
  for (const orders of Object.values(game.orders)) {
    for (const order of orders) {
      if (!isAdjustmentOrder(order)) continue;
      if (order.type === "build") builds.push(order);
      else if (order.type === "disband") disbands.add(order.unitId);
    }
  }

  game.units = game.units.filter((unit) => !disbands.has(unit.id));
  let buildCount = 0;
  for (const build of builds) {
    if (build.type !== "build") continue;
    const ownerId = game.control[build.provinceId];
    const player = game.players.find((candidate) => candidate.id === ownerId);
    if (!player?.faction) continue;
    if (unitAt(game, build.provinceId)) continue;
    game.units.push({
      id: id(),
      ownerId,
      faction: player.faction,
      provinceId: build.provinceId,
      type: build.unitType
    });
    buildCount += 1;
  }

  const disbandCount = disbands.size;
  game.adjustmentNeeds = {};
  game.orders = {};
  game.year += 1;
  game.season = "spring";
  game.status = "orders";
  game.turn += 1;
  pushActivity(game, id, `Winter adjustments resolved: ${buildCount} build${buildCount === 1 ? "" : "s"} and ${disbandCount} disband${disbandCount === 1 ? "" : "s"}. Spring ${game.year} orders are open.`);
}

export function resolveTurn(game: Game, id: () => string): void {
  normalizeGame(game);
  if (game.status === "orders") resolveMovementPhase(game, id);
  else if (game.status === "retreats") resolveRetreatPhase(game, id);
  else if (game.status === "adjustments") resolveAdjustmentPhase(game, id);
}
