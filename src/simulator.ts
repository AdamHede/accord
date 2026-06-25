import {
  canProvinceHostUnit,
  createInitialControl,
  createInitialUnits,
  FACTIONS,
  type FactionId,
  type Game,
  type Order,
  PROVINCES,
  requiredSubmitterIds,
  resolveTurn,
  scoreFor,
  type StoredPlayer,
  type Unit
} from "./engine.js";

/** The intentionally small set of policies used for balance simulations. */
export const STRATEGIES = ["random", "expansionist", "cautious"] as const;
export type StrategyName = (typeof STRATEGIES)[number];

export const STRATEGY_DESCRIPTIONS: Record<StrategyName, string> = {
  random: "Usually moves to a random unoccupied neighboring province.",
  expansionist: "Usually advances toward neighboring provinces it does not already control.",
  cautious: "Moves selectively to safer neutral neighboring provinces."
};

export interface SimulationOptions {
  /** Number of independent games to play. Defaults to 1,000. */
  games?: number;
  /** Stop an unresolved game after this many turns. Defaults to 500. */
  maxTurns?: number;
  /** Number of factions in each game, between 2 and the faction count. Defaults to all factions. */
  playerCount?: number;
  /** Strategies sampled independently for each player, with replacement. */
  strategies?: readonly StrategyName[];
  /** Seed for the deterministic pseudo-random number generator. */
  seed?: string | number;
}

export interface ResolvedSimulationOptions {
  games: number;
  maxTurns: number;
  playerCount: number;
  strategies: StrategyName[];
  seed: string;
}

export interface StrategyStats {
  appearances: number;
  wins: number;
  winRate: number;
  averageFinalScore: number;
}

export interface FactionStats {
  appearances: number;
  wins: number;
  winRate: number;
  averageFinalScore: number;
}

export interface LineupStats {
  games: number;
  wins: number;
  draws: number;
}

export interface SimulationReport {
  options: ResolvedSimulationOptions;
  completedGames: number;
  wins: number;
  draws: number;
  averageTurns: number;
  elapsedMs: number;
  /** Null when the run completed in under one millisecond and speed cannot be measured. */
  gamesPerSecond: number | null;
  strategies: Record<StrategyName, StrategyStats>;
  factions: Record<FactionId, FactionStats>;
  lineups: Record<string, LineupStats>;
}

export interface SimulatedGame {
  game: Game;
  strategiesByPlayerId: Record<string, StrategyName>;
}

type Random = () => number;

interface MutableStats {
  appearances: number;
  wins: number;
  totalFinalScore: number;
}

const DEFAULT_SEED = "accord-balance";
const MOVE_PROBABILITY: Record<StrategyName, number> = {
  random: 0.65,
  expansionist: 0.85,
  cautious: 0.5
};

function integerOption(name: string, value: number | undefined, fallback: number, minimum: number, maximum: number): number {
  const resolved = value ?? fallback;
  if (!Number.isInteger(resolved) || resolved < minimum || resolved > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
  return resolved;
}

export function resolveSimulationOptions(options: SimulationOptions = {}): ResolvedSimulationOptions {
  const strategies = [...(options.strategies ?? STRATEGIES)];
  if (strategies.length === 0 || strategies.some((strategy) => !STRATEGIES.includes(strategy))) {
    throw new Error(`strategies must include one or more of: ${STRATEGIES.join(", ")}.`);
  }

  return {
    games: integerOption("games", options.games, 1_000, 1, 1_000_000),
    maxTurns: integerOption("maxTurns", options.maxTurns, 500, 1, 10_000),
    playerCount: integerOption("playerCount", options.playerCount, FACTIONS.length, 2, FACTIONS.length),
    strategies,
    seed: String(options.seed ?? DEFAULT_SEED)
  };
}

/**
 * A seeded generator makes a balance result reproducible from its CLI command.
 * It is deliberately not used by the live game, which still uses crypto randomness.
 */
export function createSeededRandom(seed: string | number): Random {
  let state = 2166136261;
  for (const character of String(seed)) {
    state ^= character.charCodeAt(0);
    state = Math.imul(state, 16777619);
  }

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function choose<T>(items: readonly T[], random: Random): T {
  return items[Math.floor(random() * items.length)];
}

function shuffled<T>(items: readonly T[], random: Random): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

/** Create one fresh game with randomized factions and independently sampled strategies. */
export function spawnSimulationGame(options: ResolvedSimulationOptions, random: Random): SimulatedGame {
  const factions = shuffled(FACTIONS, random).slice(0, options.playerCount);
  const players: StoredPlayer[] = factions.map((faction, index) => ({
    // createInitialUnits uses the first eight ID characters to construct unit
    // IDs, so that prefix must be unique for every simulated player.
    id: `sim-${String(index + 1).padStart(4, "0")}`,
    name: `Simulator ${index + 1}`,
    token: `simulation-token-${index + 1}`,
    role: "envoy",
    faction: faction.id,
    joinedAt: 0
  }));
  const game: Game = {
    roomCode: "SIMUL8",
    hostPlayerId: players[0].id,
    status: "orders",
    turn: 1,
    year: 1,
    season: "spring",
    players,
    units: [],
    control: {},
    orders: {},
    pendingRetreats: {},
    adjustmentNeeds: {},
    chats: [],
    activity: [],
    winnerId: null
  };
  game.units = createInitialUnits(game);
  game.control = createInitialControl(game);

  return {
    game,
    strategiesByPlayerId: Object.fromEntries(players.map((player) => [player.id, choose(options.strategies, random)]))
  };
}

function canMoveDirect(unit: Unit, destination: string): boolean {
  const origin = PROVINCES[unit.provinceId];
  const target = PROVINCES[destination];
  if (!origin || !target || !origin.neighbors.includes(destination)) return false;
  if (unit.type === "army") return origin.kind !== "sea" && target.kind !== "sea";
  return canProvinceHostUnit(destination, "fleet") && (origin.kind === "sea" || target.kind === "sea");
}

function availableDestinations(game: Game, unit: Unit, reservedDestinations: Set<string>): string[] {
  const occupied = new Set(game.units.map((candidate) => candidate.provinceId));
  return PROVINCES[unit.provinceId].neighbors.filter((provinceId) => canMoveDirect(unit, provinceId) && !occupied.has(provinceId) && !reservedDestinations.has(provinceId));
}

function enemyUnitNeighbors(game: Game, provinceId: string, ownerId: string): number {
  const neighboringProvinces = new Set(PROVINCES[provinceId].neighbors);
  return game.units.filter((unit) => unit.ownerId !== ownerId && neighboringProvinces.has(unit.provinceId)).length;
}

function chooseExpansionDestination(game: Game, ownerId: string, destinations: string[], random: Random): string {
  const value = (provinceId: string): number => {
    const controller = game.control[provinceId];
    if (!controller) return 2;
    return controller === ownerId ? 0 : 1;
  };
  const bestValue = Math.max(...destinations.map(value));
  return choose(destinations.filter((destination) => value(destination) === bestValue), random);
}

function chooseCautiousDestination(game: Game, ownerId: string, destinations: string[], random: Random): string | null {
  const neutral = destinations.filter((destination) => !game.control[destination]);
  if (neutral.length === 0) return null;
  const lowestThreat = Math.min(...neutral.map((destination) => enemyUnitNeighbors(game, destination, ownerId)));
  return choose(neutral.filter((destination) => enemyUnitNeighbors(game, destination, ownerId) === lowestThreat), random);
}

function chooseMovementOrders(game: Game, playerId: string, strategy: StrategyName, random: Random): Order[] {
  const reservedDestinations = new Set<string>();
  const orders: Order[] = [];

  for (const unit of game.units.filter((candidate) => candidate.ownerId === playerId)) {
    const destinations = availableDestinations(game, unit, reservedDestinations);
    // At the initial position, each neutral province is contested by two units.
    // Independent willingness to wait lets a single move win that opening race;
    // without it, an always-advance policy bounces forever on this compact map.
    if (destinations.length === 0 || random() >= MOVE_PROBABILITY[strategy]) {
      orders.push({ unitId: unit.id, type: "hold" });
      continue;
    }

    let destination: string | null;
    if (strategy === "expansionist") destination = chooseExpansionDestination(game, playerId, destinations, random);
    else if (strategy === "cautious") destination = chooseCautiousDestination(game, playerId, destinations, random);
    else destination = choose(destinations, random);

    if (!destination) {
      orders.push({ unitId: unit.id, type: "hold" });
      continue;
    }
    reservedDestinations.add(destination);
    orders.push({ unitId: unit.id, type: "move", destination });
  }
  return orders;
}

function chooseRetreatOrders(game: Game, playerId: string, random: Random): Order[] {
  return Object.values(game.pendingRetreats)
    .filter((retreat) => game.units.find((unit) => unit.id === retreat.unitId)?.ownerId === playerId)
    .map((retreat) => retreat.destinations.length > 0 ? { unitId: retreat.unitId, type: "retreat", destination: choose(retreat.destinations, random) } : { unitId: retreat.unitId, type: "disband" });
}

function chooseAdjustmentOrders(game: Game, playerId: string, random: Random): Order[] {
  const need = game.adjustmentNeeds[playerId] ?? 0;
  if (need === 0) return [];
  const ownedUnits = game.units.filter((unit) => unit.ownerId === playerId);
  if (need < 0) return shuffled(ownedUnits, random).slice(0, Math.abs(need)).map((unit) => ({ unitId: unit.id, type: "disband" }));

  const player = game.players.find((candidate) => candidate.id === playerId);
  const occupied = new Set(game.units.map((unit) => unit.provinceId));
  const options = Object.values(PROVINCES)
    .filter((province) => province.supplyCenter === "home" && province.homeFactionId === player?.faction && game.control[province.id] === playerId && !occupied.has(province.id))
    .flatMap((province) => [
      { type: "build" as const, provinceId: province.id, unitType: "army" as const },
      ...(canProvinceHostUnit(province.id, "fleet") ? [{ type: "build" as const, provinceId: province.id, unitType: "fleet" as const }] : [])
    ]);
  const builds: Order[] = [];
  const used = new Set<string>();
  for (const option of shuffled(options, random)) {
    if (builds.length >= need) break;
    if (used.has(option.provinceId)) continue;
    used.add(option.provinceId);
    builds.push(option);
  }
  while (builds.length < need) builds.push({ type: "waive" });
  return builds;
}

/** Produce a complete, valid set of orders for one simulated player in the current phase. */
export function chooseOrders(game: Game, playerId: string, strategy: StrategyName, random: Random): Order[] {
  if (game.status === "retreats") return chooseRetreatOrders(game, playerId, random);
  if (game.status === "adjustments") return chooseAdjustmentOrders(game, playerId, random);
  return chooseMovementOrders(game, playerId, strategy, random);
}

function emptyStats(): MutableStats {
  return { appearances: 0, wins: 0, totalFinalScore: 0 };
}

function toStrategyStats(stats: MutableStats): StrategyStats {
  return {
    appearances: stats.appearances,
    wins: stats.wins,
    winRate: stats.appearances === 0 ? 0 : stats.wins / stats.appearances,
    averageFinalScore: stats.appearances === 0 ? 0 : stats.totalFinalScore / stats.appearances
  };
}

function lineupKey(strategies: Iterable<StrategyName>): string {
  const counts = new Map<StrategyName, number>();
  for (const strategy of strategies) counts.set(strategy, (counts.get(strategy) ?? 0) + 1);
  return STRATEGIES.filter((strategy) => counts.has(strategy)).map((strategy) => `${strategy} x${counts.get(strategy)}`).join(", ");
}

/** Run independent games against the production turn resolver and aggregate balance data. */
export function runSimulation(input: SimulationOptions = {}): SimulationReport {
  const options = resolveSimulationOptions(input);
  const random = createSeededRandom(options.seed);
  const strategyStats = Object.fromEntries(options.strategies.map((strategy) => [strategy, emptyStats()])) as Record<StrategyName, MutableStats>;
  const factionStats = Object.fromEntries(FACTIONS.map((faction) => [faction.id, emptyStats()])) as Record<FactionId, MutableStats>;
  const lineups: Record<string, LineupStats> = {};
  let wins = 0;
  let totalTurns = 0;
  let eventId = 0;
  const startedAt = Date.now();

  for (let gameNumber = 0; gameNumber < options.games; gameNumber += 1) {
    const { game, strategiesByPlayerId } = spawnSimulationGame(options, random);
    const lineup = lineupKey(Object.values(strategiesByPlayerId));
    const lineupStats = lineups[lineup] ?? { games: 0, wins: 0, draws: 0 };
    lineupStats.games += 1;
    lineups[lineup] = lineupStats;

    let turns = 0;
    while (game.status !== "finished" && turns < options.maxTurns) {
      for (const player of game.players.filter((candidate) => requiredSubmitterIds(game).includes(candidate.id))) {
        game.orders[player.id] = chooseOrders(game, player.id, strategiesByPlayerId[player.id], random);
      }
      resolveTurn(game, () => `simulation-event-${++eventId}`);
      turns += 1;
    }
    totalTurns += turns;

    const winner = game.winnerId ? game.players.find((player) => player.id === game.winnerId) : undefined;
    if (winner) {
      wins += 1;
      lineupStats.wins += 1;
      strategyStats[strategiesByPlayerId[winner.id]].wins += 1;
      factionStats[winner.faction as FactionId].wins += 1;
    } else {
      lineupStats.draws += 1;
    }

    for (const player of game.players) {
      const strategy = strategiesByPlayerId[player.id];
      strategyStats[strategy].appearances += 1;
      strategyStats[strategy].totalFinalScore += scoreFor(game, player.id);
      const faction = player.faction as FactionId;
      factionStats[faction].appearances += 1;
      factionStats[faction].totalFinalScore += scoreFor(game, player.id);
    }
  }

  const elapsedMs = Date.now() - startedAt;
  return {
    options,
    completedGames: options.games,
    wins,
    draws: options.games - wins,
    averageTurns: totalTurns / options.games,
    elapsedMs,
    gamesPerSecond: elapsedMs === 0 ? null : (options.games / elapsedMs) * 1000,
    strategies: Object.fromEntries(Object.entries(strategyStats).map(([strategy, stats]) => [strategy, toStrategyStats(stats)])) as Record<StrategyName, StrategyStats>,
    factions: Object.fromEntries(Object.entries(factionStats).map(([faction, stats]) => [faction, toStrategyStats(stats)])) as Record<FactionId, FactionStats>,
    lineups
  };
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function table(headers: string[], rows: string[][]): string {
  const widths = headers.map((header, index) => Math.max(header.length, ...rows.map((row) => row[index].length)));
  const render = (cells: string[]) => cells.map((cell, index) => cell.padEnd(widths[index])).join("  ");
  return [render(headers), render(widths.map((width) => "-".repeat(width))), ...rows.map(render)].join("\n");
}

/** Render a compact, human-readable report for terminal use. */
export function formatSimulationReport(report: SimulationReport): string {
  const strategies = Object.entries(report.strategies)
    .filter(([, stats]) => stats.appearances > 0)
    .map(([strategy, stats]) => [strategy, String(stats.appearances), String(stats.wins), percent(stats.winRate), stats.averageFinalScore.toFixed(2)]);
  const factions = Object.entries(report.factions)
    .filter(([, stats]) => stats.appearances > 0)
    .map(([faction, stats]) => [faction, String(stats.appearances), String(stats.wins), percent(stats.winRate), stats.averageFinalScore.toFixed(2)]);
  const speed = report.gamesPerSecond === null ? "too fast to measure" : `${report.gamesPerSecond.toFixed(1)} games/sec`;
  const mixedGames = Object.entries(report.lineups)
    .filter(([lineup]) => lineup.includes(","))
    .reduce((total, [, stats]) => total + stats.games, 0);

  return [
    "Accord headless simulator",
    `Games: ${report.completedGames} | Seed: ${report.options.seed} | Players/game: ${report.options.playerCount} | Max turns: ${report.options.maxTurns}`,
    `Resolved wins: ${report.wins} | Draws at turn cap: ${report.draws} | Average turns: ${report.averageTurns.toFixed(1)}`,
    `Runtime: ${report.elapsedMs}ms (${speed})`,
    `Strategy lineups: ${Object.keys(report.lineups).length} distinct; ${mixedGames} mixed and ${report.completedGames - mixedGames} uniform.`,
    "",
    "Strategy performance (per assigned player):",
    table(["Strategy", "Seats", "Wins", "Win rate", "Avg score"], strategies),
    "",
    "Faction performance:",
    table(["Faction", "Seats", "Wins", "Win rate", "Avg score"], factions)
  ].join("\n");
}
