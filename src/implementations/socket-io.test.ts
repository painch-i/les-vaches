import { RealPlayer } from "../game/players";
import { api } from "./api";

const testPlayer: RealPlayer = {
  name: "Player",
  realPlayerId: "player",
  cowCount: 0,
  hand: [],
};

async function tests() {
  const cardIndex = await api.promptPlayerCardChoice(testPlayer, []);
  console.log(cardIndex);
}

tests();