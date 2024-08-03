import { startGame } from "./game/game";
import { api } from "./implementations/api";
import { cli } from "./implementations/cli";

async function main() {
  await startGame([cli, api]);
}
main();