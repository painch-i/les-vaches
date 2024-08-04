import { cli } from "../implementations/cli";
import { socketIO } from "../implementations/socket-io";
import { Board, Card, cards, Deck } from "./cards";
import { MAX_COW_COUNT, MAX_ROW_SIZE, PLAYER_COUNT, PLAYER_HAND_SIZE, PLAYER_TIMEOUT } from "./config";
import { IGameImplementation } from "./game-implementation.interface";
import { Player, playerActions, players, RealPlayer } from "./players";

function customLog(log: string) {
  // if (players[0].realPlayerId === null) {
  //   return;
  // }
  console.log(log);
}

// Types
type CardChoice = {
  playerIndex: number;
  card: Card;
}

type GameState = {
  board: Board;
  players: Player[];
}

function sendCowsToPlayer(player: Player, row: Card[]) {
  player.cowCount += row.reduce((sum, card) => sum + card.cowCount, 0);
  row.length = 0;
}

const timeoutsByPlayer= new Map<string, NodeJS.Timeout>();

async function waitForPlayerTimeout(player: RealPlayer) {
  return new Promise<void>(resolve => {
    const existingTimeout = timeoutsByPlayer.get(player.realPlayerId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    const timeout = setTimeout(() => {
      (player as Player).realPlayerId = null;
      resolve();
    }, PLAYER_TIMEOUT);
    timeoutsByPlayer.set(player.realPlayerId, timeout);
  });
}

function waitForNewPlayer() {
  return new Promise<void>(resolve => {
    for (const implementation of implementations) {
      implementation.onRealPlayerJoin(() => {
        resolve();
      });
    }
  });
}

function initializeBoard(deck: Deck) {
  board = Array.from({ length: 4 }, () => {
    const row: Card[] = [];
    cards.moveCard({
      from: deck,
      to: row
    });
    return row;
  });
}

function getBoardRowsLastCards() {
  return board.map(row => row[row.length - 1]).sort((a, b) => a.index - b.index);
}

export function getGameState(): GameState {
  return structuredClone({
    board,
    players
  });
}

// Fonction de journalisation
let log: string[] = [];

function logEvent(event: string) {
  customLog(event);
  log.push(event);
}

// Fonction de visualisation de l'état du jeu
function printGameState() {
  customLog("\nCurrent Game State:");
  customLog("Board:");
  board.forEach((row, index) => {
    customLog(`Row ${index}: ${row.map(card => card.index).join(", ")}`);
  });
  customLog("Players:");
  players.forEach(player => {
    customLog(`${player.name}: Hand: ${player.hand.map(card => card.index).join(", ")}, Cow Count: ${player.cowCount}`);
  });
}

function validateCardChoice(player: Player, handIndex: number) {
  if (handIndex < 0 || handIndex >= player.hand.length) {
    throw new Error("Invalid card choice");
  }
}

function validateRowChoice(row: number) {
  if (row < 0 || row >= board.length) {
    throw new Error("Invalid row choice");
  }
}

type PromptPlayerOptions<R> = {
  player: Player;
  promptFn: (implementation: IGameImplementation, realPlayer: RealPlayer) => PromiseLike<R>;
  fallbackFn: () => Promise<R> | R;
  validateFn?: (result: R) => void;
}

async function promptPlayer<R>(options: PromptPlayerOptions<R>): Promise<R> {
  const player = options.player;
  if (player.realPlayerId === null) {
    const result = await options.fallbackFn();
    return result;
  }
  const realPlayer = player as RealPlayer;
  const implementation = implementationByPlayerId.get(realPlayer.realPlayerId);
  if (!implementation) {
    throw new Error("No implementation found for player");
  }
  const promptResult = await Promise.race([options.promptFn(implementation, realPlayer), waitForPlayerTimeout(realPlayer)]);
  let result: R;
  if (promptResult !== undefined) {
    try {
      options.validateFn ? options.validateFn(promptResult) : null;
    } catch (error) {
      console.error(error);
      result = await options.fallbackFn();
    }
    return promptResult;
  } else {
    player.realPlayerId = null;
    result = await options.fallbackFn();
  }
  return result;
}

function atLeastOneRealPlayer() {
  return players.some(player => player.realPlayerId !== null);
}

function refreshPlayerGameStates() {
  printGameState();
  for (const implementation of implementations) {
    for (const player of players) {
      if (player.realPlayerId !== null) {
        implementation.onPlayerGameStateChange(playerActions.getPlayerGameState(player.realPlayerId));
      }
    }
  }
}

let looser: Player | null = null;
let board: Board = [];
let leaderBoard: Player[] = [];
let stillPlaying = true;
const implementations = [cli, socketIO];
const implementationByPlayerId: Map<string, IGameImplementation> = new Map();

for (const implementation of implementations) {
  implementation.onRealPlayerJoin(({ playerId, playerName }) => {
    // Try to find existing player
    let player = players.find(player => player.realPlayerId === playerId);
    if (!player) {
      // Find first player with no realPlayerId
      player = players.find(player => player.realPlayerId === null);
      if (player) {
        player.realPlayerId = playerId;
        if (playerName) {
          player.name = playerName;
        }
      }
    }
    console.log(`${playerName ? playerName : `Player ${playerId}`} joined`);
    implementationByPlayerId.set(playerId, implementation);
  });
  implementation.onRealPlayerNameChange(({ playerId, playerName }) => {
    const player = players.find(player => player.realPlayerId === playerId);
    if (player) {
      player.name = playerName;
      console.log(`${player.name} changed name to ${playerName}`);
    }
  });
}


export async function startGame() {
  while (stillPlaying) {
    if (atLeastOneRealPlayer() === false) {
      console.log("No real players. Waiting for new player.");
      await waitForNewPlayer();
    }
    console.log("Starting game");
    playerActions.resetPlayers();
    looser = null;
    board = [];
    leaderBoard = [];
    while (looser === null) {
      // Mélange du deck
      const deck = cards.getShuffledDeck();
    
      // Initialisation des cartes du plateau
      initializeBoard(deck);
    
      // Distribution des cartes
      for (let i = 0; i < PLAYER_HAND_SIZE; i++) {
        for (const player of players) {
          cards.moveCard({
            from: deck,
            to: player.hand
          });
        }
      }


      // Tours de jeu
      for (let i = 0; i < PLAYER_HAND_SIZE; i++) {
        refreshPlayerGameStates();
        const playerCardChoices: CardChoice[] = [];
        for (let i = 0; i < PLAYER_COUNT; i++) {
          const player = players[i];
          let chosenCard: Card;
          logEvent(`${player.name} has to choose a card`);
          const chosenCardHandIndex = await promptPlayer({
            player,
            promptFn: (implementation, realPlayer) => implementation.promptPlayerCardChoice(realPlayer, board),
            validateFn: (handIndex) => validateCardChoice(player, handIndex),
            fallbackFn: () => Math.floor(Math.random() * player.hand.length)
          });
          chosenCard = cards.pickCardFrom(player.hand, chosenCardHandIndex);
          playerCardChoices[i] = {
            playerIndex: i,
            card: chosenCard,
          };
          logEvent(`${player.name} chose card ${chosenCard.index}`);
        }
        playerCardChoices.sort((a, b) => a.card.index - b.card.index);
        for (let i = 0; i < playerCardChoices.length; i++) {
          const choice = playerCardChoices[i];
          const { card: chosenCard, playerIndex } = choice;
          const boardRowsLastCards: Card[] = getBoardRowsLastCards();
          const player = players[playerIndex];
          let row = -1;
          for (let j = 0; j < boardRowsLastCards.length; j++) {
            if (chosenCard.index > boardRowsLastCards[j].index) {
              row++;
            }
          }
          // Si la carte est plus petite que toutes les cartes du plateau, on demande au joueur de choisir une rangée
          if (row === -1) {
            logEvent(`${player.name} chose card ${chosenCard.index} and has to choose a row`);
            row = await promptPlayer({
              player,
              promptFn: (implementation, realPlayer) => implementation.promptPlayerRowChoice(realPlayer, board),
              validateFn: (row) => validateRowChoice(row),
              fallbackFn: () => Math.floor(Math.random() * board.length)
            })
            sendCowsToPlayer(player, board[row]);
            logEvent(`${player.name} takes row ${row} and gets ${player.cowCount} cows`);
            // Si la rangée est pleine, on envoie les vaches au joueur
          } else if (board[row].length === MAX_ROW_SIZE) {
            sendCowsToPlayer(player, board[row]);
            logEvent(`Row ${row} was full. ${player.name} takes row and gets ${player.cowCount} cows`);
          }
        
          // On place la carte choisie dans la rangée
          cards.moveCard({
            from: [chosenCard],
            to: board[row]
          });
          logEvent(`${player.name} placed card ${chosenCard.index} in row ${row}`);
        }
      }
      // Vérification de l'existance d'un looser
      const looserIndex = players.findIndex(player => player.cowCount >= MAX_COW_COUNT);
      if (looserIndex !== -1) {
        looser = players[looserIndex];
      }
      // Calcul du classement
      leaderBoard = players.sort((a, b) => a.cowCount - b.cowCount);
    }

    customLog(`The looser is ${looser.name} with ${looser.cowCount} cows`);
    customLog(`The leader board is:`);
    leaderBoard.forEach(player => {
      customLog(`${player.name}: ${player.cowCount} cows`);
    });

    const playersStillPlaying: Player[] = [];
    for (const player of players) {
      if (player.realPlayerId !== null) {
        logEvent(`Prompting ${player.name} to play again`);
        const isPlayerStillPlaying = await promptPlayer({
          player,
          promptFn: (implementation, realPlayer) => implementation.promptToPlayAgain(realPlayer),
          fallbackFn: () => false
        });
        if (isPlayerStillPlaying) {
          playersStillPlaying.push(player);
        }
      }
    }
    if (playersStillPlaying.length === 0) {
      console.log("No players left. Game over.");
      stillPlaying = false;
      for (const implementation of implementations) {
        await implementation.onGameEnd();
      }
    }
    for (const timeout of timeoutsByPlayer.values()) {
      clearTimeout(timeout);
    }
  }
}
