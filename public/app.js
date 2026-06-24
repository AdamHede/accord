const sessionKey = "accord-session-v1";
let session = readSession();
let game = null;
let socket = null;
let drafts = {};
let activeTurn = null;
let toastTimer = null;

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
function notify(message) { const toast = $("#toast"); toast.textContent = message; toast.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("show"), 3600); }

async function api(path, options = {}) {
  const response = await fetch(path, { headers: { "Content-Type": "application/json", ...(options.headers ?? {}) }, ...options });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Request failed.");
  return body;
}

function showGame() {
  landing.hidden = true;
  gameShell.hidden = false;
  $("#room-meta").textContent = `ROOM ${session.roomCode}`;
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
  const playerCount = game.players.length;
  const status = game.status === "lobby" ? "Council forming" : game.status === "finished" ? "Council concluded" : `Turn ${game.turn}`;
  const copy = game.status === "lobby" ? "Choose a faction. The convener starts when every envoy is ready." : game.status === "finished" ? `${player(game.winnerId)?.name ?? "A rival"} has claimed the council.` : "Moves remain private until every envoy has committed.";
  $("#status").innerHTML = `<div class="eyebrow">${escapeHtml(status)}</div><div class="status-title">${game.status === "orders" ? `${ready}/${playerCount} orders committed` : escapeHtml(status)}</div><p class="status-copy">${escapeHtml(copy)}</p>${game.status === "orders" ? `<p class="status-ready">${game.ordersSubmitted.includes(session.playerId) ? "YOUR ORDERS ARE SEALED" : "YOUR ORDERS ARE NOT YET COMMITTED"}</p>` : ""}`;
}

function renderFactionPanel() {
  const panel = $("#faction-panel");
  const mine = ownPlayer();
  if (game.status !== "lobby") { panel.hidden = true; return; }
  panel.hidden = false;
  const choices = game.factions.map((choice) => {
    const owner = game.players.find((candidate) => candidate.faction === choice.id);
    const chosen = mine?.faction === choice.id;
    return `<button class="faction ${chosen ? "chosen" : ""}" style="--faction:${choice.color}" data-faction="${choice.id}" ${owner && !chosen ? "disabled" : ""}><strong>${escapeHtml(choice.name.replace(/ .*/, ""))}</strong><small>${owner ? (chosen ? "your banner" : `${escapeHtml(owner.name)} holds it`) : "available"}</small></button>`;
  }).join("");
  const start = session.playerId === game.hostPlayerId ? `<button class="commit" id="start-game" ${game.players.length < 2 || game.players.some((candidate) => !candidate.faction) ? "disabled" : ""}>Begin council <span>→</span></button>` : `<p class="status-copy">Waiting for the convener to begin.</p>`;
  panel.innerHTML = `<h3>Choose your banner</h3><div class="faction-grid">${choices}</div>${start}`;
  panel.querySelectorAll("[data-faction]").forEach((button) => button.addEventListener("click", () => send({ type: "faction", factionId: button.dataset.faction })));
  $("#start-game")?.addEventListener("click", () => send({ type: "start" }));
}

function orderLabel(unit) { const province = game.map.find((item) => item.id === unit.provinceId); return `${faction(unit.faction)?.name.split(" ")[0] ?? ""} army — ${province?.name ?? unit.provinceId}`; }
function renderOrderPanel() {
  const panel = $("#order-panel");
  if (game.status !== "orders") { panel.hidden = true; return; }
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

const BOARD_WIDTH = 1200;
const BOARD_HEIGHT = 620;

const labelPositions = {
  awc: "label-se", cal: "label-s", gla: "label-ne", ena: "label-e", mex: "label-sw", yuc: "label-se", pan: "label-se", car: "label-e",
  ama: "label-ne", bra: "label-se", and: "label-sw", pat: "label-s",
  bri: "label-nw", weu: "label-sw", ceu: "label-ne", sca: "label-ne", ibe: "label-sw", bal: "label-se", ana: "label-se", eeu: "label-ne",
  mag: "label-sw", lib: "label-se", waf: "label-sw", con: "label-se", egy: "label-se", lev: "label-ne", ara: "label-se", per: "label-e", eaf: "label-se", cap: "label-s",
  ind: "label-se", cas: "label-ne", ste: "label-nw", sib: "label-ne", mon: "label-ne", chi: "label-e", man: "label-ne", jak: "label-e", sea: "label-se", mal: "label-se", png: "label-ne", aus: "label-s"
};

function boardPoint(place) { return { x: place.x / 100 * BOARD_WIDTH, y: place.y / 100 * BOARD_HEIGHT }; }
function routePath(a, b, sea) {
  const from = boardPoint(a);
  const to = boardPoint(b);
  if (!sea) return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} L ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const span = Math.abs(to.x - from.x);
  let curveY = midY - 32;
  if (span > 320) curveY = midY < 210 ? 34 : Math.min(582, midY + 78);
  else if (midY > 410) curveY = Math.min(582, midY + 44);
  return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} Q ${midX.toFixed(1)} ${curveY.toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
}

function worldArt() {
  return `<svg class="world-art" viewBox="0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <pattern id="map-grid" width="100" height="62" patternUnits="userSpaceOnUse"><path d="M 100 0 L 0 0 0 62" fill="none" stroke="rgba(199,217,207,.14)" stroke-width="1"/></pattern>
      <filter id="land-shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#07111a" flood-opacity=".42"/></filter>
    </defs>
    <rect width="1200" height="620" fill="url(#map-grid)" opacity=".72"/>
    <g class="ocean-lines" fill="none"><path d="M30 128 C180 92 316 108 435 142 S708 179 870 136 S1070 90 1180 127"/><path d="M18 405 C168 369 332 402 466 434 S769 469 936 421 S1090 380 1195 414"/><path d="M86 286 C230 252 344 276 472 308 S790 346 954 299 S1082 262 1170 294"/></g>
    <g class="landmasses" filter="url(#land-shadow)">
      <path d="M44 74 L92 42 151 53 190 78 237 92 278 132 270 180 239 198 220 242 177 233 151 262 111 247 101 210 65 192 44 148 58 118 Z"/>
      <path d="M239 268 L283 282 321 326 351 384 346 451 320 519 286 551 262 493 247 431 224 367 228 313 Z"/>
      <path d="M474 118 L505 85 547 79 569 109 554 139 527 154 498 146 Z"/>
      <path d="M515 178 L565 175 594 199 584 236 558 250 536 224 Z"/>
      <path d="M531 250 L578 270 611 330 597 394 568 447 533 420 509 361 500 307 Z"/>
      <path d="M570 122 L644 84 742 88 824 111 902 124 982 156 1032 199 1003 236 932 239 889 268 824 254 771 284 710 270 664 243 626 218 590 199 Z"/>
      <path d="M644 246 L695 260 726 298 709 341 668 355 637 321 Z"/>
      <path d="M715 307 L780 319 826 354 814 399 755 412 715 374 Z"/>
      <path d="M799 351 L857 375 878 425 849 454 808 424 786 388 Z"/>
      <path d="M862 267 L883 251 902 270 891 297 870 296 Z"/>
      <path d="M943 278 L966 267 981 282 969 306 948 303 Z"/>
      <path d="M942 431 L1001 415 1045 443 1053 498 1022 531 970 523 934 486 Z"/>
      <path d="M1058 92 L1083 78 1117 94 1128 123 1099 140 1068 126 Z"/>
    </g>
    <g class="region-labels"><text x="174" y="154">NORTH AMERICA</text><text x="292" y="458">SOUTH AMERICA</text><text x="556" y="94">EUROPE</text><text x="558" y="350">AFRICA</text><text x="690" y="197">WEST ASIA</text><text x="846" y="171">ASIA</text><text x="1000" y="566">OCEANIA</text><text x="760" y="492">INDIAN OCEAN</text></g>
  </svg>`;
}

function renderMap() {
  if (!game) return;
  const map = $("#map");
  const routes = [];
  const provinceById = Object.fromEntries(game.map.map((place) => [place.id, place]));
  for (const place of game.map) for (const neighbor of place.neighbors) if (place.id < neighbor) {
    const neighborPlace = provinceById[neighbor];
    routes.push(`<path class="route ${place.seaNeighbors.includes(neighbor) ? "route-sea" : "route-land"}" d="${routePath(place, neighborPlace, place.seaNeighbors.includes(neighbor))}"/>`);
  }
  const provinces = game.map.map((place) => {
    const owner = player(game.control[place.id]);
    const ownerFaction = faction(owner?.faction);
    const homeFaction = game.factions.find((choice) => choice.homes.includes(place.id));
    const units = game.units.filter((unit) => unit.provinceId === place.id);
    const target = Object.values(drafts).some((order) => order.type === "move" && order.destination === place.id);
    const color = ownerFaction?.color ?? homeFaction?.color ?? "";
    const style = `--x:${place.x}%;--y:${place.y}%${color ? `;--province-color:${color}` : ""}`;
    return `<div class="province province-${place.kind} ${target ? "selected-destination" : ""} ${ownerFaction ? "controlled" : ""}" style="${style}" title="${escapeHtml(place.name)}${ownerFaction ? ` — controlled by ${escapeHtml(ownerFaction.name)}` : ""}"><span class="province-marker">${units.map((unit) => `<i class="unit-dot" style="background:${faction(unit.faction)?.color}" title="${escapeHtml(player(unit.ownerId)?.name ?? "Unknown")}">${escapeHtml(faction(unit.faction)?.name[0] ?? "?")}</i>`).join("")}</span><span class="province-name ${labelPositions[place.id] ?? "label-e"}">${escapeHtml(place.name)}</span></div>`;
  }).join("");
  map.innerHTML = `${worldArt()}<svg class="route-layer" viewBox="0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}" preserveAspectRatio="none" aria-hidden="true">${routes.join("")}</svg>${provinces}`;
}

function renderScores() {
  const scores = game.players.slice().sort((a, b) => (Object.values(game.control).filter((id) => id === b.id).length - Object.values(game.control).filter((id) => id === a.id).length)).map((candidate) => {
    const value = Object.values(game.control).filter((id) => id === candidate.id).length;
    const color = faction(candidate.faction)?.color ?? "#62718b";
    return `<div class="score-row"><i class="score-dot" style="background:${color}"></i><span>${escapeHtml(candidate.name)}<small> ${candidate.faction ? `· ${escapeHtml(faction(candidate.faction)?.name.split(" ")[0] ?? "")}` : ""}</small></span><strong>${value}/${game.victoryScore}</strong></div>`;
  }).join("");
  $("#scores").innerHTML = scores;
  const occupiedFactions = game.factions.filter((choice) => game.players.some((candidate) => candidate.faction === choice.id));
  $("#legend").innerHTML = `<span class="legend-item legend-rule"><i class="legend-node home"></i>Home center</span><span class="legend-item legend-rule"><i class="legend-node neutral"></i>Neutral center</span><span class="legend-item legend-rule"><i class="legend-node buffer"></i>Strategic buffer</span><span class="legend-item legend-rule"><i class="legend-route"></i>Maritime route</span>${occupiedFactions.map((choice) => `<span class="legend-item"><i class="legend-swatch" style="background:${choice.color}"></i>${escapeHtml(choice.name)}</span>`).join("")}`;
}

function renderChat() {
  const messages = game.chats.map((message) => `<div class="message ${message.recipientId ? "private" : ""}"><div class="message-head"><span>${escapeHtml(message.authorName)}${message.recipientId ? ` → ${escapeHtml(player(message.recipientId)?.name ?? "private")}` : ""}</span><span>${new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></div>${escapeHtml(message.body)}</div>`).join("") || `<p class="status-copy">No negotiations yet. Make the first offer.</p>`;
  $("#chat").innerHTML = messages;
  const selected = $("#chat-recipient").value;
  $("#chat-recipient").innerHTML = `<option value="">Public council</option>${game.players.filter((candidate) => candidate.id !== session.playerId).map((candidate) => `<option value="${candidate.id}">Private: ${escapeHtml(candidate.name)}</option>`).join("")}`;
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
  try { const roomCode = $("#join-code").value.toUpperCase().replace(/[^A-Z0-9]/g, ""); const result = await api(`/api/rooms/${roomCode}/join`, { method: "POST", body: JSON.stringify({ name: $("#join-name").value }) }); saveSession(result); game = result.state; activeTurn = game.turn; resetDrafts(); render(); openSocket(); } catch (reason) { $("#landing-error").textContent = reason.message; }
});
$("#chat-form").addEventListener("submit", (event) => { event.preventDefault(); const input = $("#chat-input"); if (!input.value.trim()) return; send({ type: "chat", body: input.value, recipientId: $("#chat-recipient").value || null }); input.value = ""; });
$("#copy-room").addEventListener("click", async () => { try { await navigator.clipboard.writeText(`${location.origin}/?room=${session.roomCode}`); notify("Invite link copied."); } catch { notify(`Room code: ${session.roomCode}`); } });
$("#leave-room").addEventListener("click", () => { socket?.close(); localStorage.removeItem(sessionKey); session = null; game = null; location.href = "/"; });

if (session) {
  api(`/api/rooms/${session.roomCode}/state`, { headers: { "X-Player-Id": session.playerId, "X-Player-Token": session.playerToken } }).then((state) => { game = state; activeTurn = game.turn; resetDrafts(); render(); openSocket(); }).catch(() => { localStorage.removeItem(sessionKey); session = null; });
}
