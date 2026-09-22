import { describe, expect, it } from 'vitest';
import { Applause, APPLAUSE_INTERVAL } from './applause';
import type { OutgoingMessage } from './messages';

describe('Applause', () => {
  it('sends at most twice a second', () => {
    const sent: OutgoingMessage[] = [];
    let now = 1000;
    const applause = new Applause({ send: (message) => sent.push(message) > 0 }, () => now);
    expect(applause.clap()).toBe(true);
    expect(applause.clap()).toBe(false);
    now += APPLAUSE_INTERVAL - 1;
    expect(applause.clap()).toBe(false);
    now += 1;
    expect(applause.clap()).toBe(true);
    expect(sent).toEqual([{ t: 'applause' }, { t: 'applause' }]);
  });

  it('reports a clap that could not be sent', () => {
    const applause = new Applause({ send: () => false }, () => 0);
    expect(applause.clap()).toBe(false);
  });
});
