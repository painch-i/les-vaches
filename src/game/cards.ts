import { CARD_COUNT } from "./config";

export type Card = {
  index: number;
  cowCount: number;
};

export type Board = Card[][];

export type Deck = Card[];

function createDeck(): Deck {
  const deck = Array.from({ length: CARD_COUNT + 1 }, (_, index) => ({
    index,
    cowCount: 3,
  }));
  deck.shift();
  return deck;
}

function getShuffledDeck() {
  const deck = createDeck();
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
  const card = cards.pickCardFrom(from, fromCardIndex);
  to.push(card);
}

export const cards = {
  pickCardFrom,
  getShuffledDeck,
  moveCard,
}
