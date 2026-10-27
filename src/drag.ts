import type { SpindleFloatWidgetHandle } from 'lumiverse-spindle-types';

/** Own the gesture instead of relying on a host drag listener across Shadow DOM. */
export function draggable(handle: HTMLElement, widget: Pick<SpindleFloatWidgetHandle, 'root' | 'getPosition' | 'moveTo'>) {
  let gesture: { id: number; x: number; y: number; start: { x: number; y: number }; scale: number; moved: boolean } | undefined;
  let suppressUntil = 0;
  const scale = () => {
    const width = widget.root.offsetWidth;
    return width ? widget.root.getBoundingClientRect().width / width || 1 : 1;
  };
  const move = (x: number, y: number, ratio = scale()) => {
    const bounds = widget.root.getBoundingClientRect();
    widget.moveTo(Math.max(8, Math.min(x, (window.innerWidth - bounds.width) / ratio - 8)), Math.max(8, Math.min(y, (window.innerHeight - bounds.height) / ratio - 8)));
  };
  const cancel = () => {
    const id = gesture?.id; gesture = undefined; delete handle.dataset.dragging;
    if (id !== undefined && handle.hasPointerCapture?.(id)) handle.releasePointerCapture(id);
  };
  const down = (event: PointerEvent) => {
    if (event.button !== 0 || event.isPrimary === false || gesture) return;
    event.stopPropagation(); suppressUntil = 0;
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, start: widget.getPosition(), scale: scale(), moved: false };
    handle.setPointerCapture?.(event.pointerId);
  };
  const drag = (event: PointerEvent) => {
    if (!gesture || event.pointerId !== gesture.id) return;
    const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
    if (!gesture.moved && Math.hypot(dx, dy) < 5) return;
    gesture.moved = true; handle.dataset.dragging = ''; suppressUntil = Date.now() + 700;
    if (event.cancelable) event.preventDefault();
    move(gesture.start.x + dx / gesture.scale, gesture.start.y + dy / gesture.scale, gesture.scale);
  };
  const finish = (event: PointerEvent) => {
    if (!gesture || event.pointerId !== gesture.id) return;
    if (event.type === 'pointerup') drag(event);
    cancel();
  };
  const click = (event: MouseEvent) => {
    if (event.detail !== 0 && Date.now() < suppressUntil) { event.preventDefault(); event.stopImmediatePropagation(); }
  };
  const preventDrag = (event: DragEvent) => event.preventDefault();
  const key = (event: KeyboardEvent) => {
    const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!delta) return;
    event.preventDefault(); event.stopPropagation();
    const p = widget.getPosition(), step = event.shiftKey ? 40 : 10;
    move(p.x + delta[0] * step, p.y + delta[1] * step);
  };
  handle.style.touchAction = 'none'; handle.style.userSelect = 'none';
  handle.addEventListener('pointerdown', down); handle.addEventListener('click', click, true);
  handle.addEventListener('dragstart', preventDrag); handle.addEventListener('keydown', key);
  handle.addEventListener('lostpointercapture', cancel);
  window.addEventListener('pointermove', drag, { passive: false }); window.addEventListener('pointerup', finish);
  window.addEventListener('pointercancel', finish); window.addEventListener('blur', cancel);
  return { cancel, destroy() {
    cancel(); handle.removeEventListener('pointerdown', down); handle.removeEventListener('click', click, true);
    handle.removeEventListener('dragstart', preventDrag); handle.removeEventListener('keydown', key);
    handle.removeEventListener('lostpointercapture', cancel);
    window.removeEventListener('pointermove', drag); window.removeEventListener('pointerup', finish);
    window.removeEventListener('pointercancel', finish); window.removeEventListener('blur', cancel);
  } };
}
