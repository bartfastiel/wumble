import { describe, expect, it, vi } from 'vitest';
import type { OutgoingMessage } from './messages';
import { MusicianLink } from './musician-link';

const setup = (open = true) => {
  const sent: OutgoingMessage[] = [];
  const onState = vi.fn();
  const onChord = vi.fn();
  const link = new MusicianLink({
    link: {
      open,
      send: (message) => {
        sent.push(message);
        return true;
      },
    },
    id: 'me',
    onState,
    onChord,
  });
  return { link, sent, onState, onChord };
};

const state = {
  t: 'state',
  k: 3,
  st: 'blues',
  tu: 'just',
  g: true,
  hue: 355,
  c: 2,
  taken: ['organ', 'piano'],
} as const;

describe('MusicianLink', () => {
  it('takes the key, style and tuning from the player', () => {
    const { link, onState } = setup();
    link.receive(state);
    expect(link.state).toEqual({
      signature: 3,
      style: 'blues',
      tuning: 'just',
      german: true,
      hue: 355,
      chord: 2,
      taken: ['organ', 'piano'],
    });
    expect(onState).toHaveBeenCalledTimes(1);
  });

  it('follows the chord on its own, without the rest of the state', () => {
    const { link, onChord } = setup();
    link.receive(state);
    link.receive({ t: 'chord', c: 5 });
    expect(link.state?.chord).toBe(5);
    expect(link.state?.style).toBe('blues');
    expect(onChord).toHaveBeenCalledWith(5);
  });

  it('ignores a chord before it knows anything else', () => {
    const { link, onChord } = setup();
    link.receive({ t: 'chord', c: 5 });
    expect(link.state).toBeNull();
    expect(onChord).not.toHaveBeenCalled();
  });

  it('takes a seat and reports the tones under its fingers, each change once', () => {
    const { link, sent } = setup();
    link.join('guitar', true);
    expect(sent).toEqual([{ t: 'join', id: 'me', sound: 'guitar', low: true }]);
    expect(link.seated).toBe(true);
    link.note(64, true);
    link.note(64, true); // the same finger, still down: nothing new to say
    link.note(67, true);
    link.note(64, false);
    expect(sent.slice(1)).toEqual([
      { t: 'note', id: 'me', midi: 64, on: true },
      { t: 'note', id: 'me', midi: 67, on: true },
      { t: 'note', id: 'me', midi: 64, on: false },
    ]);
  });

  it('says nothing before it has a seat', () => {
    const { link, sent } = setup();
    link.note(60, true);
    expect(sent).toEqual([]);
  });

  it('lets go of everything when the page goes quiet, and gives up the seat on leaving', () => {
    const { link, sent } = setup();
    link.join('bell', false);
    link.note(60, true);
    link.note(62, true);
    link.release();
    expect(sent.filter((message) => message.t === 'note' && !message.on)).toHaveLength(2);
    link.leave();
    expect(sent.at(-1)).toEqual({ t: 'leave', id: 'me' });
    expect(link.seated).toBe(false);
  });

  it('takes its seat again after a reconnect, with nothing held', () => {
    const { link, sent } = setup();
    link.join('bell', false);
    link.note(60, true);
    sent.length = 0;
    link.reconnected();
    expect(sent).toEqual([{ t: 'join', id: 'me', sound: 'bell', low: false }]);
    link.note(60, true); // the old finger is forgotten, so this is news again
    expect(sent.at(-1)).toEqual({ t: 'note', id: 'me', midi: 60, on: true });
  });
});
