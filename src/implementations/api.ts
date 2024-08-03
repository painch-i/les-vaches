import Fastify from 'fastify';
import { z } from 'zod';
import { Board } from '../game/cards';
import { IGameImplementation, onPlayerJoinPlayerCallback, onPlayerNameChangeCallback } from '../game/game-implementation.interface';
import { Player } from '../game/players';

const fastify = Fastify({
  logger: true
})

const onPlayerJoinCallbacks: onPlayerJoinPlayerCallback[] = [];
const onPlayerNameChangeCallbacks: onPlayerNameChangeCallback[] = [];


fastify.post('/join', async (request, reply) => {
  const { playerId } = z.object({
    playerId: z.string(),
  }).parse(request.body)
  for (const callback of onPlayerJoinCallbacks) {
    try {
      callback(playerId)
    } catch (error) {
      console.error(error);
    }
  }
});

fastify.post('/change-name', async (request, reply) => {
  const { playerId, playerName } = z.object({
    playerId: z.string(),
    playerName: z.string().min(3),
  }).parse(request.body)
  for (const callback of onPlayerNameChangeCallbacks) {
    try {
      callback(playerId, playerName)
    } catch (error) {
      console.error(error);
    }
  }
});


function onRealPlayerJoin(callback: onPlayerJoinPlayerCallback): void {
  onPlayerJoinCallbacks.push(callback);
}

function onRealPlayerNameChange(callback: onPlayerNameChangeCallback): void {
  onPlayerNameChangeCallbacks.push(callback);
}

function onGameEnd() {
  fastify.close();
}

fastify.listen({ port: 3000 }, function (err, address) {
  if (err) {
    fastify.log.error(err)
    fastify.close()
  }
  // Server is now listening on ${address}
})

export const api: IGameImplementation = {
  promptPlayerCardChoice: function (player: Player, board: Board): Promise<number> {
    throw new Error('Function not implemented.');
  },
  promptPlayerRowChoice: function (player: Player, board: Board): Promise<number> {
    throw new Error('Function not implemented.');
  },
  promptToPlayAgain: function (): Promise<boolean> {
    throw new Error('Function not implemented.');
  },
  onRealPlayerJoin,
  onRealPlayerNameChange,
  onGameEnd,
}