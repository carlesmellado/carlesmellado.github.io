/**
 * Base entity movement engine (spec B): sub-pixel float positions with an
 * axis change allowed ONLY at tile centers, plus Pac-Man's pre-turn window.
 * A tile center sits at col*8+4 / row*8+4.
 */

import {
  Direction,
  DIR_VECTORS,
  TILE_SIZE,
  CANVAS_WIDTH,
  TUNNEL_ROW,
  TUNNEL_WRAP_MARGIN,
  PRETURN_DISTANCE_PX,
} from '../constants/index.js';
import { TileMap, TilePos } from '../grid/tilemap.js';

const EPS = 0.0001;

export interface MovementContext {
  tileMap: TileMap;
  /** Called when the entity lands exactly on a tile center. Return false to stop. */
  onCenter(self: Entity): boolean;
  /** Ghost? (walks over door/house; stops at tunnel mouths) */
  ghost: boolean;
}

export abstract class Entity {
  x = 0;
  y = 0;
  dir: Direction = Direction.LEFT;
  /** Speed in px per 60Hz frame. */
  speed = 0;
  stopped = false;

  protected readonly tileMap: TileMap;

  constructor(tileMap: TileMap) {
    this.tileMap = tileMap;
  }

  tile(): TilePos {
    return this.tileMap.tileOfPx(this.x, this.y);
  }

  protected isHorizontal(): boolean {
    return this.dir === Direction.LEFT || this.dir === Direction.RIGHT;
  }

  /** Signed px to the next tile center along dir; 0 when sitting on one. */
  protected deltaToCenter(): number {
    const horizontal = this.isHorizontal();
    const p = horizontal ? this.x : this.y;
    const forward = this.dir === Direction.RIGHT || this.dir === Direction.DOWN ? 1 : -1;
    // Snap when already on a center (kills float drift before it accumulates).
    const mod = (((p - TILE_SIZE / 2) % TILE_SIZE) + TILE_SIZE) % TILE_SIZE;
    if (mod < EPS || mod > TILE_SIZE - EPS) {
      const snapped = Math.round((p - TILE_SIZE / 2) / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
      if (horizontal) this.x = snapped;
      else this.y = snapped;
      return 0;
    }
    const idx = Math.floor((p - TILE_SIZE / 2) / TILE_SIZE);
    const centers = [idx * TILE_SIZE + TILE_SIZE / 2, (idx + 1) * TILE_SIZE + TILE_SIZE / 2];
    return (forward > 0 ? centers[1] : centers[0]) - p;
  }

  /** Tile whose center we are approaching (valid even mid-tile). */
  protected centerAheadTile(): TilePos {
    const horizontal = this.isHorizontal();
    const p = horizontal ? this.x : this.y;
    const d = this.deltaToCenter();
    const centerPx = p + d; // exact center coordinate on the moving axis
    const cross = horizontal ? this.y : this.x;
    const crossTile = Math.round((cross - TILE_SIZE / 2) / TILE_SIZE);
    const moveTile = Math.round((centerPx - TILE_SIZE / 2) / TILE_SIZE);
    return horizontal ? { col: moveTile, row: crossTile } : { col: crossTile, row: moveTile };
  }

  /** Snap one axis to its lane center (used when turning). */
  protected snapAxis(axis: 'x' | 'y'): void {
    const p = axis === 'x' ? this.x : this.y;
    const snapped = Math.round((p - TILE_SIZE / 2) / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
    if (axis === 'x') this.x = snapped;
    else this.y = snapped;
  }

  protected turnTo(dir: Direction): void {
    this.dir = dir;
    // The perpendicular axis becomes the lane; the moving axis keeps its px.
    this.snapAxis(this.isHorizontal() ? 'y' : 'x');
  }

  protected wrapTunnel(): void {
    if (!this.isHorizontal()) return;
    const { row } = this.tileMap.tileOfPx(this.x, this.y);
    if (row !== TUNNEL_ROW) return;
    const m = TUNNEL_WRAP_MARGIN;
    const span = CANVAS_WIDTH + m * 2;
    if (this.x < -m) this.x += span;
    else if (this.x > CANVAS_WIDTH + m) this.x -= span;
  }

  canTurnTo(dir: Direction, ghost: boolean): boolean {
    const { col, row } = this.tile();
    return this.tileMap.exitsFrom(col, row, ghost).includes(dir);
  }

  /**
   * Advance `distance` px, honoring center-only turns. When `tryPreTurn` is
   * given (Pac-Man), the axis may flip up to PRETURN_DISTANCE_PX before the
   * upcoming center (arcade cornering, spec B).
   */
  protected move(distance: number, ctx: MovementContext, tryPreTurn?: () => Direction | null): void {
    if (distance <= 0) return;
    let remaining = distance;
    let guard = 8; // speed is ≤ ~2px/f, so ≥3 centers/frame never happens

    while (remaining > EPS && guard-- > 0) {
      const d = this.deltaToCenter();
      if (d === 0) {
        const dirBefore = this.dir;
        if (!ctx.onCenter(this)) {
          this.stopped = true;
          return;
        }
        if (this.dir === dirBefore) {
          // steering allowed straight travel: spend the rest of the distance
          this.advance(remaining);
          remaining = 0;
        }
        continue;
      }

      const abs = Math.abs(d);
      if (remaining < abs) {
        if (tryPreTurn && abs <= PRETURN_DISTANCE_PX) {
          const want = tryPreTurn();
          if (want !== null && want !== this.dir && this.canTurnAtCenterAhead(want, ctx.ghost)) {
            this.advance(abs); // finish to the center exactly, then cut the corner
            remaining -= abs;
            this.turnTo(want);
            continue;
          }
        }
        this.advance(remaining);
        remaining = 0;
      } else {
        this.advance(abs); // advance() applies the direction sign itself
        remaining -= abs;
      }
    }
    this.wrapTunnel();
  }

  protected canTurnAtCenterAhead(dir: Direction, ghost: boolean): boolean {
    const { col, row } = this.centerAheadTile();
    return this.tileMap.exitsFrom(col, row, ghost).includes(dir);
  }

  protected advance(px: number): void {
    const v = DIR_VECTORS[this.dir];
    this.x += v.x * px;
    this.y += v.y * px;
  }
}
