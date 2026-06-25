import assert from "node:assert/strict";

const baseUrl = process.env.ACCORD_URL ?? "http://127.0.0.1:8787";
const wsBase = baseUrl.replace(/^http/, "ws");

async function request(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const result = await response.json();
  assert.equal(response.ok, true, result.error);
  return result;
}

function client(session) {
  const socket = new WebSocket(`${wsBase}/ws/${session.roomCode}?playerId=${session.playerId}&token=${session.playerToken}`);
  let state = null;
  let failure = null;
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.type === "state") state = message.payload;
    if (message.type === "error") failure = new Error(message.message);
  });
  return { socket, get state() { return state; }, get failure() { return failure; } };
}

function waitFor(condition, label) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 7000;
    const check = () => {
      try {
        if (condition()) return resolve();
        if (Date.now() > deadline) return reject(new Error(`Timed out waiting for ${label}`));
        setTimeout(check, 25);
      } catch (error) { reject(error); }
    };
    check();
  });
}

function ordersFor(state, playerId, overrideByProvince = {}) {
  return state.units.filter((unit) => unit.ownerId === playerId).map((unit) => {
    const override = overrideByProvince[unit.provinceId];
    return override ? { unitId: unit.id, ...override } : { unitId: unit.id, type: "hold" };
  });
}

const host = await request("/api/rooms", { name: "Aster" });
const guest = await request(`/api/rooms/${host.roomCode}/join`, { name: "Bryn" });
const hostClient = client(host);
const guestClient = client(guest);

await waitFor(() => hostClient.state && guestClient.state, "initial WebSocket state");
hostClient.socket.send(JSON.stringify({ type: "faction", factionId: "north-american-union" }));
await waitFor(() => hostClient.state.players.find((player) => player.id === host.playerId)?.faction === "north-american-union", "host faction");
guestClient.socket.send(JSON.stringify({ type: "faction", factionId: "european-compact" }));
await waitFor(() => guestClient.state.players.find((player) => player.id === guest.playerId)?.faction === "european-compact", "guest faction");
hostClient.socket.send(JSON.stringify({ type: "start" }));
await waitFor(() => hostClient.state.status === "orders" && guestClient.state.status === "orders", "game start");
const spectator = await request(`/api/rooms/${host.roomCode}/join`, { name: "Board", role: "spectator" });
const spectatorClient = client(spectator);
await waitFor(() => spectatorClient.state, "spectator WebSocket state");
assert.equal(spectatorClient.state.players.find((player) => player.id === spectator.playerId)?.role, "spectator");
spectatorClient.socket.send(JSON.stringify({ type: "orders", orders: [] }));
await waitFor(() => spectatorClient.failure?.message === "Spectators cannot submit orders.", "spectator order rejection");

hostClient.socket.send(JSON.stringify({ type: "orders", orders: ordersFor(hostClient.state, host.playerId, { cal: { type: "move", destination: "mex" } }) }));
guestClient.socket.send(JSON.stringify({ type: "orders", orders: ordersFor(guestClient.state, guest.playerId) }));
await waitFor(() => hostClient.state.status === "orders" && hostClient.state.season === "fall" && hostClient.state.turn === 2, "spring movement resolution");
assert.equal(hostClient.state.control.mex, undefined);

hostClient.socket.send(JSON.stringify({ type: "orders", orders: ordersFor(hostClient.state, host.playerId) }));
guestClient.socket.send(JSON.stringify({ type: "orders", orders: ordersFor(guestClient.state, guest.playerId) }));
await waitFor(() => hostClient.state.status === "adjustments" && hostClient.state.season === "winter", "fall center ownership and adjustment phase");
assert.equal(hostClient.state.control.mex, host.playerId);
assert.equal(hostClient.state.adjustmentNeeds[host.playerId], 1);

hostClient.socket.send(JSON.stringify({ type: "orders", orders: [{ type: "build", provinceId: "cal", unitType: "army" }] }));
await waitFor(() => hostClient.state.status === "orders" && hostClient.state.season === "spring" && hostClient.state.year === 2, "winter build resolution");
assert.equal(hostClient.state.units.some((unit) => unit.ownerId === host.playerId && unit.provinceId === "cal" && unit.type === "army"), true);
hostClient.socket.send(JSON.stringify({ type: "chat", body: "A public proposal for peace.", recipientId: null }));
await waitFor(() => guestClient.state.chats.some((message) => message.body === "A public proposal for peace.") && spectatorClient.state.chats.some((message) => message.body === "A public proposal for peace."), "chat broadcast");
hostClient.socket.send(JSON.stringify({ type: "chat", body: "A private counteroffer.", recipientId: guest.playerId }));
await waitFor(() => guestClient.state.chats.some((message) => message.body === "A private counteroffer."), "private chat delivery");

assert.equal(hostClient.failure, null);
assert.equal(guestClient.failure, null);
assert.equal(hostClient.state.units.length, 7);
hostClient.socket.close();
guestClient.socket.close();
spectatorClient.socket.close();
console.log(`smoke passed for room ${host.roomCode}`);
