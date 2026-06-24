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
