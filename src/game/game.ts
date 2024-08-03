import { cli } from "../implementations/cli";
import { Board, Card, cards, Deck } from "./cards";
import { MAX_COW_COUNT, MAX_ROW_SIZE, PLAYER_COUNT, PLAYER_HAND_SIZE, PLAYER_TIMEOUT } from "./config";
import { IGameImplementation } from "./game-implementation.interface";
import { Player, playerActions, players } from "./players";

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

const timeouts: NodeJS.Timeout[] = [];

async function waitForPlayerTimeout(player: Player) {
  return new Promise<void>(resolve => {
    const timeout = setTimeout(() => {
      player.realPlayerId = null;
      resolve();
    }, PLAYER_TIMEOUT);
    timeouts.push(timeout);
  });
}

function waitForNewPlayer() {
  return new Promise<string>(resolve => {
    cli.onRealPlayerJoin(resolve);
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
  promptFn: (implementation: IGameImplementation) => Promise<R> | R;
  fallbackFn: () => Promise<R> | R;
  validateFn?: (result: R) => void;
}

async function promptPlayer<R>(options: PromptPlayerOptions<R>): Promise<R> {
  const player = options.player;
  if (player.realPlayerId === null) {
    const result = await options.fallbackFn();
    return result;
  }
  const implementation = implementationByPlayerId.get(player.realPlayerId);
  if (!implementation) {
    throw new Error("No implementation found for player");
  }
  const promptResult = await Promise.race([options.promptFn(implementation), waitForPlayerTimeout(player)]);
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

let looser: Player | null = null;
let board: Board = [];
let leaderBoard: Player[] = [];
let stillPlaying = true;
const implementationByPlayerId: Map<string, IGameImplementation> = new Map();

function atLeastOneRealPlayer() {
  return players.some(player => player.realPlayerId !== null);
}

export async function startGame(implementations: IGameImplementation[] = [cli]) {
  for (const implementation of implementations) {
    implementation.onRealPlayerJoin((realPlayerId) => {
      let player = players.find(player => player.realPlayerId === realPlayerId);
      if (!player) {
        player = players.find(player => player.realPlayerId === null);
        if (player) {
          player.realPlayerId = realPlayerId;
        }
      }
      implementationByPlayerId.set(realPlayerId, implementation);
    });
    implementation.onRealPlayerNameChange((realPlayerId, name) => {
      const player = players.find(player => player.realPlayerId === realPlayerId);
      if (player) {
        player.name = name;
      }
    });
  }
  while (stillPlaying) {
    if (atLeastOneRealPlayer() === false) {
      await waitForNewPlayer();
    }
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
        printGameState();
        const playerCardChoices: CardChoice[] = [];
        for (let i = 0; i < PLAYER_COUNT; i++) {
          const player = players[i];
          let chosenCard: Card;
          const chosenCardHandIndex = await promptPlayer({
            player,
            promptFn: (implementation) => implementation.promptPlayerCardChoice(player, board),
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
          // Si la carte est plus petite que toutes les cartes du plateau, on la place dans une rangée aléatoire et on envoie les vaches au joueur
          if (row === -1) {
            row = await promptPlayer({
              player,
              promptFn: (implementation) => implementation.promptPlayerRowChoice(player, board),
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
          printGameState();
        }
      }
      printGameState();
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
    for (const implementation of implementations) {
      implementation.onGameEnd();
    }
    for (const timeout of timeouts) {
      clearTimeout(timeout);
    }
    const playersStillPlaying: Player[] = [];
    for (const player of players) {
      if (player.realPlayerId !== null) {
        const isPlayerStillPlaying = await promptPlayer({
          player,
          promptFn: (implementation) => implementation.promptToPlayAgain(),
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
    }
  }
}
