/**
 * Fixed-timestep game loop (spec: delta-time accumulator at 60Hz).
 * All simulation logic runs per tick; rendering happens once per frame.
 */
import { FRAME_MS } from '../constants/index.js';
export class GameLoop {
    update;
    render;
    rafId = 0;
    lastTime = 0;
    accumulatorMs = 0;
    running = false;
    constructor(update, render) {
        this.update = update;
        this.render = render;
    }
    start() {
        if (this.running)
            return;
        this.running = true;
        this.lastTime = performance.now();
        const frame = (now) => {
            if (!this.running)
                return;
            // Clamp to avoid the spiral of death after tab-switch pauses.
            const elapsed = Math.min(now - this.lastTime, 250);
            this.lastTime = now;
            this.accumulatorMs += elapsed;
            let ticks = 0;
            while (this.accumulatorMs >= FRAME_MS && ticks < 5) {
                // One failing subsystem (audio, rendering edge cases) must never kill the loop.
                try {
                    this.update();
                }
                catch (err) {
                    console.error('[gameLoop] update error:', err);
                }
                this.accumulatorMs -= FRAME_MS;
                ticks++;
            }
            if (ticks === 5)
                this.accumulatorMs = 0;
            try {
                this.render();
            }
            catch (err) {
                console.error('[gameLoop] render error:', err);
            }
            this.rafId = requestAnimationFrame(frame);
        };
        this.rafId = requestAnimationFrame(frame);
    }
    stop() {
        this.running = false;
        cancelAnimationFrame(this.rafId);
    }
}
