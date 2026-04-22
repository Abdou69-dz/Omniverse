export type UnoColor = 'red' | 'blue' | 'green' | 'yellow' | 'wild';
export type UnoValue = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'skip' | 'reverse' | 'draw2' | 'wild' | 'draw4';

export interface UnoCard {
  id: string;
  color: UnoColor;
  value: UnoValue;
  score: number;
}

export interface UnoGameState {
  deck: UnoCard[];
  discardPile: UnoCard[];
  hands: { [userId: string]: UnoCard[] };
  turnIndex: number;
  direction: 1 | -1;
  status: 'waiting' | 'playing' | 'finished';
  winnerId: string | null;
  pendingColorPick: string | null; // userId who needs to pick
  activeColor: UnoColor | null; // For wild cards
  playerOrder: string[];
  unoPressed: { [userId: string]: boolean };
}
