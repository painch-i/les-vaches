// Constantes
const PLAYER_COUNT = 4;
const CARD_COUNT = 104;
const PLAYER_HAND_SIZE = 10;
const MAX_ROW_SIZE = 5;
const MAX_COW_COUNT = 66;

// Types
type Card = {
  index: number;
  cowCount: number;
};

type Player = {
  index: number;
  hand: Card[];
  cowCount: number;
};

type CardChoice = {
  playerIndex: number;
  card: Card;
}

type PlayerCardChoices = {
  [playerIndex: number]: Card;
};

// Utilitaires
function shuffleDeck(deck: Card[]): Card[] {
  const randomValues = new Uint32Array(deck.length);
  crypto.getRandomValues(randomValues);
  
  for (let i = deck.length - 1; i > 0; i--) {
    const j = randomValues[i] % (i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  
  return deck;
}

function pickCardFrom(from: Card[], cardIndex?: number): Card {
  let card: Card | undefined;
  if (cardIndex === undefined) {
    card = from.pop();
  } else {
    card = from.splice(cardIndex, 1)[0];
  }
  if (!card) {
    throw new Error('No card to pick');
  }
  return card;
}

type MoveCardOptions = {
  from: Card[];
  fromCardIndex?: number;
  to: Card[];
};
function moveCard({ from, fromCardIndex, to }: MoveCardOptions) {
  const card = pickCardFrom(from, fromCardIndex);
  to.push(card);
}

function sendCowsToPlayer(player: Player, row: Card[]) {
  player.cowCount += row.reduce((sum, card) => sum + card.cowCount, 0);
  row.length = 0;
}

function getBoardRowsLastCards() {
  return board.map(row => row[row.length - 1]).sort((a, b) => a.index - b.index);
}

function sortBoardRows() {
  board.sort((a, b) => a[a.length - 1].index - b[b.length - 1].index);
}

// Fonction de journalisation
let log: string[] = [];

function logEvent(event: string) {
  console.log(event);
  log.push(event);
}

function printLog() {
  console.log(log.join('\n'));
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

const players: Player[] = Array.from({ length: PLAYER_COUNT }, (_, index) => ({
  index,
  cowCount: 0,
  hand: []
}));

let looser: Player | null = null;

let board: Card[][] = [];
let deck: Card[] = [];
let leaderBoard: Player[] = [];


while (looser === null) {
  // Initialisation
  deck = Array.from({ length: CARD_COUNT }, (_, index) => ({
    index,
    cowCount: 3,
  }));
  deck = shuffleDeck(deck);
  
  board = Array.from({ length: 4 }, () => {
    const row: Card[] = [];
    moveCard({
      from: deck,
      to: row
    });
    return row;
  });
  sortBoardRows();
  
  // Distribution des cartes
  for (let i = 0; i < players.length; i++) {
    players[i].hand = [];
  }
  for (let i = 0; i < PLAYER_HAND_SIZE; i++) {
    for (const player of players) {
      moveCard({
        from: deck,
        to: player.hand
      });
    }
  }
  
  // Tour de jeu
  for (let i = 0; i < PLAYER_HAND_SIZE; i++) {
    printGameState();
    const playerCardChoices: CardChoice[] = [];
    for (let i = 0; i < PLAYER_COUNT; i++) {
      const chosenCard = pickCardFrom(players[i].hand);
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
      moveCard({
        from: [chosenCard],
        to: board[row]
      });
      sortBoardRows();
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
