import type { SpindleFloatWidgetHandle } from 'lumiverse-spindle-types';
import type { Settings } from './shared';
import curled from '../assets/kazz-curled.png';
import peek from '../assets/kazz-peek.png';

/** Mobile docking has its own position; opening tools never moves the launcher. */
export function mascotLayout(widget: SpindleFloatWidgetHandle, button: HTMLElement, image: HTMLImageElement, settings: () => Settings | undefined) {
  let peeking: boolean | undefined, side = 'right', mobileY = Math.max(8, window.innerHeight - 190);
  let roundPosition = widget.getPosition();
  const height = () => window.visualViewport?.height || window.innerHeight;
  function dock() {
    widget.moveTo(side === 'left' ? 8 : window.innerWidth - 72, Math.max(8, Math.min(mobileY, height() - 92)));
    button.classList.toggle('peek-left', side === 'left');
  }
  function sync(resized = false) {
    const next = window.innerWidth <= 600 && settings()?.mobilePeek !== false;
    if (next !== peeking) {
      if (next) roundPosition = widget.getPosition();
      peeking = next; button.classList.toggle('peek', next); image.src = next ? peek : curled;
      if (!next) { button.classList.remove('peek-left'); widget.moveTo(roundPosition.x, roundPosition.y); }
      resized = true;
    }
    const size = settings()?.mascotSize || 110;
    widget.setSize(next ? 64 : size, next ? 84 : size);
    if (resized && next) dock();
    else if (resized) { const p = widget.getPosition(); widget.moveTo(Math.max(8, Math.min(p.x, window.innerWidth - size - 8)), Math.max(8, Math.min(p.y, height() - size - 8))); }
  }
  return { sync, width: () => peeking ? 64 : settings()?.mascotSize || 110, settled() {
    const p = widget.getPosition();
    if (peeking) { side = p.x + 32 < window.innerWidth / 2 ? 'left' : 'right'; mobileY = p.y; dock(); }
    else roundPosition = p;
  } };
}
