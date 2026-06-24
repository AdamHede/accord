# Accord

## Headless balance simulator

Run 1,000 seeded six-player games against the live turn resolver:

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

Use `npm run simulate -- --help` for the complete option list. The simulator defaults to a 500-turn cap; games that have not reached the normal victory score by then are reported as draws.
Accord is a real-time, diplomacy-inspired strategy game. Players join a private room, choose a faction, negotiate publicly or privately, and submit simultaneous movement orders. The first player to control seven provinces wins.

The current playable map is **The Shattered Coast**, an 18-province prototype designed to exercise the game rules and multiplayer flow.

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
npm test         # Run engine tests
npm run smoke    # Run the API smoke test
npm run deploy   # Deploy with Wrangler
```

## How a game works

1. A player creates a council and shares its six-character room code.
2. Each player joins and selects an unclaimed faction.
3. The host starts the game after at least two players have joined.
4. Players negotiate, then secretly commit orders for each unit.
5. Once every player has submitted, the turn resolves simultaneously.
6. A player wins by controlling seven provinces.

## Project layout

| Path | Purpose |
| --- | --- |
| `src/index.ts` | Worker routes, WebSocket handling, and the `GameRoom` Durable Object |
| `src/engine.ts` | Map data, game types, order validation, and turn resolution |
| `public/` | Browser client and styles |
| `test/engine.test.ts` | Unit tests for game-engine behavior |
| `wrangler.jsonc` | Cloudflare Worker, asset, and Durable Object configuration |

## To-do

- [ ] Replace the prototype board with a realistic world map, including geographically meaningful regions and adjacency rules.
- [ ] Build a simulator for automated game testing, turn-resolution stress tests, and balance analysis.
- [ ] Add an AI participant that can choose a faction, negotiate, submit orders, and compete in a world.

