import { DurableObject } from "cloudflare:workers";
import {
  createInitialUnits,
  factionById,
  FACTIONS,
  Game,
  isEnvoy,
  normalizeMessage,
  normalizeName,
  Order,
  publicView,
  resolveTurn,
  StoredPlayer,
  validateOrders
} from "./engine";

interface Session {
  roomCode: string;
  playerId: string;
  playerToken: string;
}

interface SocketSession {
  playerId: string;
  token: string;
}

interface RoomResponse extends Session {
  state: ReturnType<typeof publicView>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSocketSession(value: unknown): value is SocketSession {
  return isRecord(value) && typeof value.playerId === "string" && typeof value.token === "string";
}

async function secureEquals(left: string, right: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right))
  ]);
  // Both SHA-256 digests have a fixed length, so this compares every byte without
  // early exit while keeping the original token length out of the comparison.
  const leftBytes = new Uint8Array(leftHash);
  const rightBytes = new Uint8Array(rightHash);
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) difference |= leftBytes[index] ^ rightBytes[index];
  return difference === 0;
}

function randomRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function error(message: string, status = 400): Response {
  return json({ error: message }, status);
}

async function requestBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return isRecord(body) ? body : null;
  } catch {
    return null;
  }
}

export class GameRoom extends DurableObject<Env> {
  private async readGame(): Promise<Game | null> {
    return (await this.ctx.storage.get<Game>("game")) ?? null;
  }

  private async writeGame(game: Game): Promise<void> {
    await this.ctx.storage.put("game", game);
  }

  private async authorize(game: Game, playerId: string, token: string): Promise<StoredPlayer> {
    const player = game.players.find((candidate) => candidate.id === playerId);
    if (!player || !(await secureEquals(player.token, token))) throw new Error("Your private game session is not valid.");
    return player;
  }

  private async responseFor(game: Game, player: StoredPlayer): Promise<RoomResponse> {
    return {
      roomCode: game.roomCode,
      playerId: player.id,
      playerToken: player.token,
      state: publicView(game, player.id)
    };
  }

  async initializeRoom(roomCode: string, name: unknown): Promise<RoomResponse> {
    const existing = await this.readGame();
    if (existing) throw new Error("Room code collision. Please try again.");
    const now = Date.now();
    const player: StoredPlayer = { id: crypto.randomUUID(), token: crypto.randomUUID(), name: normalizeName(name), role: "envoy", faction: null, joinedAt: now };
    const game: Game = {
      roomCode,
      hostPlayerId: player.id,
      status: "lobby",
      turn: 1,
      players: [player],
      units: [],
      control: {},
      orders: {},
      chats: [],
      activity: [{ id: crypto.randomUUID(), text: `${player.name} convened a new council.`, createdAt: now }],
      winnerId: null
    };
    await this.writeGame(game);
    return this.responseFor(game, player);
  }

  async joinGame(name: unknown, requestedRole: unknown): Promise<RoomResponse> {
    const game = await this.readGame();
    if (!game) throw new Error("That council does not exist.");
    const role = requestedRole === "spectator" ? "spectator" : "envoy";
    const envoyCount = game.players.filter(isEnvoy).length;
    if (role === "envoy" && game.status !== "lobby") throw new Error("The council has already started. Join as a spectator to follow the board.");
    if (role === "envoy" && envoyCount >= FACTIONS.length) throw new Error("This council is full. Join as a spectator to follow the board.");
    const player: StoredPlayer = { id: crypto.randomUUID(), token: crypto.randomUUID(), name: normalizeName(name), role, faction: null, joinedAt: Date.now() };
    game.players.push(player);
    game.activity.unshift({ id: crypto.randomUUID(), text: role === "spectator" ? `${player.name} joined as a spectator.` : `${player.name} entered the council.`, createdAt: Date.now() });
    game.activity = game.activity.slice(0, 8);
    await this.writeGame(game);
    this.broadcast(game);
    return this.responseFor(game, player);
  }

  async getState(playerId: string, token: string): Promise<ReturnType<typeof publicView>> {
    const game = await this.readGame();
    if (!game) throw new Error("That council does not exist.");
    await this.authorize(game, playerId, token);
    return publicView(game, playerId);
  }

  private async chooseFaction(game: Game, player: StoredPlayer, factionId: unknown): Promise<void> {
    if (!isEnvoy(player)) throw new Error("Spectators cannot choose a faction.");
    if (game.status !== "lobby") throw new Error("Factions are locked once the council begins.");
    if (typeof factionId !== "string" || !factionById(factionId)) throw new Error("Unknown faction.");
    if (game.players.some((candidate) => candidate.id !== player.id && candidate.faction === factionId)) {
      throw new Error("That faction already has an envoy.");
    }
    player.faction = factionId as StoredPlayer["faction"];
    game.activity.unshift({ id: crypto.randomUUID(), text: `${player.name} pledged to the ${factionById(factionId)?.name}.`, createdAt: Date.now() });
    game.activity = game.activity.slice(0, 8);
  }

  private async startGame(game: Game, player: StoredPlayer): Promise<void> {
    const envoys = game.players.filter(isEnvoy);
    if (!isEnvoy(player) || player.id !== game.hostPlayerId) throw new Error("Only the convener can begin the council.");
    if (envoys.length < 2) throw new Error("At least two envoys are required.");
    if (envoys.some((candidate) => !candidate.faction)) throw new Error("Every envoy must choose a faction first.");
    game.status = "orders";
    game.units = createInitialUnits(game);
    game.control = Object.fromEntries(game.units.map((unit) => [unit.provinceId, unit.ownerId]));
    game.activity.unshift({ id: crypto.randomUUID(), text: "The council has begun. Orders are simultaneous and secret until everyone commits.", createdAt: Date.now() });
    game.activity = game.activity.slice(0, 8);
  }

  private async submitOrders(game: Game, player: StoredPlayer, submitted: unknown): Promise<void> {
    if (!isEnvoy(player)) throw new Error("Spectators cannot submit orders.");
    if (game.status !== "orders") throw new Error("The council is not accepting orders.");
    game.orders[player.id] = validateOrders(game, player.id, submitted);
    game.activity.unshift({ id: crypto.randomUUID(), text: `${player.name} has committed orders.`, createdAt: Date.now() });
    game.activity = game.activity.slice(0, 8);
    if (game.players.filter(isEnvoy).every((candidate) => game.orders[candidate.id])) resolveTurn(game, () => crypto.randomUUID());
  }

  private async sendChat(game: Game, player: StoredPlayer, body: unknown, recipientId: unknown): Promise<void> {
    if (!isEnvoy(player)) throw new Error("Spectators cannot send messages.");
    const message = normalizeMessage(body);
    if (!message) throw new Error("Messages cannot be empty.");
    const recipient = typeof recipientId === "string" ? recipientId : null;
    if (recipient && !game.players.some((candidate) => candidate.id === recipient && isEnvoy(candidate))) throw new Error("Unknown recipient.");
    game.chats.push({ id: crypto.randomUUID(), authorId: player.id, authorName: player.name, recipientId: recipient, body: message, createdAt: Date.now() });
    game.chats = game.chats.slice(-80);
  }

  private broadcast(game: Game): void {
    for (const socket of this.ctx.getWebSockets()) {
      const session = socket.deserializeAttachment();
      if (!isSocketSession(session) || !game.players.some((player) => player.id === session.playerId)) {
        socket.close(1008, "Invalid session");
        continue;
      }
      try {
        socket.send(JSON.stringify({ type: "state", payload: publicView(game, session.playerId) }));
      } catch {
        socket.close(1011, "Unable to deliver state");
      }
    }
  }

  private sendError(socket: WebSocket, message: string): void {
    socket.send(JSON.stringify({ type: "error", message }));
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return error("WebSocket upgrade required.", 426);
    const game = await this.readGame();
    if (!game) return error("That council does not exist.", 404);
    const url = new URL(request.url);
    const playerId = url.searchParams.get("playerId") ?? "";
    const token = url.searchParams.get("token") ?? "";
    try {
      await this.authorize(game, playerId, token);
    } catch (reason) {
      return error(reason instanceof Error ? reason.message : "Unauthorized.", 401);
    }
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.serializeAttachment({ playerId, token } satisfies SocketSession);
    this.ctx.acceptWebSocket(server);
    server.send(JSON.stringify({ type: "state", payload: publicView(game, playerId) }));
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const session = socket.deserializeAttachment();
    if (!isSocketSession(session)) {
      socket.close(1008, "Invalid session");
      return;
    }
    let data: unknown;
    try {
      data = JSON.parse(typeof message === "string" ? message : new TextDecoder().decode(message));
    } catch {
      this.sendError(socket, "Malformed message.");
      return;
    }
    if (!isRecord(data) || typeof data.type !== "string") {
      this.sendError(socket, "Malformed message.");
      return;
    }

    try {
      const game = await this.readGame();
      if (!game) throw new Error("That council does not exist.");
      const player = await this.authorize(game, session.playerId, session.token);
      if (data.type === "faction") await this.chooseFaction(game, player, data.factionId);
      else if (data.type === "start") await this.startGame(game, player);
      else if (data.type === "orders") await this.submitOrders(game, player, data.orders);
      else if (data.type === "chat") await this.sendChat(game, player, data.body, data.recipientId);
      else throw new Error("Unknown action.");
      await this.writeGame(game);
      this.broadcast(game);
    } catch (reason) {
      this.sendError(socket, reason instanceof Error ? reason.message : "The council could not process that action.");
    }
  }
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/health") return json({ ok: true });
      if (url.pathname === "/api/rooms" && request.method === "POST") {
        const body = await requestBody(request);
        if (!body) return error("Expected a JSON request body.");
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const roomCode = randomRoomCode();
          try {
            const result = await env.GAME_ROOM.getByName(roomCode).initializeRoom(roomCode, body.name);
            return json(result, 201);
          } catch (reason) {
            if (!(reason instanceof Error) || reason.message !== "Room code collision. Please try again.") throw reason;
          }
        }
        return error("Unable to reserve a room code. Please try again.", 503);
      }

      const roomMatch = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]{6})\/(join|state)$/);
      if (roomMatch) {
        const [, roomCode, action] = roomMatch;
        const room = env.GAME_ROOM.getByName(roomCode);
        if (action === "join" && request.method === "POST") {
          const body = await requestBody(request);
          if (!body) return error("Expected a JSON request body.");
          return json(await room.joinGame(body.name, body.role), 201);
        }
        if (action === "state" && request.method === "GET") {
          const playerId = request.headers.get("X-Player-Id") ?? "";
          const token = request.headers.get("X-Player-Token") ?? "";
          return json(await room.getState(playerId, token));
        }
      }

      const websocketMatch = url.pathname.match(/^\/ws\/([A-Z0-9]{6})$/);
      if (websocketMatch) return env.GAME_ROOM.getByName(websocketMatch[1]).fetch(request);
      return env.ASSETS.fetch(request);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Unexpected server error.";
      console.error(JSON.stringify({ message: "request failed", path: url.pathname, error: message }));
      return error(message, message.includes("session") ? 401 : 400);
    }
  }
} satisfies ExportedHandler<Env>;
