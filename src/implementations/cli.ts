import input from '@inquirer/input';
import select from '@inquirer/select';
import { Card } from "../game/cards";
import { IGameImplementation, onPlayerJoinPlayerCallback, onPlayerNameChangeCallback } from '../game/game-implementation.interface';
import { Player } from "../game/players";


type CancelablePromise = Promise<any> & { cancel: () => void };

const prompts: CancelablePromise[] = []

function drawBoard(board: Card[][]): string {
  return board.map(row => row.map(card => card.index).join(' ')).join('\n');
}

async function promptPlayerName(): Promise<string> {
  const prompt = input({
    message: 'Enter your name:',
    validate: (input) => {
      if (input.length < 3) {
        return 'Name must be at least 3 characters long';
      }
      return true;
    }
  });
  prompts.push(prompt);
  return prompt;
}

async function promptPlayerCardChoice(player: Player, board: Card[][]): Promise<number> {
  const choices = player.hand.map((card, handIndex) => ({
    name: `Card ${card.index} Cows: ${card.cowCount}`,
    value: handIndex,
    cardIndex: card.index,
  })).sort((a, b) => a.cardIndex - b.cardIndex);
  
  const prompt = select({
    message: `${drawBoard(board)}\n${player.name}, choose a card:`,
    choices,
    loop: false,
  });
  prompts.push(prompt);
  return prompt;
}

async function promptPlayerRowChoice(player: Player, board: Card[][]): Promise<number> {
  const answer = await select({
    message: `${drawBoard(board)}\n${player.name}, choose a row:`,
    choices: board.map((row, index) => ({
      name: `Row ${index + 1}: ${row.map(card => card.index).join(' ')} ${row.reduce((sum, card) => sum + card.cowCount, 0)} cows`,
      value: index
    })),
    loop: false,
  });
  return answer;
}

const onPlayerJoinCallbacks: onPlayerJoinPlayerCallback[] = [];
const onPlayerNameChangeCallbacks: onPlayerNameChangeCallback[] = [];

function onRealPlayerJoin(callback: onPlayerJoinPlayerCallback): void {
  onPlayerJoinCallbacks.push(callback);
}

function onRealPlayerNameChange(callback: onPlayerNameChangeCallback): void {
  onPlayerNameChangeCallbacks.push(callback);
}

function promptToPlayAgain(): Promise<boolean> {
  const prompt = select({
    message: 'Do you want to play again?',
    choices: [
      { name: 'Yes', value: true },
      { name: 'No', value: false }
    ],
    loop: false,
  });
  prompts.push(prompt);
  return prompt;
}

function onGameEnd(): void {
  prompts.forEach(prompt => prompt.cancel());
  prompts.length = 0;
}

const currentUserId = 'cli';
promptPlayerName().then(name => {
  onPlayerJoinCallbacks.forEach(callback => callback(currentUserId));
  onPlayerNameChangeCallbacks.forEach(callback => callback(currentUserId, name));
});


export const cli: IGameImplementation = {
  promptPlayerCardChoice,
  promptPlayerRowChoice,
  onRealPlayerJoin,
  onRealPlayerNameChange,
  onGameEnd,
  promptToPlayAgain,
};

