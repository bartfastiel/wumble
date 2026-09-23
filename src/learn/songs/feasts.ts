// The songs a room actually sings together. The words are complete – every verse, and the chorus where there is
// one – because half a song is no use at a party. A few notes of lead-in come first, so nobody has to guess where
// the first word falls. "_" holds the previous syllable on one more note, which is how a melody carries a word
// longer than a syllable.
//
// Every melody here was written against a score, not from memory (see the ADR on songs): the German carols and
// "Lasst uns froh und munter sein" against the engravings in the German Wikipedia articles, "O Tannenbaum" against
// that engraving and the ABC transcription at trillian.mit.edu, "Jingle Bells" against the ABC of the 1857 print
// with its syllables written under the notes (Thornton Rose after MySheetMusic), checked against two more.
// Where a score has a chromatic neighbour note – the turn in "Alles schläft", the raised fourth in the third line
// of "Kling, Glöckchen" – the field has no key for it, so the melody takes the note of the scale instead.
//
// Licences, in short: German carols of the 18th and 19th century, every author long dead (the last of them, Eduard
// Ebel, died in 1908). "Jingle Bells" is James Lord Pierpont, 1857. "Happy Birthday to You": the tune is Mildred J.
// Hill's (died 1916); the words were held free by a US court in 2015, and any claim through Patty Hill (died 1946)
// ran out in Germany at the end of 2016. "Zum Geburtstag viel Glück" is that tune with a German line repeated four
// times – an everyday greeting with no author and without the originality a right would need.
import type { SongDefinition } from '../song-notation';

export const FEASTS: readonly SongDefinition[] = [
  // Franz Xaver Gruber (1787–1863), words Joseph Mohr (1792–1848), Oberndorf 1818
  {
    title: 'Stille Nacht',
    k: 0,
    bpm: 76,
    group: 'feasts',
    intro: 'C5/I:1 G4/I:.5 E4/I:1.5',
    notes: `
    G4/I:.75 A4/I:.25 G4/I:.5 E4/I:1.5
    G4/I:.75 A4/I:.25 G4/I:.5 E4/I:1.5
    D5/V:1 D5/V:.5 B4/V:1.5
    C5/I:1 C5/I:.5 G4/I:1.5
    A4/IV:1 A4/IV:.5 C5/IV:.75 B4/IV:.25 A4/IV:.5
    G4/I:.75 A4/I:.25 G4/I:.5 E4/I:1.5
    A4/IV:1 A4/IV:.5 C5/IV:.75 B4/IV:.25 A4/IV:.5
    G4/I:.75 A4/I:.25 G4/I:.5 E4/I:1.5
    B4/V:.75 B4/V:.25 B4/V:.5 D5/V:.75 C5/V:.25 B4/V:.5
    C5/I:1.5 E5/I:1.5
    C5/I:1 G4/I:.5 E4/I:.75 G4/I:.25 F4/V:.5 D4/V:.5
    C4/I:3`,
    verses: [
      `Stil- le Nacht, _ hei- li- ge Nacht!
       Al- les schläft, ein- sam wacht
       nur das trau- te hoch- hei- li- ge Paar.
       Hol- der Kna- be im lo- cki- gen Haar,
       schlaf in himm- li- scher Ruh, _ _
       schlaf in himm- li- scher Ruh. _`,
      `Stil- le Nacht, _ hei- li- ge Nacht!
       Hir- ten erst kund- ge- macht,
       durch der En- gel Hal- le- lu- ja _
       tönt es laut von fern und nah: _ _
       Christ, der Ret- ter ist da, _ _
       Christ, der Ret- ter ist da! _`,
      `Stil- le Nacht, _ hei- li- ge Nacht!
       Got- tes Sohn, o wie lacht
       Lieb aus dei- nem gött- li- chen Mund, _
       da uns schlägt die ret- ten- de Stund, _
       Christ, in dei- ner Ge- burt, _ _
       Christ, in dei- ner Ge- burt! _`,
    ],
  },
  // Melody a 16th-century folk tune, words Ernst Anschütz (1780–1861), Leipzig 1824. Three parts: the verse, the
  // middle section, and the verse again – which is why the first line comes back at the end of every stanza.
  {
    title: 'O Tannenbaum',
    k: -1,
    bpm: 100,
    group: 'feasts',
    intro: 'F4/I:1 A4/I:1 C5/I:1',
    notes: `
    C4/I:.5
    F4/I:.75 F4/I:.25 F4/I:1 G4/V:1
    A4/I:.75 A4/I:.25 A4/I:1.5 A4/vi:.5
    G4/vi:.5 A4/vi:.5 Bb4/vi:1 E4/V:1
    G4/V:1 F4/I:1
    C5/I:.5
    C5/I:.5 A4/IV:.5 D5/IV:1.5 C5/IV:.5
    C5/V:.5 Bb4/V:.5 Bb4/V:1.5 Bb4/V:.5
    Bb4/V:.5 G4/V:.5 C5/V:1.5 Bb4/V:.5
    Bb4/V:.5 A4/I:.5 A4/I:1
    C4/I:.5
    F4/I:.75 F4/I:.25 F4/I:1 G4/V:1
    A4/I:.75 A4/I:.25 A4/I:1.5 A4/vi:.5
    G4/vi:.5 A4/vi:.5 Bb4/vi:1 E4/V:1
    G4/V:1 F4/I:1`,
    verses: [
      `O
       Tan- nen- baum, o
       Tan- nen- baum! Wie
       treu sind dei- ne
       Blät- ter;
       du
       grünst nicht nur zur
       Som- mer- zeit, nein
       auch im Win- ter,
       wenn es schneit.
       O
       Tan- nen- baum, o
       Tan- nen- baum, wie
       treu sind dei- ne
       Blät- ter.`,
      `O
       Tan- nen- baum, o
       Tan- nen- baum, du
       kannst mir sehr ge-
       fal- len!
       Wie
       oft hat nicht zur
       Weih- nachts- zeit ein
       Baum von dir mich
       hoch er- freut!
       O
       Tan- nen- baum, o
       Tan- nen- baum, du
       kannst mir sehr ge-
       fal- len!`,
      `O
       Tan- nen- baum, o
       Tan- nen- baum, dein
       Kleid will mich was
       leh- ren:
       Die
       Hoff- nung und Be-
       stän- dig- keit gibt
       Trost und Kraft zu
       je- der Zeit.
       O
       Tan- nen- baum, o
       Tan- nen- baum, dein
       Kleid will mich was
       leh- ren.`,
    ],
  },
  // Friedrich Silcher (1789–1860), words Wilhelm Hey (1789–1854)
  {
    title: 'Alle Jahre wieder',
    k: 0,
    bpm: 92,
    group: 'feasts',
    intro: 'C4/I:1 E4/I:1 G4/I:2',
    notes: `
    G4/I:1.5 A4/I:.5 G4/I:1 F4/V:1
    E4/I:2 D4/V:2
    C4/I:1 D4/V:.5 E4/I:.5 F4/V:1 E4/I:1
    D4/V:4
    E4/I:1 G4/I:1 A4/IV:1 G4/I:1
    C5/IV:2 B4/V:1 A4/V:1
    G4/I:1 F4/V:.5 E4/I:.5 F4/V:1 G4/V:1
    E4/I:4`,
    verses: [
      `Al- le Jah- re wie- der
       kommt das _ Chris- tus- kind
       auf die Er- de nie- der, _
       wo wir _ Men- schen sind.`,
      `Kehrt mit sei- nem Se- gen
       ein in _ je- des Haus,
       geht auf al- len We- gen _
       mit uns ein _ und aus.`,
      `Steht auch mir zur Sei- te
       still und _ un- er- kannt,
       dass es treu mich lei- te _
       an der _ lie- ben Hand.`,
    ],
  },
  // Traditional, 19th century, from the Rhineland or the Hunsrück; the Nikolaus song every German child learns first
  {
    title: 'Lasst uns froh und munter sein',
    k: 0,
    bpm: 128,
    group: 'feasts',
    intro: 'C4/I:1 E4/I:1 G4/I:2',
    notes: `
    G4/I:1 G4/I:1 G4/I:.5 A4/V:.5 G4/I:.5 F4/V:.5 E4/I:4
    F4/IV:1 F4/IV:1 F4/IV:.5 G4/V:.5 F4/V:.5 E4/I:.5 D4/V:4`,
    chorus: {
      notes: `
      C4/I:1 D4/V:1 E4/I:1 F4/IV:1
      G4/V:.5 A4/V:.5 G4/V:.5 A4/V:.5 G4/V:2
      C5/I:1 G4/I:1 G4/I:.5 A4/V:.5 G4/I:.5 F4/V:.5 E4/I:1 D4/V:3
      C5/I:1 G4/I:1 G4/I:.5 A4/V:.5 G4/I:.5 F4/V:.5 E4/I:1 D4/V:1 C4/I:2`,
      text: `Lus- tig, lus- tig, tra- le- ra- le- ra!
             Bald ist Ni- ko- laus- a- bend da,
             bald ist Ni- ko- laus- a- bend da! _`,
    },
    verses: [
      `Lasst uns froh und mun- ter sein
       und uns recht von Her- zen freun!`,
      `Dann stell ich den Tel- ler auf,
       Nik- laus legt ge- wiss was drauf.`,
      `Wenn ich schlaf, dann träu- me ich,
       jetzt bringt Nik- laus was für mich.`,
    ],
  },
  // Words Karl Enslin (1819–1875), melody traditional. The bell line opens and closes every verse.
  {
    title: 'Kling, Glöckchen',
    k: -1,
    bpm: 104,
    group: 'feasts',
    intro: 'F4/I:1 A4/I:1 C5/I:2',
    notes: `
    C5/I:1 A4/I:.5 Bb4/V:.5
    C5/I:.25 D5/I:.25 C5/I:.25 D5/I:.25 C5/I:1
    Bb4/V:1 G4/V:.5 C5/I:.5
    A4/I:2
    G4/I:.5 G4/I:.5 A4/I:.5 F4/I:.5
    A4/I:1 G4/V:1
    Bb4/V:.5 Bb4/V:.5 C5/V:.5 G4/V:.5
    Bb4/V:1 A4/I:1
    G4/I:.5 G4/I:.5 A4/I:.5 Bb4/IV:.5
    C5/IV:1 G4/V:1
    A4/IV:.5 D5/IV:.5 C5/V:.5 Bb4/V:.5
    D5/V:1 C5/I:1
    C5/I:1 A4/I:.5 Bb4/V:.5
    C5/I:.25 D5/I:.25 C5/I:.25 D5/I:.25 C5/I:1
    Bb4/V:1 G4/V:.5 C5/I:.5
    A4/I:2`,
    verses: [
      `Kling, Glöck- chen, klin- ge- lin- ge- ling,
       kling, Glöck- chen, kling!
       Lasst mich ein, ihr Kin- der, ist so kalt der Win- ter,
       öff- net mir die Tü- ren, lasst mich nicht er- frie- ren!
       Kling, Glöck- chen, klin- ge- lin- ge- ling,
       kling, Glöck- chen, kling!`,
      `Kling, Glöck- chen, klin- ge- lin- ge- ling,
       kling, Glöck- chen, kling!
       Mäd- chen, hört, und Büb- chen, macht mir auf das Stüb- chen,
       bringt euch vie- le Ga- ben, sollt euch dran er- la- ben!
       Kling, Glöck- chen, klin- ge- lin- ge- ling,
       kling, Glöck- chen, kling!`,
      `Kling, Glöck- chen, klin- ge- lin- ge- ling,
       kling, Glöck- chen, kling!
       Hell er- glühn die Ker- zen, öff- net mir die Her- zen!
       Will drin woh- nen fröh- lich, from- mes Kind, wie se- lig!
       Kling, Glöck- chen, klin- ge- lin- ge- ling,
       kling, Glöck- chen, kling!`,
    ],
  },
  // James Lord Pierpont (1822–1893), Boston 1857. The verse lies a fourth under the chorus, which is why it reaches
  // further down the field than anything else here. The second verse puts two syllables where the first holds one,
  // so those notes stand split and the first verse carries the melisma – that is how the 1857 song is printed.
  {
    title: 'Jingle Bells',
    k: 0,
    bpm: 132,
    group: 'feasts',
    intro: 'E4/I:1 C4/I:1 G3/I:2',
    notes: `
    G3/I:.5 E4/I:.5 D4/I:.5 C4/I:.5
    G3/I:1.5 G3/I:.25 G3/I:.25
    G3/I:.5 E4/I:.5 D4/I:.5 C4/I:.5
    A3/IV:2
    A3/ii:.5 F4/ii:.5 E4/ii:.5 D4/ii:.5
    B3/V:1 B3/V:1
    G4/V:.5 G4/V:.5 F4/V:.5 D4/V:.5
    E4/I:1 E4/I:1
    G3/I:.5 E4/I:.5 D4/I:.5 C4/I:.5
    G3/I:1 G3/I:1
    G3/I:.5 E4/I:.5 D4/I:.5 C4/I:.5
    A3/IV:1 A3/IV:.5
    A3/ii:.5
    A3/ii:.5 F4/ii:.5 E4/ii:.5 D4/ii:.5
    G4/V:.5 G4/V:.5 G4/V:.5 G4/V:.5
    A4/V:.5 G4/V:.5 F4/V:.5 D4/V:.5
    C4/I:2`,
    chorus: {
      notes: `
      E4/I:1 E4/I:1 E4/I:2
      E4/I:1 E4/I:1 E4/I:2
      E4/I:1 G4/I:1 C4/I:1.5 D4/V:.5
      E4/I:4
      F4/IV:1 F4/IV:1 F4/IV:1.5 F4/IV:.5
      F4/IV:1 E4/I:1 E4/I:1 E4/I:.5 E4/I:.5
      E4/I:1 D4/V:1 D4/V:1 E4/I:1
      D4/V:2 G4/V:2
      E4/I:1 E4/I:1 E4/I:2
      E4/I:1 E4/I:1 E4/I:2
      E4/I:1 G4/I:1 C4/I:1.5 D4/V:.5
      E4/I:4
      F4/IV:1 F4/IV:1 F4/IV:1.5 F4/IV:.5
      F4/IV:1 E4/I:1 E4/I:1 E4/I:.5 E4/I:.5
      G4/V:1 G4/V:1 F4/IV:1 D4/V:1
      C4/I:4`,
      text: `Jin- gle bells, jin- gle bells, jin- gle all the way!
             Oh, what fun it is to ride in a one horse o- pen sleigh. Hey!
             Jin- gle bells, jin- gle bells, jin- gle all the way!
             Oh, what fun it is to ride in a one horse o- pen sleigh.`,
    },
    verses: [
      `Dash- ing through the snow, in a one horse o- pen sleigh.
       O'er the fields we go, _ laugh- ing all the way. _
       Bells on bob- tail ring, _ ma- king spir- its bright. _
       What fun it is to ride and sing a sleigh- ing song to- night.`,
      `A day or two a- go, I thought I'd take a ride,
       and soon Miss Fan- ny Bright was seat- ed by my side.
       The horse was lean and lank, Mis- for- tune seemed his lot.
       We ran in- to a drift- ed bank and there we got up- sot.`,
    ],
  },
  // Mildred J. Hill (1859–1916), "Good Morning to All", 1893 – see the licence note at the top of this file.
  // The German line has one syllable more than the English one, so its third phrase carries one note more.
  {
    title: 'Zum Geburtstag viel Glück',
    k: -1,
    bpm: 104,
    group: 'feasts',
    intro: 'F4/I:1 A4/I:1 C5/I:1',
    notes: `
    C4/I:.75 C4/I:.25 D4/I:1 C4/I:1 F4/I:1 E4/V:2
    C4/V:.75 C4/V:.25 D4/V:1 C4/V:1 G4/V:1 F4/I:2
    C4/I:.75 C4/I:.25 C5/I:1 A4/I:1 F4/I:1 E4/I:.5 E4/I:.5 D4/IV:1
    Bb4/IV:.75 Bb4/IV:.25 A4/I:1 F4/I:1 G4/V:1 F4/I:2`,
    verses: [
      `Zum Ge- burts- tag viel Glück,
       zum Ge- burts- tag viel Glück,
       zum Ge- burts- tag, al- les Gu- te,
       zum Ge- burts- tag viel Glück!`,
    ],
  },
  {
    title: 'Happy Birthday to You',
    k: -1,
    bpm: 104,
    group: 'feasts',
    intro: 'F4/I:1 A4/I:1 C5/I:1',
    notes: `
    C4/I:.75 C4/I:.25 D4/I:1 C4/I:1 F4/I:1 E4/V:2
    C4/V:.75 C4/V:.25 D4/V:1 C4/V:1 G4/V:1 F4/I:2
    C4/I:.75 C4/I:.25 C5/I:1 A4/I:1 F4/I:1 E4/I:1 D4/IV:1
    Bb4/IV:.75 Bb4/IV:.25 A4/I:1 F4/I:1 G4/V:1 F4/I:2`,
    verses: [
      `Hap- py birth- day to you,
       hap- py birth- day to you,
       hap- py birth- day dear some- one,
       hap- py birth- day to you!`,
    ],
  },
  // A traditional toast, sung right after the birthday song: a fanfare with no author and no fixed score
  {
    title: 'Hoch soll er leben',
    k: 0,
    bpm: 120,
    group: 'feasts',
    intro: 'G4/I:1 E4/I:1 C4/I:2',
    notes: `
    C4/I:1 E4/I:1 G4/I:1 C5/I:1 C5/I:2
    C4/I:1 E4/I:1 G4/I:1 C5/I:1 C5/I:2
    G4/V:1 A4/V:1 B4/V:1 C5/I:3
    C5/I:.5 C5/I:.5 C5/I:1 B4/V:.5 B4/V:.5 B4/V:1
    A4/IV:.5 A4/IV:.5 A4/IV:1 G4/I:2`,
    verses: [
      `Hoch soll er le- ben,
       hoch soll er le- ben,
       drei- mal hoch! _
       Hoch, hoch, hoch, hoch, hoch, hoch,
       hoch, hoch, hoch, hoch!`,
    ],
  },
];
