// Applause from a listener: at most twice a second reaches the player, faster tapping only animates locally.
import type { OutgoingMessage } from './messages';

export const APPLAUSE_INTERVAL = 500;

export class Applause {
  private lastAt = -Infinity;

  constructor(
    private readonly link: { send(message: OutgoingMessage): boolean },
    private readonly now: () => number,
  ) {}

  // True when the clap went out to the player
  clap(): boolean {
    const now = this.now();
    if (now - this.lastAt < APPLAUSE_INTERVAL) return false;
    this.lastAt = now;
    return this.link.send({ t: 'applause' });
  }
}
