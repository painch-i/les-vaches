import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { z } from 'zod';
import { Board } from '../game/cards';
import { IGameImplementation, onPlayerJoinPlayerCallback, onPlayerNameChangeCallback } from '../game/game-implementation.interface';
import { playerActions, PlayerGameState, RealPlayer } from '../game/players';

// Créer le serveur HTTP
const server = createServer();

// Créer le serveur Socket.IO
const io = new SocketIOServer(server);

const onPlayerJoinCallbacks: onPlayerJoinPlayerCallback[] = [];
const onPlayerNameChangeCallbacks: onPlayerNameChangeCallback[] = [];

type PlayerPrompt = 'card-choice' | 'row-choice' | 'play-again';
type PromptKey = `${string}-${PlayerPrompt}`;
const pendingPrompts = new Map<PromptKey, (choice: any) => void>();

function sendToPlayer(playerId: string, eventName: string, message?: any) {
  const socketId = socketIdByPlayerId.get(playerId);
  if (!socketId) {
    console.error(`Player ${playerId} not found`);
    return;
  }
  const socket = io.sockets.sockets.get(socketId);
  if (!socket) {
    console.error(`Player ${playerId} not found`);
    return;
  }
  socket.emit(eventName, message);
}

const socketIdByPlayerId = new Map<string, string>();

io.on('connection', (socket) => {
  const socketId = socket.id;
  let socketPlayerId: string | null = null;
  socket.on('join', (data) => {
    try {
      const { playerId, playerName } = z.object({
        playerId: z.string(),
        playerName: z.string().min(3).optional(),
      }).parse(data);
      socketIdByPlayerId.set(playerId, socketId);
      socketPlayerId = playerId;
      for (const callback of onPlayerJoinCallbacks) {
        try {
          callback({
            playerId,
            playerName,
          });
        } catch (error) {
          console.error(error);
        }
      }

      socket.emit('game-state', playerActions.getPlayerGameState(playerId));
    } catch (error) {
      socket.emit('error', { error: 'Invalid join data' });
    }
  });

  socket.on('change-name', (data) => {
    try {
      const { playerId, playerName } = z.object({
        playerName: z.string().min(3),
        playerId: z.string(),
      }).parse({
        ...data,
        playerId: socketPlayerId,
      });

      for (const callback of onPlayerNameChangeCallbacks) {
        try {
          callback({
            playerId,
            playerName,
          });
        } catch (error) {
          console.error(error);
        }
      }

      socket.emit('game-state', playerActions.getPlayerGameState(playerId));
    } catch (error) {
      socket.emit('error', { error: 'Invalid name data' });
    }
  });

  socket.on('choose-card', (data) => {
    try {
      const { playerId, cardIndex } = z.object({
        playerId: z.string(),
        cardIndex: z.number(),
      }).parse({...data, playerId: socketPlayerId});

      const pendingPromptKey = `${playerId}-card-choice` as const;
      if (!pendingPrompts.has(pendingPromptKey)) {
        socket.emit('error', { error: 'Invalid request' });
        return;
      }

      const resolveCardChoice = pendingPrompts.get(pendingPromptKey)!;
      resolveCardChoice(cardIndex);
      pendingPrompts.delete(pendingPromptKey);
      socket.emit('game-state', playerActions.getPlayerGameState(playerId));
    } catch (error) {
      socket.emit('error', { error: 'Invalid card choice data' });
    }
  });

  socket.on('choose-row', (data) => {
    try {
      const { playerId, rowIndex } = z.object({
        playerId: z.string(),
        rowIndex: z.number(),
      }).parse({
        ...data,
        playerId: socketPlayerId,
      });

      const pendingPromptKey = `${playerId}-row-choice` as const;
      if (!pendingPrompts.has(pendingPromptKey)) {
        socket.emit('error', { error: 'Invalid request' });
        return;
      }

      const resolveRowChoice = pendingPrompts.get(pendingPromptKey)!;
      resolveRowChoice(rowIndex);
      pendingPrompts.delete(pendingPromptKey);
      socket.emit('game-state', playerActions.getPlayerGameState(playerId));
    } catch (error) {
      socket.emit('error', { error: 'Invalid row choice data' });
    }
  });

  socket.on('play-again', (data) => {
    try {
      const playAgainData = z.object({
        playerId: z.string(),
        playAgain: z.boolean(),
      }).parse({
        ...data,
        playerId: socketPlayerId,
      });

      const pendingPromptKey = `${playAgainData.playerId}-play-again` as const;
      if (!pendingPrompts.has(pendingPromptKey)) {
        socket.emit('error', { error: 'Invalid request' });
        return;
      }

      const resolvePlayAgain = pendingPrompts.get(pendingPromptKey)!;
      resolvePlayAgain(playAgainData.playAgain);
      pendingPrompts.delete(pendingPromptKey);
      socket.emit('game-state', playerActions.getPlayerGameState(playAgainData.playerId));
    } catch (error) {
      socket.emit('error', { error: 'Invalid play again data' });
    }
  });

  socket.on('disconnect', () => {
    console.log(`Connection closed: ${socket.id}`);
  });
});

function onRealPlayerJoin(callback: onPlayerJoinPlayerCallback): void {
  onPlayerJoinCallbacks.push(callback);
}

function onRealPlayerNameChange(callback: onPlayerNameChangeCallback): void {
  onPlayerNameChangeCallbacks.push(callback);
}

async function onGameEnd() {
  pendingPrompts.clear();
  io.close();
  server.close();
  console.log('Server closed');
}

function onPlayerGameStateChange(playerGameState: PlayerGameState) {
  sendToPlayer(playerGameState.player.realPlayerId, 'game-state', playerGameState);
}

export const socketIO: IGameImplementation = {
  promptPlayerCardChoice: function (player: RealPlayer, board: Board) {
    return new Promise((resolve) => {
      const pendingPromptKey = `${player.realPlayerId}-card-choice` as const;
      pendingPrompts.set(pendingPromptKey, resolve);
      sendToPlayer(player.realPlayerId, 'card-choice-prompted');
    });
  },
  promptPlayerRowChoice: function (player: RealPlayer): Promise<number> {
    return new Promise((resolve) => {
      const pendingPromptKey = `${player.realPlayerId}-row-choice` as const;
      pendingPrompts.set(pendingPromptKey, resolve);
      sendToPlayer(player.realPlayerId, 'row-choice-prompted');
    });
  },
  promptToPlayAgain: function (player: RealPlayer): Promise<boolean> {
    return new Promise((resolve) => {
      const pendingPromptKey = `${player.realPlayerId}-play-again` as const;
      pendingPrompts.set(pendingPromptKey, resolve);
      sendToPlayer(player.realPlayerId, 'play-again-prompted');
    });
  },
  onRealPlayerJoin,
  onRealPlayerNameChange,
  onGameEnd,
  onPlayerGameStateChange,
};

server.listen(3000, () => {
  console.log('Server is listening on port 3000');
});
