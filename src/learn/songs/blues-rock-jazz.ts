// Blues, rock and jazz: a chorus, a riff and a spiritual on the stage styles.
import type { SongDefinition } from '../song-notation';

export const BLUES_ROCK_JAZZ: readonly SongDefinition[] = [
  // One chorus: I7 I7 I7 I7 | IV7 IV7 I7 I7 | V7 IV7 I7 V7 – riff from the C blues scale
  {
    title: '12-Takt-Blues',
    k: 0,
    bpm: 100,
    style: 'blues',
    group: 'bluesRockJazz',
    notes: `
    C4/I Eb4/I F4/I Gb4/I  G4/I:2 Bb4/I G4/I  F4/I Eb4/I C4/I Bb3/I  C4/I:4
    C4/IV Eb4/IV F4/IV Gb4/IV  F4/IV:2 Eb4/IV C4/IV  G4/I Gb4/I F4/I Eb4/I  C4/I:4
    G4/V G4/V Bb4/V C5/V  C5/IV Bb4/IV F4/IV:2  C5/I Bb4/I G4/I Eb4/I  F4/V Gb4/V G4/V:2`,
  },
  // Exercise: power chords I5, ♭VII5 and IV5 over the E minor pentatonic, 8 bars
  {
    title: 'Rock-Riff',
    k: 4,
    bpm: 120,
    style: 'rock',
    group: 'bluesRockJazz',
    notes: `
    E4/I:.5 E4/I:.5 G4/I:.5 E4/I:.5 A4/I:.5 G4/I:.5 E4/I  E4/I:.5 E4/I:.5 G4/I:.5 E4/I:.5 B4/I:.5 A4/I:.5 G4/I
    D4/bVII:.5 D4/bVII:.5 A4/bVII:.5 D4/bVII:.5 G4/bVII:.5 A4/bVII:.5 D4/bVII  A3/IV:.5 A3/IV:.5 E4/IV:.5 A3/IV:.5 G4/IV:.5 E4/IV:.5 A3/IV
    E4/I:.5 E4/I:.5 G4/I:.5 E4/I:.5 A4/I:.5 G4/I:.5 E4/I  E4/I:.5 E4/I:.5 G4/I:.5 E4/I:.5 B4/I:.5 A4/I:.5 G4/I
    D4/bVII:.5 D4/bVII:.5 A4/bVII:.5 D4/bVII:.5 G4/bVII:.5 A4/bVII:.5 D4/bVII  A3/IV:.5 A3/IV:.5 E4/IV:.5 G4/IV:.5 E4/I:2`,
  },
  // Spiritual (New Orleans), jazz four-note chords in C major, 2/4
  {
    title: 'When the Saints Go Marching In',
    k: 0,
    bpm: 120,
    style: 'jazz',
    group: 'bluesRockJazz',
    text: `
    Oh when the saints, oh when the saints, oh when the saints go march- ing in,
    I want to be in that num- ber, when the saints go march- ing in.`,
    notes: `
    C4/I:.5 E4/I:.5 F4/I:.5  G4/I:2.5  C4/I:.5 E4/I:.5 F4/I:.5  G4/I:2.5  C4/I:.5 E4/I:.5 F4/I:.5  G4/I E4/I  C4/I E4/I  D4/V:2.5
    E4/I:.5 E4/I:.5 D4/I:.5  C4/I:2.5  E4/I G4/IV  G4/IV:.5 F4/IV:2.5  E4/I:.5 F4/I:.5  G4/I E4/I  C4/V D4/V  C4/I:2`,
  },
];
