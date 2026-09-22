import { describe, expect, it } from 'vitest';
import { createTapTempo } from './tap-tempo';

describe('createTapTempo', () => {
  it('averages the last four taps from the second tap on', () => {
    let now = 0;
    const tapTempo = createTapTempo({ now: () => now });
    expect(tapTempo.tap()).toBeNull();
    now = 0.5;
    expect(tapTempo.tap()).toBe(120);
    now = 1.5;
    expect(tapTempo.tap()).toBe(80); // two intervals over 1.5 s
    now = 2;
    expect(tapTempo.tap()).toBe(90);
    now = 2.5;
    expect(tapTempo.tap()).toBe(90); // the first tap has dropped out: three intervals over 2 s
  });

  it('starts over after a pause of two seconds', () => {
    let now = 0;
    const tapTempo = createTapTempo({ now: () => now });
    tapTempo.tap();
    now = 0.5;
    tapTempo.tap();
    now = 3;
    expect(tapTempo.tap()).toBeNull();
    now = 3.5;
    expect(tapTempo.tap()).toBe(120);
  });

  it('gives no tempo while the clock stands still', () => {
    const tapTempo = createTapTempo({ now: () => 1 });
    tapTempo.tap();
    expect(tapTempo.tap()).toBeNull();
  });
});
