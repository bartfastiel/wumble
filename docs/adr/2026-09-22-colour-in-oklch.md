# Colour in OKLCH, and every channel means something

## Context

An early version gave every pitch class its own hue from the circle of fifths. It looked
cheerful and said almost nothing, because the most important information — how well a note fits
right now — was not in the colour at all.

## Decision

Colours are computed in OKLCH and converted to RGB in the page.

| channel   | carries                                                            |
| --------- | ------------------------------------------------------------------ |
| hue       | fitness, on a narrow arc from warm (carries) to cool (pulls)       |
| lightness | register — dark in the bass, light in the treble                   |
| chroma    | certainty: carrying notes are saturated, pulling notes nearly grey |

Pitch class shifts the hue by at most one and a half degrees — enough to tell two stripes
apart, not enough to be colourful.

## Why

In HSL, yellow at a given lightness looks far brighter than blue at the same number. Lightness
therefore lies, and it cannot be used to carry a second dimension. OKLCH is built on
measurements of human perception: equal numbers look equally bright, so hue and lightness
become two independent channels that can be read at the same time.

## Rejected

_Twelve hues by pitch class._ Pretty, uninformative, and it spent the strongest visual channel
on the least useful fact.
