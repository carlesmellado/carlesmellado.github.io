/**
 * Game orchestrator: the 60Hz state machine (READY → PLAYING → DYING/CLEAR →
 * READY/…/GAME OVER), scatter/chase wave engine, frightened cascade, fruit,
 * scoring/lives/extra life, collisions and audio dispatch (spec D/E).
 */

import {
  WAVE_SCHEDULE,
  FRIGHTENED_FRAMES_BY_LEVEL,
  FRIGHTENED_FLASH_FRAMES,
  SCORING,
  FRUIT,
  READY_FRAMES,
  LEVEL_CLEAR_FRAMES,
  MAZE_FLASH_FRAMES,
  DEATH_ANIM_FRAMES,
  POPUP_FRAMES,
  GHOST_ORDER,
  GhostName,
} from '../constants/index.js';
import { TileMap } from '../grid/tilemap.js';
import { InputBuffer } from './input.js';
import { Pacman } from '../entities/pacman.js';
import { Ghost, GhostWorld } from '../entities/ghost.js';
import { AudioManager } from '../audio/audioManager.js';
import { RenderState } from '../rendering/renderer.js';
import { FRUIT_SPAWN_PX } from '../constants/index.js';

type GameState = 'READY' | 'PLAYING' | 'DYING' | 'CLEAR' | 'OVER';

export class Game {
  map: TileMap;
  pacman: Pacman;
  ghosts: Record<GhostName, Ghost>;

  state: GameState = 'READY';
  frame = 0;
  paused = false;

  score = 0;
  highScore = 0;
  lives = 3;
  level = 1;

  /** Scatter/Chase wave engine (spec D). */
  private waveIndex = 0;
  private waveFrames = WAVE_SCHEDULE[0].frames;
  waveMode: 'SCATTER' | 'CHASE' = 'SCATTER';

  /** Frightened state machine. */
  frightenedFrames = 0;
  private cascade = 0;

  /** Fruit tracking (spec E). */
  private dotsEaten = 0;
  private fruitSpawned = [false, false];
  private fruitTtl = 0;
  readonly fruitX = FRUIT_SPAWN_PX.x;
  readonly fruitY = FRUIT_SPAWN_PX.y;

  private overlayFrames = 0;
  private extraLifeAwarded = false;
  popups: RenderState['popups'] = [];

  private audio: AudioManager;
  private input: InputBuffer;

  constructor(canvasMap: TileMap, input: InputBuffer, audio: AudioManager) {
    this.map = canvasMap;
    this.input = input;
    this.audio = audio;

    this.pacman = new Pacman(this.map, {
      onPellet: (kind) => this.onPellet(kind),
    });

    this.ghosts = {
      blinky: new Ghost(this.map, 'blinky'),
      pinky: new Ghost(this.map, 'pinky'),
      inky: new Ghost(this.map, 'inky'),
      clyde: new Ghost(this.map, 'clyde'),
    };

    input.onPause = () => {
      if (this.state === 'PLAYING' || this.state === 'READY') {
        this.paused = !this.paused;
      }
    };
    input.onStart = () => {
      if (this.state === 'OVER') this.fullReset();
      this.audio.unlock();
    };

    this.enterReady();
  }

  // ─── State transitions ────────────────────────────────────────────────────

  private enterReady(): void {
    this.state = 'READY';
    this.overlayFrames = READY_FRAMES;
    this.pacman.reset();
    const levelStart = this.frame;
    for (const name of GHOST_ORDER) this.ghosts[name].reset(levelStart);
    this.input.clear();
    this.paused = false;
  }

  private onDeathComplete(): void {
    this.lives--;
    if (this.lives <= 0) {
      this.state = 'OVER';
      this.overlayFrames = Infinity;
      this.highScore = Math.max(this.highScore, this.score);
      this.audio.stopSiren();
      this.audio.stopEnergy();
    } else {
      this.enterReady();
    }
  }

  private onLevelClear(): void {
    this.state = 'CLEAR';
    this.overlayFrames = LEVEL_CLEAR_FRAMES;
    this.audio.stopSiren();
    this.audio.stopEnergy();
  }

  private nextLevel(): void {
    this.level++;
    this.map = new TileMap();
    this.pacman = new Pacman(this.map, { onPellet: (kind) => this.onPellet(kind) });
    for (const name of GHOST_ORDER) {
      this.ghosts[name] = new Ghost(this.map, name);
    }
    this.waveIndex = 0;
    this.waveFrames = WAVE_SCHEDULE[0].frames;
    this.waveMode = WAVE_SCHEDULE[0].mode;
    this.frightenedFrames = 0;
    this.dotsEaten = 0;
    this.fruitSpawned = [false, false];
    this.fruitTtl = 0;
    this.enterReady();
  }

  private fullReset(): void {
    this.score = 0;
    this.lives = 3;
    this.extraLifeAwarded = false;
    this.popups = [];
    this.nextLevel();
    this.level = 1;
    this.enterReady();
  }

  // ─── Per-frame update ─────────────────────────────────────────────────────

  update(): void {
    this.frame++;
    if (this.paused) return;

    for (const p of this.popups) p.frames--;
    this.popups = this.popups.filter((p) => p.frames > 0);

    switch (this.state) {
      case 'READY':
        this.overlayFrames--;
        if (this.overlayFrames <= 0) {
          this.state = 'PLAYING';
          this.overlayFrames = 0;
          this.audio.startSiren();
        }
        return;

      case 'PLAYING':
        this.updatePlaying();
        return;

      case 'DYING':
        this.pacman.update(); // runs the death animation timer
        if (this.pacman.deathDone) this.onDeathComplete();
        return;

      case 'CLEAR':
        this.overlayFrames--;
        if (this.overlayFrames <= 0) this.nextLevel();
        return;

      case 'OVER':
        return;
    }
  }

  private updatePlaying(): void {
    // ── wave timer (scatter/chase, spec D)
    this.waveFrames--;
    if (this.waveFrames <= 0) {
      this.waveIndex = Math.min(this.waveIndex + 1, WAVE_SCHEDULE.length - 1);
      this.waveFrames = WAVE_SCHEDULE[this.waveIndex].frames;
      const mode = WAVE_SCHEDULE[this.waveIndex].mode;
      if (mode !== this.waveMode) {
        this.waveMode = mode;
        if (this.frightenedFrames === 0) {
          for (const name of GHOST_ORDER) this.ghosts[name].forceReverse();
        }
      }
    }

    // ── frightened countdown
    if (this.frightenedFrames > 0) {
      this.frightenedFrames--;
      this.audio.tickEnergy(Math.floor(this.frame / 8) % 2 === 0);
      if (this.frightenedFrames === 0) this.endFrightened();
    }

    // ── input → pac (latest key wins; an un-executable desire must never
    // lock out newer inputs — arcade-style buffer replacement)
    const pending = this.input.pending;
    if (pending !== null) {
      this.pacman.desired = pending;
      this.input.consumePending();
    }
    this.pacman.applyFrightened(this.frightenedFrames > 0);
    this.pacman.update();

    // ── ghosts
    const world: GhostWorld = {
      frame: this.frame,
      waveMode: this.waveMode,
      frightenedFrames: this.frightenedFrames,
      remainingDots: this.map.pelletsRemainingCount,
      pacman: this.pacman,
      ghosts: this.ghosts,
    };
    for (const name of GHOST_ORDER) this.ghosts[name].update(world);

    // ── siren control
    const nearest = this.nearestGhostDistanceTiles();
    this.audio.updateSiren(
      this.frightenedFrames > 0 ? 'frightened' : this.waveMode === 'CHASE' ? 'chase' : 'scatter',
      Math.min(1, nearest / 24),
    );

    // ── fruit lifecycle (spec E)
    this.updateFruit();

    // ── collisions
    this.checkGhostCollisions();

    // ── level clear
    if (this.map.pelletsRemainingCount === 0) this.onLevelClear();
  }

  // ─── Pellets, frightened, collisions ─────────────────────────────────────

  private onPellet(kind: 'dot' | 'energizer'): void {
    if (kind === 'dot') {
      this.addScore(SCORING.dot);
      this.dotsEaten++;
      this.audio.waka();
    } else {
      this.addScore(SCORING.energizer);
      this.startFrightened();
    }
    if (this.extraLifeAwarded === false && this.score >= SCORING.extraLifeAt) {
      this.extraLifeAwarded = true;
      this.lives++;
      this.audio.extraLife();
    }
  }

  private startFrightened(): void {
    const idx = Math.min(this.level - 1, FRIGHTENED_FRAMES_BY_LEVEL.length - 1);
    this.frightenedFrames = FRIGHTENED_FRAMES_BY_LEVEL[idx];
    this.cascade = 0;
    this.audio.stopSiren();
    this.audio.startEnergy();
    for (const name of GHOST_ORDER) {
      const g = this.ghosts[name];
      if (g.stage !== 'eyes') {
        g.frightened = true;
        g.forceReverse();
      }
    }
  }

  private endFrightened(): void {
    this.audio.stopEnergy();
    this.audio.startSiren();
    for (const name of GHOST_ORDER) {
      const g = this.ghosts[name];
      if (g.stage !== 'eyes') {
        g.frightened = false;
        g.forceReverse();
      }
    }
  }

  private checkGhostCollisions(): void {
    for (const name of GHOST_ORDER) {
      const g = this.ghosts[name];
      if (g.stage === 'eyes' || g.stage === 'caged') continue;
      const dx = Math.abs(g.x - this.pacman.x);
      const dy = Math.abs(g.y - this.pacman.y);
      if (dx >= 7 || dy >= 7) continue;

      if (g.frightened) {
        const points = SCORING.ghostCascade[Math.min(this.cascade, SCORING.ghostCascade.length - 1)];
        this.cascade++;
        this.addScore(points);
        this.popups.push({ x: this.pacman.x, y: this.pacman.y, text: String(points), frames: POPUP_FRAMES });
        g.frightened = false;
        g.stage = 'eyes';
        this.audio.ghostEaten();
      } else {
        // Pac-Man dies
        this.state = 'DYING';
        this.overlayFrames = DEATH_ANIM_FRAMES;
        this.pacman.startDeath();
        this.audio.stopSiren();
        this.audio.stopEnergy();
        this.audio.death();
        return;
      }
    }
  }

  private updateFruit(): void {
    for (let i = 0; i < FRUIT.spawnAfterDots.length; i++) {
      if (!this.fruitSpawned[i] && this.dotsEaten >= FRUIT.spawnAfterDots[i]) {
        this.fruitSpawned[i] = true;
        this.fruitTtl = FRUIT.lifetimeFrames;
      }
    }
    if (this.fruitTtl > 0) {
      this.fruitTtl--;
      if (
        Math.abs(this.pacman.x - this.fruitX) < 8 &&
        Math.abs(this.pacman.y - this.fruitY) < 8
      ) {
        this.fruitTtl = 0;
        const idx = Math.min(this.level - 1, FRUIT.pointsByLevel.length - 1);
        const pts = FRUIT.pointsByLevel[idx];
        this.addScore(pts);
        this.popups.push({ x: this.fruitX, y: this.fruitY, text: String(pts), frames: POPUP_FRAMES });
        this.audio.fruitGot();
      }
    }
  }

  private addScore(points: number): void {
    this.score += points;
    if (this.score > this.highScore) this.highScore = this.score;
  }

  private nearestGhostDistanceTiles(): number {
    const p = this.pacman.tile();
    let best = 99;
    for (const name of GHOST_ORDER) {
      const g = this.ghosts[name];
      if (g.stage !== 'out') continue;
      const d = TileMap.euclidean(g.tile(), p);
      if (d < best) best = d;
    }
    return best;
  }

  /** How long before fright expiry the ghosts start flashing (spec E). */
  get frightenedFlashOut(): number {
    return FRIGHTENED_FLASH_FRAMES;
  }

  // ─── View state for the renderer ──────────────────────────────────────────

  renderState(): RenderState {
    return {
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      level: this.level,
      auto: '',
      frightenedFrames: this.frightenedFrames,
      frightenedFlashOut: this.frightenedFlashOut,
      paused: this.paused,
      overlay: this.paused
        ? 'PAUSED'
        : this.state === 'READY'
          ? 'READY!'
          : this.state === 'OVER'
            ? 'GAME OVER'
            : '',
      overlaySub: this.state === 'OVER' ? 'PRESS ENTER' : '',
      mazeFlash:
        this.state === 'CLEAR' &&
        Math.floor(this.overlayFrames / MAZE_FLASH_FRAMES) % 2 === 1,
      overlayFrames: this.overlayFrames,
      fruitVisible: this.fruitTtl > 0,
      fruitX: this.fruitX,
      fruitY: this.fruitY,
      popups: this.popups,
    };
  }
}
