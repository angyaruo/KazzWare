import type { SpindleFloatWidgetHandle } from 'lumiverse-spindle-types';
import type { Settings } from './shared';
import curled from '../assets/kazz-curled.png';
import peek from '../assets/kazz-peek.png';

/** Each pose keeps its own position; opening tools never moves the launcher. */
export function mascotLayout(widget: SpindleFloatWidgetHandle, button: HTMLElement, image: HTMLImageElement, settings: () => Settings | undefined) {
  let peeking: boolean | undefined, side = 'right', peekY = Math.max(8, window.innerHeight - 190), size = 110;
  let roundPosition = widget.getPosition();
  const height = () => window.visualViewport?.height || window.innerHeight;
  function dock() {
    widget.moveTo(side === 'left' ? 8 : Math.max(8, window.innerWidth - size - 8), Math.max(8, Math.min(peekY, height() - size - 8)));
    button.classList.toggle('peek-left', side === 'left');
  }
  function sync(resized = false) {
    const preferences = settings();
    const style = preferences?.widgetStyle ?? (preferences?.mobilePeek === false ? 'floating' : 'auto');
    const next = style === 'peeking' || (style === 'auto' && window.innerWidth <= 600);
    const changed = next !== peeking;
    if (changed) {
      if (next) roundPosition = widget.getPosition();
      peeking = next; button.classList.toggle('peek', next); image.src = next ? peek : curled;
      if (!next) button.classList.remove('peek-left');
      resized = true;
    }
    const nextSize = preferences?.mascotSize || 110;
    if (nextSize !== size) resized = true;
    size = nextSize;
    // Both original PNGs are square. Fit the entire high-resolution image;
    // an oversized inner image used to clip the peeker's hair and tail.
    widget.setSize(size, size);
    if (changed && !next) widget.moveTo(roundPosition.x, roundPosition.y);
    if (resized && next) dock();
    else if (resized) { const p = widget.getPosition(); widget.moveTo(Math.max(8, Math.min(p.x, window.innerWidth - size - 8)), Math.max(8, Math.min(p.y, height() - size - 8))); }
  }
  return { sync, reset() {
    side = 'right'; peekY = Math.max(8, height() - 190);
    const size = settings()?.mascotSize || 110;
    roundPosition = { x: Math.max(8, window.innerWidth - size - 24), y: Math.max(8, height() - size - 130) };
    widget.moveTo(roundPosition.x, roundPosition.y); sync(true);
  }, width: () => size, settled() {
    const p = widget.getPosition();
    if (peeking) { side = p.x + size / 2 < window.innerWidth / 2 ? 'left' : 'right'; peekY = p.y; dock(); }
    else roundPosition = p;
  } };
}
