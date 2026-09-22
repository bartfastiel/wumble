// The sheet scan panel: camera preview (rear camera), take, choose image, the example clean
// or as a photo, the key signature; the result as the turned-back image under the overlay of scan-view.ts, "N notes
// recognised: …", Play (the song joins the library's scanned group and the learn mode starts) and Again.
import { t } from '../i18n';
import { harmonizeSong } from '../play/harmony';
import { renderExampleSheet } from '../scan/example-sheet';
import { SCAN_WIDTH } from '../scan/raster';
import { ScanError, type ScanResult, scanSheet } from '../scan/sheet-scanner';
import { songFromScan, styleForScan } from '../scan/song-from-scan';
import { keyLabel, signatureLabel } from '../theory/key-labels';
import { type Key, keyBySignature, KEYS } from '../theory/keys';
import { buildModel } from '../theory/model';
import { CLOSE_EVENT, WmPanel } from './wm-panel';
import {
  errorOverlay,
  labelPx,
  LINE_COLOR,
  type Point,
  PROFILE_COLOR,
  recognizedText,
  type ScanOverlay,
  scanOverlay,
} from './scan-view';
import { hint } from './settings-groups';

interface Scan {
  readonly image: ImageData; // what the scanner read, at most SCAN_WIDTH wide
  readonly source: HTMLCanvasElement; // the same picture for drawing
  readonly result: ScanResult | ScanError;
}

const LABEL_HALO = 'rgba(255,255,255,.85)'; // the names stay readable over stems
const TABLE = '#888'; // behind the turned-back picture

// The types promise the camera API, insecure pages (http) do not have it
const mediaDevices = (): MediaDevices | undefined => (navigator as Partial<Navigator>).mediaDevices;

const polyline = (cx: CanvasRenderingContext2D, points: readonly Point[]): void => {
  cx.beginPath();
  points.forEach((point, i) => {
    if (i === 0) cx.moveTo(point.x, point.y);
    else cx.lineTo(point.x, point.y);
  });
  cx.stroke();
};

const button = (label: string, onClick: () => void, primary = false): HTMLButtonElement => {
  const node = document.createElement('button');
  node.type = 'button';
  node.textContent = label;
  node.classList.toggle('primary', primary);
  node.addEventListener('click', onClick);
  return node;
};

const row = (...children: readonly Node[]): HTMLDivElement => {
  const node = document.createElement('div');
  node.className = 'row';
  node.append(...children);
  return node;
};

export class WmScan extends WmPanel {
  private readonly select = document.createElement('select');
  private readonly live = document.createElement('div');
  private readonly video = document.createElement('video');
  private readonly result = document.createElement('div');
  private readonly view = document.createElement('canvas');
  private readonly text = document.createElement('p');
  private readonly play = document.createElement('button');
  private stream: MediaStream | null = null;
  private scan: Scan | null = null;

  protected override build(): void {
    this.setHeading(t('scan.title'));
    this.body.classList.add('scan');
    const file = document.createElement('input');
    file.type = 'file';
    file.accept = 'image/*';
    file.addEventListener('change', () => {
      void this.choose(file);
    });
    const choose = document.createElement('label');
    choose.append(t('scan.choose'), file);
    const key = document.createElement('label');
    key.className = 'opt';
    key.append(t('scan.key'), this.select);
    this.select.addEventListener('change', () => {
      this.rescan();
    });
    this.video.playsInline = true;
    this.video.muted = true;
    this.video.autoplay = true;
    this.live.hidden = true;
    this.live.append(
      this.video,
      row(
        button(
          t('scan.take'),
          () => {
            this.scanSource(this.video, this.video.videoWidth, this.video.videoHeight);
          },
          true,
        ),
      ),
    );
    this.text.className = 'result';
    this.play.type = 'button';
    this.play.className = 'primary';
    this.play.textContent = t('scan.play');
    this.play.addEventListener('click', () => {
      this.playScan();
    });
    this.result.hidden = true;
    this.result.append(
      this.view,
      this.text,
      row(
        this.play,
        button(t('scan.again'), () => {
          this.reset();
        }),
      ),
    );
    this.body.replaceChildren(
      hint(t('scan.intro')),
      row(
        button(t('scan.camera'), () => {
          void this.camera();
        }),
        choose,
        button(t('scan.example'), () => {
          this.scanExample(false);
        }),
        button(t('scan.examplePhoto'), () => {
          this.scanExample(true);
        }),
      ),
      key,
      hint(t('scan.keyHint')),
      this.live,
      this.result,
    );
  }

  protected override opened(): void {
    this.reset();
    const { signature, german } = this.context.store.get();
    this.select.replaceChildren(
      ...KEYS.map((key) => {
        const option = document.createElement('option');
        option.value = String(key.signature);
        option.textContent = `${keyLabel(key, german)} · ${signatureLabel(key.signature)}`;
        return option;
      }),
    );
    this.select.value = String(signature);
  }

  override close(): void {
    super.close();
    this.reset();
  }

  private get key(): Key {
    return keyBySignature(Number(this.select.value));
  }

  private reset(): void {
    this.stopCamera();
    this.scan = null;
    this.result.hidden = true;
    this.text.textContent = '';
  }

  private stopCamera(): void {
    for (const track of this.stream?.getTracks() ?? []) track.stop();
    this.stream = null;
    this.video.srcObject = null;
    this.live.hidden = true;
  }

  private async camera(): Promise<void> {
    this.reset();
    try {
      const media = mediaDevices();
      if (media === undefined) throw new Error('no camera');
      this.stream = await media.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 } } });
      this.video.srcObject = this.stream;
      this.live.hidden = false;
      await this.video.play();
    } catch {
      this.text.textContent = t('scan.noCamera');
      this.view.hidden = true;
      this.play.hidden = true;
      this.result.hidden = false;
    }
  }

  // A chosen file, turned the way its metadata says where the browser can
  private async choose(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = '';
    if (file === undefined) return;
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() =>
      createImageBitmap(file),
    );
    this.scanSource(bitmap, bitmap.width, bitmap.height);
    bitmap.close();
  }

  private scanExample(photo: boolean): void {
    const image = renderExampleSheet({ photo });
    const data = new ImageData(image.data.slice(), image.width, image.height);
    const source = document.createElement('canvas');
    source.width = image.width;
    source.height = image.height;
    source.getContext('2d')?.putImageData(data, 0, 0);
    this.scanImage(data, source);
  }

  // The picture at most SCAN_WIDTH wide: the scanner reads its pixels, the result view draws it
  private scanSource(source: CanvasImageSource, width: number, height: number): void {
    const scale = Math.min(1, SCAN_WIDTH / width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const cx = canvas.getContext('2d');
    if (cx === null) return;
    cx.drawImage(source, 0, 0, canvas.width, canvas.height);
    this.scanImage(cx.getImageData(0, 0, canvas.width, canvas.height), canvas);
  }

  private scanImage(image: ImageData, source: HTMLCanvasElement): void {
    this.stopCamera();
    this.scan = { image, source, result: this.read(image) };
    this.show();
  }

  private read(image: ImageData): ScanResult | ScanError {
    try {
      return scanSheet(image, { signature: this.key.signature });
    } catch (error) {
      if (error instanceof ScanError) return error;
      throw error;
    }
  }

  // The key may change after the scan: the same picture read again with the new signature
  private rescan(): void {
    if (this.scan === null) return;
    this.scan = { ...this.scan, result: this.read(this.scan.image) };
    this.show();
  }

  private show(): void {
    const scan = this.scan;
    if (scan === null) return;
    const { result } = scan;
    const key = this.key;
    const { german } = this.context.store.get();
    const failed = result instanceof ScanError;
    this.draw(failed ? errorOverlay(result) : scanOverlay(result, key, german), scan.source);
    this.text.textContent = failed ? t('scan.noStaff') : recognizedText(result, key, german);
    this.play.hidden = failed || result.notes.length === 0;
    this.view.hidden = false;
    this.result.hidden = false;
  }

  private draw(overlay: ScanOverlay, source: HTMLCanvasElement): void {
    const { width, height, angle } = overlay;
    this.view.width = width;
    this.view.height = height;
    const cx = this.view.getContext('2d');
    if (cx === null) return;
    cx.fillStyle = TABLE;
    cx.fillRect(0, 0, width, height);
    cx.save();
    cx.translate(width / 2, height / 2);
    cx.rotate((-angle * Math.PI) / 180);
    cx.drawImage(source, -width / 2, -height / 2, width, height);
    cx.restore();
    cx.lineWidth = 2;
    if (overlay.profile.length > 0) {
      cx.strokeStyle = PROFILE_COLOR;
      polyline(cx, overlay.profile);
    }
    cx.strokeStyle = LINE_COLOR;
    for (const line of overlay.lines) polyline(cx, line);
    cx.font = `bold ${String(labelPx(width))}px system-ui, sans-serif`;
    cx.textAlign = 'center';
    cx.textBaseline = 'bottom';
    cx.lineJoin = 'round';
    for (const box of overlay.boxes) {
      cx.strokeStyle = box.color;
      cx.lineWidth = 2;
      cx.strokeRect(box.x, box.y, box.w, box.h);
      cx.strokeStyle = LABEL_HALO;
      cx.lineWidth = 4;
      cx.strokeText(box.label, box.x + box.w / 2, box.y - 3);
      cx.fillStyle = box.color;
      cx.fillText(box.label, box.x + box.w / 2, box.y - 3);
    }
  }

  // The song: the current style when it stacks major thirds and holds every tone, otherwise classical; the chord
  // chords from the harmoniser of the play module on that style's model
  private playScan(): void {
    const result = this.scan?.result;
    if (result === undefined || result instanceof ScanError || result.notes.length === 0) return;
    const app = this.context;
    const key = this.key;
    const style = styleForScan(result.notes, key, app.store.get().style);
    const model = buildModel(key, style);
    const song = songFromScan(result.notes, { key, style, harmonize: (notes) => harmonizeSong(model, notes) });
    app.addScannedSong(song);
    app.startSong(song);
    this.reset();
    this.dispatchEvent(new Event(CLOSE_EVENT, { bubbles: true }));
  }
}
