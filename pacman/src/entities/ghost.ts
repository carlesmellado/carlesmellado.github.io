/**
 * Ghost entity + the four deterministic AI controllers (spec C/D/E).
 *  - Target tiles: Blinky=pac, Pinky=+4 (UP overflow bug), Inky=vector from
 *    Blinky doubled off +2 (UP bug), Clyde=8-tile shy.
 *  - Intersection choice: min Euclidean distance to target, tie-breaker
 *    iteration order UP>LEFT>DOWN>RIGHT, no 180° reverse, no UP on bait tiles.
 *  - Frightened: pseudo-random turns at intersections. Eyes path to the door.
 */

import {
  Direction,
  DIR_VECTORS,
  TILE_SIZE,
  SPEEDS,
  GHOST_SPAWNS_PX,
  SCATTER_TARGETS,
  HOUSE_BOUNCE_PX,
  GHOST_DOOR_TILE,
  TUNNEL_SLOW_COLS,
  ELROY_THRESHOLDS,
  ELROY_SPEED_KEYS,
  GhostName,
} from '../constants/index.js';
import { Entity, MovementContext } from './entity.js';
import { TileMap, TilePos, TileType } from '../grid/tilemap.js';

export type GhostStage = 'caged' | 'exiting' | 'out' | 'eyes';

export interface GhostWorld {
  frame: number;
  waveMode: 'SCATTER' | 'CHASE';
  frightenedFrames: number; // frames of fright still running (0 = none)
  remainingDots: number;
  pacman: { x: number; y: number; dir: Direction; tile(): TilePos };
  ghosts: Record<GhostName, Ghost>;
}

/** Tiny deterministic PRNG for frightened ghost turns (seeded per decision). */
function mulberry32(seed: number): number {
  let a = seed >>> 0;
  a = (a + 0x6d2b79f5) >>> 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const NAME_HASH: Record<GhostName, number> = { blinky: 11, pinky: 23, inky: 37, clyde: 41 };

export class Ghost extends Entity {
  readonly name: GhostName;
  stage: GhostStage = 'out';
  frightened = false;
  /** Absolute frame at which a caged ghost may leave the house. */
  releaseAt = 0;

  private bounceDir = 1;
  private ctx: MovementContext;
  private exitSideFlip = false; // alternates LEFT/RIGHT on each exit
  /** Latest world snapshot, set at the top of every update(). */
  private world?: GhostWorld;

  constructor(tileMap: TileMap, name: GhostName) {
    super(tileMap);
    this.name = name;
    this.ctx = { tileMap, ghost: true, onCenter: () => this.decide(this) };
    this.reset(0);
  }

  reset(levelStartFrame: number): void {
    const spawn = GHOST_SPAWNS_PX[this.name];
    this.x = spawn.x;
    this.y = spawn.y;
    this.frightened = false;
    this.stopped = false;
    if (this.name === 'blinky') {
      this.stage = 'out';
      this.dir = Direction.LEFT;
    } else {
      this.stage = 'caged';
      this.dir = Direction.UP;
      // Arcade-style staggered release (Pinky quick, Inky/Clyde slower).
      const order = { pinky: 1, inky: 2, clyde: 3 } as const;
      this.releaseAt = levelStartFrame + order[this.name] * 180;
    }
  }

  get isEaten(): boolean {
    return this.stage === 'eyes';
  }

  /** Immediate 180° flip on Scatter/Chase/Frightened transitions (spec D). */
  forceReverse(): void {
    if (this.stage !== 'out' || this.isEaten) return;
    this.dir = (this.dir + 2) % 4 as Direction;
  }

  update(world: GhostWorld): void {
    this.world = world;
    switch (this.stage) {
      case 'caged':
        this.updateCaged(world);
        break;
      case 'exiting':
        this.updateExiting();
        break;
      case 'out':
      case 'eyes':
        this.updateRoaming(world);
        break;
    }
  }

  // ─── House lifecycle ──────────────────────────────────────────────────────

  private updateCaged(world: GhostWorld): void {
    // bounce vertically like the arcade caged ghosts
    this.y += this.bounceDir * 0.5;
    if (this.y <= HOUSE_BOUNCE_PX.minY) {
      this.y = HOUSE_BOUNCE_PX.minY;
      this.bounceDir = 1;
    } else if (this.y >= HOUSE_BOUNCE_PX.maxY) {
      this.y = HOUSE_BOUNCE_PX.maxY;
      this.bounceDir = -1;
    }
    if (world.frame >= this.releaseAt) this.stage = 'exiting';
  }

  /**
   * Arcade exit sequence: line up with the door, rise to the corridor row,
   * slide to the assigned exit column (12/15 alternating) and climb out one
   * tile higher, where the roaming AI takes over. The no-UP restriction only
   * governs roaming ghosts (spec D), so this scripted path bypasses it.
   */
  private updateExiting(): void {
    const doorX = GHOST_DOOR_TILE.col * TILE_SIZE + TILE_SIZE / 2;
    const holderY = (GHOST_DOOR_TILE.row - 1) * TILE_SIZE + TILE_SIZE / 2; // corridor row above door
    const exitY = (GHOST_DOOR_TILE.row - 2) * TILE_SIZE + TILE_SIZE / 2;   // hand-off tile (row 13)
    const speed = 0.75;

    if (this.y > holderY) {
      // still inside the house: center on the door, then rise through it
      if (Math.abs(this.x - doorX) > 0.5) {
        this.dir = this.x < doorX ? Direction.RIGHT : Direction.LEFT;
        this.advance(speed);
        return;
      }
      this.x = doorX;
      this.dir = Direction.UP;
      this.y = Math.max(holderY, this.y - speed);
      return;
    }

    // corridor row: slide to the exit column, then climb out at row 13
    const exitX = (this.exitSideFlip ? 15 : 12) * TILE_SIZE + TILE_SIZE / 2;
    if (this.x !== exitX) {
      const dx = exitX - this.x;
      this.dir = dx > 0 ? Direction.RIGHT : Direction.LEFT;
      if (Math.abs(dx) <= speed) this.x = exitX;
      else this.advance(speed);
      return;
    }
    this.x = exitX;
    this.dir = Direction.UP;
    if (this.y - speed <= exitY) {
      this.y = exitY;
      this.stage = 'out';
      this.exitSideFlip = !this.exitSideFlip;
    } else {
      this.y -= speed;
    }
  }

  // ─── Roaming AI (out + eyes) ─────────────────────────────────────────────

  private roamingSpeed(world: GhostWorld): number {
    if (this.stage === 'eyes') return SPEEDS.ghostEyes;
    const { col } = this.tile();
    const inTunnel =
      this.tileMap.isTunnelRow(this.tile().row) &&
      (col <= TUNNEL_SLOW_COLS.leftMax || col >= TUNNEL_SLOW_COLS.rightMin);
    if (inTunnel) return SPEEDS.ghostTunnel;
    if (this.frightened) return SPEEDS.ghostFrightened;
    if (this.name === 'blinky') {
      if (world.remainingDots <= ELROY_THRESHOLDS.elroy2) return SPEEDS[ELROY_SPEED_KEYS.elroy2];
      if (world.remainingDots <= ELROY_THRESHOLDS.elroy1) return SPEEDS[ELROY_SPEED_KEYS.elroy1];
    }
    return SPEEDS.ghostNormal;
  }

  private updateRoaming(world: GhostWorld): void {
    this.speed = this.roamingSpeed(world);
    this.stopped = false;
    this.move(this.speed, this.ctx);
    // eyes reaching the door center descend into the house and revive
    if (this.stage === 'eyes') {
      const doorX = GHOST_DOOR_TILE.col * TILE_SIZE + TILE_SIZE / 2;
      const doorY = GHOST_DOOR_TILE.row * TILE_SIZE + TILE_SIZE / 2;
      if (Math.abs(this.x - doorX) < 1 && Math.abs(this.y - doorY) < 1) {
        this.x = doorX;
        this.y = (GHOST_DOOR_TILE.row + 2) * TILE_SIZE + TILE_SIZE / 2; // inside house
        this.stage = 'caged';
        this.bounceDir = -1;
        this.frightened = world.frightenedFrames > 0; // revived ghosts re-frighten if timer runs
        this.releaseAt = world.frame + 60;
      }
    }
  }

  /** Intersection decision at tile center. Return true to keep moving. */
  private decide(ghost: Ghost): boolean {
    const world = this.world;
    if (!world) return false;
    const { col, row } = ghost.tile();
    if (!this.tileMap.isWalkableByGhost(col, row)) return false;

    const all = this.tileMap.exitsFrom(col, row, true);
    const back = (ghost.dir + 2) % 4 as Direction;
    // One-way door: only eaten eyes re-enter the house; roaming/frightened
    // ghosts must never take the door back down.
    const legal =
      ghost.stage === 'eyes'
        ? all
        : all.filter((d) => {
            const v = DIR_VECTORS[d];
            return this.tileMap.tileAt(col + v.x, row + v.y) !== TileType.DOOR;
          });

    if (ghost.stage === 'eyes') {
      // Eyes path to the door; reverse only when the corridor dead-ends.
      let options = all.filter((d) => d !== back);
      if (options.length === 0) options = [back];
      ghost.dir = this.pickByTarget(options, world, ghost);
      return true;
    }

    if (ghost.frightened) {
      // Pseudo-random turn at intersections (spec E); straight corridors only.
      let options = legal.filter((d) => d !== back);
      if (legal.length > 2) {
        if (options.length === 0) options = [back]; // dead end: forced reverse
      } else {
        options = legal.includes(ghost.dir) ? [ghost.dir] : options;
        if (options.length === 0) options = [back];
      }
      const pick = Math.floor(
        mulberry32(world.frame * 31 + NAME_HASH[ghost.name] + col * 7 + row) * options.length,
      );
      ghost.dir = options[pick];
      return true;
    }

    // Scatter/Chase: no 180°, no UP on the two bait tiles, then min distance.
    let options = legal.filter((d) => d !== back);
    if (this.tileMap.isNoUpTurnTile(col, row)) {
      options = options.filter((d) => d !== Direction.UP);
    }
    if (options.length === 0) options = [back]; // dead end: forced reverse, never freeze
    ghost.dir = this.pickByTarget(options, world, ghost);
    return true;
  }

  /** Minimal Euclidean distance to target tile; ties follow ALL_DIRECTIONS order. */
  private pickByTarget(options: Direction[], world: GhostWorld, ghost: Ghost): Direction {
    const target = this.targetTile(world);
    const here = ghost.tile();
    let best = options[0];
    let bestDist = Infinity;
    for (const dir of options) {
      const v = DIR_VECTORS[dir];
      // eyes entering the door evaluate one tile beyond the door (the house)
      const cand: TilePos = { col: here.col + v.x, row: here.row + v.y };
      const d = TileMap.euclidean(cand, target);
      if (d < bestDist - 0.0001) {
        bestDist = d;
        best = dir;
      }
    }
    return best;
  }

  // ─── Target tile per personality (spec C) ────────────────────────────────

  private targetTile(world: GhostWorld): TilePos {
    if (this.stage === 'eyes') return { ...GHOST_DOOR_TILE };

    const pac = world.pacman.tile();
    const pacDir = world.pacman.dir;

    if (world.waveMode === 'SCATTER' && this.stage === 'out') {
      return { ...SCATTER_TARGETS[this.name] };
    }

    switch (this.name) {
      case 'blinky':
        return pac;

      case 'pinky': {
        const v = DIR_VECTORS[pacDir];
        let col = pac.col + v.x * 4;
        let row = pac.row + v.y * 4;
        // original 16-bit overflow bug: facing UP also shifts 4 left
        if (pacDir === Direction.UP) col -= 4;
        return { col, row };
      }

      case 'inky': {
        const v = DIR_VECTORS[pacDir];
        let col = pac.col + v.x * 2;
        let row = pac.row + v.y * 2;
        if (pacDir === Direction.UP) col -= 2; // same overflow quirk at ×2
        const blinky = world.ghosts.blinky.tile();
        return { col: blinky.col + 2 * (col - blinky.col), row: blinky.row + 2 * (row - blinky.row) };
      }

      case 'clyde': {
        const d = TileMap.euclidean(this.tile(), pac);
        if (d >= 8) return pac;
        return { ...SCATTER_TARGETS.clyde }; // shy: retreats to his corner (spec C4)
      }
    }
  }
}
