// Children's songs. Melodies in the public domain only, checked against the scores on Wikipedia/Wikisource; the lyrics
// follow the Lilypond sources with \addlyrics, one syllable per note (see song-notation.ts).
import type { SongDefinition } from '../song-notation';

export const CHILDREN: readonly SongDefinition[] = [
  {
    title: 'Alle meine Entchen',
    k: 0,
    bpm: 110,
    group: 'children',
    text: `
    Al- le mei- ne Ent- chen schwim- men auf dem See, schwim- men auf dem See,
    Köpf- chen in das Was- ser, Schwänz- chen in die Höh'.`,
    notes: `
    C4/I D4/I E4/I F4/I G4/I:2 G4/I:2  A4/IV A4/IV A4/IV A4/IV G4/I:4  A4/IV A4/IV A4/IV A4/IV G4/I:4
    F4/IV F4/IV F4/IV F4/IV E4/I:2 E4/I:2  G4/V G4/V G4/V G4/V C4/I:4`,
  },
  {
    title: 'Hänschen klein',
    k: 0,
    bpm: 120,
    group: 'children',
    text: `
    Häns- chen klein ging al- lein in die wei- te Welt hi- nein.
    Stock und Hut steht ihm gut, ist gar wohl- ge- mut.`,
    notes: `
    G4/I E4/I E4/I:2  F4/V D4/V D4/V:2  C4/I D4/V E4/I F4/IV G4/I G4/I G4/I:2
    G4/I E4/I E4/I:2  F4/V D4/V D4/V:2  C4/I E4/I G4/I G4/I C4/I:4`,
  },
  {
    title: 'Bruder Jakob',
    k: 0,
    bpm: 110,
    group: 'children',
    text: `
    Bru- der Ja- kob, Bru- der Ja- kob, schläfst du noch? Schläfst du noch?
    Hörst du nicht die Glo- cken? Hörst du nicht die Glo- cken? Ding dang dong, ding dang dong.`,
    notes: `
    C4/I D4/I E4/I C4/I  C4/I D4/I E4/I C4/I  E4/I F4/I G4/I:2  E4/I F4/I G4/I:2
    G4/I:.5 A4/I:.5 G4/I:.5 F4/I:.5 E4/I C4/I  G4/I:.5 A4/I:.5 G4/I:.5 F4/I:.5 E4/I C4/I
    C4/I G3/V C4/I:2  C4/I G3/V C4/I:2`,
  },
  {
    title: 'Twinkle, Twinkle, Little Star',
    k: 1,
    bpm: 100,
    group: 'children',
    text: `
    Twin- kle, twin- kle, lit- tle star, how I won- der what you are!
    Up a- bove the world so high, like a dia- mond in the sky.
    Twin- kle, twin- kle, lit- tle star, how I won- der what you are!`,
    notes: `
    G4/I G4/I D5/I D5/I E5/IV E5/IV D5/I:2  C5/IV C5/IV B4/I B4/I A4/V A4/V G4/I:2
    D5/I D5/I C5/IV C5/IV B4/I B4/I A4/V:2  D5/I D5/I C5/IV C5/IV B4/I B4/I A4/V:2
    G4/I G4/I D5/I D5/I E5/IV E5/IV D5/I:2  C5/IV C5/IV B4/I B4/I A4/V A4/V G4/I:2`,
  },
  // Folk song (Hoffmann von Fallersleben 1817), 3/4 – the rests after "Kuckuck" hang on the second note
  {
    title: 'Kuckuck, Kuckuck, ruft’s aus dem Wald',
    k: 1,
    bpm: 140,
    group: 'children',
    text: `
    Ku- ckuck, Ku- ckuck, ruft's aus dem Wald. Las- set uns sin- gen, tan- zen und sprin- gen!
    Früh- ling, Früh- ling wird es nun bald.`,
    notes: `
    D5/I B4/I:2  D5/I B4/I:2  A4/V G4/V A4/V  G4/I:3
    A4/V A4/V B4/V  C5/V:2 A4/V  B4/I B4/I C5/I  D5/I:2 B4/I
    D5/I:2 B4/I  D5/I:2 B4/I  C5/V B4/V A4/V  G4/I:3`,
  },
  // Folk song (lyrics Hoffmann von Fallersleben 1837), D major
  {
    title: 'Alle Vögel sind schon da',
    k: 2,
    bpm: 126,
    group: 'children',
    text: `
    Al- le Vö- gel sind schon _ da, al- le Vö- gel, al- le.
    Welch ein Sin- gen, Mu- si- _ ziern, Pfei- fen, Zwit- schern, Ti- ri- _ liern!
    Früh- ling will nun ein- mar- _ schiern, kommt mit Sang und Schal- le.`,
    notes: `
    D4/I:1.5 F#4/I:.5 A4/I D5/I  B4/IV D5/IV:.5 B4/IV:.5 A4/I:2  G4/V:1.5 A4/V:.5 F#4/I D4/I  E4/V:2 D4/I:2
    A4/I A4/I G4/V G4/V  F#4/I A4/I:.5 F#4/I:.5 E4/V:2  A4/I A4/I G4/V G4/V  F#4/I A4/I:.5 F#4/I:.5 E4/V:2
    D4/I:1.5 F#4/I:.5 A4/I D5/I  B4/IV D5/IV:.5 B4/IV:.5 A4/I:2  G4/V:1.5 A4/V:.5 F#4/I D4/I  E4/V:2 D4/I:2`,
  },
  // Canon (folk tune), F major, 3/4
  {
    title: 'Es tönen die Lieder',
    k: -1,
    bpm: 144,
    group: 'children',
    text: `
    Es tö- nen die Lie- der, der Früh- ling kehrt wie- der, es spie- let _ der _ Hir- te auf sei- ner _ Schal- _ mei: La
    la la la la la la, la _ la, la la la la la la la.`,
    notes: `
    C4/I  F4/I F4/I F4/I  G4/V C4/V C4/V  G4/V G4/V G4/V  A4/I F4/I C5/I
    C5/I A4/I:.5 C5/I:.5 A4/I:.5 C5/I:.5  Bb4/V G4/V Bb4/V  Bb4/V G4/V:.5 Bb4/V:.5 G4/V:.5 Bb4/V:.5  A4/I:2 C5/I
    F5/I:.5 E5/I:.5 D5/I:.5 C5/I:.5 Bb4/I:.5 A4/I:.5  C5/V Bb4/V G4/V  E4/V:.5 F4/V:.5 G4/V:.5 A4/V:.5 Bb4/V:.5 G4/V:.5  F4/I:2`,
  },
  // Canon (folk tune) in G minor: techno with root G – the minor of the rows ♭VII, ♭III and i
  {
    title: 'Hejo, spann den Wagen an',
    k: 1,
    bpm: 116,
    style: 'techno',
    group: 'children',
    text: `
    He- jo, spann den Wa- gen an, denn der Wind treibt Re- gen ü- bers Land!
    Hol die gold- nen Gar- ben, hol die gold- nen Gar- _ ben _`,
    notes: `
    G4/i:2 F4/bVII:2  G4/i:.5 G4/i:.5 G4/i:.5 G4/i:.5 D4/i:2
    G4/i G4/i A4/i A4/i  Bb4/bIII:.5 Bb4/bIII:.5 Bb4/bIII:.5 Bb4/bIII:.5 A4/i:2
    D5/i:.5 D5/i:.5 D5/i:.5 D5/i:.5 D5/i D5/i  D5/i:.5 D5/i:.5 D5/i:.5 D5/i:.5 D5/i:.5 C5/i:.5 Bb4/i:.5 A4/i:.5`,
  },
];
