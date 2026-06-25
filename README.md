# Accord

Accord is a real-time, diplomacy-inspired strategy game. Players join a private council, choose a faction, negotiate publicly or privately, and submit simultaneous orders for armies and fleets.

Play: https://accord-strategy.adam-hede.workers.dev

The current map is a 42-land-territory world board with additional explicit sea spaces for fleet movement and convoys. Home and neutral supply centers are distinct from ordinary provinces; the first player to control 16 supply centers wins.

## Stack

- Cloudflare Workers and Durable Objects for room state and WebSocket updates
- TypeScript for the game engine and worker API
- Vanilla HTML, CSS, and JavaScript for the client
- Vitest for engine tests

## Run locally

Prerequisites: Node.js and npm.

```sh
npm install
npm run dev
```

Wrangler prints the local URL when the development server is ready. Open it in two browser windows to create and join a council.

## Available commands

```sh
npm run dev      # Start the local Cloudflare Workers development server
npm run check    # Generate Worker types and type-check the project
npm test         # Run engine and simulator tests
npm run smoke    # Run the API smoke test
npm run deploy   # Deploy with Wrangler
npm run simulate # Run seeded headless balance simulations
```

## How a game works

1. A player creates a council and shares its six-character room code.
2. Each envoy joins and selects an unclaimed faction. Spectators can join to watch the public board.
3. The host starts the game after at least two envoys have joined and every envoy has a faction.
4. Spring and Fall movement phases accept hold, move, support, and convoy orders.
5. Dislodged units enter a retreat phase and must retreat or disband.
6. Supply-center ownership updates only after Fall retreats.
7. Winter adjustments add builds or require disbands until each player’s unit count matches their owned supply centers.
8. A player wins by controlling 16 supply centers.

## Headless balance simulator

Run 1,000 seeded games against the live turn resolver:

```sh
npm run simulate -- --seed balance-v1
```

The report gives resolved wins and draws, then per-seat win rate and average final score for each strategy and faction. A seed makes a run reproducible. The included strategies are independently sampled for every player with replacement, so games naturally contain mixed and repeated strategies.

Useful options:

```sh
# Increase the turn cap, use four players, and limit the strategy pool.
npm run simulate -- --games 1000 --turns 750 --players 4 --strategies random,expansionist --seed candidate-rules

# Machine-readable full report (use --silent when piping npm output).
npm run --silent simulate -- --games 1000 --json > simulation-report.json
```

Use `npm run simulate -- --help` for the complete option list. The simulator defaults to a 500-phase cap; games that have not reached the normal victory score by then are reported as draws.

## Project layout

| Path | Purpose |
| --- | --- |
| `src/index.ts` | Worker routes, WebSocket handling, and the `GameRoom` Durable Object |
| `src/engine.ts` | Map data, game types, order validation, adjudication, retreats, and adjustments |
| `src/simulator.ts` | Headless simulator for balance and stress testing |
| `public/` | Browser client and styles |
| `test/engine.test.ts` | Unit tests for game-engine behavior |
| `wrangler.jsonc` | Cloudflare Worker, asset, and Durable Object configuration |
