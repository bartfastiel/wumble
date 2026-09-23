// A row or grid of tiles, one of them current. Each tile shows a drawing of what it does – the words are only in
// the tooltip. The widget knows nothing about what is being chosen.
export interface ChoiceItem<V> {
  readonly value: V;
  readonly label: string;
  readonly art: () => Node; // the picture on the tile
  readonly caption?: string; // a symbol or two under the picture, never a sentence
}

export interface Choice<V> {
  readonly element: HTMLDivElement;
  set(value: V): void;
}

export const choice = <V extends string | number>(
  items: readonly ChoiceItem<V>[],
  current: V,
  onPick: (value: V) => void,
  columns = 0, // 0 lets the tiles flow
): Choice<V> => {
  const element = document.createElement('div');
  element.className = 'tiles';
  element.setAttribute('role', 'radiogroup');
  if (columns > 0) element.style.setProperty('--cols', String(columns));
  const tiles = items.map((item) => {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'tile';
    tile.title = item.label;
    tile.setAttribute('role', 'radio');
    tile.setAttribute('aria-label', item.label);
    const art = document.createElement('span');
    art.className = 'art';
    art.append(item.art());
    tile.append(art);
    if (item.caption !== undefined) {
      const caption = document.createElement('span');
      caption.className = 'cap';
      caption.textContent = item.caption;
      tile.append(caption);
    }
    tile.addEventListener('click', () => {
      onPick(item.value);
    });
    element.append(tile);
    return { tile, value: item.value };
  });
  const set = (value: V): void => {
    for (const { tile, value: own } of tiles) {
      const on = own === value;
      tile.classList.toggle('on', on);
      tile.setAttribute('aria-checked', String(on));
    }
  };
  set(current);
  return { element, set };
};
