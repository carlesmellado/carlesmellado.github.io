/**
 * TileMap — parses the maze into a queryable 28x36 grid.
 * Responsibilities: terrain queries, pellet state, intersection detection,
 * no-up-turn zones, tunnel helpers and coordinate math (px <-> tile).
 * Movement/steering lives in the entity layer; this class is pure data + queries.
 */

import {
  GRID_COLS,
  GRID_ROWS,
  TILE_SIZE,
  MAZE_LAYOUT,
  TUNNEL_ROW,
  NO_UP_TURN_TILES,
  ALL_DIRECTIONS,
  Direction,
  DIR_VECTORS,
} from '../constants/index.js';

export enum TileType {
  /** Empty walkable path (no pellet). */
  EMPTY,
  WALL,
  DOT,
  ENERGIZER,
  /** Ghost house door: ghosts pass, Pac-Man blocked. */
  DOOR,
  /** Ghost house interior: ghosts pass, Pac-Man blocked. */
  HOUSE,
  /** Side warp tunnel corridor (walkable by everyone, wraps). */
  TUNNEL,
  /** HUD band / non-playfield black area. Blocks everything. */
  OUT_OF_BOUNDS,
}

const CHAR_TO_TILE: Record<string, TileType> = {
  '#': TileType.WALL,
  '.': TileType.DOT,
  'o': TileType.ENERGIZER,
  ' ': TileType.EMPTY,
  '=': TileType.DOOR,
  'H': TileType.HOUSE,
  'T': TileType.TUNNEL,
};

export interface TilePos {
  col: number;
  row: number;
}

export class TileMap {
  private readonly tiles: TileType[][] = [];
  /** Pellets still uneaten (dots + energizers). Drives Elroy & fruit timers. */
  private pelletsRemaining = 0;

  constructor(layout: readonly string[] = MAZE_LAYOUT) {
    for (let row = 0; row < GRID_ROWS; row++) {
      const line = layout[row] ?? '';
      const rowTiles: TileType[] = [];
      for (let col = 0; col < GRID_COLS; col++) {
        const ch = line[col] ?? ' ';
        const tile = CHAR_TO_TILE[ch] ?? TileType.OUT_OF_BOUNDS;
        rowTiles.push(tile);
        if (tile === TileType.DOT || tile === TileType.ENERGIZER) this.pelletsRemaining++;
      }
      this.tiles.push(rowTiles);
    }
  }

  // ─── Coordinate helpers ───────────────────────────────────────────────────

  tileAt(col: number, row: number): TileType {
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return TileType.OUT_OF_BOUNDS;
    return this.tiles[row][col];
  }

  /** Tile containing a pixel position (floors; negative-safe). */
  tileOfPx(x: number, y: number): TilePos {
    return { col: Math.floor(x / TILE_SIZE), row: Math.floor(y / TILE_SIZE) };
  }

  /** Pixel center of a tile. */
  centerOf(col: number, row: number): { x: number; y: number } {
    return { x: col * TILE_SIZE + TILE_SIZE / 2, y: row * TILE_SIZE + TILE_SIZE / 2 };
  }

  // ─── Terrain queries ──────────────────────────────────────────────────────

  isTunnelRow(row: number): boolean {
    return row === TUNNEL_ROW;
  }

  isTunnelTile(col: number, row: number): boolean {
    return this.tileAt(col, row) === TileType.TUNNEL;
  }

  /** Walkable by Pac-Man? (walls, OOB, door and house interior block him) */
  isWalkableByPacman(col: number, row: number): boolean {
    const t = this.tileAt(col, row);
    return (
      t === TileType.EMPTY ||
      t === TileType.DOT ||
      t === TileType.ENERGIZER ||
      t === TileType.TUNNEL
    );
  }

  /** Walkable by ghosts? (everything except walls, OOB and HUD) */
  isWalkableByGhost(col: number, row: number): boolean {
    const t = this.tileAt(col, row);
    return t !== TileType.WALL && t !== TileType.OUT_OF_BOUNDS;
  }

  /**
   * Pac-Man eats a pellet at tile; returns what was removed (or null).
   * Tile becomes EMPTY path afterwards.
   */
  eatPellet(col: number, row: number): 'dot' | 'energizer' | null {
    const t = this.tileAt(col, row);
    if (t !== TileType.DOT && t !== TileType.ENERGIZER) return null;
    this.tiles[row][col] = TileType.EMPTY;
    this.pelletsRemaining--;
    return t === TileType.DOT ? 'dot' : 'energizer';
  }

  get pelletsRemainingCount(): number {
    return this.pelletsRemaining;
  }

  pelletAt(col: number, row: number): 'dot' | 'energizer' | null {
    const t = this.tileAt(col, row);
    if (t === TileType.DOT) return 'dot';
    if (t === TileType.ENERGIZER) return 'energizer';
    return null;
  }

  // ─── Intersection & steering queries ──────────────────────────────────────

  /** Walkable neighbors (direction -> neighbor tile), for the given mover. */
  exitsFrom(
    col: number,
    row: number,
    ghost: boolean,
  ): Direction[] {
    const walk = ghost ? this.isWalkableByGhost.bind(this) : this.isWalkableByPacman.bind(this);
    const exits: Direction[] = [];
    for (const dir of ALL_DIRECTIONS) {
      const v = DIR_VECTORS[dir];
      const nc = col + v.x;
      const nr = row + v.y;
      // Off-grid horizontally on the tunnel row: only Pac-Man wraps through
      // the side tunnels; ghosts stop dead at the tunnel mouth (arcade rule).
      if (nc < 0 || nc >= GRID_COLS) {
        if (!ghost && v.y === 0 && this.isTunnelRow(row)) exits.push(dir);
        continue;
      }
      if (walk(nc, nr)) exits.push(dir);
    }
    return exits;
  }

  /** A tile is an intersection when it offers more than two exits. */
  isIntersection(col: number, row: number, ghost = true): boolean {
    return this.exitsFrom(col, row, ghost).length > 2;
  }

  /** Spec D: ghosts may not reverse-direction turn UP on the two bait tiles. */
  isNoUpTurnTile(col: number, row: number): boolean {
    return NO_UP_TURN_TILES.some((t) => t.col === col && t.row === row);
  }

  /** Distance in tiles between two grid positions (Euclidean, spec C/D). */
  static euclidean(a: TilePos, b: TilePos): number {
    const dx = a.col - b.col;
    const dy = a.row - b.row;
    return Math.sqrt(dx * dx + dy * dy);
  }
}
