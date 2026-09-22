// Songs from around the world. Public domain only: folk songs or composers who died before 1925, checked against the
// scores on Wikipedia/Wikisource. Minor and modal styles build on the tonic of the key: techno with k: 2 (D) is D minor.
import type { SongDefinition } from '../song-notation';

export const WORLD: readonly SongDefinition[] = [
  {
    title: 'Ode an die Freude',
    k: 0,
    bpm: 100,
    group: 'world',
    text: `
    Freu- de, schö- ner Göt- ter- fun- ken, Toch- ter aus E- ly- si- um,
    wir be- tre- ten feu- er- trun- ken, Himm- li- sche, dein Hei- lig- tum!`,
    notes: `
    E4/I E4/I F4/I G4/I  G4/I F4/I E4/I D4/V  C4/I C4/I D4/I E4/I  E4/I:1.5 D4/V:.5 D4/V:2
    E4/I E4/I F4/I G4/I  G4/I F4/I E4/I D4/V  C4/I C4/I D4/I E4/I  D4/V:1.5 C4/I:.5 C4/I:2`,
  },
  // Hymn (tune "New Britain", Excell's 1900 version), G major pentatonic, 3/4
  {
    title: 'Amazing Grace',
    k: 1,
    bpm: 84,
    style: 'pentatonic',
    group: 'world',
    text: `
    A- ma- zing _ grace! How sweet the sound, that saved a _ wretch like me!
    I once _ was _ lost, but now _ am _ found, was blind, but _ now I see.`,
    notes: `
    D4/I  G4/I:2 B4/I:.5 G4/I:.5  B4/I:2 A4/V  G4/vi:2 E4/IV  D4/I:2 D4/I  G4/I:2 B4/I:.5 G4/I:.5  B4/I:2 A4/V
    D5/I:2 B4/I  D5/I:1.5 B4/I:.5 D5/I:.5 B4/I:.5  G4/I:2 D4/I  E4/IV:1.5 G4/IV:.5 G4/IV:.5 E4/IV:.5  D4/I:2 D4/I
    G4/vi:2 B4/I:.5 G4/I:.5  B4/I:2 A4/V  G4/I:3`,
  },
  // Scottish folk song, F major pentatonic: verse and chorus
  {
    title: 'Auld Lang Syne',
    k: -1,
    bpm: 96,
    style: 'pentatonic',
    group: 'world',
    text: `
    Should auld ac- quain- tance be for- got, and ne- ver brought to mind? Should
    auld ac- quain- tance be for- got, and auld _ lang _ syne? For
    auld _ lang _ syne, my jo, for auld _ lang _ syne, we'll
    tak' a cup o' kind- ness yet, for auld _ lang _ syne.`,
    notes: `
    C4/I  F4/I:1.5 F4/I:.5 F4/I A4/I  G4/V:1.5 F4/V:.5 G4/V A4/V  F4/I:1.5 F4/I:.5 A4/I C5/I  D5/IV:3 D5/IV
    C5/I:1.5 A4/I:.5 A4/I F4/I  G4/V:1.5 F4/V:.5 G4/V A4/V  F4/I:1.5 D4/I:.5 D4/I C4/V  F4/I:3 D5/I
    C5/I:1.5 A4/I:.5 A4/I F4/I  G4/V:1.5 F4/V:.5 G4/V D5/V  C5/I:1.5 A4/I:.5 A4/I C5/I  D5/IV:3 D5/IV
    C5/I:1.5 A4/I:.5 A4/I F4/I  G4/V:1.5 F4/V:.5 G4/V A4/V  F4/I:1.5 D4/I:.5 D4/I C4/V  F4/I:3`,
  },
  // Stephen Foster 1848 (original in G), here in E♭ major: verse and chorus, 2/4
  {
    title: 'Oh! Susanna',
    k: -3,
    bpm: 112,
    group: 'world',
    notes: `
    Eb4/I:.25 F4/I:.25  G4/I:.5 Bb4/I:.5 Bb4/I:.5 C5/I:.5  Bb4/I:.5 G4/I:.5 Eb4/I:.75 F4/I:.25  G4/I:.5 G4/I:.5 F4/I:.5 Eb4/I:.5  F4/V:1.5 Eb4/V:.25 F4/V:.25
    G4/I:.5 Bb4/I:.5 Bb4/I:.75 C5/I:.25  Bb4/I:.5 G4/I:.5 Eb4/I:.75 F4/I:.25  G4/I:.5 G4/I:.5 F4/V:.5 F4/V:.5  Eb4/I:1.5
    Ab4/IV Ab4/IV  C5/IV:.5 C5/IV C5/IV:.5  Bb4/I:.5 Bb4/I:.5 G4/I:.5 Eb4/I:.5  F4/V:1.5 Eb4/V:.25 F4/V:.25
    G4/I:.5 Bb4/I:.5 Bb4/I:.5 C5/I:.5  Bb4/I:.5 G4/I:.5 Eb4/I:.5 F4/I:.5  G4/I:.5 G4/I:.5 F4/V:.5 F4/V:.5  Eb4/I:2`,
  },
  // English folk song in D dorian (the sixth B in "rosemary"), 3/4
  {
    title: 'Scarborough Fair',
    k: 2,
    bpm: 100,
    style: 'dorian',
    group: 'world',
    text: `
    Are you go- ing to Scar- bo- rough Fair? Pars- ley, sage, rose- ma- ry and thyme.
    Re- mem- ber me to one who lives there, she once was a true love of mine.`,
    notes: `
    D4/i:2 D4/i  A4/i:.5 A4/i:1.5 A4/i  E4/v:1.5 F4/v:.5 E4/v  D4/i:4
    A4/v C5/v  D5/i:2 C5/i  A4/i B4/IV G4/IV  A4/i:2 D5/i
    D5/i:2 D5/i  C5/v:2 A4/v  A4/i G4/i F4/i  E4/v:3
    D4/i:2 A4/i  G4/v:2 F4/v  E4/v D4/v C4/v  D4/i:3`,
  },
  // Shanty in D dorian, 2/4: i and ♭VII in alternation
  {
    title: 'Drunken Sailor',
    k: 2,
    bpm: 104,
    style: 'dorian',
    group: 'world',
    notes: `
    A4/i:.5 A4/i:.25 A4/i:.25 A4/i:.5 A4/i:.25 A4/i:.25  A4/i:.5 D4/i:.5 F4/i:.5 A4/i:.5
    G4/bVII:.5 G4/bVII:.25 G4/bVII:.25 G4/bVII:.5 G4/bVII:.25 G4/bVII:.25  G4/bVII:.5 C4/bVII:.5 E4/bVII:.5 G4/bVII:.5
    A4/i:.5 A4/i:.25 A4/i:.25 A4/i:.5 A4/i:.25 A4/i:.25  A4/i:.5 B4/i:.5 C5/i:.5 D5/i:.5
    C5/bVII:.5 A4/bVII:.5 G4/bVII:.5 E4/bVII:.5  D4/i D4/i
    A4/i A4/i:.75 A4/i:.25  A4/i:.5 D4/i:.5 F4/i:.5 A4/i:.5
    G4/bVII G4/bVII:.75 G4/bVII:.25  G4/bVII:.5 C4/bVII:.5 E4/bVII:.5 G4/bVII:.5
    A4/i A4/i:.75 A4/i:.25  A4/i:.5 B4/i:.5 C5/i:.5 D5/i:.5
    C5/bVII:.5 A4/bVII:.5 G4/bVII:.5 E4/bVII:.5  D4/i D4/i`,
  },
  // Russian folk song (Nekrasov 1861), A natural minor – written an octave lower so it fits the field
  {
    title: 'Korobeiniki',
    k: 3,
    bpm: 140,
    style: 'techno',
    group: 'world',
    notes: `
    E4/i B3/i:.5 C4/i:.5 D4/i C4/i:.5 B3/i:.5  A3/i A3/i:.5 C4/i:.5 E4/i D4/i:.5 C4/i:.5  B3/v B3/v:.5 C4/v:.5 D4/v E4/v  C4/i A3/i A3/i:2
    D4/iv:1.5 F4/iv:.5 A4/iv G4/iv:.5 F4/iv:.5  E4/bIII:1.5 C4/bIII:.5 E4/bIII D4/bIII:.5 C4/bIII:.5  B3/v B3/v:.5 C4/v:.5 D4/v E4/v  C4/i A3/i A3/i:2`,
  },
  // Italian folk song, D minor
  {
    title: 'Bella Ciao',
    k: 2,
    bpm: 120,
    style: 'techno',
    group: 'world',
    notes: `
    A3/i:.5 D4/i:.5 E4/i:.5  F4/i:.5 D4/i:2 A3/i:.5 D4/i:.5 E4/i:.5  F4/i:.5 D4/i:2 A3/i:.5 D4/i:.5 E4/i:.5
    F4/i E4/i:.5 D4/i:.5 F4/i E4/i:.5 D4/i:.5  A4/v A4/v A4/v:.5 A4/v:.5 G4/v:.5 A4/v:.5
    Bb4/iv:.5 Bb4/iv:2 Bb4/iv:.5 Bb4/iv:.5 A4/iv:.5 G4/iv:.5  Bb4/v:.5 A4/v:2 A4/v:.5 A4/v:.5 G4/v:.5 F4/v:.5
    E4/v A4/v F4/v E4/v  D4/i:2`,
  },
  // Hasidic folk tune: phrygian dominant on D = G harmonic minor (rows V7, iv, i)
  {
    title: 'Hava Nagila',
    k: 1,
    bpm: 116,
    style: 'harmonicMinor',
    group: 'world',
    notes: `
    D4/V D4/V:1.5 F#4/V:.5 Eb4/V:.5 D4/V:.5  F#4/V F#4/V:1.5 A4/V:.5 G4/V:.5 F#4/V:.5  G4/iv G4/iv:1.5 Bb4/iv:.5 A4/iv:.5 G4/iv:.5  F#4/V Eb4/iv:.25 D4/iv:.25 Eb4/iv:.5 D4/V:2
    D4/V D4/V:1.5 F#4/V:.5 Eb4/V:.5 D4/V:.5  F#4/V F#4/V:1.5 A4/V:.5 G4/V:.5 F#4/V:.5  G4/iv G4/iv:1.5 Bb4/iv:.5 A4/iv:.5 G4/iv:.5  F#4/V Eb4/iv:.25 D4/iv:.25 Eb4/iv:.5 D4/V:2
    F#4/V:.5 F#4/V Eb4/iv:.5 D4/V:.5 D4/V:.5 D4/V  Eb4/iv:.5 Eb4/iv D4/i:.5 C4/iv:.5 C4/iv:.5 C4/iv  C4/iv Eb4/iv:.75 D4/iv:.25 C4/iv:.5 C4/iv:.5 G4/iv  F#4/V Eb4/iv:.25 D4/iv:.25 Eb4/iv:.5 D4/V:2
    F#4/V:.5 F#4/V Eb4/iv:.5 D4/V:.5 D4/V:.5 D4/V  Eb4/iv:.5 Eb4/iv D4/i:.5 C4/iv:.5 C4/iv:.5 C4/iv  C4/iv Eb4/iv:.75 D4/iv:.25 C4/iv:.5 C4/iv:.5 G4/iv  F#4/V Eb4/iv:.25 D4/iv:.25 Eb4/iv:.5 D4/V:2
    G4/i:2 G4/i:2  G4/i G4/i G4/i G4/i
    G4/i:.5 G4/i:.5 Bb4/i:.75 A4/i:.25 G4/i:.5 Bb4/i:.5 A4/i:.5 G4/i:.5  G4/i:.5 G4/i:.5 Bb4/i:.75 A4/i:.25 G4/i:.5 Bb4/i:.5 A4/i:.5 G4/i:.5
    A4/iv:.5 A4/iv:.5 C5/iv:.75 Bb4/iv:.25 A4/iv:.5 C5/iv:.5 Bb4/iv:.5 A4/iv:.5  A4/iv:.5 A4/iv:.5 C5/iv:.75 Bb4/iv:.25 A4/iv:.5 C5/iv:.5 Bb4/iv:.5 A4/iv:.5
    A4/V:.5 A4/V:.5 D5/V:1.5 D4/V:.5 D4/V:.5 D5/V:2  D4/V:.5 D4/V:.5 D4/V:.5 Bb4/V:.5 A4/V:.5 G4/V:.5 F#4/V:.5  G4/i:3`,
  },
  // Korean folk song, F major pentatonic, 9/8 (quarter note as the beat)
  {
    title: 'Arirang',
    k: -1,
    bpm: 132,
    style: 'pentatonic',
    group: 'world',
    notes: `
    C4/I:2.5 D4/I:.5 C4/I D4/I:.5  F4/I:2.5 G4/I:.5 F4/I G4/I:.5  A4/I:1.5 G4/I:.5 A4/I:.5 G4/I:.5 F4/I D4/I:.5  C4/V:2.5 D4/V:.5 C4/V:.5 D4/V
    F4/I:2.5 G4/I:.5 F4/I G4/I:.5  A4/I G4/I:.5 F4/I D4/I:.5 C4/I D4/I:.5  F4/I:2.5 G4/I:.5 F4/I:1.5  F4/I:4.5
    C5/I:3 C5/I:1.5  C5/V:1.5 A4/V:1.5 G4/V:1.5  A4/I:1.5 G4/I A4/I:.5 F4/I D4/I:.5  C4/V:2.5 D4/V:.5 C4/V:.5 D4/V
    F4/I:2.5 G4/I:.5 F4/I G4/I:.5  A4/I G4/I:.5 F4/I D4/I:.5 C4/I D4/I:.5  F4/I:2.5 G4/I:.5 F4/I:1.5  F4/I:4.5`,
  },
  // Chinese folk song ("Jasmine Flower"), D major pentatonic
  {
    title: 'Mo Li Hua',
    k: 2,
    bpm: 100,
    style: 'pentatonic',
    group: 'world',
    notes: `
    F#4/I F#4/I:.5 A4/I:.5 B4/I:.5 D5/I:.5 D5/I:.5 B4/I:.5  A4/V A4/V:.5 B4/V:.5 A4/V:2
    F#4/I F#4/I:.5 A4/I:.5 B4/I:.5 D5/I:.5 D5/I:.5 B4/I:.5  A4/V A4/V:.5 B4/V:.5 A4/V:2
    A4/I A4/I A4/I F#4/I:.5 A4/I:.5  B4/V B4/V A4/V:2
    F#4/I E4/I:.5 F#4/I:.5 A4/I F#4/I:.5 E4/I:.5  D4/I D4/I:.5 E4/I:.5 D4/I:2
    F#4/I:.5 E4/I:.5 D4/I:.5 F#4/I:.5 E4/I:1.5 F#4/I:.5  A4/I B4/I:.5 D5/I:.5 A4/I:2
    E4/V F#4/V:.5 A4/V:.5 E4/V:.5 F#4/V:.5 D4/V:.5 B3/V:.5  A3/I:2 B3/I D4/I
    E4/V:1.5 F#4/V:.5 D4/V:.5 E4/V:.5 D4/V:.5 B3/V:.5  A3/I:4`,
  },
  // American fiddle tune in A mixolydian, chorus twice (the verse would need a leading tone outside the scale)
  {
    title: 'Old Joe Clark (Refrain)',
    k: 3,
    bpm: 112,
    style: 'mixolydian',
    group: 'world',
    notes: `
    A4/I A4/I  E5/I:.5 D5/I:.5 C#5/I  A4/I A4/I  B4/bVII B4/bVII  A4/I A4/I  E5/I:.5 D5/I:.5 C#5/I  A4/I:.5 C#5/I:.5 B4/bVII:.5 G4/bVII:.5  A4/I A4/I
    A4/I A4/I  E5/I:.5 D5/I:.5 C#5/I  A4/I A4/I  B4/bVII B4/bVII  A4/I A4/I  E5/I:.5 D5/I:.5 C#5/I  A4/I:.5 C#5/I:.5 B4/bVII:.5 G4/bVII:.5  A4/I A4/I`,
  },
];
