const sessionKey = "accord-session-v1";
let session = readSession();
let game = null;
let socket = null;
let drafts = {};
let activeTurn = null;
let toastTimer = null;
let screenWakeLock = null;

const $ = (selector) => document.querySelector(selector);
const landing = $("#landing");
const gameShell = $("#game");

function readSession() {
  try {
    const saved = JSON.parse(localStorage.getItem(sessionKey));
    return saved && typeof saved.roomCode === "string" && typeof saved.playerId === "string" && typeof saved.playerToken === "string" ? saved : null;
  } catch { return null; }
}

function saveSession(next) { session = next; localStorage.setItem(sessionKey, JSON.stringify(next)); }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]); }
function faction(id) { return game?.factions.find((item) => item.id === id); }
function player(id) { return game?.players.find((item) => item.id === id); }
function ownPlayer() { return player(session?.playerId); }
function ownUnits() { return game?.units.filter((unit) => unit.ownerId === session?.playerId) ?? []; }
function isSpectator() { return ownPlayer()?.role === "spectator"; }
function envoys() { return game?.players.filter((candidate) => candidate.role !== "spectator") ?? []; }
function notify(message) { const toast = $("#toast"); toast.textContent = message; toast.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("show"), 3600); }

async function api(path, options = {}) {
  const response = await fetch(path, { headers: { "Content-Type": "application/json", ...(options.headers ?? {}) }, ...options });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Request failed.");
  return body;
}

function showGame() {
  const spectator = isSpectator();
  landing.hidden = true;
  gameShell.hidden = false;
  gameShell.classList.toggle("spectator-mode", spectator);
  $("#room-meta").textContent = spectator ? `ROOM ${session.roomCode} · SPECTATOR DISPLAY` : `ROOM ${session.roomCode}`;
  $("#spectator-fullscreen").hidden = !spectator;
  if (spectator) void requestScreenWakeLock();
  else void releaseScreenWakeLock();
}

async function requestScreenWakeLock() {
  if (!isSpectator() || document.visibilityState !== "visible" || screenWakeLock || !navigator.wakeLock?.request) return;
  try {
    screenWakeLock = await navigator.wakeLock.request("screen");
    screenWakeLock.addEventListener("release", () => { screenWakeLock = null; });
  } catch {
    // Wake Lock is not supported everywhere or may be unavailable under a device policy.
  }
}

async function releaseScreenWakeLock() {
  if (!screenWakeLock) return;
  const currentWakeLock = screenWakeLock;
  screenWakeLock = null;
  try { await currentWakeLock.release(); } catch { /* Already released by the browser. */ }
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await gameShell.requestFullscreen();
  } catch { notify("Fullscreen is not available in this browser."); }
}

function resetDrafts() {
  drafts = Object.fromEntries((game.myOrders || []).map((order) => [order.unitId, order]));
  for (const unit of ownUnits()) if (!drafts[unit.id]) drafts[unit.id] = { unitId: unit.id, type: "hold" };
}

function openSocket() {
  if (!session) return;
  socket?.close();
  const origin = location.protocol === "https:" ? "wss:" : "ws:";
  socket = new WebSocket(`${origin}//${location.host}/ws/${session.roomCode}?playerId=${encodeURIComponent(session.playerId)}&token=${encodeURIComponent(session.playerToken)}`);
  $("#connection").textContent = "connecting";
  $("#connection").classList.remove("online");
  socket.addEventListener("open", () => { $("#connection").textContent = "live"; $("#connection").classList.add("online"); });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.type === "error") return notify(message.message);
    if (message.type === "state") {
      const turnChanged = game && game.turn !== message.payload.turn;
      game = message.payload;
      if (activeTurn === null || turnChanged) { activeTurn = game.turn; resetDrafts(); }
      render();
    }
  });
  socket.addEventListener("close", () => {
    $("#connection").textContent = "reconnecting";
    $("#connection").classList.remove("online");
    if (session) setTimeout(() => { if (socket?.readyState === WebSocket.CLOSED) openSocket(); }, 1500);
  });
}

function send(payload) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return notify("Connection is recovering. Try again in a moment.");
  socket.send(JSON.stringify(payload));
}

function renderStatus() {
  const ready = game.ordersSubmitted.length;
  const playerCount = envoys().length;
  const status = game.status === "lobby" ? "Council forming" : game.status === "finished" ? "Council concluded" : `Turn ${game.turn}`;
  const spectator = isSpectator();
  const copy = spectator ? "Public board display. Private negotiations and uncommitted orders remain hidden." : game.status === "lobby" ? "Choose a faction. The convener starts when every envoy is ready." : game.status === "finished" ? `${player(game.winnerId)?.name ?? "A rival"} has claimed the council.` : "Moves remain private until every envoy has committed.";
  $("#status").innerHTML = `<div class="eyebrow">${escapeHtml(status)}</div><div class="status-title">${game.status === "orders" ? `${ready}/${playerCount} orders committed` : escapeHtml(status)}</div><p class="status-copy">${escapeHtml(copy)}</p>${game.status === "orders" && !spectator ? `<p class="status-ready">${game.ordersSubmitted.includes(session.playerId) ? "YOUR ORDERS ARE SEALED" : "YOUR ORDERS ARE NOT YET COMMITTED"}</p>` : ""}`;
  $("#map-hint").textContent = spectator ? (game.status === "orders" ? `Live public board · Turn ${game.turn} · ${ready}/${playerCount} orders committed` : `Live public board · ${status}`) : "Set each order in the command panel; this map tracks resolved positions.";
}

function renderFactionPanel() {
  const panel = $("#faction-panel");
  const mine = ownPlayer();
  if (isSpectator() || game.status !== "lobby") { panel.hidden = true; return; }
  panel.hidden = false;
  const choices = game.factions.map((choice) => {
    const owner = game.players.find((candidate) => candidate.faction === choice.id);
    const chosen = mine?.faction === choice.id;
    return `<button class="faction ${chosen ? "chosen" : ""}" style="--faction:${choice.color}" data-faction="${choice.id}" ${owner && !chosen ? "disabled" : ""}><strong>${escapeHtml(choice.name.replace(/ .*/, ""))}</strong><small>${owner ? (chosen ? "your banner" : `${escapeHtml(owner.name)} holds it`) : "available"}</small></button>`;
  }).join("");
  const currentEnvoys = envoys();
  const start = session.playerId === game.hostPlayerId ? `<button class="commit" id="start-game" ${currentEnvoys.length < 2 || currentEnvoys.some((candidate) => !candidate.faction) ? "disabled" : ""}>Begin council <span>→</span></button>` : `<p class="status-copy">Waiting for the convener to begin.</p>`;
  panel.innerHTML = `<h3>Choose your banner</h3><div class="faction-grid">${choices}</div>${start}`;
  panel.querySelectorAll("[data-faction]").forEach((button) => button.addEventListener("click", () => send({ type: "faction", factionId: button.dataset.faction })));
  $("#start-game")?.addEventListener("click", () => send({ type: "start" }));
}

function orderLabel(unit) { const province = game.map.find((item) => item.id === unit.provinceId); return `${faction(unit.faction)?.name.split(" ")[0] ?? ""} army — ${province?.name ?? unit.provinceId}`; }
function renderOrderPanel() {
  const panel = $("#order-panel");
  if (isSpectator() || game.status !== "orders") { panel.hidden = true; return; }
  panel.hidden = false;
  const committed = game.ordersSubmitted.includes(session.playerId);
  const rows = ownUnits().map((unit) => {
    const options = [{ value: "hold", label: "Hold position" }, ...game.map.filter((place) => place.neighbors.includes(unit.provinceId)).map((place) => ({ value: `move:${place.id}`, label: `Move to ${place.name}` }))];
    const order = drafts[unit.id] ?? { type: "hold" };
    const selected = order.type === "move" ? `move:${order.destination}` : "hold";
    return `<div class="order-row"><label>${escapeHtml(orderLabel(unit))}<select data-order-unit="${unit.id}" ${committed ? "disabled" : ""}>${options.map((option) => `<option value="${option.value}" ${option.value === selected ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}</select></label></div>`;
  }).join("");
  panel.innerHTML = `<h3>Orders</h3><p class="status-copy">Conflicting moves bounce. A unit entering an occupied province needs its defender to move away.</p><div class="orders">${rows}</div><button id="commit-orders" class="commit" ${committed ? "disabled" : ""}>${committed ? "Orders sealed" : "Commit simultaneous orders"}<span>→</span></button>`;
  panel.querySelectorAll("[data-order-unit]").forEach((select) => select.addEventListener("change", () => {
    const [type, destination] = select.value.split(":");
    drafts[select.dataset.orderUnit] = type === "move" ? { unitId: select.dataset.orderUnit, type, destination } : { unitId: select.dataset.orderUnit, type: "hold" };
    renderMap();
  }));
  $("#commit-orders")?.addEventListener("click", () => send({ type: "orders", orders: Object.values(drafts) }));
}

function routeLine(a, b) { const x = b.x - a.x; const y = b.y - a.y; const length = Math.sqrt(x ** 2 + y ** 2); const angle = Math.atan2(y, x) * 180 / Math.PI; return `<i class="route" style="left:${a.x}%;top:${a.y}%;width:${length}%;transform:rotate(${angle}deg)"></i>`; }
function renderMap() {
  if (!game) return;
  const map = $("#map");
  const routes = [];
  const provinceById = Object.fromEntries(game.map.map((place) => [place.id, place]));
  for (const place of game.map) for (const neighbor of place.neighbors) if (place.id < neighbor) routes.push(routeLine(place, provinceById[neighbor]));
  const provinces = game.map.map((place) => {
    const owner = player(game.control[place.id]);
    const ownerFaction = faction(owner?.faction);
    const units = game.units.filter((unit) => unit.provinceId === place.id);
    const target = Object.values(drafts).some((order) => order.type === "move" && order.destination === place.id);
    return `<div class="province ${target ? "selected-destination" : ""}" style="left:${place.x}%;top:${place.y}%" title="${escapeHtml(place.name)}"><span class="province-name">${escapeHtml(place.name)}</span><span class="province-control">${ownerFaction ? `<i class="legend-swatch" style="background:${ownerFaction.color}"></i>${escapeHtml(ownerFaction.name.split(" ")[0])}` : "unclaimed"}</span><span>${units.map((unit) => `<i class="unit-dot" style="background:${faction(unit.faction)?.color}" title="${escapeHtml(player(unit.ownerId)?.name ?? "Unknown")}">${escapeHtml(faction(unit.faction)?.name[0] ?? "?")}</i>`).join("")}</span></div>`;
  }).join("");
  map.innerHTML = routes.join("") + provinces;
}

function renderScores() {
  const scores = envoys().slice().sort((a, b) => (Object.values(game.control).filter((id) => id === b.id).length - Object.values(game.control).filter((id) => id === a.id).length)).map((candidate) => {
    const value = Object.values(game.control).filter((id) => id === candidate.id).length;
    const color = faction(candidate.faction)?.color ?? "#62718b";
    return `<div class="score-row"><i class="score-dot" style="background:${color}"></i><span>${escapeHtml(candidate.name)}<small> ${candidate.faction ? `· ${escapeHtml(faction(candidate.faction)?.name.split(" ")[0] ?? "")}` : ""}</small></span><strong>${value}/${game.victoryScore}</strong></div>`;
  }).join("");
  $("#scores").innerHTML = scores;
  $("#legend").innerHTML = game.factions.filter((choice) => envoys().some((candidate) => candidate.faction === choice.id)).map((choice) => `<span class="legend-item"><i class="legend-swatch" style="background:${choice.color}"></i>${escapeHtml(choice.name)}</span>`).join("");
}

function renderChat() {
  const messages = game.chats.map((message) => `<div class="message ${message.recipientId ? "private" : ""}"><div class="message-head"><span>${escapeHtml(message.authorName)}${message.recipientId ? ` → ${escapeHtml(player(message.recipientId)?.name ?? "private")}` : ""}</span><span>${new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></div>${escapeHtml(message.body)}</div>`).join("") || `<p class="status-copy">No negotiations yet. Make the first offer.</p>`;
  $("#chat").innerHTML = messages;
  const selected = $("#chat-recipient").value;
  $("#chat-recipient").innerHTML = `<option value="">Public council</option>${envoys().filter((candidate) => candidate.id !== session.playerId).map((candidate) => `<option value="${candidate.id}">Private: ${escapeHtml(candidate.name)}</option>`).join("")}`;
  $("#chat-recipient").value = selected;
  $("#chat").scrollTop = $("#chat").scrollHeight;
}

function renderActivity() { $("#activity").innerHTML = game.activity.map((item) => `<div class="activity-item">${escapeHtml(item.text)}</div>`).join(""); }
function render() { if (!game) return; showGame(); renderStatus(); renderFactionPanel(); renderOrderPanel(); renderMap(); renderScores(); renderChat(); renderActivity(); }

$("#create-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try { const result = await api("/api/rooms", { method: "POST", body: JSON.stringify({ name: $("#create-name").value }) }); saveSession(result); game = result.state; activeTurn = game.turn; resetDrafts(); render(); openSocket(); } catch (reason) { $("#landing-error").textContent = reason.message; }
});
$("#join-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try { const roomCode = $("#join-code").value.toUpperCase().replace(/[^A-Z0-9]/g, ""); const result = await api(`/api/rooms/${roomCode}/join`, { method: "POST", body: JSON.stringify({ name: $("#join-name").value, role: $("#join-role").value }) }); saveSession(result); game = result.state; activeTurn = game.turn; resetDrafts(); render(); openSocket(); } catch (reason) { $("#landing-error").textContent = reason.message; }
});
$("#chat-form").addEventListener("submit", (event) => { event.preventDefault(); const input = $("#chat-input"); if (!input.value.trim()) return; send({ type: "chat", body: input.value, recipientId: $("#chat-recipient").value || null }); input.value = ""; });
$("#copy-room").addEventListener("click", async () => { try { await navigator.clipboard.writeText(`${location.origin}/?room=${session.roomCode}`); notify("Invite link copied."); } catch { notify(`Room code: ${session.roomCode}`); } });
$("#spectator-fullscreen").addEventListener("click", () => { void toggleFullscreen(); });
$("#leave-room").addEventListener("click", () => { socket?.close(); void releaseScreenWakeLock(); localStorage.removeItem(sessionKey); session = null; game = null; location.href = "/"; });

document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") void requestScreenWakeLock(); });
window.addEventListener("pagehide", () => { void releaseScreenWakeLock(); });
document.addEventListener("fullscreenchange", () => { $("#spectator-fullscreen").textContent = document.fullscreenElement ? "Exit fullscreen" : "Fullscreen"; });

const inviteRoomCode = new URLSearchParams(location.search).get("room")?.toUpperCase().replace(/[^A-Z0-9]/g, "");
if (inviteRoomCode) $("#join-code").value = inviteRoomCode.slice(0, 6);

if (session) {
  api(`/api/rooms/${session.roomCode}/state`, { headers: { "X-Player-Id": session.playerId, "X-Player-Token": session.playerToken } }).then((state) => { game = state; activeTurn = game.turn; resetDrafts(); render(); openSocket(); }).catch(() => { localStorage.removeItem(sessionKey); session = null; });
}
