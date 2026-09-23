// How far the current bar has run, between one step and the next. The scheduler only says which step it is on, and
// sixteen jumps per bar would show as sixteen jumps; this fills the gaps from the wall clock so anything drawn from
// it moves the way the music does.
import { STEPS_PER_BAR } from './patterns';

export class BarClock {
  private step = 0;
  private at = 0; // when that step arrived, in milliseconds
  private span = 125; // how long a step lasts, learned from the steps themselves

  // A step arrived. `now` is a wall-clock reading, not audio time: this drives drawing, not sound.
  mark(step: number, now: number): void {
    if (step !== this.step) {
      const since = now - this.at;
      // Learn the step length, but only from steps that followed each other: a pause or a restart says nothing
      if (this.at > 0 && since > 20 && since < 2000) this.span = this.span * 0.7 + since * 0.3;
      this.step = step;
      this.at = now;
    }
  }

  // 0 at the start of the bar, 1 at its end – never running past the next step it has not seen yet
  progress(now: number): number {
    const within = Math.max(0, Math.min(1, this.at === 0 ? 0 : (now - this.at) / this.span));
    return Math.min(1, (this.step + within) / STEPS_PER_BAR);
  }

  // Nothing is playing: the bar has not begun
  reset(): void {
    this.step = 0;
    this.at = 0;
  }
}
