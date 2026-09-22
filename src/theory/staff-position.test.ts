import { describe, expect, it } from 'vitest';
import { parseId, RECORDED, referenceTones } from './__fixtures__/recorded';
import { keyBySignature } from './keys';
import { buildModel } from './model';
import { FLAT_POSITIONS, notePosition, SHARP_POSITIONS, signaturePositions } from './staff-position';
import { STYLES } from './styles';

describe('notePosition', () => {
  it('counts steps from E4 on the lowest line', () => {
    const C = keyBySignature(0);
    expect(notePosition(64, C, STYLES.classical)).toEqual({ step: 0, accidental: '' }); // E4
    expect(notePosition(60, C, STYLES.classical)).toEqual({ step: -2, accidental: '' }); // C4
    expect(notePosition(79, C, STYLES.classical)).toEqual({ step: 9, accidental: '' }); // G5
  });

  it('shows accidentals against the key signature', () => {
    expect(notePosition(66, keyBySignature(0), STYLES.lydian)).toEqual({ step: 1, accidental: '♯' }); // F♯4 in C
    expect(notePosition(66, keyBySignature(2), STYLES.classical)).toEqual({ step: 1, accidental: '' }); // F♯4 in D
    expect(notePosition(65, keyBySignature(2), STYLES.blues)).toEqual({ step: 1, accidental: '♮' }); // F4 in D
    expect(notePosition(70, keyBySignature(0), STYLES.blues)).toEqual({ step: 4, accidental: '♭' }); // B♭4 in C
    expect(notePosition(70, keyBySignature(-1), STYLES.classical)).toEqual({ step: 4, accidental: '' }); // B♭4 in F
  });

  it('keeps flats on their letter across the octave: B♭3 is still a B', () => {
    expect(notePosition(58, keyBySignature(-1), STYLES.classical)).toEqual({ step: -3, accidental: '' });
  });

  it.each(Object.entries(RECORDED.notes))('%s matches the reference', (id, recorded) => {
    const { signature, styleId } = parseId(id);
    const key = keyBySignature(signature);
    const model = buildModel(key, styleId);
    expect(referenceTones(model.tones).map((midi) => notePosition(midi, key, model.style))).toEqual(recorded);
  });
});

describe('signaturePositions', () => {
  it('lists the steps of the accidentals in the key signature', () => {
    expect(signaturePositions(3)).toEqual([8, 5, 9]); // F♯ C♯ G♯
    expect(signaturePositions(-2)).toEqual([4, 7]); // B♭ E♭
    expect(signaturePositions(0)).toEqual([]);
  });

  it('matches the reference tables', () => {
    expect(SHARP_POSITIONS).toEqual(RECORDED.tables.SHARP_POS);
    expect(FLAT_POSITIONS).toEqual(RECORDED.tables.FLAT_POS);
  });
});
