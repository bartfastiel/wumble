# The app plays the song itself

Date: 2026-09-23 · Status: accepted

## Context

The songs for singing together assume somebody is playing. At a real party that person often is not there, or puts
their glass down in the middle of the second verse. Everyone else is ready to sing and the song stops.

## Decision

A switch, in the song list and in the bar while a song runs: the app takes the melody over. It presses the very spot
the rope points at, holds it for exactly the note's length, and lets go. Nothing else changes – the chord follows
the song, the karaoke in the room follows the presses, the title counts the notes – because it goes through the same
press the finger would have made.

The switch works mid-song in both directions: hand the melody over, take it back at the next note, without the song
stopping. It is not saved and not in the shared link: it says who is playing right now, not what the instrument is.

## Why

The alternative was a player of its own, scheduling notes in the audio clock. That would have been in time to the
millisecond and would have had to repeat everything the hand already triggers: the chord, the room, the score, the
rope, the applause. One of those two would have drifted out of step with the other within a week.

The frame clock is good enough for singing along, as long as each tone starts when it is _due_ rather than when the
frame arrives – otherwise every note is a sixtieth of a second late and the song drags. So the app's finger carries
the time it means, and the frame only asks whether that moment has come.

## Consequences

A song played by the app scores points like any other. Nobody minds at a party, and a record set this way is
obviously not a record anyone earned – the level, not the switch, is what guards that.

## Rejected

_Starting automatically when no one plays._ It would have to guess what "no one is playing" means, and it would
start the moment somebody was looking for the first note.

_Switching the melody off and only showing the lyrics._ Then the room has no note to hold on to. Singing together
needs something to sing against.
