# A bar of pictures instead of a settings page

Date: 2026-09-23 · Status: accepted, supersedes the settings panel

## Context

Everything that was not playing lived on one scrolling page: eleven radio groups, a checkbox, a slider and a share
button, every option a sentence long. To change the key you opened a panel that covered the instrument, scrolled past
the labels, and read thirteen lines to find the one that said A major. The page was complete and nobody could see
anything in it — least of all how the options relate to each other, which is exactly what this instrument is about.

## Decision

The settings page is gone. Every subject is one icon in the bar along the top, and behind every icon is a panel that
shows the choice as a picture rather than as a list of words:

- **Key** — the circle of fifths. Neighbours on the ring are neighbours in the music, the colour is the one the whole
  page takes on, and the accidentals are written under each sign. The button itself wears the current key.
- **Style** — each style as its own scale: twelve semitones with the ones it uses standing tall. Major, blues and
  pentatonic have shapes you recognise after seeing them twice.
- **Sound** — the instrument, and under it the shape the sound makes: how fast it speaks, how long it rings, how much
  room is around it. Under the same button, the tunings as how far they bend the twelve semitones.
- **Band** — the schema as its own bars, near-to-home chords tall and far ones low, so the twelve-bar blues is a shape.
  The tempo on a dial, the loop length as the number of bars it will record, the radio as a switch.
- **View** — the three looks drawn the way each of them draws itself, the labels as the label they would write on a
  stripe, the spelling as the one letter that differs, the play mode as one hand or two.

The words are in the tooltips and in the accessible names, never on the screen. Whatever holds right now is lit.

The code follows the same split: `widgets/` holds pieces that know nothing about music – a button, a popover, tiles,
a dial, a wheel, a switch, a pattern, an envelope – and `controls/` turns theory into what those pieces need. The
header wires them together and owns no drawing of its own.

Characters used as icons are gone with it. Every symbol is an SVG line drawing on a 24-unit grid, stroked at the same
weight as the lines around it.

## Why

A picture of a choice is faster to read than its name, and it can show what a name cannot: that F and G sit either
side of C, that blues and major differ by two steps, that one schema is four bars and another twelve. That is the
same argument the field itself makes – width means fitness, height means pull – applied to everything around it.

Splitting widgets from controls keeps both honest. A widget that knows what a key is grows a second job the moment
something else needs a ring of choices; a control that draws its own tiles cannot be changed without touching theory.

Emoji were never ours: they are drawn by the operating system, they change under us, they carry colour we did not
choose, and they sit on a different baseline in every font. A line drawing we ship is the same everywhere.

## Rejected

_Keeping the panel and adding pictures to it._ The panel's problem was not its decoration but that it covered the
instrument and asked for scrolling. Nothing in it needed a full screen.

_One menu with submenus._ Fewer icons in the bar, more taps to everything, and the relations between subjects get
buried one level down.

_Words under the icons._ At the size a phone allows, that is either unreadable or half the bar. The tooltip and the
accessible name carry the words for whoever needs them.

_An icon font._ One more thing to load and to fall back from, for drawings we can inline as paths.
