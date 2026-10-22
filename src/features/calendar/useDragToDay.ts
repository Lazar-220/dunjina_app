import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { IsoDate } from '../../domain/dates';
import type { CalendarItem } from '../workout/calendar-item';

/** How long a press must last before a workout lifts. */
export const LONG_PRESS_MS = 350;
/** Movement before the press completes counts as scrolling, not dragging. */
const SLOP_PX = 8;
const EDGE_PX = 70;
const SCROLL_STEP_PX = 12;

export interface DragState {
  item: CalendarItem;
  x: number;
  y: number;
  /** Position and size of the row when it was lifted, so the floating copy matches it. */
  rect: { left: number; width: number; height: number };
  /** Day under the pointer, or null when it is not over a day. */
  targetDate: IsoDate | null;
}

interface Pending {
  item: CalendarItem;
  x: number;
  y: number;
  rect: DOMRect;
}

const dateAt = (x: number, y: number): IsoDate | null =>
  document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-date]')?.dataset['date'] ?? null;

/**
 * Long-press a workout, drag it over a day and release to move it. Days are elements carrying `data-date`.
 * Cancelled by Escape, by pointer cancel, or by moving before the press completes (that is scrolling).
 */
export function useDragToDay(onDrop: (item: CalendarItem, date: IsoDate) => void) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const pending = useRef<Pending | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dragging = useRef<DragState | null>(null);
  const justDragged = useRef(false);
  const scrollFrame = useRef<number | undefined>(undefined);
  const onDropRef = useRef(onDrop);

  useEffect(() => {
    onDropRef.current = onDrop;
  }, [onDrop]);

  const stopAutoScroll = () => {
    if (scrollFrame.current !== undefined) cancelAnimationFrame(scrollFrame.current);
    scrollFrame.current = undefined;
  };

  const end = useCallback((drop: boolean) => {
    clearTimeout(timer.current);
    stopAutoScroll();
    const current = dragging.current;
    pending.current = null;
    dragging.current = null;
    if (current) {
      justDragged.current = true;
      setTimeout(() => {
        justDragged.current = false;
      }, 0);
      if (drop && current.targetDate !== null && current.targetDate !== current.item.date) {
        onDropRef.current(current.item, current.targetDate);
      }
    }
    setDrag(null);
  }, []);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const waiting = pending.current;
      if (waiting && !dragging.current) {
        if (Math.hypot(event.clientX - waiting.x, event.clientY - waiting.y) > SLOP_PX) end(false);
        return;
      }
      const current = dragging.current;
      if (!current) return;
      const next = { ...current, x: event.clientX, y: event.clientY, targetDate: dateAt(event.clientX, event.clientY) };
      dragging.current = next;
      setDrag(next);
      autoScroll(event.clientY);
    };

    const autoScroll = (y: number) => {
      stopAutoScroll();
      const container = document.querySelector<HTMLElement>('.scroll');
      if (!container) return;
      const bounds = container.getBoundingClientRect();
      const direction = y < bounds.top + EDGE_PX ? -1 : y > bounds.bottom - EDGE_PX ? 1 : 0;
      if (direction === 0) return;
      const step = () => {
        container.scrollTop += direction * SCROLL_STEP_PX;
        const current = dragging.current;
        if (current) {
          const targetDate = dateAt(current.x, current.y);
          if (targetDate !== current.targetDate) {
            dragging.current = { ...current, targetDate };
            setDrag(dragging.current);
          }
          scrollFrame.current = requestAnimationFrame(step);
        }
      };
      scrollFrame.current = requestAnimationFrame(step);
    };

    const up = () => end(true);
    const cancel = () => end(false);
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dragging.current) {
        event.stopPropagation();
        end(false);
      }
    };
    // Once a workout is lifted the page must not scroll under the finger.
    const touch = (event: TouchEvent) => {
      if (dragging.current && event.cancelable) event.preventDefault();
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('keydown', key, true);
    window.addEventListener('touchmove', touch, { passive: false });
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('touchmove', touch);
      clearTimeout(timer.current);
      stopAutoScroll();
    };
  }, [end]);

  /** Props to spread on the element that can be picked up. */
  const gestureProps = useCallback(
    (item: CalendarItem) => ({
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        const rect = event.currentTarget.closest('.wk')?.getBoundingClientRect() ?? event.currentTarget.getBoundingClientRect();
        pending.current = { item, x: event.clientX, y: event.clientY, rect };
        clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          const waiting = pending.current;
          if (!waiting) return;
          const lifted: DragState = {
            item: waiting.item,
            x: waiting.x,
            y: waiting.y,
            rect: { left: waiting.rect.left, width: waiting.rect.width, height: waiting.rect.height },
            targetDate: dateAt(waiting.x, waiting.y),
          };
          dragging.current = lifted;
          setDrag(lifted);
        }, LONG_PRESS_MS);
      },
      onClickCapture: (event: { stopPropagation: () => void; preventDefault: () => void }) => {
        if (justDragged.current) {
          event.stopPropagation();
          event.preventDefault();
        }
      },
      onContextMenu: (event: { preventDefault: () => void }) => event.preventDefault(),
    }),
    [],
  );

  return { drag, gestureProps };
}
