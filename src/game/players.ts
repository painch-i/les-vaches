import { cli } from "../implementations/cli";
import { Board, Card, cards } from "./cards";
import { PLAYER_COUNT } from "./config";
import { getGameState } from "./game";

export type Player = {
  realPlayerId: string | null;
  name: string;
  hand: Card[];
  cowCount: number;
};

export type PlayerGameState = {
  player: Player;
  board: Board;
};

export const players: Player[] = Array.from({ length: PLAYER_COUNT + 1 }, (_, index) => ({
  realPlayerId: null,
  name: `Player ${index}`,
  cowCount: 0,
  hand: []
}));
players.shift();

cli.onRealPlayerJoin((realPlayerId) => {
  const player = players.find(player => player.realPlayerId === null);
  if (player) {
    player.realPlayerId = realPlayerId;
  }
})

cli.onRealPlayerNameChange((realPlayerId, name) => {
  const player = players.find(player => player.realPlayerId === realPlayerId);
  if (player) {
    player.name = name;
  }
})

function chooseCard(player: Player): Card {
  const card = cards.pickCardFrom(player.hand);
  return card;
}

function getPlayerGameState(realPlayerId: string): PlayerGameState {
  const gameState = getGameState();
  const player = players.find(player => player.realPlayerId === realPlayerId);
  if (!player) {
    throw new Error('Player not found');
  }
  return structuredClone({
    player,
    board: gameState.board,
  });
}

function resetPlayers() {
  for (const player of players) {
    player.cowCount = 0;
    player.hand = [];
  }
}

export const playerActions = {
  chooseCard,
  getPlayerGameState,
  resetPlayers
};
