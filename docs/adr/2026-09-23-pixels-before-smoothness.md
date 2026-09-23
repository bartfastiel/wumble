# The field gives up pixels before it gives up smoothness

Date: 2026-09-23 · Status: accepted

## Context

On a phone the field crawled. Measured on a throttled browser at a phone's pixel ratio it managed nine frames a
second – an instrument that answers a finger a tenth of a second later is not an instrument.

Profiling said where it went: ninety per cent of the time was outside JavaScript, in rasterising. Two things did it.

_Gradients._ Every stripe built its own gradient every frame, and so did every chord and every glance of light along
them – around seventy a frame. Canvas builds a gradient from scratch each time one is created. Switching them off in
a running page took the same scene from 19 to 61 frames a second.

_Pixels._ A phone with three device pixels per CSS pixel paints nine times the area of a plain screen. At that ratio
the same scene dropped from 32 to 9 frames a second.

## Decision

_Gradients are built once and stretched._ They are made in unit space, from 0 to 1, and kept under the colour they
were made for; the shape stretches one onto itself when it is filled, because a gradient is read through the
transform in force at fill time while the path was already laid down. The glance along a stripe and along a chord
gave up its gradient altogether: at the width it is drawn, a plain stroke of the same light is the same picture.

_Narrow stripes are plain bars._ Below nine pixels across, the lacquer, the glance and the shadow are all smaller
than a pixel and each costs what it costs on the widest stripe.

_The field measures its own frames and buys smoothness with resolution._ It watches the gap between frames – the only
honest measure, since a canvas call returns long before the pixels exist – and steps the rendering scale down through
2, 1.5, 1.25, 1 when frames run long, and back up when they arrive on the screen's own beat again. Below a threshold
it also drops the trimmings and widens what counts as a wide stripe. It never asks for more pixels than the device
has, and it starts one step below the device's best, because the first frames are the expensive ones.

The canvas is also created without an alpha channel: the field paints its own background over every pixel.

On the same throttled browser, at a phone's pixel ratio: 9 → 46 frames a second, and 34 at ten times slower than
this machine.

## Why

A softer picture that follows the finger is worth more than a sharp one that lags. On an instrument that is nothing
but touch and feedback, latency is the medium, and everything else is decoration.

Measuring the gap between frames rather than the time inside the drawing code is what makes the regulation work at
all: the first attempt timed `draw()`, found two milliseconds, and concluded everything was fine while the page ran
at nine frames a second.

## Rejected

_WebGL._ The rasteriser was never the problem – the number of things handed to it was. Rewriting the field as
triangles and shaders is weeks of work, a second drawing path to keep true, and a class of devices where it fails
outright. The measurements left nothing for it to win.

_A worker with an OffscreenCanvas._ It moves the same work to another thread; the work is the cost, not the thread.
Ninety per cent of the time was not in JavaScript in the first place.

_WebAssembly._ There is no hot loop of arithmetic here to compile. The geometry is a few hundred numbers a frame.

_A fixed low resolution._ It would rob a fast phone of what it can do, and still be wrong on the slowest one.
