import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = process.env.ACCORD_URL ?? "http://127.0.0.1:8787";
const wsBase = baseUrl.replace(/^http/, "ws");
const roomCount = Number(process.env.ACCORD_VISUAL_ROOMS ?? "2");
const outputDir = process.env.ACCORD_VISUAL_OUTPUT ?? "artifacts/visual-smoke";
const factions = ["north-american-union", "european-compact", "afro-arabian-league", "asian-coalition", "southern-maritime-league"];

async function request(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const result = await response.json().catch(() => ({}));
  assert.equal(response.ok, true, result.error ?? `HTTP ${response.status}`);
  return result;
}

function client(session) {
  const socket = new WebSocket(`${wsBase}/ws/${session.roomCode}?playerId=${session.playerId}&token=${session.playerToken}`);
  let state = null;
  let failure = null;
  let open = false;
  socket.addEventListener("open", () => { open = true; });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.type === "state") state = message.payload;
    if (message.type === "error") failure = new Error(message.message);
  });
  return { socket, get open() { return open; }, get state() { return state; }, get failure() { return failure; } };
}

function waitFor(condition, label, timeoutMs = 7000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
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

async function createStartedRoom(index) {
  const host = await request("/api/rooms", { name: `Visual Host ${index}` });
  const guest = await request(`/api/rooms/${host.roomCode}/join`, { name: `Visual Guest ${index}` });
  const spectator = await request(`/api/rooms/${host.roomCode}/join`, { name: `Visual Board ${index}`, role: "spectator" });
  const hostClient = client(host);
  const guestClient = client(guest);
  await waitFor(() => hostClient.open && guestClient.open && hostClient.state && guestClient.state, `room ${host.roomCode} sockets`);
  hostClient.socket.send(JSON.stringify({ type: "faction", factionId: factions[(index * 2) % factions.length] }));
  guestClient.socket.send(JSON.stringify({ type: "faction", factionId: factions[(index * 2 + 1) % factions.length] }));
  await waitFor(() => {
    if (hostClient.failure || guestClient.failure) throw hostClient.failure ?? guestClient.failure;
    return hostClient.state?.players.filter((player) => player.faction).length >= 2;
  }, `room ${host.roomCode} factions`);
  hostClient.socket.send(JSON.stringify({ type: "start" }));
  await waitFor(() => hostClient.state.status === "orders", `room ${host.roomCode} start`);
  hostClient.socket.close();
  guestClient.socket.close();
  return { host, guest, spectator, roomCode: host.roomCode };
}

async function openSessionPage(browser, session, viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  await context.addInitScript(({ session }) => localStorage.setItem("accord-session-v1", JSON.stringify(session)), { session });
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.locator("#game:not([hidden])").waitFor();
  await page.locator(".unit-token").first().waitFor();
  await page.waitForTimeout(250);
  return { context, page };
}

async function captureRoom(browser, room, index) {
  const roomDir = `${outputDir}/${room.roomCode}`;
  await mkdir(roomDir, { recursive: true });

  const spectator = await openSessionPage(browser, room.spectator, { width: 1920, height: 1080 });
  await assertMapReadable(spectator.page, "spectator");
  await spectator.page.screenshot({ path: `${roomDir}/spectator-world.png`, fullPage: true });
  for (const preset of ["fitEuropeAfrica", "fitAsiaPacific", "fitAmericas"]) {
    await spectator.page.locator(`[data-camera-preset="${preset}"]`).click();
    await spectator.page.waitForTimeout(200);
    await assertMapReadable(spectator.page, `spectator ${preset}`);
    await spectator.page.screenshot({ path: `${roomDir}/spectator-${preset}.png`, fullPage: true });
  }

  const player = await openSessionPage(browser, room.host, { width: 1440, height: 1000 });
  await assertMapReadable(player.page, "player");
  await player.page.locator(".unit-token").first().click();
  await player.page.locator(".selected-destination").first().waitFor();
  await player.page.screenshot({ path: `${roomDir}/player-selected-unit.png`, fullPage: true });

  await player.context.close();
  await spectator.context.close();
  console.log(`visual smoke room ${index + 1}/${roomCount}: ${room.roomCode}`);
}

async function assertMapReadable(page, label) {
  const metrics = await page.evaluate(() => {
    const map = document.querySelector("#map");
    const rect = map?.getBoundingClientRect();
    return {
      unitTokens: document.querySelectorAll(".unit-token").length,
      territoryLabels: document.querySelectorAll(".territory-label").length,
      seaLabels: document.querySelectorAll(".sea-province-label").length,
      mapWidth: rect?.width ?? 0,
      mapHeight: rect?.height ?? 0,
      zoomLevel: map?.dataset.zoomLevel ?? ""
    };
  });
  assert.ok(metrics.mapWidth > 300 && metrics.mapHeight > 200, `${label} map is too small: ${JSON.stringify(metrics)}`);
  assert.ok(metrics.unitTokens >= 6, `${label} has too few visible unit tokens: ${JSON.stringify(metrics)}`);
  assert.ok(metrics.territoryLabels >= 40, `${label} has too few territory labels: ${JSON.stringify(metrics)}`);
  assert.ok(metrics.seaLabels >= 8, `${label} has too few sea labels: ${JSON.stringify(metrics)}`);
}

await mkdir(outputDir, { recursive: true });
const rooms = [];
for (let index = 0; index < roomCount; index += 1) rooms.push(await createStartedRoom(index));

const browser = await chromium.launch();
try {
  for (let index = 0; index < rooms.length; index += 1) await captureRoom(browser, rooms[index], index);
} finally {
  await browser.close();
}
console.log(`visual smoke passed for ${rooms.length} room(s); screenshots in ${outputDir}`);
