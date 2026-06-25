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
  $("#map-hint").textContent = spectator ? (acceptingOrders ? `Live public board · ${status} · ${ready}/${playerCount} committed` : `Live public board · ${status}`) : "Set orders in the command panel; this map tracks resolved positions and center control.";
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
  const pending = pendingUnitIds();
  const provinces = game.map.map((place) => {
    const owner = player(game.control[place.id]);
    const ownerFaction = faction(owner?.faction);
    const homeFaction = faction(place.homeFactionId) ?? game.factions.find((choice) => choice.homes.includes(place.id));
    const units = game.units.filter((unit) => unit.provinceId === place.id);
    const target = draftOrders().some((order) => (order.type === "move" || order.type === "retreat") && order.destination === place.id || order.type === "build" && order.provinceId === place.id);
    const color = ownerFaction?.color ?? homeFaction?.color ?? "";
    const style = `--x:${place.x}%;--y:${place.y}%${color ? `;--province-color:${color}` : ""}`;
    const title = `${place.name}${place.supplyCenter ? ` · ${place.supplyCenter} supply center` : place.kind === "sea" ? " · sea space" : " · ordinary province"}${ownerFaction ? ` — controlled by ${ownerFaction.name}` : ""}`;
    return `<div class="province province-${place.kind} ${target ? "selected-destination" : ""} ${ownerFaction ? "controlled" : ""}" style="${style}" title="${escapeHtml(title)}"><span class="province-marker">${units.map((unit) => `<i class="unit-dot ${pending.has(unit.id) ? "retreating" : ""}" style="background:${faction(unit.faction)?.color}" title="${escapeHtml(`${player(unit.ownerId)?.name ?? "Unknown"} ${unit.type}${pending.has(unit.id) ? " (dislodged)" : ""}`)}">${unit.type === "fleet" ? "F" : "A"}</i>`).join("")}</span><span class="province-name ${labelPositions[place.id] ?? (place.kind === "sea" ? "label-s" : "label-e")}">${escapeHtml(place.kind === "sea" ? "Sea" : place.name)}</span></div>`;
  }).join("");
  map.innerHTML = `${worldArt()}<svg class="route-layer" viewBox="0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}" preserveAspectRatio="none" aria-hidden="true">${routes.join("")}</svg>${provinces}`;
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
  $("#legend").innerHTML = `<span class="legend-item legend-rule"><i class="legend-node home"></i>Home center</span><span class="legend-item legend-rule"><i class="legend-node neutral"></i>Neutral center</span><span class="legend-item legend-rule"><i class="legend-node buffer"></i>Ordinary province</span><span class="legend-item legend-rule"><i class="legend-node sea"></i>Sea space</span><span class="legend-item legend-rule"><i class="legend-route"></i>Fleet/convoy edge</span>${occupiedFactions.map((choice) => `<span class="legend-item"><i class="legend-swatch" style="background:${choice.color}"></i>${escapeHtml(choice.name)}</span>`).join("")}`;
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
