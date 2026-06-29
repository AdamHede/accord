import { WORLD_LAND_PATHS } from "./world-land-paths.js";

const sessionKey = "accord-session-v1";
const worldLandMarkup = WORLD_LAND_PATHS.map((path) => `<path d="${path}"></path>`).join("");
let session = readSession();
let game = null;
let socket = null;
let drafts = {};
let activeTurn = null;
let selectedUnitId = null;
let selectedProvinceId = null;
let toastTimer = null;
let screenWakeLock = null;
const mapViewport = { scale: 1, x: 0, y: 0, pointers: new Map(), lastDistance: 0, suppressClick: false, mode: "embedded", cameraReady: false, cameraPreset: "fitWorld", insets: { top: 0, right: 0, bottom: 0, left: 0 } };
let explicitMapMode = null;
const MAP_DISPLAY_MODES = {
  embedded: { minScale: 0.9, maxScale: 3.2, initialScale: 1 },
  "mobile-dedicated": { minScale: 0.95, maxScale: 4, initialScale: 1.25 },
  "spectator-1080p": { minScale: 0.68, maxScale: 2.4, initialScale: 1 }
};

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
  updateMapDisplayMode();
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

function clearMapSelection() { selectedUnitId = null; selectedProvinceId = null; }

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
      if (activeTurn === null || turnChanged) { activeTurn = game.turn; clearMapSelection(); resetDrafts(); }
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
  $("#map-hint").textContent = spectator ? (acceptingOrders ? `Live public board · ${status} · ${ready}/${playerCount} committed` : `Live public board · ${status}`) : "Pinch or drag the board on mobile. Tap units for legal moves; dashed lanes are fleet and convoy spaces.";
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
const defaultLandLabels = {
  awc: "Alaska", ena: "E. N. America", yuc: "Yucatán", car: "Carib.", pat: "Patagonia", bri: "Britain", weu: "W. Europe", ceu: "C. Europe", sca: "Scand.", eeu: "E. Europe", lib: "Libya", egy: "Egypt", ara: "Arabia", per: "Persia", eaf: "E. Africa", cap: "Cape", cas: "C. Asia", ste: "Steppe", jak: "Japan/Korea", sea: "S.E. Asia", mal: "Malacca", png: "New Guinea"
};

const seaLabels = {
  water_awc_sib: "Bering Sea", water_car_ena: "W. Atlantic", water_car_pan: "Caribbean Sea", water_bra_car: "S. Atlantic", water_bri_sca: "North Sea", water_bri_weu: "Channel", water_ibe_mag: "W. Med.", water_mag_egy: "E. Med.", water_ara_eaf: "Red Sea", water_cap_aus: "Indian Ocean", water_ind_mal: "Andaman Sea", water_mal_sea: "Malacca Strait", water_aus_mal: "Timor Sea", water_mal_png: "Banda Sea", water_aus_png: "Coral Sea", water_man_jak: "E. China Sea", water_jak_sib: "N. Pacific"
};

function labelName(place) {
  return defaultLandLabels[place.id] ?? place.name;
}

function seaName(place) {
  return seaLabels[place.id] ?? place.name.replace(/ Sea Route$/, " Sea").replace(/–/g, "–");
}
function seaRouteEndpoints(place) {
  if (place.kind !== "sea" || !place.id.startsWith("water_")) return null;
  const parts = place.id.replace(/^water_/, "").split("_");
  return parts.length === 2 ? parts : null;
}
function selectedLegalTargetIds() {
  const unit = activeUnits().find((candidate) => candidate.id === selectedUnitId);
  if (!unit) return new Set();
  return new Set(game.map.filter((place) => canMoveDirect(unit, place.id) || (unit.type === "army" && hasPotentialConvoyRoute(unit, place.id))).map((place) => place.id));
}

function draftTargetIds() {
  const targets = selectedLegalTargetIds();
  for (const order of draftOrders()) {
    if ((order.type === "move" || order.type === "retreat") && order.destination) targets.add(order.destination);
    if (order.type === "build" && order.provinceId) targets.add(order.provinceId);
  }
  return targets;
}
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function mapViewportElements() { return { panel: document.querySelector(".map-panel"), viewport: document.querySelector(".map-scroll"), map: $("#map") }; }
const MAP_ZOOM_CLASSES = ["map-zoom-world", "map-zoom-strategic", "map-zoom-regional", "map-zoom-tactical"];
function viewportIsMobile(viewport = document.querySelector(".map-scroll")) {
  const rect = viewport?.getBoundingClientRect();
  return Boolean(window.matchMedia?.("(max-width: 760px)").matches || window.innerWidth < 760 || (rect && rect.width < 640));
}
function deriveMapDisplayMode(viewport = document.querySelector(".map-scroll")) {
  if (isSpectator()) return "spectator-1080p";
  if (explicitMapMode === "mobile-dedicated") return "mobile-dedicated";
  if (document.fullscreenElement && viewportIsMobile(viewport)) return "mobile-dedicated";
  return "embedded";
}
function currentMapDisplayMode(viewport = document.querySelector(".map-scroll")) { return mapViewport.mode || deriveMapDisplayMode(viewport); }
function updateMapDisplayMode() {
  const { panel, viewport, map } = mapViewportElements();
  const previousMode = mapViewport.mode;
  const mode = deriveMapDisplayMode(viewport);
  mapViewport.mode = mode;
  for (const target of [panel, viewport, map, gameShell]) {
    if (target) target.dataset.mapMode = mode;
  }
  const dedicated = mode === "mobile-dedicated";
  $("#open-map").hidden = isSpectator() || !viewportIsMobile(viewport) || dedicated;
  $("#close-map").hidden = !dedicated;
  document.body.classList.toggle("map-dedicated-open", dedicated);
  if (previousMode && previousMode !== mode) setMapCamera(defaultMapCameraPreset(), { preserveMode: true });
  else applyMapViewport();
}
function currentMapZoomLevel(scale = mapViewport.scale, mode = currentMapDisplayMode()) {
  const { viewport } = mapViewportElements();
  const rect = viewport?.getBoundingClientRect();
  const physicalWidth = rect?.width || window.innerWidth || 0;
  const physicalHeight = rect?.height || window.innerHeight || 0;
  const physicalDiagonal = Math.hypot(physicalWidth, physicalHeight);
  const sizeBias = clamp((physicalDiagonal - 760) / 1300, -0.18, 0.18);
  const modeBias = mode === "spectator-1080p" ? 0.22 : mode === "mobile-dedicated" ? 0.14 : mode === "embedded" ? -0.06 : 0;
  const effectiveScale = scale + sizeBias + modeBias;
  if (effectiveScale >= 2.35) return "tactical";
  if (effectiveScale >= 1.45) return "regional";
  if (effectiveScale >= 1.08) return "strategic";
  return "world";
}
function clampMapViewport() {
  const { viewport, map } = mapViewportElements();
  if (!viewport || !map) return;
  const viewportRect = viewport.getBoundingClientRect();
  const mapWidth = map.offsetWidth * mapViewport.scale;
  const mapHeight = map.offsetHeight * mapViewport.scale;
  const insets = mapViewport.insets ?? { top: 0, right: 0, bottom: 0, left: 0 };
  const availableWidth = Math.max(1, viewportRect.width - insets.left - insets.right);
  const availableHeight = Math.max(1, viewportRect.height - insets.top - insets.bottom);
  const minX = Math.min(insets.left, insets.left + availableWidth - mapWidth);
  const maxX = insets.left;
  const minY = Math.min(insets.top, insets.top + availableHeight - mapHeight);
  const maxY = insets.top;
  mapViewport.x = mapWidth <= availableWidth ? insets.left + (availableWidth - mapWidth) / 2 : clamp(mapViewport.x, minX, maxX);
  mapViewport.y = mapHeight <= availableHeight ? insets.top + (availableHeight - mapHeight) / 2 : clamp(mapViewport.y, minY, maxY);
}
function applyMapViewport() {
  const { viewport, map } = mapViewportElements();
  if (!map) return;
  clampMapViewport();
  const displayMode = currentMapDisplayMode(viewport);
  const zoomLevel = currentMapZoomLevel(mapViewport.scale, displayMode);
  map.style.transform = `translate3d(${mapViewport.x}px, ${mapViewport.y}px, 0) scale(${mapViewport.scale})`;
  map.dataset.zoomLevel = zoomLevel;
  map.dataset.displayMode = displayMode;
  map.classList.remove(...MAP_ZOOM_CLASSES, "regional-zoom");
  map.classList.add(`map-zoom-${zoomLevel}`);
}
function zoomMapAt(clientX, clientY, nextScale) {
  const { viewport } = mapViewportElements();
  if (!viewport) return;
  const rect = viewport.getBoundingClientRect();
  const anchorX = clientX - rect.left;
  const anchorY = clientY - rect.top;
  const previousScale = mapViewport.scale;
  const limits = MAP_DISPLAY_MODES[currentMapDisplayMode()] ?? MAP_DISPLAY_MODES.embedded;
  nextScale = clamp(nextScale, limits.minScale, limits.maxScale);
  if (Math.abs(nextScale - previousScale) < 0.001) return;
  const boardX = (anchorX - mapViewport.x) / previousScale;
  const boardY = (anchorY - mapViewport.y) / previousScale;
  mapViewport.scale = nextScale;
  mapViewport.x = anchorX - boardX * nextScale;
  mapViewport.y = anchorY - boardY * nextScale;
  applyMapViewport();
}
const MAP_CAMERA_PRESETS = {
  fitWorld: { box: { left: 0, top: 0, right: BOARD_WIDTH, bottom: BOARD_HEIGHT }, padding: 18 },
  fitEuropeAfrica: { box: { left: 455, top: 35, right: 845, bottom: 540 }, padding: 34 },
  fitAsiaPacific: { box: { left: 720, top: 45, right: 1160, bottom: 590 }, padding: 34 },
  fitAmericas: { box: { left: 25, top: 35, right: 465, bottom: 595 }, padding: 34 }
};
function boxAroundPoints(points, padding = 54) {
  if (!points.length) return null;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    left: clamp(Math.min(...xs) - padding, 0, BOARD_WIDTH),
    top: clamp(Math.min(...ys) - padding, 0, BOARD_HEIGHT),
    right: clamp(Math.max(...xs) + padding, 0, BOARD_WIDTH),
    bottom: clamp(Math.max(...ys) + padding, 0, BOARD_HEIGHT)
  };
}
function provinceCameraBox(provinceId, padding = 90) {
  const place = province(provinceId);
  return place ? boxAroundPoints([boardPoint(place)], padding) : null;
}
function selectedProvinceCameraBox() { return provinceCameraBox(selectedProvinceId, 115); }
function selectedUnitCameraBox() { return provinceCameraBox(activeUnits().find((unit) => unit.id === selectedUnitId)?.provinceId, 115); }
function homeRegionCameraBox() {
  const mine = ownPlayer();
  const homeIds = faction(mine?.faction)?.homes ?? [];
  return boxAroundPoints(homeIds.map((id) => province(id)).filter(Boolean).map(boardPoint), 120);
}
function cameraBoxForPreset(preset) {
  if (preset === "selectedProvince") return selectedProvinceCameraBox() ?? MAP_CAMERA_PRESETS.fitWorld.box;
  if (preset === "selectedUnit") return selectedUnitCameraBox() ?? selectedProvinceCameraBox() ?? MAP_CAMERA_PRESETS.fitWorld.box;
  if (preset === "homeRegion") return homeRegionCameraBox() ?? MAP_CAMERA_PRESETS.fitWorld.box;
  return (MAP_CAMERA_PRESETS[preset] ?? MAP_CAMERA_PRESETS.fitWorld).box;
}
function mapCameraInsets(mode, options = {}) {
  const base = options.padding ?? MAP_CAMERA_PRESETS[options.preset]?.padding ?? 24;
  if (mode === "spectator-1080p") return { top: 128, right: 28, bottom: 72, left: 28 };
  if (mode === "mobile-dedicated") return { top: 82, right: 14, bottom: 86, left: 14 };
  return { top: base, right: base, bottom: base, left: base };
}
function setMapCamera(preset = "fitWorld", options = {}) {
  const { viewport, map } = mapViewportElements();
  if (!viewport || !map) return;
  if (!options.preserveMode) mapViewport.mode = deriveMapDisplayMode(viewport);
  const mode = currentMapDisplayMode(viewport);
  const box = cameraBoxForPreset(preset);
  const insets = { ...mapCameraInsets(mode, { ...options, preset }), ...(options.insets ?? {}) };
  mapViewport.insets = insets;
  const viewportRect = viewport.getBoundingClientRect();
  const mapWidth = map.offsetWidth || BOARD_WIDTH;
  const mapHeight = map.offsetHeight || BOARD_HEIGHT;
  const boxLeft = box.left / BOARD_WIDTH * mapWidth;
  const boxTop = box.top / BOARD_HEIGHT * mapHeight;
  const boxWidth = Math.max(1, (box.right - box.left) / BOARD_WIDTH * mapWidth);
  const boxHeight = Math.max(1, (box.bottom - box.top) / BOARD_HEIGHT * mapHeight);
  const availableWidth = Math.max(1, viewportRect.width - insets.left - insets.right);
  const availableHeight = Math.max(1, viewportRect.height - insets.top - insets.bottom);
  const limits = MAP_DISPLAY_MODES[mode] ?? MAP_DISPLAY_MODES.embedded;
  const fitScale = Math.min(availableWidth / boxWidth, availableHeight / boxHeight);
  mapViewport.scale = clamp(fitScale, limits.minScale, limits.maxScale);
  mapViewport.x = insets.left + (availableWidth - boxWidth * mapViewport.scale) / 2 - boxLeft * mapViewport.scale;
  mapViewport.y = insets.top + (availableHeight - boxHeight * mapViewport.scale) / 2 - boxTop * mapViewport.scale;
  mapViewport.cameraReady = true;
  mapViewport.cameraPreset = preset;
  applyMapViewport();
}
function defaultMapCameraPreset() {
  if (isSpectator()) return "fitWorld";
  if (viewportIsMobile() && homeRegionCameraBox()) return "homeRegion";
  return "fitWorld";
}
function installCameraControls() {
  document.querySelectorAll("[data-camera-preset]").forEach((button) => {
    if (button.dataset.cameraReady === "true") return;
    button.dataset.cameraReady = "true";
    button.addEventListener("click", () => setMapCamera(button.dataset.cameraPreset));
  });
}

function installMapViewportInteractions() {
  const { viewport } = mapViewportElements();
  if (!viewport || viewport.dataset.zoomReady === "true") return;
  viewport.dataset.zoomReady = "true";
  viewport.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary && event.pointerType === "mouse") return;
    viewport.setPointerCapture?.(event.pointerId);
    mapViewport.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (mapViewport.pointers.size === 2) {
      const points = [...mapViewport.pointers.values()];
      mapViewport.lastDistance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
    }
  });
  viewport.addEventListener("pointermove", (event) => {
    const previous = mapViewport.pointers.get(event.pointerId);
    if (!previous) return;
    event.preventDefault();
    const current = { x: event.clientX, y: event.clientY };
    mapViewport.pointers.set(event.pointerId, current);
    if (mapViewport.pointers.size >= 2) {
      const points = [...mapViewport.pointers.values()].slice(0, 2);
      const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      const midpointX = (points[0].x + points[1].x) / 2;
      const midpointY = (points[0].y + points[1].y) / 2;
      if (mapViewport.lastDistance) zoomMapAt(midpointX, midpointY, mapViewport.scale * (distance / mapViewport.lastDistance));
      mapViewport.lastDistance = distance;
      mapViewport.suppressClick = true;
      return;
    }
    const dx = current.x - previous.x;
    const dy = current.y - previous.y;
    if (Math.hypot(dx, dy) > 2) mapViewport.suppressClick = true;
    mapViewport.x += dx;
    mapViewport.y += dy;
    applyMapViewport();
  }, { passive: false });
  const endPointer = (event) => {
    mapViewport.pointers.delete(event.pointerId);
    mapViewport.lastDistance = 0;
  };
  viewport.addEventListener("pointerup", endPointer);
  viewport.addEventListener("pointercancel", endPointer);
  viewport.addEventListener("click", (event) => {
    if (!mapViewport.suppressClick) return;
    event.preventDefault();
    event.stopPropagation();
    mapViewport.suppressClick = false;
  }, true);
  viewport.addEventListener("wheel", (event) => {
    if (!event.ctrlKey && Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;
    event.preventDefault();
    zoomMapAt(event.clientX, event.clientY, mapViewport.scale * (event.deltaY > 0 ? 0.88 : 1.12));
  }, { passive: false });
  viewport.addEventListener("dblclick", (event) => {
    event.preventDefault();
    if (mapViewport.scale > 1.05) setMapCamera(defaultMapCameraPreset());
    else zoomMapAt(event.clientX, event.clientY, 2);
  });
  window.addEventListener("resize", updateMapDisplayMode);
  updateMapDisplayMode();
  if (!mapViewport.cameraReady) setMapCamera(defaultMapCameraPreset(), { preserveMode: true });
}

function openDedicatedMap() { explicitMapMode = "mobile-dedicated"; updateMapDisplayMode(); setMapCamera(defaultMapCameraPreset(), { preserveMode: true }); }
function closeDedicatedMap() { explicitMapMode = null; updateMapDisplayMode(); setMapCamera(defaultMapCameraPreset(), { preserveMode: true }); }

function installMapInteractions(map) {
  map.querySelectorAll("[data-province]").forEach((element) => element.addEventListener("click", (event) => {
    event.stopPropagation();
    selectedProvinceId = element.dataset.province;
    selectedUnitId = null;
    renderMap();
  }));
  map.querySelectorAll("[data-unit]").forEach((element) => element.addEventListener("click", (event) => {
    event.stopPropagation();
    selectedUnitId = element.dataset.unit;
    selectedProvinceId = province(activeUnits().find((unit) => unit.id === selectedUnitId)?.provinceId)?.id ?? null;
    renderMap();
  }));
  map.addEventListener("click", () => { clearMapSelection(); renderMap(); }, { once: true });
}
function placeColor(place, ownerFaction) {
  const homeFaction = faction(place.homeFactionId) ?? game.factions.find((choice) => choice.homes.includes(place.id));
  return ownerFaction?.color ?? homeFaction?.color ?? "";
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

function buildMapViewModel() {
  const provinceById = Object.fromEntries(game.map.map((place) => [place.id, place]));
  const territories = territoryPaths(provinceById);
  const pendingUnitIdsSet = pendingUnitIds();
  const units = game.units ?? [];
  const unitsByProvinceId = new Map();
  for (const unit of units) {
    const stack = unitsByProvinceId.get(unit.provinceId) ?? [];
    stack.push(unit);
    unitsByProvinceId.set(unit.provinceId, stack);
  }
  const selectedUnit = activeUnits().find((candidate) => candidate.id === selectedUnitId) ?? null;
  const selectedProvince = provinceById[selectedProvinceId] ?? (selectedUnit ? provinceById[selectedUnit.provinceId] : null);
  const legalTargetIds = selectedLegalTargetIds();
  const plannedTargetIds = draftTargetIds();
  const plannedOrders = draftOrders();
  const currentOrders = game.myOrders ?? [];
  const ownershipByProvinceId = Object.fromEntries(game.map.map((place) => {
    const owner = player(game.control[place.id]);
    const ownerFaction = faction(owner?.faction);
    return [place.id, { owner, ownerFaction, color: placeColor(place, ownerFaction) }];
  }));
  return {
    displayMode: currentMapDisplayMode(),
    zoomMode: currentMapZoomLevel(),
    provinceById,
    territories,
    ownershipByProvinceId,
    unitsByProvinceId,
    pendingUnitIds: pendingUnitIdsSet,
    selectedProvinceId: selectedProvince?.id ?? null,
    selectedProvince,
    selectedUnitId,
    selectedUnit,
    legalTargetIds,
    plannedTargetIds,
    plannedOrders,
    currentOrders
  };
}

function mapLayerAttributes(name, model) {
  return `data-map-layer="${name}" data-display-mode="${model.displayMode}" data-zoom-mode="${model.zoomMode}"`;
}

function provinceOccupant(model, place) {
  return model.unitsByProvinceId.get(place.id)?.[0] ?? null;
}

function placeTitle(place, ownerFaction, model = null) {
  const occupant = model ? provinceOccupant(model, place) : game?.units.find((unit) => unit.provinceId === place.id);
  return `${place.kind === "sea" ? seaName(place) : place.name} · ${provinceTypeLabel(place, model?.provinceById)}${place.supplyCenter ? ` · ${place.supplyCenter} supply center` : " · non-center"}${ownerFaction ? ` — controlled by ${ownerFaction.name}` : ""}${occupant ? ` · occupied by ${faction(occupant.faction)?.name ?? "unknown"} ${occupant.type}` : ""}`;
}

function renderProvinceInfo(place, model = buildMapViewModel()) {
  const metadata = model.ownershipByProvinceId[place.id] ?? {};
  const occupant = provinceOccupant(model, place);
  const type = provinceType(place, model.provinceById);
  const fleet = placeCanHostFleet(place) ? "yes" : "no";
  return `<div class="map-inspector"><strong>${escapeHtml(place.kind === "sea" ? seaName(place) : place.name)}</strong><span>${escapeHtml(provinceTypeLabel(place, model.provinceById))}</span><span>Center: ${escapeHtml(place.supplyCenter ?? "none")}</span><span>Controller: ${escapeHtml(metadata.ownerFaction?.name ?? "uncontrolled")}</span><span>Occupant: ${occupant ? escapeHtml(`${faction(occupant.faction)?.name ?? "Unknown"} ${occupant.type}`) : "none"}</span>${type !== "water" ? `<span>Army: yes · Fleet: ${fleet}</span>` : `<span>Fleet: yes · Army: no</span>`}<small>Tap units for legal moves. Long-press shows browser details.</small></div>`;
}

function renderBaseWorldLayer(model) {
  return worldArt().replace('class="world-art"', `class="world-art" ${mapLayerAttributes("base-world", model)}`);
}

function renderTerritoryLayer(model) {
  const territoryLayer = game.map.filter((place) => place.kind !== "sea").map((place) => {
    const metadata = model.ownershipByProvinceId[place.id] ?? {};
    const type = provinceType(place, model.provinceById);
    const classes = ["territory", `territory-${place.kind}`, `province-${type}`];
    if (metadata.color) classes.push("has-color");
    if (metadata.ownerFaction) classes.push("controlled");
    if (model.plannedTargetIds.has(place.id)) classes.push("selected-destination");
    if (model.selectedProvinceId === place.id) classes.push("selected-province");
    if (model.selectedUnitId && !model.legalTargetIds.has(place.id)) classes.push("selection-muted");
    const style = metadata.color ? ` style="--province-color:${metadata.color}"` : "";
    return `<path class="${classes.join(" ")}" data-province="${place.id}"${style} d="${model.territories.get(place.id) ?? fallbackTerritoryPath(place)}"><title>${escapeHtml(placeTitle(place, metadata.ownerFaction, model))}</title></path>`;
  }).join("");
  const macroBorders = territoryRegions.map((region) => `<path class="macro-border" d="${polygonPath(region.polygon)}"/>`).join("");
  return `<svg class="territory-layer" ${mapLayerAttributes("territory", model)} viewBox="0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}" preserveAspectRatio="none" aria-hidden="true"><defs><filter id="territory-shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="6" stdDeviation="7" flood-color="#06101a" flood-opacity=".38"/></filter><clipPath id="world-land-clip">${worldLandMarkup}</clipPath></defs><g filter="url(#territory-shadow)" clip-path="url(#world-land-clip)">${territoryLayer}</g><g class="macro-borders">${macroBorders}</g><g class="real-coastline">${worldLandMarkup}</g></svg>`;
}

function renderRouteLayer(model) {
  const landRoutes = [];
  const seaRoutes = [];
  const seaMarkers = [];
  for (const place of game.map) {
    if (place.kind !== "sea") {
      for (const neighbor of place.neighbors) {
        const neighborPlace = model.provinceById[neighbor];
        if (neighborPlace?.kind !== "sea" && place.id < neighbor) landRoutes.push(`<path class="route route-land" d="${routePath(place, neighborPlace)}"/>`);
      }
      continue;
    }
    const endpoints = seaRouteEndpoints(place);
    if (!endpoints) continue;
    const [a, b] = endpoints.map((id) => model.provinceById[id]);
    if (!a || !b) continue;
    const point = boardPoint(place);
    const selected = model.plannedTargetIds.has(place.id);
    seaRoutes.push(`<path class="route route-sea-lane ${selected ? "selected-destination" : ""} ${model.selectedUnitId ? "planning-route" : ""}" d="${seaLanePath(place, a, b)}"><title>${escapeHtml(placeTitle(place, null, model))}</title></path>`);
    seaMarkers.push(`<g class="sea-space ${selected ? "selected-destination" : ""} ${model.selectedProvinceId === place.id ? "selected-province" : ""}" data-province="${place.id}" transform="translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})"><title>${escapeHtml(placeTitle(place, null, model))}</title><circle class="sea-space-halo" r="18"/><circle class="sea-space-ring" r="7"/></g>`);
  }
  return `<svg class="route-layer" ${mapLayerAttributes("routes", model)} viewBox="0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}" preserveAspectRatio="none" aria-hidden="true"><g class="sea-lanes">${seaRoutes.join("")}</g><g class="land-routes">${landRoutes.join("")}</g><g class="sea-spaces">${seaMarkers.join("")}</g></svg>`;
}

function renderUnitTokens(place, modelOrPending) {
  const model = modelOrPending instanceof Set ? null : modelOrPending;
  const pending = model?.pendingUnitIds ?? modelOrPending;
  const units = model?.unitsByProvinceId.get(place.id) ?? game.units.filter((unit) => unit.provinceId === place.id);
  return units.map((unit) => {
    const color = faction(unit.faction)?.color ?? "#aab3c2";
    const title = `${player(unit.ownerId)?.name ?? "Unknown"} ${unit.type}${pending.has(unit.id) ? " (dislodged)" : ""}`;
    return `<i class="unit-token unit-${unit.type} ${pending.has(unit.id) ? "retreating" : ""} ${selectedUnitId === unit.id ? "selected-unit" : ""}" data-unit="${unit.id}" style="--unit-color:${color}" title="${escapeHtml(title)}">${unit.type === "fleet" ? "F" : "A"}</i>`;
  }).join("");
}

function renderLabelLayer(model) {
  const labels = game.map.filter((place) => place.kind !== "sea").map((place) => {
    const metadata = model.ownershipByProvinceId[place.id] ?? {};
    const center = place.supplyCenter ? `<i class="center-token center-${place.supplyCenter} ${metadata.ownerFaction ? "controlled" : ""}"></i>` : "";
    const units = renderUnitTokens(place, model);
    const [labelX, labelY] = labelAnchors[place.id] ?? [place.x, place.y];
    const style = `--x:${labelX}%;--y:${labelY}%;${metadata.color ? `--province-color:${metadata.color};` : ""}`;
    const type = provinceType(place, model.provinceById);
    return `<div class="territory-label province-label-${type} ${model.plannedTargetIds.has(place.id) ? "selected-destination" : ""} ${model.selectedProvinceId === place.id ? "selected-province" : ""}" data-province="${place.id}" style="${style}" title="${escapeHtml(placeTitle(place, metadata.ownerFaction, model))}"><span class="territory-name territory-name-short">${escapeHtml(labelName(place))}</span><span class="territory-name territory-name-full">${escapeHtml(place.name)}</span>${center || units ? `<span class="territory-assets">${center}${units ? `<span class="unit-stack">${units}</span>` : ""}</span>` : ""}</div>`;
  }).join("");
  return `<div class="map-label-layer" ${mapLayerAttributes("labels", model)}>${labels}</div>`;
}

function renderUnitLayer(model) {
  const seaTokens = game.map.filter((place) => place.kind === "sea").map((place) => {
    const units = renderUnitTokens(place, model);
    const style = `--x:${place.x}%;--y:${place.y}%;`;
    return `<div class="sea-province-label ${model.plannedTargetIds.has(place.id) ? "selected-destination" : ""} ${model.selectedProvinceId === place.id ? "selected-province" : ""}" data-province="${place.id}" style="${style}" title="${escapeHtml(placeTitle(place, null, model))}"><span class="territory-name">${escapeHtml(seaName(place))}</span>${units ? `<span class="unit-stack">${units}</span>` : ""}</div>`;
  }).join("");
  return `<div class="map-unit-layer" ${mapLayerAttributes("units", model)}>${seaTokens}</div>`;
}

function renderOrderOverlayLayer(model) {
  return `<div class="map-order-overlay-layer" ${mapLayerAttributes("orders", model)} data-planned-orders="${model.plannedOrders.length}" data-current-orders="${model.currentOrders.length}"></div>`;
}

function renderInspectorLayer(model) {
  return `<div class="map-inspector-layer" ${mapLayerAttributes("inspector", model)}>${model.selectedProvince ? renderProvinceInfo(model.selectedProvince, model) : ""}</div>`;
}

function renderMap() {
  if (!game) return;
  const map = $("#map");
  const model = buildMapViewModel();
  map.innerHTML = [
    renderBaseWorldLayer(model),
    renderTerritoryLayer(model),
    renderRouteLayer(model),
    renderLabelLayer(model),
    renderUnitLayer(model),
    renderOrderOverlayLayer(model),
    renderInspectorLayer(model)
  ].join("");
  installMapInteractions(map);
  installCameraControls();
  installMapViewportInteractions();
  updateMapDisplayMode();
  if (!mapViewport.cameraReady) setMapCamera(defaultMapCameraPreset(), { preserveMode: true });
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
$("#open-map").addEventListener("click", openDedicatedMap);
$("#close-map").addEventListener("click", closeDedicatedMap);
$("#spectator-fullscreen").addEventListener("click", () => { void toggleFullscreen(); });
$("#leave-room").addEventListener("click", () => { socket?.close(); void releaseScreenWakeLock(); localStorage.removeItem(sessionKey); session = null; game = null; location.href = "/"; });

document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") void requestScreenWakeLock(); });
window.addEventListener("pagehide", () => { void releaseScreenWakeLock(); });
document.addEventListener("fullscreenchange", () => { $("#spectator-fullscreen").textContent = document.fullscreenElement ? "Exit fullscreen" : "Fullscreen"; updateMapDisplayMode(); });

const inviteRoomCode = new URLSearchParams(location.search).get("room")?.toUpperCase().replace(/[^A-Z0-9]/g, "");
if (inviteRoomCode) $("#join-code").value = inviteRoomCode.slice(0, 6);

if (session) {
  api(`/api/rooms/${session.roomCode}/state`, { headers: { "X-Player-Id": session.playerId, "X-Player-Token": session.playerToken } }).then((state) => { game = state; activeTurn = game.turn; resetDrafts(); render(); openSocket(); }).catch(() => { localStorage.removeItem(sessionKey); session = null; });
}
