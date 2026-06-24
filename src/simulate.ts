import {
  formatSimulationReport,
  runSimulation,
  STRATEGIES,
  type SimulationOptions,
  type StrategyName
} from "./simulator.js";

function usage(): string {
  return [
    "Usage: npm run simulate -- [options]",
    "",
    "Options:",
    "  --games, -g <n>             Number of independent games (default: 1000)",
    "  --turns <n>                 Maximum turns per game before a draw (default: 500)",
    "  --players <n>               Players per game, from 2 to 6 (default: 6)",
    `  --strategies <names>       Comma-separated subset of: ${STRATEGIES.join(", ")}`,
    "  --seed <value>              Seed for a reproducible run (default: accord-balance)",
    "  --json                      Emit the full report as JSON",
    "  --help, -h                  Show this message"
  ].join("\n");
}

function requiredValue(args: string[], index: number, option: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith("-")) throw new Error(`${option} requires a value.`);
  return value;
}

function parseInteger(value: string, option: string): number {
  if (!/^\d+$/.test(value)) throw new Error(`${option} must be an integer.`);
  return Number(value);
}

function parseArguments(args: string[]): { options: SimulationOptions; json: boolean; help: boolean } {
  const options: SimulationOptions = {};
  let json = false;
  let help = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--help" || argument === "-h") help = true;
    else if (argument === "--json") json = true;
    else if (argument === "--games" || argument === "-g") {
      options.games = parseInteger(requiredValue(args, index, argument), argument);
      index += 1;
    } else if (argument === "--turns") {
      options.maxTurns = parseInteger(requiredValue(args, index, argument), argument);
      index += 1;
    } else if (argument === "--players") {
      options.playerCount = parseInteger(requiredValue(args, index, argument), argument);
      index += 1;
    } else if (argument === "--seed") {
      options.seed = requiredValue(args, index, argument);
      index += 1;
    } else if (argument === "--strategies") {
      const requested = requiredValue(args, index, argument).split(",").filter(Boolean);
      if (requested.length === 0 || requested.some((strategy) => !STRATEGIES.includes(strategy as StrategyName))) {
        throw new Error(`--strategies must include one or more of: ${STRATEGIES.join(", ")}.`);
      }
      options.strategies = requested as StrategyName[];
      index += 1;
    } else {
      throw new Error(`Unknown option: ${argument}`);
    }
  }
  return { options, json, help };
}

try {
  const { options, json, help } = parseArguments(process.argv.slice(2));
  if (help) {
    console.log(usage());
  } else {
    const report = runSimulation(options);
    console.log(json ? JSON.stringify(report, null, 2) : formatSimulationReport(report));
  }
} catch (reason) {
  console.error(`Simulation failed: ${reason instanceof Error ? reason.message : "Unknown error."}`);
  console.error(`\n${usage()}`);
  process.exitCode = 1;
}
