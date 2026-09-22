// Reference values for the golden tests of the audience modules: the QR codes of a set of texts, the tables
// a QR code is built from, the lyrics lines of every song, and the links a page hands out.
import lines from './lines.json';
import qr from './qr.json';
import qrTables from './qrTables.json';
import room from './room.json';

export interface QrFixture {
  readonly text: string;
  readonly bytes: number;
  readonly version: number;
  readonly size: number;
  readonly mask: number;
  readonly format: number;
  readonly penalty: number;
  readonly freeBits: number;
  readonly dataCodewords: readonly number[];
  readonly codewords: readonly number[];
  readonly blocks: readonly { readonly data: readonly number[]; readonly ec: readonly number[] }[];
  readonly rows: readonly string[]; // '#' dark, '.' light, with quiet zone
}
export interface QrTablesFixture {
  readonly formatBits: readonly number[]; // level M, masks 0–7
  readonly formatTable: readonly number[]; // all 32 format information values
  readonly versionBits: readonly number[]; // versions 1–10
  readonly generators: readonly { readonly degree: number; readonly coefficients: readonly number[] }[];
}
export interface LinesFixture {
  readonly title: string;
  readonly k: number;
  readonly bpm: number;
  readonly hasText: boolean;
  readonly beats: readonly number[];
  readonly midi: readonly number[];
  readonly syllables: readonly string[];
  readonly lines: readonly (readonly number[])[]; // syllable indices per line
}
export interface RoomFixture {
  readonly name: string;
  readonly location: {
    readonly protocol: string;
    readonly hostname: string;
    readonly origin: string;
    readonly pathname: string;
    readonly href: string;
  };
  readonly publicUrl: string;
  readonly page: string;
  readonly relay: string;
  readonly href: string; // room link for the code k7m3x
}

export const RECORDED = {
  qr: qr as readonly QrFixture[],
  qrTables: qrTables as QrTablesFixture,
  lines: lines as readonly LinesFixture[],
  room: room as readonly RoomFixture[],
};
