import { Board } from "./cards";
import { Player } from "./players";

export type onPlayerJoinPlayerCallback = (realPlayerId: string) => void;
export type onPlayerNameChangeCallback = (realPlayerId: string, newName: string) => void;

export interface IGameImplementation {
  promptPlayerCardChoice(player: Player, board: Board): Promise<number>;
  promptPlayerRowChoice(player: Player, board: Board): Promise<number>;
  promptToPlayAgain(): Promise<boolean>;
  onRealPlayerJoin(callback: onPlayerJoinPlayerCallback): void;
  onRealPlayerNameChange(callback: onPlayerNameChangeCallback): void;
  onGameEnd(): void;
}