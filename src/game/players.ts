import { Board, Card, cards } from "./cards";
import { PLAYER_COUNT } from "./config";
import { getGameState } from "./game";

export type Player = {
  realPlayerId: string | null;
  name: string;
  hand: Card[];
  cowCount: number;
};

export type RealPlayer = Player & {
  realPlayerId: string;
};

export type PlayerGameState = {
  player: RealPlayer;
  board: Board;
};

export const players: Player[] = Array.from({ length: PLAYER_COUNT + 1 }, (_, index) => ({
  realPlayerId: null,
  name: `Player ${index}`,
  cowCount: 0,
  hand: []
}));
players.shift();

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
  const realPlayer = player as RealPlayer;
  return structuredClone({
    player: realPlayer,
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
