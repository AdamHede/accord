import { WORLD_LAND_PATHS } from "./world-land-paths.js";

const sessionKey = "accord-session-v1";
const worldLandMarkup = WORLD_LAND_PATHS.map((path) => `<path d="${path}"></path>`).join("");
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
function province(id) { return game?.map.find((item) => item.id === id); }
function ownPlayer() { return player(session?.playerId); }
function ownUnits() { return game?.units.filter((unit) => unit.ownerId === session?.playerId) ?? []; }
function isSpectator() { return ownPlayer()?.role === "spectator"; }
function envoys() { return game?.players.filter((candidate) => candidate.role !== "spectator") ?? []; }
function notify(message) { const toast = $("#toast"); toast.textContent = message; toast.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("show"), 3600); }
function pendingUnitIds() { return new Set(Object.keys(game?.pendingRetreats ?? {})); }
function activeUnits() { const pending = pendingUnitIds(); return game?.units.filter((unit) => !pending.has(unit.id)) ?? []; }
function activeOwnUnits() { return activeUnits().filter((unit) => unit.ownerId === session?.playerId); }
function supplyCenterIds() { return new Set(game?.map.filter((place) => place.supplyCenter).map((place) => place.id) ?? []); }
function seasonLabel() { return game?.season ? `${game.season[0].toUpperCase()}${game.season.slice(1)} ${game.year}` : ""; }
function phaseLabel() {
  if (!game) return "";
  if (game.status === "lobby") return "Council forming";
  if (game.status === "finished") return "Council concluded";
  if (game.status === "orders") return `${seasonLabel()} Orders`;
  if (game.status === "retreats") return `${seasonLabel()} Retreats`;
  return `Winter ${game.year} Adjustments`;
}
function draftOrders() { return Array.isArray(drafts.adjustments) ? drafts.adjustments : Object.values(drafts); }
function placeCanHostFleet(place) { return place?.kind === "sea" || game.map.some((candidate) => candidate.kind === "sea" && candidate.neighbors.includes(place?.id)); }
function canMoveDirect(unit, destinationId) {
  const origin = province(unit.provinceId);
  const target = province(destinationId);
  if (!origin || !target || !origin.neighbors.includes(destinationId)) return false;
  if (unit.type === "army") return origin.kind !== "sea" && target.kind !== "sea";
  return placeCanHostFleet(target) && (origin.kind === "sea" || target.kind === "sea");
}
function canSupport(unit, destinationId) { return canMoveDirect(unit, destinationId); }
function hasPotentialConvoyRoute(unit, destinationId) {
  const origin = province(unit.provinceId);
  const target = province(destinationId);
  if (!origin || !target || unit.type !== "army" || origin.kind === "sea" || target.kind === "sea" || origin.id === target.id) return false;
  const fleetSeas = new Set(activeUnits().filter((candidate) => candidate.type === "fleet" && province(candidate.provinceId)?.kind === "sea").map((candidate) => candidate.provinceId));
  const queue = origin.neighbors.filter((neighbor) => fleetSeas.has(neighbor));
  const seen = new Set(queue);
  while (queue.length > 0) {
    const current = queue.shift();
    if (province(current)?.neighbors.includes(destinationId)) return true;
    for (const neighbor of province(current)?.neighbors ?? []) {
      if (!fleetSeas.has(neighbor) || seen.has(neighbor)) continue;
      seen.add(neighbor);
      queue.push(neighbor);
    }
  }
  return false;
}
function seaCanParticipateInConvoy(fleet, army, destinationId) {
  if (fleet.type !== "fleet" || province(fleet.provinceId)?.kind !== "sea") return false;
  const fleetSeas = new Set(activeUnits().filter((candidate) => candidate.type === "fleet" && province(candidate.provinceId)?.kind === "sea").map((candidate) => candidate.provinceId));
  const queue = [fleet.provinceId];
  const seen = new Set(queue);
  let reachesOrigin = province(fleet.provinceId)?.neighbors.includes(army.provinceId);
  let reachesDestination = province(fleet.provinceId)?.neighbors.includes(destinationId);
  while (queue.length > 0) {
    const current = queue.shift();
    reachesOrigin ||= province(current)?.neighbors.includes(army.provinceId);
    reachesDestination ||= province(current)?.neighbors.includes(destinationId);
    if (reachesOrigin && reachesDestination) return true;
    for (const neighbor of province(current)?.neighbors ?? []) {
      if (!fleetSeas.has(neighbor) || seen.has(neighbor)) continue;
      seen.add(neighbor);
      queue.push(neighbor);
    }
  }
  return false;
}

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
  if (game.status === "adjustments") {
    const need = game.adjustmentNeeds?.[session.playerId] ?? 0;
    drafts = { adjustments: game.myOrders?.length ? [...game.myOrders] : Array.from({ length: Math.max(0, need) }, () => ({ type: "waive" })) };
    return;
  }

  drafts = Object.fromEntries((game.myOrders || []).filter((order) => order.unitId).map((order) => [order.unitId, order]));
  if (game.status === "retreats") {
    const ownPending = Object.values(game.pendingRetreats ?? {}).filter((retreat) => ownUnits().some((unit) => unit.id === retreat.unitId));
    for (const retreat of ownPending) if (!drafts[retreat.unitId]) drafts[retreat.unitId] = { unitId: retreat.unitId, type: "disband" };
    return;
  }

  for (const unit of activeOwnUnits()) if (!drafts[unit.id]) drafts[unit.id] = { unitId: unit.id, type: "hold" };
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
      const turnChanged = game && (game.turn !== message.payload.turn || game.status !== message.payload.status || game.season !== message.payload.season);
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
  const required = game.ordersRequired ?? [];
  const ready = game.ordersSubmitted.filter((playerId) => required.includes(playerId)).length;
  const playerCount = required.length || envoys().length;
  const status = phaseLabel();
  const spectator = isSpectator();
  const acceptingOrders = ["orders", "retreats", "adjustments"].includes(game.status);
  const copy = spectator ? "Public board display. Private negotiations and uncommitted orders remain hidden." : game.status === "lobby" ? "Choose a faction. The convener starts when every envoy is ready." : game.status === "finished" ? `${player(game.winnerId)?.name ?? "A rival"} has claimed the council.` : game.status === "retreats" ? "Dislodged units must retreat or disband before the season closes." : game.status === "adjustments" ? "Winter builds and disbands reconcile unit count with supply-center count." : "Movement, support, and convoy orders remain private until every required envoy commits.";
  $("#status").innerHTML = `<div class="eyebrow">${escapeHtml(status)}</div><div class="status-title">${acceptingOrders ? `${ready}/${playerCount} committed` : escapeHtml(status)}</div><p class="status-copy">${escapeHtml(copy)}</p>${acceptingOrders && !spectator && required.includes(session.playerId) ? `<p class="status-ready">${game.ordersSubmitted.includes(session.playerId) ? "YOUR ORDERS ARE SEALED" : "YOUR ORDERS ARE NOT YET COMMITTED"}</p>` : ""}`;
  $("#map-hint").textContent = spectator ? (acceptingOrders ? `Live public board · ${status} · ${ready}/${playerCount} committed` : `Live public board · ${status}`) : "Named land and water provinces show legal topology. Dashed lines are secondary naval aids.";
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
  const hostControls = session.playerId === game.hostPlayerId ? `<button class="commit" id="add-ai" ${currentEnvoys.length >= game.factions.length ? "disabled" : ""}>Add AI envoy</button><button class="commit" id="start-game" ${currentEnvoys.length < 2 || currentEnvoys.some((candidate) => !candidate.faction) ? "disabled" : ""}>Begin council <span>→</span></button>` : `<p class="status-copy">Waiting for the convener to begin.</p>`;
  panel.innerHTML = `<h3>Choose your banner</h3><div class="faction-grid">${choices}</div>${hostControls}`;
  panel.querySelectorAll("[data-faction]").forEach((button) => button.addEventListener("click", () => send({ type: "faction", factionId: button.dataset.faction })));
  $("#add-ai")?.addEventListener("click", () => send({ type: "addAi" }));
  $("#start-game")?.addEventListener("click", () => send({ type: "start" }));
}

function unitLabel(unit) {
  const place = province(unit.provinceId);
  return `${unit.type === "fleet" ? "Fleet" : "Army"} — ${place?.name ?? unit.provinceId}`;
}
function orderLabel(unit) { return `${faction(unit.faction)?.name.split(" ")[0] ?? ""} ${unitLabel(unit)}`; }
function movementOptionValue(order) {
  if (!order || order.type === "hold") return "hold";
  if (order.type === "move") return `${order.viaConvoy ? "convoyMove" : "move"}:${order.destination}`;
  if (order.type === "support") return `support:${order.targetUnitId}:${order.destination ?? ""}`;
  if (order.type === "convoy") return `convoy:${order.targetUnitId}:${order.destination}`;
  return "hold";
}
function movementOptionsFor(unit) {
  const options = [{ value: "hold", label: "Hold position" }];
  for (const place of game.map) {
    if (canMoveDirect(unit, place.id)) options.push({ value: `move:${place.id}`, label: `Move to ${place.name}` });
    else if (unit.type === "army" && hasPotentialConvoyRoute(unit, place.id)) options.push({ value: `convoyMove:${place.id}`, label: `Move by convoy to ${place.name}` });
  }
  for (const target of activeUnits().filter((candidate) => candidate.id !== unit.id)) {
    if (canSupport(unit, target.provinceId)) options.push({ value: `support:${target.id}:`, label: `Support ${unitLabel(target)} to hold` });
    const targetOrder = drafts[target.id];
    if (targetOrder?.type === "move" && canSupport(unit, targetOrder.destination)) {
      options.push({ value: `support:${target.id}:${targetOrder.destination}`, label: `Support ${unitLabel(target)} to ${province(targetOrder.destination)?.name ?? targetOrder.destination}` });
    }
  }
  if (unit.type === "fleet" && province(unit.provinceId)?.kind === "sea") {
    for (const army of activeUnits().filter((candidate) => candidate.type === "army")) {
      const armyOrder = drafts[army.id];
      if (armyOrder?.type === "move" && armyOrder.viaConvoy && seaCanParticipateInConvoy(unit, army, armyOrder.destination)) {
        options.push({ value: `convoy:${army.id}:${armyOrder.destination}`, label: `Convoy ${unitLabel(army)} to ${province(armyOrder.destination)?.name ?? armyOrder.destination}` });
      }
    }
  }
  return options;
}
function buildOptions() {
  const mine = ownPlayer();
  const occupied = new Set(activeUnits().map((unit) => unit.provinceId));
  return game.map
    .filter((place) => place.supplyCenter === "home" && place.homeFactionId === mine?.faction && game.control[place.id] === session.playerId && !occupied.has(place.id))
    .flatMap((place) => [
      { value: `build:${place.id}:army`, label: `Build army in ${place.name}` },
      ...(placeCanHostFleet(place) ? [{ value: `build:${place.id}:fleet`, label: `Build fleet in ${place.name}` }] : [])
    ]);
}
function renderOrderPanel() {
  const panel = $("#order-panel");
  if (isSpectator() || !["orders", "retreats", "adjustments"].includes(game.status) || !(game.ordersRequired ?? []).includes(session.playerId)) { panel.hidden = true; return; }
  panel.hidden = false;
  const committed = game.ordersSubmitted.includes(session.playerId);
  if (game.status === "retreats") {
    const rows = Object.values(game.pendingRetreats ?? {}).filter((retreat) => ownUnits().some((unit) => unit.id === retreat.unitId)).map((retreat) => {
      const unit = ownUnits().find((candidate) => candidate.id === retreat.unitId);
      const selected = drafts[retreat.unitId]?.type === "retreat" ? `retreat:${drafts[retreat.unitId].destination}` : "disband";
      const options = [{ value: "disband", label: "Disband" }, ...retreat.destinations.map((destination) => ({ value: `retreat:${destination}`, label: `Retreat to ${province(destination)?.name ?? destination}` }))];
      return `<div class="order-row"><label>${escapeHtml(unit ? orderLabel(unit) : retreat.unitId)}<select data-retreat-unit="${retreat.unitId}" ${committed ? "disabled" : ""}>${options.map((option) => `<option value="${option.value}" ${option.value === selected ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}</select></label></div>`;
    }).join("");
    panel.innerHTML = `<h3>Retreats</h3><p class="status-copy">Retreats cannot enter occupied provinces, the attacker’s origin, or a standoff province. Conflicting retreats disband.</p><div class="orders">${rows}</div><button id="commit-orders" class="commit" ${committed ? "disabled" : ""}>${committed ? "Retreats sealed" : "Commit retreats"}<span>→</span></button>`;
    panel.querySelectorAll("[data-retreat-unit]").forEach((select) => select.addEventListener("change", () => {
      const [type, destination] = select.value.split(":");
      drafts[select.dataset.retreatUnit] = type === "retreat" ? { unitId: select.dataset.retreatUnit, type, destination } : { unitId: select.dataset.retreatUnit, type: "disband" };
      renderMap();
    }));
    $("#commit-orders")?.addEventListener("click", () => send({ type: "orders", orders: Object.values(drafts) }));
    return;
  }

  if (game.status === "adjustments") {
    const need = game.adjustmentNeeds?.[session.playerId] ?? 0;
    if (need > 0) {
      const options = [{ value: "waive", label: "Waive build" }, ...buildOptions()];
      const rows = Array.from({ length: need }, (_, index) => {
        const current = drafts.adjustments?.[index];
        const selected = current?.type === "build" ? `build:${current.provinceId}:${current.unitType}` : "waive";
        return `<div class="order-row"><label>Build slot ${index + 1}<select data-build-slot="${index}" ${committed ? "disabled" : ""}>${options.map((option) => `<option value="${option.value}" ${option.value === selected ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}</select></label></div>`;
      }).join("");
      panel.innerHTML = `<h3>Winter builds</h3><p class="status-copy">Build only in vacant owned home centers. Extra capacity may be waived.</p><div class="orders">${rows}</div><button id="commit-orders" class="commit" ${committed ? "disabled" : ""}>${committed ? "Adjustments sealed" : "Commit adjustments"}<span>→</span></button>`;
      panel.querySelectorAll("[data-build-slot]").forEach((select) => select.addEventListener("change", () => {
        const index = Number(select.dataset.buildSlot);
        const [type, provinceId, unitType] = select.value.split(":");
        drafts.adjustments[index] = type === "build" ? { type: "build", provinceId, unitType } : { type: "waive" };
      }));
    } else {
      const deficit = Math.abs(need);
      const selected = new Set((drafts.adjustments ?? []).filter((order) => order.type === "disband").map((order) => order.unitId));
      const rows = activeOwnUnits().map((unit) => `<label class="order-check"><input type="checkbox" data-disband-unit="${unit.id}" ${selected.has(unit.id) ? "checked" : ""} ${committed ? "disabled" : ""}> ${escapeHtml(orderLabel(unit))}</label>`).join("");
      const ready = selected.size === deficit;
      panel.innerHTML = `<h3>Winter disbands</h3><p class="status-copy">Select exactly ${deficit} unit${deficit === 1 ? "" : "s"} to disband.</p><div class="orders">${rows}</div><button id="commit-orders" class="commit" ${committed || !ready ? "disabled" : ""}>${committed ? "Adjustments sealed" : "Commit adjustments"}<span>→</span></button>`;
      panel.querySelectorAll("[data-disband-unit]").forEach((checkbox) => checkbox.addEventListener("change", () => {
        const next = new Set((drafts.adjustments ?? []).filter((order) => order.type === "disband").map((order) => order.unitId));
        if (checkbox.checked) next.add(checkbox.dataset.disbandUnit);
        else next.delete(checkbox.dataset.disbandUnit);
        drafts.adjustments = [...next].map((unitId) => ({ type: "disband", unitId }));
        renderOrderPanel();
      }));
    }
    $("#commit-orders")?.addEventListener("click", () => send({ type: "orders", orders: drafts.adjustments ?? [] }));
    return;
  }

  const rows = activeOwnUnits().map((unit) => {
    const options = movementOptionsFor(unit);
    const selected = movementOptionValue(drafts[unit.id] ?? { type: "hold" });
    return `<div class="order-row"><label>${escapeHtml(orderLabel(unit))}<select data-order-unit="${unit.id}" ${committed ? "disabled" : ""}>${options.map((option) => `<option value="${option.value}" ${option.value === selected ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}</select></label></div>`;
  }).join("");
  panel.innerHTML = `<h3>Orders</h3><p class="status-copy">Attacks resolve by strength. Supports may be cut by attacks, and convoy routes fail if all convoying fleets are dislodged.</p><div class="orders">${rows}</div><button id="commit-orders" class="commit" ${committed ? "disabled" : ""}>${committed ? "Orders sealed" : "Commit simultaneous orders"}<span>→</span></button>`;
  panel.querySelectorAll("[data-order-unit]").forEach((select) => select.addEventListener("change", () => {
    const [type, first, second] = select.value.split(":");
    if (type === "move") drafts[select.dataset.orderUnit] = { unitId: select.dataset.orderUnit, type: "move", destination: first };
    else if (type === "convoyMove") drafts[select.dataset.orderUnit] = { unitId: select.dataset.orderUnit, type: "move", destination: first, viaConvoy: true };
    else if (type === "support") drafts[select.dataset.orderUnit] = second ? { unitId: select.dataset.orderUnit, type: "support", targetUnitId: first, destination: second } : { unitId: select.dataset.orderUnit, type: "support", targetUnitId: first };
    else if (type === "convoy") drafts[select.dataset.orderUnit] = { unitId: select.dataset.orderUnit, type: "convoy", targetUnitId: first, destination: second };
    else drafts[select.dataset.orderUnit] = { unitId: select.dataset.orderUnit, type: "hold" };
    renderOrderPanel();
    renderMap();
  }));
  $("#commit-orders")?.addEventListener("click", () => send({ type: "orders", orders: Object.values(drafts) }));
}

const BOARD_WIDTH = 1200;
const BOARD_HEIGHT = 620;

const labelAnchors = {
  gla: [25.0, 22.0], ena: [29.2, 25.1], cal: [16.2, 27.8], mex: [21.3, 38.4], yuc: [25.2, 41.3], pan: [27.6, 48.1], car: [30.5, 41.4],
  bri: [48.1, 14.7], weu: [49.7, 20.6], ceu: [53.6, 17.1], sca: [55.4, 8.1], ibe: [47.9, 26.7], bal: [56.2, 23.5], ana: [60.1, 26.5], eeu: [59.2, 17.4],
  mag: [48.4, 32.5], lib: [54.1, 33.3], egy: [58.2, 36.3], lev: [60.7, 31.6], ara: [62.4, 39.5], per: [65.2, 31.7], eaf: [62.3, 52.1],
  ind: [71.2, 39.7], cas: [68.2, 22.8], ste: [67.1, 17.1], mon: [78.5, 21.0], chi: [80.0, 30.0], man: [84.9, 22.5], jak: [88.8, 27.2],
  sea: [78.8, 45.6], mal: [80.8, 57.4], png: [90.8, 58.5], aus: [87.1, 74.2]
};

const territoryRegions = [
  { ids: ["awc", "cal", "gla", "ena", "mex", "yuc", "pan", "car"], polygon: [[36, 72], [92, 38], [170, 48], [242, 78], [322, 118], [392, 165], [383, 232], [354, 290], [316, 324], [262, 282], [214, 274], [160, 292], [104, 253], [58, 201], [38, 143]] },
  { ids: ["ama", "bra", "and", "pat"], polygon: [[240, 292], [330, 292], [390, 330], [455, 390], [444, 470], [365, 566], [320, 584], [285, 512], [262, 438], [238, 356]] },
  { ids: ["bri", "weu", "ceu", "sca", "ibe", "bal", "ana", "eeu"], polygon: [[482, 112], [524, 68], [612, 46], [688, 42], [764, 82], [790, 145], [742, 195], [664, 205], [580, 188], [514, 154]] },
  { ids: ["mag", "lib", "waf", "con", "egy", "lev", "ara", "per", "eaf", "cap"], polygon: [[520, 202], [620, 174], [715, 178], [800, 196], [838, 272], [800, 354], [737, 510], [655, 492], [580, 410], [520, 306]] },
  { ids: ["ind", "cas", "ste", "sib", "mon", "chi", "man", "jak"], polygon: [[742, 98], [854, 62], [940, 50], [1052, 70], [1132, 118], [1122, 176], [1058, 222], [974, 238], [880, 256], [805, 218], [754, 162]] },
  { ids: ["sea", "mal", "png", "aus"], polygon: [[888, 264], [950, 236], [1016, 266], [1092, 318], [1134, 382], [1110, 494], [1026, 548], [950, 520], [906, 440], [884, 344]] }
];

let territoryPathCache = null;

function boardPoint(place) { return { x: place.x / 100 * BOARD_WIDTH, y: place.y / 100 * BOARD_HEIGHT }; }
function polygonPath(points) { return `M ${points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L ")} Z`; }
function fallbackTerritoryPath(place) {
  const point = boardPoint(place);
  const radiusX = 28;
  const radiusY = 20;
  return polygonPath([[point.x, point.y - radiusY], [point.x + radiusX, point.y], [point.x, point.y + radiusY], [point.x - radiusX, point.y]]);
}
function clipPolygon(points, a, b, c) {
  const inside = ([x, y]) => a * x + b * y <= c + 0.001;
  const intersection = (from, to) => {
    const fromValue = a * from[0] + b * from[1] - c;
    const toValue = a * to[0] + b * to[1] - c;
    const denominator = fromValue - toValue;
    const ratio = Math.abs(denominator) < 0.0001 ? 0 : fromValue / denominator;
    return [from[0] + (to[0] - from[0]) * ratio, from[1] + (to[1] - from[1]) * ratio];
  };
  const next = [];
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const previous = points[(index + points.length - 1) % points.length];
    const currentInside = inside(current);
    const previousInside = inside(previous);
    if (currentInside && !previousInside) next.push(intersection(previous, current));
    if (currentInside) next.push(current);
    else if (previousInside) next.push(intersection(previous, current));
  }
  return next;
}
function territoryPaths(provinceById) {
  if (territoryPathCache) return territoryPathCache;
  territoryPathCache = new Map();
  for (const region of territoryRegions) {
    const points = region.ids.map((id) => provinceById[id]).filter(Boolean).map((place) => ({ place, point: boardPoint(place) }));
    for (const candidate of points) {
      let polygon = region.polygon.map(([x, y]) => [x, y]);
      for (const other of points) {
        if (candidate.place.id === other.place.id) continue;
        const a = 2 * (other.point.x - candidate.point.x);
        const b = 2 * (other.point.y - candidate.point.y);
        const c = other.point.x ** 2 + other.point.y ** 2 - candidate.point.x ** 2 - candidate.point.y ** 2;
        polygon = clipPolygon(polygon, a, b, c);
        if (polygon.length < 3) break;
      }
      if (polygon.length >= 3) territoryPathCache.set(candidate.place.id, polygonPath(polygon));
    }
  }
  return territoryPathCache;
}
function routePath(a, b) {
  const from = boardPoint(a);
  const to = boardPoint(b);
  return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} L ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
}
function seaLanePath(route, a, b) {
  const from = boardPoint(a);
  const to = boardPoint(b);
  const mid = boardPoint(route);
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const span = Math.abs(to.x - from.x);
  let controlX = mid.x;
  let controlY = mid.y;
  if (span > 520) {
    controlY = midY < BOARD_HEIGHT / 2 ? Math.max(18, midY - 70) : Math.min(BOARD_HEIGHT - 18, midY + 70);
  } else {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy) || 1;
    const bend = midY > BOARD_HEIGHT * 0.6 ? 34 : midY < BOARD_HEIGHT * 0.22 ? -28 : 24;
    controlX = midX + (-dy / length) * bend;
    controlY = midY + (dx / length) * bend;
  }
  return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} Q ${controlX.toFixed(1)} ${controlY.toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
}
function provinceType(place, provinceById = null) {
  if (place.kind === "sea") return "water";
  const lookup = provinceById ?? Object.fromEntries((game?.map ?? []).map((candidate) => [candidate.id, candidate]));
  return place.neighbors.some((neighbor) => lookup[neighbor]?.kind === "sea") ? "coastal" : "inland";
}
function provinceTypeLabel(place, provinceById = null) {
  const type = provinceType(place, provinceById);
  return type === "water" ? "water province" : `${type} land province`;
}
function seaName(place) {
  return place.name.replace(/ Sea Route$/, " Sea").replace(/–/g, "–");
}
function seaRouteEndpoints(place) {
  if (place.kind !== "sea" || !place.id.startsWith("water_")) return null;
  const parts = place.id.replace(/^water_/, "").split("_");
  return parts.length === 2 ? parts : null;
}
function draftTargetIds() {
  const targets = new Set();
  for (const order of draftOrders()) {
    if ((order.type === "move" || order.type === "retreat") && order.destination) targets.add(order.destination);
    if (order.type === "build" && order.provinceId) targets.add(order.provinceId);
  }
  return targets;
}
function placeTitle(place, ownerFaction) {
  return `${place.kind === "sea" ? seaName(place) : place.name} · ${provinceTypeLabel(place)}${place.supplyCenter ? ` · ${place.supplyCenter} supply center` : " · non-center"}${ownerFaction ? ` — controlled by ${ownerFaction.name}` : ""}`;
}
function placeColor(place, ownerFaction) {
  const homeFaction = faction(place.homeFactionId) ?? game.factions.find((choice) => choice.homes.includes(place.id));
  return ownerFaction?.color ?? homeFaction?.color ?? "";
}
function renderUnitTokens(place, pending) {
  return game.units.filter((unit) => unit.provinceId === place.id).map((unit) => {
    const color = faction(unit.faction)?.color ?? "#aab3c2";
    const title = `${player(unit.ownerId)?.name ?? "Unknown"} ${unit.type}${pending.has(unit.id) ? " (dislodged)" : ""}`;
    return `<i class="unit-token unit-${unit.type} ${pending.has(unit.id) ? "retreating" : ""}" style="--unit-color:${color}" title="${escapeHtml(title)}">${unit.type === "fleet" ? "F" : "A"}</i>`;
  }).join("");
}

function worldArt() {
  return `<svg class="world-art" viewBox="0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <pattern id="map-grid" width="100" height="62" patternUnits="userSpaceOnUse"><path d="M 100 0 L 0 0 0 62" fill="none" stroke="rgba(199,217,207,.14)" stroke-width="1"/></pattern>
    </defs>
    <rect width="1200" height="620" fill="url(#map-grid)" opacity=".72"/>
    <g class="real-land-base">${worldLandMarkup}</g>
    <g class="ocean-lines" fill="none"><path d="M30 128 C180 92 316 108 435 142 S708 179 870 136 S1070 90 1180 127"/><path d="M18 405 C168 369 332 402 466 434 S769 469 936 421 S1090 380 1195 414"/><path d="M86 286 C230 252 344 276 472 308 S790 346 954 299 S1082 262 1170 294"/><path d="M38 548 C192 512 359 526 496 558 S778 596 956 542 S1116 510 1180 540"/></g>
    <g class="region-labels"><text x="184" y="146">NORTH AMERICA</text><text x="326" y="470">SOUTH AMERICA</text><text x="612" y="82">EUROPE</text><text x="640" y="372">AFRICA</text><text x="728" y="194">WEST ASIA</text><text x="938" y="156">ASIA</text><text x="1018" y="574">OCEANIA</text><text x="785" y="514">INDIAN OCEAN</text></g>
  </svg>`;
}

function renderMap() {
  if (!game) return;
  const map = $("#map");
  const provinceById = Object.fromEntries(game.map.map((place) => [place.id, place]));
  const territories = territoryPaths(provinceById);
  const targets = draftTargetIds();
  const pending = pendingUnitIds();
  const territoryLayer = game.map.filter((place) => place.kind !== "sea").map((place) => {
    const ownerFaction = faction(player(game.control[place.id])?.faction);
    const color = placeColor(place, ownerFaction);
    const type = provinceType(place, provinceById);
    const classes = ["territory", `territory-${place.kind}`, `province-${type}`];
    if (color) classes.push("has-color");
    if (ownerFaction) classes.push("controlled");
    if (targets.has(place.id)) classes.push("selected-destination");
    const style = color ? ` style="--province-color:${color}"` : "";
    return `<path class="${classes.join(" ")}"${style} d="${territories.get(place.id) ?? fallbackTerritoryPath(place)}"><title>${escapeHtml(placeTitle(place, ownerFaction))}</title></path>`;
  }).join("");

  const landRoutes = [];
  const seaRoutes = [];
  const seaMarkers = [];
  for (const place of game.map) {
    if (place.kind !== "sea") {
      for (const neighbor of place.neighbors) {
        const neighborPlace = provinceById[neighbor];
        if (neighborPlace?.kind !== "sea" && place.id < neighbor) {
          landRoutes.push(`<path class="route route-land" d="${routePath(place, neighborPlace)}"/>`);
        }
      }
      continue;
    }
    const endpoints = seaRouteEndpoints(place);
    if (!endpoints) continue;
    const [a, b] = endpoints.map((id) => provinceById[id]);
    if (!a || !b) continue;
    const point = boardPoint(place);
    const selected = targets.has(place.id);
    seaRoutes.push(`<path class="route route-sea-lane ${selected ? "selected-destination" : ""}" d="${seaLanePath(place, a, b)}"><title>${escapeHtml(placeTitle(place))}</title></path>`);
    seaMarkers.push(`<g class="sea-space ${selected ? "selected-destination" : ""}" transform="translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})"><title>${escapeHtml(placeTitle(place))}</title><circle class="sea-space-halo" r="18"/><circle class="sea-space-ring" r="7"/></g>`);
  }

  const labels = game.map.filter((place) => place.kind !== "sea").map((place) => {
    const ownerFaction = faction(player(game.control[place.id])?.faction);
    const color = placeColor(place, ownerFaction);
    const center = place.supplyCenter ? `<i class="center-token center-${place.supplyCenter} ${ownerFaction ? "controlled" : ""}"></i>` : "";
    const units = renderUnitTokens(place, pending);
    const [labelX, labelY] = labelAnchors[place.id] ?? [place.x, place.y];
    const style = `--x:${labelX}%;--y:${labelY}%;${color ? `--province-color:${color};` : ""}`;
    const type = provinceType(place, provinceById);
    return `<div class="territory-label province-label-${type} ${targets.has(place.id) ? "selected-destination" : ""}" style="${style}" title="${escapeHtml(placeTitle(place, ownerFaction))}"><span class="territory-name">${escapeHtml(place.name)}</span>${center || units ? `<span class="territory-assets">${center}${units ? `<span class="unit-stack">${units}</span>` : ""}</span>` : ""}</div>`;
  }).join("");

  const seaTokens = game.map.filter((place) => place.kind === "sea").map((place) => {
    const units = renderUnitTokens(place, pending);
    const style = `--x:${place.x}%;--y:${place.y}%;`;
    return `<div class="sea-province-label ${targets.has(place.id) ? "selected-destination" : ""}" style="${style}" title="${escapeHtml(placeTitle(place))}"><span class="territory-name">${escapeHtml(seaName(place))}</span>${units ? `<span class="unit-stack">${units}</span>` : ""}</div>`;
  }).join("");

  const macroBorders = territoryRegions.map((region) => `<path class="macro-border" d="${polygonPath(region.polygon)}"/>`).join("");
  map.innerHTML = `${worldArt()}<svg class="territory-layer" viewBox="0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}" preserveAspectRatio="none" aria-hidden="true"><defs><filter id="territory-shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="6" stdDeviation="7" flood-color="#06101a" flood-opacity=".38"/></filter><clipPath id="world-land-clip">${worldLandMarkup}</clipPath></defs><g filter="url(#territory-shadow)" clip-path="url(#world-land-clip)">${territoryLayer}</g><g class="macro-borders">${macroBorders}</g><g class="real-coastline">${worldLandMarkup}</g></svg><svg class="route-layer" viewBox="0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}" preserveAspectRatio="none" aria-hidden="true"><g class="sea-lanes">${seaRoutes.join("")}</g><g class="land-routes">${landRoutes.join("")}</g><g class="sea-spaces">${seaMarkers.join("")}</g></svg><div class="map-label-layer">${labels}${seaTokens}</div>`;
}

function renderScores() {
  const centers = supplyCenterIds();
  const centerCount = (playerId) => Object.entries(game.control).filter(([provinceId, id]) => centers.has(provinceId) && id === playerId).length;
  const scores = envoys().slice().sort((a, b) => (centerCount(b.id) - centerCount(a.id))).map((candidate) => {
    const value = centerCount(candidate.id);
    const color = faction(candidate.faction)?.color ?? "#62718b";
    return `<div class="score-row"><i class="score-dot" style="background:${color}"></i><span>${escapeHtml(candidate.name)}<small> ${candidate.faction ? `· ${escapeHtml(faction(candidate.faction)?.name.split(" ")[0] ?? "")}` : ""}</small></span><strong>${value}/${game.victoryScore}</strong></div>`;
  }).join("");
  $("#scores").innerHTML = scores;
  const occupiedFactions = game.factions.filter((choice) => game.players.some((candidate) => candidate.faction === choice.id));
  $("#legend").innerHTML = `<span class="legend-item legend-rule"><i class="legend-node home"></i>Home center</span><span class="legend-item legend-rule"><i class="legend-node neutral"></i>Neutral center</span><span class="legend-item legend-rule"><i class="legend-node buffer"></i>Ordinary territory</span><span class="legend-item legend-rule"><i class="legend-node sea"></i>Water province</span><span class="legend-item legend-rule"><i class="legend-route"></i>Naval adjacency aid</span>${occupiedFactions.map((choice) => `<span class="legend-item"><i class="legend-swatch" style="background:${choice.color}"></i>${escapeHtml(choice.name)}</span>`).join("")}`;
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
