# Sounds: free samples plus targeted synthesis, no VST

Date: 2026-09-20 · Status: accepted

## Context

Piano, violin and church organ do not sound convincing when synthesized; VST plugins do not run in the browser, a backend
host would add latency.

## Decision

Multisamples (Salamander Grand Piano CC BY 3.0, VSCO 2 CE CC0) every three semitones, loops with baked-in crossfade,
mono MP3; synthesis for pop/supersaw, pluck (Karplus-Strong), drums and the initial sounds. Presets are combis of
bass/chord/melody. MIDI out stays parked.

## Consequences

A reproducible tool downloads and converts the sources (ffmpeg, pitch check via YIN). Attribution is mandatory (CC BY).
