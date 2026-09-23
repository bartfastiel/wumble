# Songs for singing together, whole

Date: 2026-09-23 · Status: accepted, extends 2026-09-20-songs-public-domain-only-and-verified

## Context

The library was built for learning: one verse of a melody, enough to practise a style. At a Christmas table or a
birthday that is useless. People do not sing the first verse of "Stille Nacht" and stop; they sing all three, and
"Lasst uns froh und munter sein" is nothing without the chorus after every verse. Half a song is worse than none,
because it stops exactly where the room was warming up.

## Decision

A new group, first in the list: the songs a room actually sings together – six carols, two birthday songs and the
toast that follows them. Each one carries every verse, the chorus in its place after each verse, and a lead-in of
three or four notes without words so nobody has to guess where the first syllable falls.

`SongDefinition` grew `verses`, `chorus` and `intro` for this; `parseSong` lays them out in the order they are sung,
and the syllable count of every part is checked against its notes at load time, as before. A part without words is
played, not sung: the karaoke view shows it as ♪ on a line of its own instead of inventing note names for it.

Every melody is written against an engraving, not from memory, as the earlier decision demands – the Wikipedia
scores for the German carols, plus an independent ABC transcription for "O Tannenbaum", and for "Jingle Bells" an
ABC of the 1857 print with the syllables written under the notes, checked against two further transcriptions. Where
a score has a chromatic neighbour note the field has no key for, the melody takes the note of the scale instead,
and the file says where.

Licences, each checked one by one: the German carols are 18th and 19th century, the last of their authors (Eduard
Ebel) died in 1908. "Jingle Bells" is James Lord Pierpont, 1857. The tune of "Happy Birthday to You" is Mildred J.
Hill's, who died in 1916; its words were held free by a US court in 2015, and any claim through Patty Hill, who died
in 1946, expired in Germany at the end of 2016. "Zum Geburtstag viel Glück" is that tune with one German line
repeated four times – an everyday greeting with no author, and without the originality a right would need.

## Consequences

The library is no longer only a teaching library, and the first group in it is the one a guest wants at a party.
Songs are long now: "Lasst uns froh und munter sein" is 121 notes, where the learning songs were around 30. The
score and the record still count the whole run, which makes a feast song a much harder record than a nursery rhyme –
that is fine, they are not competing with each other.

"Jingle Bells" keeps both verses and the chorus after each. Its verse lies a fourth below the chorus and reaches
further down the field than anything else in the library. The second verse puts two syllables where the first holds
one, so those four notes stand split and the first verse carries a melisma there – which is how the 1857 print sets
them.

## Rejected

_Repeating the melody and just showing more text._ It is the same thing for the singer only as long as every verse
has the same number of syllables, which no real verse has. The melismas belong to the verse, so the verse carries
them.
