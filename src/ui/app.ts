// Wires the modules into one app: settings store, audio engine,
// player, learn session, band with loop, echo and radio, the audience room, deep links. Components bind to this and
// draw; the logic stays in the modules. A small typed event bus tells the components what changed.
import { PlayerRoom } from '../audience/player-room';
import type { GuestSession } from './guest';
import type { SocketFactory } from '../audience/relay-client';
import type { PageLocation } from '../audience/room';
import { type AudioEngine, createAudioEngine } from '../audio/engine';
import { random } from '../audio/random';
import { type Band, createBand } from '../band/band';
import { audioClock, realTimers } from '../band/clock';
import { createEcho, type Echo } from '../band/echo';
import { createLooper, type Looper } from '../band/looper';
import { createPlayer as createBandPlayer, type Ghost } from '../band/player';
import { createRadio, type Radio } from '../band/radio';
import { Records } from '../learn/records';
import { type Finish, LearnSession } from '../learn/session';
import { type Song, slug } from '../learn/song-notation';
import { SONGS } from '../learn/songs';
import { formatHash, parseHash, settingsFromLink } from '../play/deep-links';
import { Player } from '../play/player';
import { type Settings, styleSettings } from '../play/settings';
import { loadSettings, saveSettings, type SettingsStorage } from '../play/settings-storage';
import { createStore, type Store } from '../play/store';
import { chordLabel, toneLabel } from '../theory/labels';
import { pcOf } from '../theory/pitch';
import { melodyFrequency } from '../theory/tuning';

const FADE_IN_SECONDS = 3.5; // the speakers may still be turned up from whatever ran before
const AUTO_POINTER = 'autoplay'; // the app's own finger, one at a time
const AUTO_RESYNC_MS = 250; // fallen this far behind (a hidden tab, a stalled frame): start counting from now again

export type ExtraPanel = 'scan' | 'audience'; // opened from the library or by a link

export interface AppEvents {
  readonly settings: (settings: Settings, previous: Settings) => void;
  readonly title: () => void; // song progress, score, echo state
  readonly band: () => void; // the band started or stopped
  readonly beat: () => void;
  readonly loop: () => void; // armed, recording, layers
  readonly draw: () => void; // something on the grid changed
  readonly finish: (result: Finish) => void;
  readonly records: () => void;
  readonly songs: () => void; // a scanned song joined the library
  readonly room: () => void; // code, connection or listener count of the audience room
  readonly applause: () => void; // a listener clapped
  readonly open: (panel: ExtraPanel, room?: string) => void; // with a room code: the page becomes a listener
}
export type AppEvent = keyof AppEvents;

export interface App {
  readonly store: Store;
  readonly engine: AudioEngine;
  readonly player: Player;
  readonly learn: LearnSession;
  readonly records: Records;
  readonly band: Band;
  readonly looper: Looper;
  readonly echo: Echo;
  readonly radio: Radio;
  readonly room: PlayerRoom;
  guest: GuestSession | null; // set when this device joined someone else's room to play along
  readonly guestTones: () => readonly number[]; // midi notes under a guest's finger, for the host's field
  readonly songs: readonly Song[]; // scanned songs of this session first, then the library
  on<E extends AppEvent>(event: E, listener: AppEvents[E]): () => void;
  addScannedSong(song: Song): void; // at the top of the library, not persisted
  startSong(song: Song): void;
  restartSong(): void;
  stopSong(): void;
  readonly autoplay: () => boolean; // the app plays the song itself, so everyone else can sing
  setAutoplay(on: boolean): void;
  autoStep(at: number): void; // one frame of the app's own playing; the field calls it after the learn tick
  startBand(): void;
  stopBand(): void;
  toggleBand(): void;
  tapTempo(): void;
  startEcho(): void;
  stopEcho(): void;
  setRadio(on: boolean): void;
  recordLoop(): void;
  ghosts(): readonly Ghost[];
  applyLink(hash: string): void;
  start(): void; // the welcome page hands over: sound on, band in, radio playing
  shareHash(): string;
  updateUrl(): void;
}

export interface AppOptions {
  readonly storage: SettingsStorage;
  readonly engine?: AudioEngine;
  readonly now?: () => number; // milliseconds for the learn session
  readonly socket?: SocketFactory; // the browser WebSocket by default
  readonly location?: PageLocation; // the page's location by default
  readonly relayUrl?: string; // instead of the relay next to the page – the e2e tests bring their own
}

type Listeners = { [E in AppEvent]: Set<AppEvents[E]> };

export const createApp = (options: AppOptions): App => {
  const { storage } = options;
  const now = options.now ?? ((): number => performance.now());
  const engine = options.engine ?? createAudioEngine();
  const store = createStore(loadSettings(storage));
  const records = new Records(storage);
  const listeners: Listeners = {
    settings: new Set(),
    title: new Set(),
    band: new Set(),
    beat: new Set(),
    loop: new Set(),
    draw: new Set(),
    finish: new Set(),
    records: new Set(),
    songs: new Set(),
    room: new Set(),
    applause: new Set(),
    open: new Set(),
  };
  const scanned: Song[] = [];
  const emit = <E extends AppEvent>(event: E, ...args: Parameters<AppEvents[E]>): void => {
    for (const listener of listeners[event]) (listener as (...a: Parameters<AppEvents[E]>) => void)(...args);
  };

  const room = new PlayerRoom({
    location: options.location ?? location,
    publicUrl: () => store.get().publicUrl,
    socket: options.socket ?? ((url) => new WebSocket(url)),
    ...(options.relayUrl === undefined ? {} : { relayUrl: options.relayUrl }),
    onChange: () => {
      shareState(); // a room that just opened, or a guest that just arrived, needs the key to play in
      catchUp(); // and the song that was already running when it opened
      emit('room');
    },
    onApplause: () => {
      emit('applause');
    },
    onGuests: () => {
      emit('draw'); // a guest pressed or released a tone: the field shows it
    },
  });

  const player = new Player({ engine, store });
  const learn = new LearnSession(records, {
    onHit: (pos) => {
      room.notePressed(pos); // the moment the audience needs for the syllable
    },
    onAdvance: () => {
      emit('title');
    },
    onFinish: (result) => {
      player.release(AUTO_POINTER);
      room.songEnded();
      emit('records');
      emit('title');
      emit('finish', result);
    },
  });

  // Chord source while the band follows the play: song → auto-harmony → the chord that is sounding → the tonic
  const harmonyChord = (): number | null => (store.get().mode === 'autoHarmony' ? player.harmony.current : null);
  const chordSource = (): number => {
    const sounding = player.chord >= 0 ? player.chord : null;
    return learn.placed[learn.pos]?.spot?.chord ?? harmonyChord() ?? sounding ?? store.model().home;
  };
  const band = createBand({
    engine,
    clock: audioClock(engine),
    timers: realTimers,
    model: () => store.model(),
    tuning: () => store.get().tuning,
    chordSource,
    onBeat: () => {
      emit('beat');
    },
    // A schema leads: the chord it moves to is chosen on the map, so the field breathes with the band and the
    // player sees what is sounding – exactly as if a hand had chosen it.
    onChord: (chord) => {
      if (chord !== null) player.chooseChord(chord, false);
      emit('draw');
    },
  });
  const bandPlayer = createBandPlayer({
    engine: () => band.output(),
    scheduler: band.scheduler,
    melodyFrequency: (chord, tone) => melodyFrequency(store.model(), store.get().tuning, chord, tone),
  });
  const looper = createLooper({
    player: bandPlayer,
    scheduler: band.scheduler,
    onChange: () => {
      emit('loop');
    },
  });
  const echo = createEcho({
    band,
    player: bandPlayer,
    model: () => store.model(),
    rng: random,
    difficulty: () => store.get().difficulty,
    onChange: () => {
      emit('title');
    },
  });
  const radio = createRadio({
    band,
    player: bandPlayer,
    model: () => store.model(),
    rng: random,
    muted: () => echo.active(),
  });

  // Band and radio are on by default: the point is to hear music the moment the welcome page closes. Until then
  // they are only wanted, not running – a browser needs the gesture first.
  const wanted = { band: true, radio: true };
  let started = false;

  const shareHash = (): string =>
    formatHash(store.get(), {
      ...(learn.song === null ? {} : { song: learn.song.title }),
      band: started ? band.running() : wanted.band,
      radio: started ? radio.on() : wanted.radio,
    });
  // The URL carries the state so it can be shared – only deviations from the defaults
  const updateUrl = (): void => {
    const hash = shareHash();
    if (hash === location.hash) return;
    history.replaceState(null, '', location.pathname + location.search + hash);
  };

  const syncBand = (): void => {
    player.bandRunning = band.running();
    emit('band');
    emit('loop');
    emit('draw');
    updateUrl();
  };
  band.onStop(syncBand);

  const startSong = (song: Song): void => {
    echo.stop();
    autoAt = 0;
    // A song is played, not accompanied: the band and the radio step aside so the way through it is the only thing
    // sounding besides the hand
    band.stop();
    radio.setOn(false);
    // A song carries its own chords, note by note: the field must not also go looking for them
    store.update({ signature: song.k, mode: 'twoHands', ...styleSettings(song.style, false) });
    player.harmony.reset();
    learn.start(song, store.get().difficulty, now());
    followSong();
    room.songStarted({ title: song.title, bpm: song.bpm, signature: song.k, notes: song.notes }, store.model().hue);
    emit('title');
    emit('draw');
    updateUrl();
  };
  const stopSong = (): void => {
    if (learn.song !== null) room.freePlay(store.model().hue);
    player.release(AUTO_POINTER);
    learn.stop();
    player.harmony.reset();
    emit('title');
    emit('draw');
    updateUrl();
  };
  const startBand = (): void => {
    started = true;
    if (band.running()) return;
    band.start();
    // The band takes over chord and bass of the chord that is sounding
    player.chordVoice.stop(engine.now());
    syncBand();
  };
  const startEcho = (): void => {
    if (learn.song !== null) stopSong();
    echo.start();
    radio.hush();
    syncBand();
  };

  // Free play for the audience: the tone's name and, if one sounds, the chord symbol with it
  const tellAudience = (tone: number, chord: number): void => {
    const model = store.model();
    const labeling = { mode: 'names', german: store.get().german } as const;
    const semitone = pcOf((model.tones[tone] ?? model.key.tonic) - model.key.tonic);
    // Only what is actually heard: a muted accompaniment is the player's business, not the room's
    const sounding = player.accompanying ? model.chords[chord] : undefined;
    room.tone(
      toneLabel(model.key, model.style, semitone, labeling),
      sounding === undefined ? '' : chordLabel(sounding, false, labeling),
    );
  };

  let guest: GuestSession | null = null;

  // What a musician in the room needs to draw the same field: key, style, tuning, note names, the chord and the
  // sound the host is on, so nobody picks it twice
  const shareState = (): void => {
    if (!room.isOpen) return;
    const settings = store.get();
    room.setState({
      signature: settings.signature,
      style: settings.style,
      tuning: settings.tuning,
      german: settings.german,
      hue: store.model().hue,
      chord: player.chord,
      sound: settings.combi,
    });
  };

  // A song that started before the room opened: the room has never heard of it, and a guest arriving now would be
  // offered karaoke without words, or none at all while a song is running.
  const catchUp = (): void => {
    const song = learn.song;
    if (!room.isOpen || song === null || room.knowsSong) return;
    room.songStarted({ title: song.title, bpm: song.bpm, signature: song.k, notes: song.notes }, store.model().hue);
  };

  // The chord of the tone the thread is on: a song changes harmony exactly where it says it does, and the field
  // is measured against that chord from the moment the way arrives there.
  const followSong = (): void => {
    const spot = learn.placed[learn.pos]?.spot ?? null;
    if (spot !== null && spot.chord !== player.chord) player.chooseChord(spot.chord, false);
  };

  // The app plays the song itself. At a party nobody has to be the one who can play: it presses exactly the spot
  // the thread points at, for exactly as long as the note lasts, and everything else – the karaoke in the room, the
  // chord under the melody, the title – happens as if a hand had done it. One press per note, one note at a time.
  let autoplay = false;
  let autoAt = 0; // when the tone now due should begin; 0 before the first one
  let pressedAt: number | null = null; // the moment the app's finger means, not the frame it happened to land in
  const autoStep = (at: number): void => {
    if (!autoplay || learn.song === null || learn.done || learn.hold !== null) return;
    const placed = learn.placed[learn.pos];
    if (placed?.spot == null) return;
    player.release(AUTO_POINTER); // the tone before it has had its full length
    followSong(); // its chord first: the melody is tuned against it, and the field shows it
    // A frame arrives whenever it arrives. Counting from when the tone was due keeps the song from dragging a
    // sixtieth of a second behind on every single note.
    if (autoAt === 0 || at - autoAt > AUTO_RESYNC_MS) autoAt = at;
    pressedAt = autoAt;
    player.press(AUTO_POINTER, placed.spot.tone);
    pressedAt = null;
    autoAt += (placed.note.beats * 60000) / learn.song.bpm;
  };
  const setAutoplay = (on: boolean): void => {
    autoplay = on;
    autoAt = 0;
    if (!on) player.release(AUTO_POINTER);
    emit('title');
    emit('draw');
  };

  // The hand takes over: the radio hushes for two bars, and a schema stops choosing for the same while
  const humanLeads = (): void => {
    radio.pause();
    band.yield();
  };

  player.subscribe({
    lead: humanLeads,
    press: ({ id, tone, chord, at }) => {
      guest?.note(store.model().tones[tone] ?? 0, true);
      if (learn.song !== null) {
        // Only the tone counts: which chord lies under it is the other hand's free choice
        learn.press(id, { chord, tone }, pressedAt ?? now(), true);
        followSong();
        emit('title');
      } else if (room.isOpen) tellAudience(tone, chord);
      if (band.running()) {
        looper.down(id, chord, tone, at);
        echo.press(tone);
        radio.pause();
      }
    },
    release: ({ id, pointer, at }) => {
      guest?.note(store.model().tones[pointer.tone] ?? 0, false);
      if (learn.song !== null) learn.release(id, now());
      looper.up(id, at);
    },
    change: () => {
      emit('draw');
      room.setChord(player.chord);
    },
  });

  band.setTempo(store.get().tempo);
  band.setSchema(store.get().schema);
  looper.setLoopBars(store.get().loopBars);
  void engine.setCombi(store.get().combi);
  store.subscribe((settings, previous) => {
    saveSettings(storage, settings);
    if (settings.combi !== previous.combi) void engine.setCombi(settings.combi);
    if (settings.tempo !== previous.tempo) band.setTempo(settings.tempo);
    if (settings.schema !== previous.schema) band.setSchema(settings.schema);
    if (settings.loopBars !== previous.loopBars) looper.setLoopBars(settings.loopBars);
    emit('settings', settings, previous);
    emit('title');
    emit('draw');
    shareState(); // the musicians in the room play in the same key, style and tuning
    updateUrl();
    // A level applies from the song start: a running song begins again (points and records belong to the level)
    if (settings.difficulty !== previous.difficulty && learn.song !== null) startSong(learn.song);
  });

  const songs = (): Song[] => [...scanned, ...SONGS];
  const findSong = (songSlug: string): Song | undefined => songs().find((song) => slug(song.title) === songSlug);

  // Deep link: a song brings its own key and style, a style its suggestions. Band and radio are not started here –
  // that needs a gesture, and the welcome page provides it.
  const applyLink = (hash: string): void => {
    const link = parseHash(hash, (songSlug) => findSong(songSlug)?.title);
    if (link.room !== undefined) {
      emit('open', 'audience', link.room);
      return;
    }
    const song = link.song === undefined ? undefined : findSong(slug(link.song));
    const linkSong = song === undefined ? undefined : { signature: song.k, style: song.style };
    store.update(settingsFromLink(store.get(), link, linkSong, band.running()));
    if (song !== undefined) startSong(song);
    if (link.radio !== undefined) wanted.radio = link.radio;
    if (link.band !== undefined) wanted.band = link.band;
    if (started) {
      radio.setOn(wanted.radio);
      if (wanted.band) startBand();
      else band.stop();
    }
    if (link.scan === true) emit('open', 'scan');
    updateUrl();
  };

  // The first gesture of the session: the audio context may run now. Everything that was asked for in the link (or,
  // without a link, the defaults) starts here – and the sound comes up over a few seconds instead of at once.
  const start = (): void => {
    started = true;
    engine.ensure();
    engine.fadeIn(FADE_IN_SECONDS);
    // A guest hears only what their own finger plays: band, radio and chords belong to whoever opened the room
    if (guest !== null) {
      player.silenceChords();
      emit('draw');
      updateUrl();
      return;
    }
    if (wanted.radio) radio.setOn(true);
    if (wanted.band) startBand();
    // The chord that was chosen all along is struck now, so the field sounds from the first moment
    player.chooseChord(player.chord, false);
    emit('draw');
    updateUrl();
  };

  return {
    get guest() {
      return guest;
    },
    set guest(session: GuestSession | null) {
      guest = session;
    },
    guestTones: () => room.guestTones,
    store,
    engine,
    player,
    learn,
    records,
    band,
    looper,
    echo,
    radio,
    room,
    get songs() {
      return songs();
    },
    on: (event, listener) => {
      const set = listeners[event] as Set<typeof listener>;
      set.add(listener);
      return () => {
        set.delete(listener);
      };
    },
    addScannedSong: (song) => {
      scanned.unshift(song);
      emit('songs');
    },
    startSong,
    restartSong: () => {
      if (learn.song !== null) startSong(learn.song);
    },
    stopSong,
    autoplay: () => autoplay,
    setAutoplay,
    autoStep,
    startBand,
    stopBand: () => {
      started = true;
      band.stop();
    },
    toggleBand: () => {
      if (band.running()) band.stop();
      else startBand();
    },
    tapTempo: () => {
      band.tap();
      store.update({ tempo: band.tempo() });
    },
    startEcho,
    stopEcho: () => {
      echo.stop();
      emit('title');
    },
    setRadio: (on) => {
      started = true;
      radio.setOn(on);
      updateUrl();
    },
    recordLoop: () => {
      if (band.running()) looper.record();
    },
    ghosts: () => bandPlayer.ghosts(),
    applyLink,
    start,
    shareHash,
    updateUrl,
  };
};
