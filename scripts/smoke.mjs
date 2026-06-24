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

const host = await request("/api/rooms", { name: "Aster" });
const guest = await request(`/api/rooms/${host.roomCode}/join`, { name: "Bryn" });
const hostClient = client(host);
const guestClient = client(guest);

await waitFor(() => hostClient.state && guestClient.state, "initial WebSocket state");
hostClient.socket.send(JSON.stringify({ type: "faction", factionId: "ivory" }));
await waitFor(() => hostClient.state.players.find((player) => player.id === host.playerId)?.faction === "ivory", "host faction");
guestClient.socket.send(JSON.stringify({ type: "faction", factionId: "azure" }));
await waitFor(() => guestClient.state.players.find((player) => player.id === guest.playerId)?.faction === "azure", "guest faction");
hostClient.socket.send(JSON.stringify({ type: "start" }));
await waitFor(() => hostClient.state.status === "orders" && guestClient.state.status === "orders", "game start");

for (const current of [hostClient, guestClient]) {
  const ownUnits = current.state.units.filter((unit) => unit.ownerId === (current === hostClient ? host.playerId : guest.playerId));
  current.socket.send(JSON.stringify({ type: "orders", orders: ownUnits.map((unit) => ({ unitId: unit.id, type: "hold" })) }));
}
await waitFor(() => hostClient.state.turn === 2 && guestClient.state.turn === 2, "simultaneous resolution");
hostClient.socket.send(JSON.stringify({ type: "chat", body: "A public proposal for peace.", recipientId: null }));
await waitFor(() => guestClient.state.chats.some((message) => message.body === "A public proposal for peace."), "chat broadcast");

assert.equal(hostClient.failure, null);
assert.equal(guestClient.failure, null);
assert.equal(hostClient.state.units.length, 4);
hostClient.socket.close();
guestClient.socket.close();
console.log(`smoke passed for room ${host.roomCode}`);
