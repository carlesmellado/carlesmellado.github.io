/**
 * Pac-Man entity: input-driven steering with pre-turning, eating, and the
 * arcade death animation. All logic runs on the fixed 60Hz step.
 */
import { SPEEDS, PACMAN_START_PX, PACMAN_START_DIR, DEATH_ANIM_FRAMES, } from '../constants/index.js';
import { Entity } from './entity.js';
export class Pacman extends Entity {
    /** Buffered desired direction (from the input queue). */
    desired = null;
    /** Frames of eating slow-down left (spec B: -1 frame delay per dot). */
    eatSlowFrames = 0;
    /** Mouth animation phase (arcade-style 3-frame wedge). */
    mouthPhase = 0;
    dying = false;
    dyingFrames = 0;
    events;
    ctx;
    constructor(tileMap, events) {
        super(tileMap);
        this.events = events;
        this.ctx = {
            tileMap,
            ghost: false,
            onCenter: (self) => this.handleCenter(self),
        };
        this.reset();
    }
    reset() {
        this.x = PACMAN_START_PX.x;
        this.y = PACMAN_START_PX.y;
        this.dir = PACMAN_START_DIR;
        this.desired = null;
        this.stopped = false;
        this.dying = false;
        this.dyingFrames = 0;
        this.eatSlowFrames = 0;
        this.mouthPhase = 0;
    }
    startDeath() {
        this.dying = true;
        this.dyingFrames = 0;
        this.speed = 0;
    }
    /** True while the death animation plays; game waits for it to end. */
    get deathDone() {
        return this.dying && this.dyingFrames >= DEATH_ANIM_FRAMES;
    }
    update() {
        if (this.dying) {
            this.dyingFrames++;
            return;
        }
        this.speed = this.frightenedSlow
            ? SPEEDS.pacmanFrightened
            : this.eatSlowFrames > 0
                ? SPEEDS.pacmanEating
                : SPEEDS.pacmanNormal;
        this.stopped = false;
        this.move(this.speed, this.ctx, () => this.desired);
        if (!this.stopped)
            this.mouthPhase = (this.mouthPhase + 1) % 24;
        if (this.eatSlowFrames > 0)
            this.eatSlowFrames--;
    }
    /** Called by the game while ghosts are frightened (pac runs slower). */
    applyFrightened(frightened) {
        this.frightenedSlow = frightened;
    }
    frightenedSlow = false;
    /** Try to consume a pellet at the tile the mouth occupies. */
    tryEat() {
        const { col, row } = this.tile();
        const kind = this.tileMap.eatPellet(col, row);
        if (kind) {
            this.events.onPellet(kind);
            this.eatSlowFrames = 1;
        }
    }
    /** Steering at exact tile centers. */
    handleCenter(pac) {
        pac.tryEat();
        // try queued desire first
        if (pac.desired !== null && pac.canTurnTo(pac.desired, false)) {
            pac.dir = pac.desired;
            pac.desired = null;
            return true; // move() detects the axis change and keeps remaining distance
        }
        // otherwise keep current heading if legal
        if (pac.canTurnTo(pac.dir, false))
            return true;
        return false; // wall ahead: stop until new input
    }
    /** Effective speed for rendering/tests (game also uses it for frightened). */
    get currentSpeed() {
        if (this.frightenedSlow)
            return SPEEDS.pacmanFrightened;
        return this.eatSlowFrames > 0 ? SPEEDS.pacmanEating : SPEEDS.pacmanNormal;
    }
}
