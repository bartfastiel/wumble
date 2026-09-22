import { beforeEach, describe, expect, it } from 'vitest';
import type { OutgoingMessage } from './messages';
import { type Link, PlayerLink, type PlayerSong } from './player-link';

const SONG: PlayerSong = {
  title: 'Alle meine Entchen',
  bpm: 110,
  signature: 0,
  notes: [
    { midi: 60, beats: 1, text: 'Al-' },
    { midi: 62, beats: 1, text: 'le' },
    { midi: 64, beats: 2 },
  ],
};
const SONG_MESSAGE = {
  t: 'song',
  title: 'Alle meine Entchen',
  bpm: 110,
  k: 0,
  hue: 85,
  notes: [
    { midi: 60, beats: 1, text: 'Al-' },
    { midi: 62, beats: 1, text: 'le' },
    { midi: 64, beats: 2 },
  ],
};

describe('PlayerLink', () => {
  let sent: OutgoingMessage[];
  let open: boolean;
  let applause: number;
  let counts: number[];
  let player: PlayerLink;
  const link: Link = {
    get open() {
      return open;
    },
    send: (message) => {
      sent.push(message);
      return open;
    },
    serverNow: () => 5000,
  };

  beforeEach(() => {
    sent = [];
    open = true;
    applause = 0;
    counts = [];
    player = new PlayerLink({
      link,
      onApplause: () => applause++,
      onListeners: (count) => counts.push(count),
    });
  });

  it('sends the song with its notes, then a position with the server time of every press', () => {
    player.songStarted(SONG, 85);
    player.notePressed(0);
    player.notePressed(1);
    expect(sent).toEqual([SONG_MESSAGE, { t: 'pos', i: 0, s: 5000 }, { t: 'pos', i: 1, s: 5000 }]);
  });

  it('sends the end and free play', () => {
    player.songStarted(SONG, 85);
    player.songEnded();
    player.freePlay(115);
    expect(sent.slice(1)).toEqual([{ t: 'end' }, { t: 'free', hue: 115 }]);
  });

  it('sends tones only while connected', () => {
    player.tone('E', 'C');
    open = false;
    player.tone('G', 'G7');
    expect(sent).toEqual([{ t: 'tone', name: 'E', chord: 'C' }]);
  });

  it('counts listeners from hallo and anwesend and forwards applause', () => {
    player.receive({ t: 'hello', role: 'player', room: 'k7m3x', s: 1, listeners: 0 });
    player.receive({ t: 'present', listeners: 2 });
    player.receive({ t: 'present', listeners: 1 });
    player.receive({ t: 'applause' });
    player.receive({ t: 'applause' });
    player.receive({ t: 'pong', c: 0, s: 0 }); // not the player's business
    expect(counts).toEqual([0, 2, 1]);
    expect(player.listeners).toBe(1);
    expect(applause).toBe(2);
  });

  it('treats a missing or odd count as nobody', () => {
    player.receive({ t: 'present', listeners: -3 });
    player.receive({ t: 'present', listeners: Number.NaN });
    player.receive({ t: 'present', listeners: 2.7 });
    expect(counts).toEqual([0, 0, 2]);
  });

  it('brings newcomers up to date: the song with the last position, or free play', () => {
    player.receive({ t: 'present', listeners: 1 });
    expect(sent).toEqual([{ t: 'free', hue: 0 }]);
    player.freePlay(85);
    player.receive({ t: 'present', listeners: 2 });
    expect(sent.at(-1)).toEqual({ t: 'free', hue: 85 });
    player.songStarted(SONG, 85);
    player.receive({ t: 'present', listeners: 3 });
    expect(sent.slice(-1)).toEqual([SONG_MESSAGE]);
    player.notePressed(2);
    player.receive({ t: 'present', listeners: 4 });
    expect(sent.slice(-2)).toEqual([SONG_MESSAGE, { t: 'pos', i: 2, s: 5000 }]);
    const before = sent.length;
    player.receive({ t: 'present', listeners: 3 }); // someone left – nothing to resend
    expect(sent).toHaveLength(before);
    player.songEnded();
    player.receive({ t: 'present', listeners: 4 });
    expect(sent.slice(-1)).toEqual([SONG_MESSAGE]); // the song stays, its position does not
  });

  it('forgets the listeners when the connection drops', () => {
    player.receive({ t: 'present', listeners: 3 });
    player.disconnected();
    expect(player.listeners).toBe(0);
    expect(counts).toEqual([3, 0]);
  });
});
