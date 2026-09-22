import { describe, expect, it } from 'vitest';
import { parseMessage } from './messages';

describe('parseMessage', () => {
  it('returns a message with a type', () => {
    expect(parseMessage('{"t":"pos","i":3,"s":1000}')).toEqual({ t: 'pos', i: 3, s: 1000 });
    expect(parseMessage('{"t":"end"}')).toEqual({ t: 'end' });
  });

  it('rejects broken JSON, non-objects and objects without a type', () => {
    expect(parseMessage('{')).toBeUndefined();
    expect(parseMessage('42')).toBeUndefined();
    expect(parseMessage('"pos"')).toBeUndefined();
    expect(parseMessage('null')).toBeUndefined();
    expect(parseMessage('{"i":3}')).toBeUndefined();
    expect(parseMessage('{"t":7}')).toBeUndefined();
  });
});
