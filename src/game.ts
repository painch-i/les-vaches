import { Card, cards } from "./cards";
import { MAX_COW_COUNT, MAX_ROW_SIZE, PLAYER_COUNT, PLAYER_HAND_SIZE } from "./config";
import { Player, playerActions, players } from "./players";

// Types
type CardChoice = {
  playerIndex: number;
  card: Card;
}

function sendCowsToPlayer(player: Player, row: Card[]) {
  player.cowCount += row.reduce((sum, card) => sum + card.cowCount, 0);
  row.length = 0;
}

function emptyPlayerHands() {
  for (const player of players) {
    player.hand = [];
  }
}

function initializeBoard() {
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

// Fonction de journalisation
let log: string[] = [];

function logEvent(event: string) {
  console.log(event);
  log.push(event);
}

// Fonction de visualisation de l'état du jeu
function printGameState() {
  console.log("\nCurrent Game State:");
  console.log("Board:");
  board.forEach((row, index) => {
    console.log(`Row ${index}: ${row.map(card => card.index).join(", ")}`);
  });
  console.log("Players:");
  players.forEach(player => {
    console.log(`Player ${player.index}: Hand: ${player.hand.map(card => card.index).join(", ")}, Cow Count: ${player.cowCount}`);
  });
}

let looser: Player | null = null;
let board: Card[][] = [];
const deck = cards.deck;
let leaderBoard: Player[] = [];


while (looser === null) {
  // Mélange du deck
  cards.shuffleDeck();
  
  // Initialisation des cartes du plateau
  initializeBoard();
  
  // Distribution des cartes
  emptyPlayerHands();
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
      const chosenCard = playerActions.chooseCard(players[i]);
      playerCardChoices[i] = {
        playerIndex: i,
        card: chosenCard,
      };
      logEvent(`Player ${i} chose card ${chosenCard.index}`);
    }
    playerCardChoices.sort((a, b) => a.card.index - b.card.index);
    for (let i = 0; i < playerCardChoices.length; i++) {
      const choice = playerCardChoices[i];
      const { card: chosenCard, playerIndex } = choice;
      const boardRowsLastCards: Card[] = getBoardRowsLastCards();
      console.log(playerCardChoices[i]);
      const player = players[playerIndex];
      let row = -1;
      for (let j = 0; j < boardRowsLastCards.length; j++) {
        if (chosenCard.index > boardRowsLastCards[j].index) {
          row++;
        }
      }
      // Si la carte est plus petite que toutes les cartes du plateau, on la place dans une rangée aléatoire et on envoie les vaches au joueur
      if (row === -1) {
        row = Math.floor(Math.random() * 4);
        sendCowsToPlayer(player, board[row]);
        logEvent(`Player ${player.index} takes row ${row} and gets ${player.cowCount} cows`);
        // Si la rangée est pleine, on envoie les vaches au joueur
      } else if (board[row].length === MAX_ROW_SIZE) {
        sendCowsToPlayer(player, board[row]);
        logEvent(`Row ${row} was full. Player ${player.index} takes row and gets ${player.cowCount} cows`);
      }
      
      // On place la carte choisie dans la rangée
      cards.moveCard({
        from: [chosenCard],
        to: board[row]
      });
      logEvent(`Player ${player.index} placed card ${chosenCard.index} in row ${row}`);
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

console.log(`The looser is player ${looser.index} with ${looser.cowCount} cows`);
console.log(`The leader board is:`);
leaderBoard.forEach(player => {
  console.log(`Player ${player.index}: ${player.cowCount} cows`);
});
// printLog();
