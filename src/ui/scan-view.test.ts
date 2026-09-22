import { describe, expect, it } from 'vitest';
import { setLocale } from '../i18n';
import { EXAMPLE_NOTES, renderExampleSheet } from '../scan/example-sheet';
import { SCAN_WIDTH } from '../scan/raster';
import { ScanError, type ScanResult, scanSheet } from '../scan/sheet-scanner';
import { keyBySignature } from '../theory/keys';
import { errorOverlay, headLabel, labelPx, noteName, recognizedText, scanOverlay } from './scan-view';

const C = keyBySignature(0);
const clean: ScanResult = scanSheet(renderExampleSheet(), { signature: 0 });

describe('noteName and headLabel', () => {
  it('spell the tone in the key, German on request, with the duration behind a dot', () => {
    expect(noteName(C, 71, false)).toBe('B');
    expect(noteName(C, 71, true)).toBe('H');
    expect(noteName(keyBySignature(-1), 70, false)).toBe('B♭');
    expect(headLabel('G', 1)).toBe('G');
    expect(headLabel('G', 2)).toBe('G·2');
    expect(headLabel('C', 4)).toBe('C·4');
  });
});

describe('scanOverlay', () => {
  const overlay = scanOverlay(clean, C, false);

  it('has the size and skew of the scan and ten staff lines as polylines', () => {
    expect(overlay).toMatchObject({ width: SCAN_WIDTH, height: clean.height, angle: 0, profile: [] });
    expect(overlay.lines).toHaveLength(10);
    const first = overlay.lines[0] ?? [];
    expect(first[0]?.x).toBe(0);
    expect(first.at(-1)?.x).toBe(1400);
    expect(first.every((point) => Math.abs(point.y - (first[0]?.y ?? 0)) < 3)).toBe(true); // straight, ±strip
  });

  it('boxes every head in the colour of its duration with the name above', () => {
    expect(overlay.boxes).toHaveLength(27);
    expect(overlay.boxes.map((box) => box.label).join(' ')).toBe(
      'C D E F G·2 G·2 A A A A G·4 A A A A G·4 F F F F E·2 E·2 G G G G C·4',
    );
    expect(overlay.boxes[0]?.color).toBe('#e8641b');
    expect(overlay.boxes[4]?.color).toBe('#1b6fe8');
    expect(overlay.boxes[10]?.color).toBe('#9a1be8');
    const box = overlay.boxes[0];
    const head = clean.debug.boxes[0];
    expect(box).toMatchObject({ x: (head?.x ?? 0) - (head?.w ?? 0) / 2, y: (head?.y ?? 0) - (head?.h ?? 0) / 2 });
  });

  it('names the notes in the chosen key', () => {
    const sharp = scanOverlay(scanSheet(renderExampleSheet(), { signature: 2 }), keyBySignature(2), true);
    expect(sharp.boxes.slice(0, 4).map((box) => box.label)).toEqual(['C♯', 'D', 'E', 'F♯']);
  });
});

describe('errorOverlay', () => {
  it('draws the profile as a curve at the right edge, the strongest row 140 px in', () => {
    const error = new ScanError('noStaff', new Float32Array([0, 5, 10, 5]), 2);
    const overlay = errorOverlay(error);
    expect(overlay).toMatchObject({ width: SCAN_WIDTH, height: 4, angle: 2, lines: [], boxes: [] });
    expect(overlay.profile).toEqual([
      { x: 1390, y: 0 },
      { x: 1320, y: 1 },
      { x: 1250, y: 2 },
      { x: 1320, y: 3 },
    ]);
    expect(errorOverlay(new ScanError('noStaff', new Float32Array([0, 0]), 0)).profile[0]?.x).toBe(1390);
  });
});

describe('recognizedText', () => {
  it('counts the notes and lists their names with the key', () => {
    setLocale('de');
    const names = EXAMPLE_NOTES.map((note) => noteName(C, note.midi, false)).join(' ');
    expect(recognizedText(clean, C, false)).toBe(
      `27 Noten erkannt: ${names} (·2 Halbe, ·4 Ganze; Tonart C-Dur / A-Moll)`,
    );
    expect(recognizedText({ ...clean, notes: [] }, C, false)).toBe(
      'Notensystem gefunden, aber keine Notenköpfe – näher heran, Blatt scharf und gerade.',
    );
  });
});

describe('labelPx', () => {
  it('scales with the width, never below 14', () => {
    expect(labelPx(1400)).toBe(31);
    expect(labelPx(300)).toBe(14);
  });
});
