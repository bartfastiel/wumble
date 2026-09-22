// Exercises for the school and nature styles: short studies written for the field, one per characteristic scale.
import type { SongDefinition } from '../song-notation';

export const EXERCISES: readonly SongDefinition[] = [
  // Exercise: lydian on F – row II (G major) carries the ♯4 (B), 8 bars
  {
    title: 'Lydische Weite',
    k: -1,
    bpm: 76,
    style: 'lydian',
    group: 'exercises',
    notes: `
    F4/I:2 A4/I C5/I  B4/II:2 G4/II D5/II  C5/I:2 A4/I F4/I  G4/II:2 B4/II:2
    F4/I A4/I C5/I E5/I  D5/II B4/II G4/II:2  A4/I:2 C5/I B4/II  F4/I:4`,
  },
  // Exercise: phrygian on E – ♭II (F major) next to i and the descending cadence iv ♭III ♭II i, 8 bars
  {
    title: 'Flamenco-Skizze',
    k: 4,
    bpm: 100,
    style: 'phrygian',
    group: 'exercises',
    notes: `
    E4/i F4/i:.5 E4/i:.5 D4/i E4/i  F4/bII E4/bII:.5 F4/bII:.5 A4/bII F4/bII  E4/i F4/i:.5 E4/i:.5 G4/i E4/i  F4/bII:2 E4/i:2
    A4/iv G4/iv:.5 A4/iv:.5 C5/iv A4/iv  G4/bIII F4/bIII:.5 G4/bIII:.5 B4/bIII G4/bIII  F4/bII E4/bII:.5 F4/bII:.5 A4/bII F4/bII  E4/i:4`,
  },
  // Exercise: whole-tone scale on C, augmented triads I+, II+, ♭VII+, ♭VI+ – slow and floating
  {
    title: 'Impressionistische Wolke',
    k: 0,
    bpm: 66,
    style: 'wholeTone',
    group: 'exercises',
    notes: `
    C4/I:2 D4/I E4/I  F#4/II:2 G#4/II:2  A#4/bVII:2 G#4/bVII F#4/bVII  E4/I:4
    G#4/bVI:2 F#4/bVI E4/bVI  D4/II:2 E4/II F#4/II  C5/I:2 A#4/I G#4/I  E4/I:2 C4/I:2`,
  },
  // Exercise: harmonic series on C – partials 8 (C) 9 (D) 10 (E) 12 (G) 16 (C), the alphorn fa 11 (F♯ column),
  // the natural seventh 14 (B♭) and the 13th partial (A♭); the call over V7 uses partial 15 (B)
  {
    title: 'Alphorn-Ruf',
    k: 0,
    bpm: 84,
    style: 'harmonicSeries',
    group: 'exercises',
    notes: `
    C4/I:2 E4/I G4/I  C5/I:3 G4/I  E4/I F#4/I G4/I:2  E4/I:2 C4/I:2
    G4/I Bb4/I Ab4/I G4/I  F#4/I G4/I E4/I:2  D4/V B3/V D4/V G4/V  C4/I:4`,
  },
];
