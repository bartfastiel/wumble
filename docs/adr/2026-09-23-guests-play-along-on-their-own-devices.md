# Guests play along on their own devices

Date: 2026-09-23 · Status: accepted, extends 2026-09-20-audience-prediction-instead-of-waiting

## Context

The QR code turned a phone into a listener: lyrics scrolling, the next tone as a dot, a button to applaud. That is
the right thing for someone who came to sing. But the instrument is a field of tones, and a family around a table has
more than one phone. Everyone who scans the code is already holding the whole app – it was just refusing to let them
play.

## Decision

A guest is asked once, on the page the code leads to: sing along, or play along? Playing along is preselected, on a
sound nobody else is using, at the middle of the field – so the question can be answered by pressing Play.

A guest who plays gets the same field in the host's key, style and tuning. Those arrive over the relay and are
mirrored into the local settings; the chord under the field follows the host bar by bar, and decides the width and
colour of every stripe as it does on the host's screen.

What a guest does not get is everything that belongs to the host: no map of chords – the whole width goes to the
tones, which is also what makes the stripes wide enough to hit on a phone – no chord sounding on their device, no
band, no radio, no loop, no songs. Their bar keeps the sound to play on and how the field looks, and nothing else.

Singing is only offered when there is something to sing: the choice appears once the host is on a song that has
words, and until then the page asks only where to sit.

The sound is made on the guest's own device. What travels to the host is the tone alone, and the host's field shows
it as a small light above that stripe – the same tone, one screen further, played by someone else.

Sounds are claimed: the host's own and each guest's travel in the state, and a sound already in use is shown greyed
out to whoever comes next. A guest who wants the bass end says so on the same page, and their field opens two octaves
down.

The relay grows a third role for this. The player speaks to the whole room; everyone else speaks to the player. That
keeps a musician's notes away from the singers, who have no use for them.

## Why

The point of the room was never an audience – it was the people who are already there. One person starts, the others
clip in; nobody sets up anything, because everything that would need setting up comes from the host.

Keeping the guests out of the host's music is what makes it safe to hand the code to a child. The worst a guest can
do is play a wrong note, on their own phone, at their own volume.

Sound on the guest's device rather than on the host's is also the only thing that can work: a note that travelled to
the host, was mixed there and came back would arrive long after the finger left the glass.

## Rejected

_Letting a guest choose chords too._ Two hands on one harmony is not an ensemble, it is a fight. The host holds the
chords; that is what makes the rest possible.

_Sending the guest's audio._ Latency, bandwidth, and echo between devices in one room – for a sound the device can
make itself.

_A separate app or page for musicians._ The instrument is the same one; only what the bar offers differs.

_Assigning instruments from the host._ Someone would have to operate that while playing. Claiming a free sound on the
way in needs nobody's attention.
