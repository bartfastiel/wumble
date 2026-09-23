import { describe, expect, it } from 'vitest';
import { Guests } from './guests';

const join = (id: string, sound = 'piano', low = false) => ({ t: 'join', id, sound, low }) as const;
const note = (id: string, midi: number, on: boolean) => ({ t: 'note', id, midi, on }) as const;

describe('Guests', () => {
  it('seats a guest with their sound and says which sounds are spoken for', () => {
    const guests = new Guests();
    expect(guests.taken()).toEqual([]);
    guests.join(join('a', 'piano'));
    guests.join(join('b', 'bell', true));
    expect(guests.count).toBe(2);
    expect(guests.taken()).toEqual(['piano', 'bell']);
    expect(guests.list.map((guest) => guest.low)).toEqual([false, true]);
  });

  it('lets a guest change their seat instead of taking a second one', () => {
    const guests = new Guests();
    guests.join(join('a', 'piano'));
    guests.join(join('a', 'guitar', true));
    expect(guests.count).toBe(1);
    expect(guests.taken()).toEqual(['guitar']);
    expect(guests.list[0]?.low).toBe(true);
  });

  it('holds and releases the tones under a guest finger', () => {
    const guests = new Guests();
    guests.join(join('a'));
    guests.note(note('a', 64, true));
    guests.note(note('a', 67, true));
    expect([...guests.sounding()].sort((x, y) => x - y)).toEqual([64, 67]);
    guests.note(note('a', 64, false));
    expect(guests.sounding()).toEqual([67]);
  });

  it('counts a tone once, however many guests hold it', () => {
    const guests = new Guests();
    guests.join(join('a'));
    guests.join(join('b', 'bell'));
    guests.note(note('a', 60, true));
    guests.note(note('b', 60, true));
    expect(guests.sounding()).toEqual([60]);
    guests.note(note('a', 60, false));
    expect(guests.sounding()).toEqual([60]); // b is still holding it
  });

  it('seats an unknown guest on their first note, so a reconnect does not go silent', () => {
    const guests = new Guests();
    expect(guests.note(note('ghost', 62, true))).toBe(true);
    expect(guests.count).toBe(1);
    expect(guests.sounding()).toEqual([62]);
  });

  it('stops growing at eight guests and at ten fingers', () => {
    const guests = new Guests();
    for (let i = 0; i < 12; i++) guests.join(join(`g${String(i)}`));
    expect(guests.count).toBe(8);
    for (let midi = 40; midi < 60; midi++) guests.note(note('g0', midi, true));
    expect(guests.list[0]?.playing.size).toBe(10);
  });

  it('forgets a guest who leaves, and everyone when the room closes', () => {
    const guests = new Guests();
    guests.join(join('a'));
    guests.join(join('b', 'bell'));
    guests.note(note('a', 60, true));
    expect(guests.leave({ t: 'leave', id: 'a' })).toBe(true);
    expect(guests.sounding()).toEqual([]);
    expect(guests.count).toBe(1);
    guests.clear();
    expect(guests.count).toBe(0);
  });
});
