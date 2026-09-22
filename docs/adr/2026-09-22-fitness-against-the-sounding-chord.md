# Fitness is measured against the sounding chord

## Context

The field has to show which notes work right now. The obvious approach — mark the notes of the
scale and dim the rest — is wrong as soon as the harmony moves: over the dominant, the tonic
note is a suspension, not a safe note.

## Decision

Every note gets one of four ranks, computed against the chord that is sounding:

| rank    | what it is                                                                  |
| ------- | --------------------------------------------------------------------------- |
| carries | root and fifth of the chord                                                 |
| colours | the third — it decides major or minor                                       |
| soft    | a scale note with no semitone friction                                      |
| pulls   | a scale note a semitone _above_ a chord tone, and the seventh of a dominant |

Three refinements make it musical rather than mechanical:

- A note a semitone **below** a chord tone is a leading note, not a problem. Only friction from
  above is harsh.
- If the chord's third is not in the scale, the note a semitone below it inherits its rank.
  That is what makes a blue note behave like a third.
- Scales of six notes or fewer have no pulling notes at all.

## Why

The first two rules come from voice leading: the avoid note of jazz theory is the note a
semitone above a chord tone, and leading notes are the opposite of a problem. The third rule
is what a pentatonic or blues scale is _for_ — they are built so that nothing inside them can
clash, and marking half of a blues scale as risky is simply false.

The rules were checked by computing every chord of every style against its scale before the
display was built. That check found four styles where the old logic marked up to five of six
notes as risky.

## Rejected

_Scale membership as the criterion._ Static, and it cannot see that the same note changes role
when the chord changes.

_A "danger" colour for everything outside the pentatonic._ The pentatonic is the set without
semitone friction over the tonic — a useful shortcut, but only for one chord.
