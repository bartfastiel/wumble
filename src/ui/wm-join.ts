// The welcome page of a guest: someone scanned the QR code and lands here. Singing or playing along? Playing along
// is preselected, with a sound nobody else is on and the middle of the field – so the whole page can be answered by
// pressing Play.
import type { CombiId } from '../audio/engine';
import { COMBI_IDS } from '../play/settings';
import { t } from '../i18n';
import { soundTiles } from './controls/sound-tiles';
import { choice, type Choice, type ChoiceItem } from './widgets/choice';
import { icon } from './widgets/icons';

export type GuestRole = 'sing' | 'play';

export interface GuestChoice {
  readonly role: GuestRole;
  readonly sound: CombiId;
  readonly low: boolean; // the bass end of the field
}

const SIGN = { sing: 'mic', play: 'hands' } as const;

export class WmJoin extends HTMLElement {
  onPlay: ((choice: GuestChoice) => void) | null = null;
  private how: GuestRole = 'play';
  private sound: CombiId = 'piano';
  private low = false;
  private taken: readonly string[] = [];
  private readonly card = document.createElement('div');
  private readonly seat = document.createElement('div');
  private sounds: Choice<CombiId> | null = null;

  connectedCallback(): void {
    if (this.classList.contains('modal')) return;
    this.className = 'modal';
    this.card.className = 'card join';
    this.seat.className = 'seat-choice';
    this.hidden = true; // only a guest who scanned the code ever sees this
    this.append(this.card);
    this.build();
  }

  // The player told us which sounds are spoken for; the preselected one steps aside for them
  setTaken(taken: readonly string[]): void {
    this.taken = taken;
    if (taken.includes(this.sound)) this.sound = this.free();
    this.sounds?.set(this.sound);
    this.build();
  }

  private free(): CombiId {
    return COMBI_IDS.find((id) => !this.taken.includes(id)) ?? 'piano';
  }

  private build(): void {
    const title = document.createElement('h2');
    title.textContent = t('join.title');
    const roles = choice<GuestRole>(
      (['play', 'sing'] as const).map((role): ChoiceItem<GuestRole> => ({
        value: role,
        label: t(`join.role.${role}.name`),
        hint: t(`join.role.${role}.text`),
        caption: t(`join.role.${role}.name`),
        art: () => icon(SIGN[role]),
      })),
      this.how,
      (role) => {
        this.how = role;
        roles.set(role);
        this.seat.hidden = role !== 'play';
      },
      2,
    );
    this.fillSeat();
    const play = document.createElement('button');
    play.className = 'play';
    play.textContent = t('welcome.play');
    play.addEventListener('click', () => {
      this.hidden = true;
      this.onPlay?.({ role: this.how, sound: this.sound, low: this.low });
    });
    this.seat.hidden = this.how !== 'play';
    this.card.replaceChildren(title, roles.element, this.seat, play);
    requestAnimationFrame(() => {
      play.focus();
    });
  }

  // Where to sit: the bass end or the middle, and on what
  private fillSeat(): void {
    const ranges = choice<number>(
      [
        {
          value: 0,
          label: t('join.range.middle.name'),
          hint: t('join.range.middle.text'),
          caption: t('join.range.middle.name'),
          art: () => icon('hands'),
        },
        {
          value: 1,
          label: t('join.range.low.name'),
          hint: t('join.range.low.text'),
          caption: t('join.range.low.name'),
          art: () => icon('pipes'),
        },
      ],
      this.low ? 1 : 0,
      (value) => {
        this.low = value === 1;
        ranges.set(value);
      },
      2,
    );
    if (this.taken.includes(this.sound)) this.sound = this.free();
    const sounds = soundTiles(
      this.sound,
      (sound) => {
        this.sound = sound;
        sounds.set(sound);
      },
      undefined,
      this.taken,
    );
    this.sounds = sounds;
    const hint = document.createElement('p');
    hint.className = 'says';
    hint.textContent = t('join.seatHint');
    this.seat.replaceChildren(ranges.element, sounds.element, hint);
  }
}
