// Wires the modules into one app: settings store, audio engine,
// player, learn session, band with loop, echo and radio, the audience room, deep links. Components bind to this and
// draw; the logic stays in the modules. A small typed event bus tells the components what changed.
import { PlayerRoom } from '../audience/player-room';
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
  readonly songs: readonly Song[]; // scanned songs of this session first, then the library
  on<E extends AppEvent>(event: E, listener: AppEvents[E]): () => void;
  addScannedSong(song: Song): void; // at the top of the library, not persisted
  startSong(song: Song): void;
  restartSong(): void;
  stopSong(): void;
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
      emit('room');
    },
    onApplause: () => {
      emit('applause');
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
    onChord: () => {
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

  const shareHash = (): string =>
    formatHash(store.get(), {
      ...(learn.song === null ? {} : { song: learn.song.title }),
      band: band.running(),
      radio: radio.on(),
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
    store.update({ signature: song.k, ...styleSettings(song.style, band.running()) });
    player.harmony.reset();
    learn.start(song, store.get().difficulty, now());
    room.songStarted({ title: song.title, bpm: song.bpm, signature: song.k, notes: song.notes }, store.model().hue);
    emit('title');
    emit('draw');
    updateUrl();
  };
  const stopSong = (): void => {
    if (learn.song !== null) room.freePlay(store.model().hue);
    learn.stop();
    player.harmony.reset();
    emit('title');
    emit('draw');
    updateUrl();
  };
  const startBand = (): void => {
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
    const sounding = model.chords[chord];
    room.tone(
      toneLabel(model.key, model.style, semitone, labeling),
      sounding === undefined ? '' : chordLabel(sounding, false, labeling),
    );
  };

  player.subscribe({
    press: ({ id, tone, chord, at }) => {
      if (learn.song !== null) {
        // Only the tone counts: which chord lies under it is the other hand's free choice
        learn.press(id, { chord, tone }, now(), true);
        emit('title');
      } else if (room.isOpen) tellAudience(tone, chord);
      if (band.running()) {
        looper.down(id, chord, tone, at);
        echo.press(tone);
        radio.pause();
      }
    },
    release: ({ id, at }) => {
      if (learn.song !== null) learn.release(id, now());
      looper.up(id, at);
    },
    change: () => {
      emit('draw');
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
    updateUrl();
    // A level applies from the song start: a running song begins again (points and records belong to the level)
    if (settings.difficulty !== previous.difficulty && learn.song !== null) startSong(learn.song);
  });

  const songs = (): Song[] => [...scanned, ...SONGS];
  const findSong = (songSlug: string): Song | undefined => songs().find((song) => slug(song.title) === songSlug);

  // Deep link: a song brings its own key and style, a style its suggestions
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
    if (link.radio !== undefined) radio.setOn(link.radio);
    if (link.band === true) startBand();
    if (link.band === false) band.stop();
    if (link.scan === true) emit('open', 'scan');
    updateUrl();
  };

  return {
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
    startBand,
    stopBand: () => {
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
      radio.setOn(on);
      updateUrl();
    },
    recordLoop: () => {
      if (band.running()) looper.record();
    },
    ghosts: () => bandPlayer.ghosts(),
    applyLink,
    shareHash,
    updateUrl,
  };
};
