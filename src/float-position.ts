import type { SpindleFloatWidgetHandle } from 'lumiverse-spindle-types';

/** Keep extension-driven coordinates through host size/visibility updates. */
export function positioned(widget: SpindleFloatWidgetHandle, width: number, height: number): SpindleFloatWidgetHandle {
  let position = widget.getPosition();
  return {
    ...widget,
    getPosition: () => ({ ...position }),
    moveTo(x, y) { position = { x, y }; widget.moveTo(x, y); },
    setSize(w, h) {
      if (width === w && height === h) return;
      width = w; height = h;
      widget.setSize(w, h); widget.moveTo(position.x, position.y);
    },
    setVisible(visible) {
      widget.setVisible(visible);
      if (visible) widget.moveTo(position.x, position.y);
    },
  };
}

/** Float beside the clicked mascot, then clamp the whole menu to the viewport. */
export function openBeside(mascot: SpindleFloatWidgetHandle, panel: SpindleFloatWidgetHandle, width: number, height: number, mascotSize: number) {
  const saved = mascot.getPosition(), rect = mascot.root.getBoundingClientRect();
  const scale = mascot.root.offsetWidth && rect.width ? rect.width / mascot.root.offsetWidth : 1;
  // Host viewport clamps can move a visible widget independently of our drag.
  const p = rect.width && rect.height ? { x: rect.left / scale, y: rect.top / scale } : saved;
  mascot.moveTo(p.x, p.y);
  const viewport = window.visualViewport;
  const left = (viewport?.offsetLeft || 0) / scale + 8, top = (viewport?.offsetTop || 0) / scale + 8;
  const right = ((viewport?.offsetLeft || 0) + (viewport?.width || window.innerWidth)) / scale - 8;
  const bottom = ((viewport?.offsetTop || 0) + (viewport?.height || window.innerHeight)) / scale - 8;
  const x = p.x + mascotSize + width + 12 <= right ? p.x + mascotSize + 12 : p.x - width - 12;
  panel.moveTo(Math.max(left, Math.min(x, right - width)), Math.max(top, Math.min(p.y, bottom - height)));
}
