import { describe, expect, it } from 'vitest';
import { RECORDED } from './__fixtures__/recorded';
import {
  generateRoomCode,
  isLocalPage,
  isRoomCode,
  LOCAL_RELAY_URL,
  publicPage,
  relayUrl,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  roomCodeFromHash,
  roomLink,
} from './room';

describe('generateRoomCode', () => {
  it('draws five characters from the alphabet without look-alikes', () => {
    expect(ROOM_CODE_ALPHABET).not.toMatch(/[01ilo]/i);
    expect(generateRoomCode(() => 0)).toBe('aaaaa');
    expect(generateRoomCode(() => 0.999_999)).toBe('99999');
    const code = generateRoomCode();
    expect(code).toHaveLength(ROOM_CODE_LENGTH);
    expect(code.split('').every((c) => ROOM_CODE_ALPHABET.includes(c))).toBe(true);
    expect(isRoomCode(code)).toBe(true);
  });
});

describe('isRoomCode', () => {
  it('accepts 3 to 12 lowercase letters and digits', () => {
    expect(isRoomCode('k7m3x')).toBe(true);
    expect(isRoomCode('abc')).toBe(true);
    expect(isRoomCode('ab')).toBe(false);
    expect(isRoomCode('abcdefghijklm')).toBe(false);
    expect(isRoomCode('K7M3X')).toBe(false);
    expect(isRoomCode('k7-3x')).toBe(false);
  });
});

describe('roomCodeFromHash', () => {
  it('reads the room code from a listener link', () => {
    expect(roomCodeFromHash('#room=k7m3x')).toBe('k7m3x');
    expect(roomCodeFromHash('#/ROOM=K7M3X')).toBe('k7m3x');
    expect(roomCodeFromHash('#style=blues&room=k7m3x')).toBe('k7m3x');
    expect(roomCodeFromHash('#room=k7m3x&tempo=100')).toBe('k7m3x');
    expect(roomCodeFromHash('#room=k7%6d3x')).toBe('k7m3x');
  });

  it('is null without a valid code', () => {
    expect(roomCodeFromHash('')).toBeNull();
    expect(roomCodeFromHash('#blues')).toBeNull();
    expect(roomCodeFromHash('#room')).toBeNull();
    expect(roomCodeFromHash('#room=')).toBeNull();
    expect(roomCodeFromHash('#room=ab')).toBeNull();
    expect(roomCodeFromHash('#room=%E0%A4%A')).toBeNull();
  });
});

describe('page, relay and room link', () => {
  it('match the reference for every location variant', () => {
    for (const fixture of RECORDED.room) {
      expect(publicPage(fixture.location, fixture.publicUrl), fixture.name).toBe(fixture.page);
      expect(relayUrl(fixture.location, fixture.publicUrl), fixture.name).toBe(fixture.relay);
      expect(roomLink(fixture.location, fixture.publicUrl, 'k7m3x'), fixture.name).toBe(fixture.href);
    }
  });

  it('treats file, localhost and 127.0.0.1 as local', () => {
    const local = RECORDED.room.filter((fixture) => isLocalPage(fixture.location)).map((fixture) => fixture.name);
    expect(local).toEqual([
      'file without public address',
      'file with public address',
      'localhost',
      'loopback with public http address',
      'file with an address that is no URL',
    ]);
  });

  it('defaults to the local relay without a public address', () => {
    const file = { protocol: 'file:', hostname: '', origin: 'null', pathname: '/x.html', href: 'file:///x.html' };
    expect(publicPage(file)).toBe('');
    expect(relayUrl(file)).toBe(LOCAL_RELAY_URL);
  });
});
