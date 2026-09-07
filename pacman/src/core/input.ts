/**
 * Keyboard input buffer (spec: independent Input Buffer module).
 * Arrows/WASD queue desired directions; Space pauses; Enter starts/restarts.
 */

import { Direction } from '../constants/index.js';

const KEY_TO_DIR: Record<string, Direction> = {
  ArrowUp: Direction.UP,
  ArrowLeft: Direction.LEFT,
  ArrowDown: Direction.DOWN,
  ArrowRight: Direction.RIGHT,
  KeyW: Direction.UP,
  KeyA: Direction.LEFT,
  KeyS: Direction.DOWN,
  KeyD: Direction.RIGHT,
};

export class InputBuffer {
  /** Buffered directions, oldest first, max 2 pending. */
  private queue: Direction[] = [];
  onPause?: () => void;
  onStart?: () => void;
  onAnyKey?: () => void;
  /** B cycles demo autopilot: off → AUTO 1 → AUTO 2 → off. */
  onToggleAuto?: () => void;

  attach(): void {
    window.addEventListener('keydown', (e) => {
      this.onAnyKey?.();
      const dir = KEY_TO_DIR[e.code];
      if (dir !== undefined) {
        e.preventDefault();
        this.push(dir);
      } else if (e.code === 'Space') {
        e.preventDefault();
        this.onPause?.();
      } else if (e.code === 'Enter') {
        this.onStart?.();
      } else if (e.code === 'KeyB') {
        this.onToggleAuto?.();
      }
    });
  }

  /** Push a direction; ignore immediate repeats and cap the buffer at 2. */
  push(dir: Direction): void {
    const last = this.queue[this.queue.length - 1] ?? null;
    if (last === dir) return;
    this.queue.push(dir);
    if (this.queue.length > 2) this.queue.shift();
  }

  /** Next buffered direction for Pac-Man to adopt (does not consume yet — the
   * entity consumes it when the turn is legal, arcade-style). */
  get pending(): Direction | null {
    return this.queue.length > 0 ? this.queue[0] : null;
  }

  consumePending(): void {
    if (this.queue.length > 0) this.queue.shift();
  }

  clear(): void {
    this.queue = [];
  }
}
