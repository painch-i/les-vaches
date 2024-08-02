import { Card, cards } from "./cards";
import { PLAYER_COUNT } from "./config";

export type Player = {
  index: number;
  hand: Card[];
  cowCount: number;
};

export const players: Player[] = Array.from({ length: PLAYER_COUNT }, (_, index) => ({
  index,
  cowCount: 0,
  hand: []
}));

function chooseCard(player: Player): Card {
  const card = cards.pickCardFrom(player.hand);
  return card;
}

export const playerActions = {
  chooseCard,
};