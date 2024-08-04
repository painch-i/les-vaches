import { Board } from "./cards";
import { PlayerGameState, RealPlayer } from "./players";

export type onPlayerJoinPlayerCallback = (realPlayerJoinData: {
  playerId: string;
  playerName?: string;
}) => void;
export type onPlayerNameChangeCallback = (realPlayerUpdateNameData: {
  playerId: string,
  playerName: string,
}) => void;

export interface IGameImplementation {
  promptPlayerCardChoice(player: RealPlayer, board: Board): PromiseLike<number>;
  promptPlayerRowChoice(player: RealPlayer, board: Board): PromiseLike<number>;
  promptToPlayAgain(player: RealPlayer): PromiseLike<boolean>;
  onRealPlayerJoin(callback: onPlayerJoinPlayerCallback): void;
  onRealPlayerNameChange(callback: onPlayerNameChangeCallback): void;
  onGameEnd(): PromiseLike<void>;
  onPlayerGameStateChange(playerGameState: PlayerGameState): void;
}