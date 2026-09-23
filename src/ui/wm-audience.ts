// The audience panel: the QR code of the room link on white, the link small below it, the
// code big, the connection status and the listener count, End, the public address (only where the page is local)
// and "listen yourself" with a code. The room itself lives in the app and outlives the panel.
import type { RoomStatus } from '../audience/player-room';
import { qrMatrix } from '../audience/qr-encoder';
import { isRoomCode } from '../audience/room';
import { t } from '../i18n';
import { formatHash } from '../play/deep-links';
import { CLOSE_EVENT, WmPanel } from './wm-panel';
import { hint } from './settings-groups';

const QR_MAX_PX = 260; // the code as large as fits, about this wide

// A QR code on the canvas: `px` CSS pixels per module, sharp on high-density screens
export const drawQr = (canvas: HTMLCanvasElement, text: string, dpr = window.devicePixelRatio || 1): void => {
  const modules = qrMatrix(text);
  const n = modules.length;
  const px = Math.max(2, Math.floor(QR_MAX_PX / n));
  canvas.width = Math.round(n * px * dpr);
  canvas.height = canvas.width;
  canvas.style.width = `${String(n * px)}px`;
  canvas.style.height = canvas.style.width;
  const cx = canvas.getContext('2d');
  if (cx === null) return;
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cx.fillStyle = '#fff';
  cx.fillRect(0, 0, n * px, n * px);
  cx.fillStyle = '#000';
  modules.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark === 1) cx.fillRect(x * px, y * px, px, px);
    });
  });
};

export const statusText = (status: RoomStatus): string => {
  switch (status.kind) {
    case 'connecting':
      return t('audience.connecting');
    case 'connected':
      return t('audience.connected');
    case 'disconnected':
      return t('audience.reconnecting');
    case 'waiting':
      return t('audience.unreachable', { seconds: Math.round(status.wait / 1000) });
    case 'closed':
      return '';
  }
};

export const listenersText = (count: number): string =>
  count === 1 ? t('audience.listeners.one') : t('audience.listeners.other', { count });

// "2 Zuhörer · 1 Mitspieler" – the musicians are only named once there are any
export const roomText = (listeners: number, musicians: number): string => {
  const singers = listenersText(listeners);
  if (musicians === 0) return singers;
  const players = musicians === 1 ? t('audience.musicians.one') : t('audience.musicians.other', { count: musicians });
  return `${singers} · ${players}`;
};

const paragraph = (className: string): HTMLParagraphElement => {
  const node = document.createElement('p');
  node.className = className;
  return node;
};

const button = (label: string, onClick: () => void): HTMLButtonElement => {
  const node = document.createElement('button');
  node.type = 'button';
  node.textContent = label;
  node.addEventListener('click', onClick);
  return node;
};

const row = (...children: readonly Node[]): HTMLDivElement => {
  const node = document.createElement('div');
  node.className = 'row';
  node.append(...children);
  return node;
};

const textInput = (placeholder: string, type = 'text'): HTMLInputElement => {
  const node = document.createElement('input');
  node.type = type;
  node.placeholder = placeholder;
  node.autocapitalize = 'off';
  node.autocomplete = 'off';
  node.spellcheck = false;
  return node;
};

export class WmAudience extends WmPanel {
  private readonly qr = document.createElement('canvas');
  private readonly link = paragraph('link');
  private readonly code = document.createElement('b');
  private readonly status = paragraph('status');
  private readonly count = paragraph('count');
  private readonly addressHint = hint(t('audience.publicUrlHint'));
  private readonly address = textInput(t('audience.publicUrlPlaceholder'), 'url');
  private readonly addressRow = row(
    this.address,
    button(t('audience.apply'), () => {
      this.applyAddress();
    }),
  );
  private readonly join = textInput('k7m3x');

  protected override build(): void {
    this.setHeading(t('audience.title'));
    this.body.classList.add('pub');
    const orCode = paragraph('code');
    orCode.append(`${t('audience.orCode')} `, this.code);
    this.addressHint.classList.add('small');
    const joinHint = hint(t('audience.listenYourself'));
    joinHint.classList.add('small');
    this.join.maxLength = 12;
    this.join.addEventListener('keydown', (event) => {
      if (event.code === 'Enter') this.listen();
    });
    this.body.replaceChildren(
      hint(t('audience.intro')),
      this.qr,
      this.link,
      orCode,
      this.status,
      this.count,
      row(
        button(t('audience.end'), () => {
          this.context.room.end();
          this.dispatchEvent(new Event(CLOSE_EVENT, { bubbles: true }));
        }),
      ),
      this.addressHint,
      this.addressRow,
      joinHint,
      row(
        this.join,
        button(t('audience.listen'), () => {
          this.listen();
        }),
      ),
    );
    this.context.on('room', () => {
      this.refresh();
    });
  }

  // The room opens with the panel and stays open when it closes – End closes it
  protected override opened(): void {
    const { room, store } = this.context;
    const { publicUrl } = store.get();
    this.address.value = publicUrl;
    const showAddress = room.isLocal || publicUrl !== '';
    this.addressHint.hidden = !showAddress;
    this.addressRow.hidden = !showAddress;
    if (!room.isOpen) room.open();
    this.refresh();
  }

  private refresh(): void {
    const { room } = this.context;
    if (room.code === null) return; // ended: the panel is closing
    if (this.code.textContent !== room.code) drawQr(this.qr, room.pageLink);
    this.link.textContent = room.pageLink;
    this.code.textContent = room.code;
    this.status.textContent = statusText(room.status);
    this.count.textContent = roomText(room.listeners, room.musicians);
  }

  // The online address for the file from disk: new room on the relay of that address
  private applyAddress(): void {
    const { room, store } = this.context;
    store.update({ publicUrl: this.address.value.trim() });
    room.restart();
  }

  // "Listen yourself": the page becomes a listener of the typed room
  private listen(): void {
    const code = this.join.value.trim().toLowerCase();
    if (!isRoomCode(code)) {
      this.join.focus();
      return;
    }
    this.context.room.end();
    location.hash = formatHash(this.context.store.get(), { room: code });
  }
}
