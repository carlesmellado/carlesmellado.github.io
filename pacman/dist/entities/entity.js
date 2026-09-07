/**
 * Base entity movement engine (spec B): sub-pixel float positions with an
 * axis change allowed ONLY at tile centers, plus Pac-Man's pre-turn window.
 * A tile center sits at col*8+4 / row*8+4.
 */
import { Direction, DIR_VECTORS, TILE_SIZE, CANVAS_WIDTH, TUNNEL_ROW, TUNNEL_WRAP_MARGIN, PRETURN_DISTANCE_PX, } from '../constants/index.js';
const EPS = 0.0001;
export class Entity {
    x = 0;
    y = 0;
    dir = Direction.LEFT;
    /** Speed in px per 60Hz frame. */
    speed = 0;
    stopped = false;
    tileMap;
    constructor(tileMap) {
        this.tileMap = tileMap;
    }
    tile() {
        return this.tileMap.tileOfPx(this.x, this.y);
    }
    isHorizontal() {
        return this.dir === Direction.LEFT || this.dir === Direction.RIGHT;
    }
    /** Signed px to the next tile center along dir; 0 when sitting on one. */
    deltaToCenter() {
        const horizontal = this.isHorizontal();
        const p = horizontal ? this.x : this.y;
        const forward = this.dir === Direction.RIGHT || this.dir === Direction.DOWN ? 1 : -1;
        // Snap when already on a center (kills float drift before it accumulates).
        const mod = (((p - TILE_SIZE / 2) % TILE_SIZE) + TILE_SIZE) % TILE_SIZE;
        if (mod < EPS || mod > TILE_SIZE - EPS) {
            const snapped = Math.round((p - TILE_SIZE / 2) / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
            if (horizontal)
                this.x = snapped;
            else
                this.y = snapped;
            return 0;
        }
        const idx = Math.floor((p - TILE_SIZE / 2) / TILE_SIZE);
        const centers = [idx * TILE_SIZE + TILE_SIZE / 2, (idx + 1) * TILE_SIZE + TILE_SIZE / 2];
        return (forward > 0 ? centers[1] : centers[0]) - p;
    }
    /** Tile whose center we are approaching (valid even mid-tile). */
    centerAheadTile() {
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
    snapAxis(axis) {
        const p = axis === 'x' ? this.x : this.y;
        const snapped = Math.round((p - TILE_SIZE / 2) / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
        if (axis === 'x')
            this.x = snapped;
        else
            this.y = snapped;
    }
    turnTo(dir) {
        this.dir = dir;
        // The perpendicular axis becomes the lane; the moving axis keeps its px.
        this.snapAxis(this.isHorizontal() ? 'y' : 'x');
    }
    wrapTunnel() {
        if (!this.isHorizontal())
            return;
        const { row } = this.tileMap.tileOfPx(this.x, this.y);
        if (row !== TUNNEL_ROW)
            return;
        const m = TUNNEL_WRAP_MARGIN;
        const span = CANVAS_WIDTH + m * 2;
        if (this.x < -m)
            this.x += span;
        else if (this.x > CANVAS_WIDTH + m)
            this.x -= span;
    }
    canTurnTo(dir, ghost) {
        const { col, row } = this.tile();
        return this.tileMap.exitsFrom(col, row, ghost).includes(dir);
    }
    /**
     * Advance `distance` px, honoring center-only turns. When `tryPreTurn` is
     * given (Pac-Man), the axis may flip up to PRETURN_DISTANCE_PX before the
     * upcoming center (arcade cornering, spec B).
     */
    move(distance, ctx, tryPreTurn) {
        if (distance <= 0)
            return;
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
            }
            else {
                this.advance(abs); // advance() applies the direction sign itself
                remaining -= abs;
            }
        }
        this.wrapTunnel();
    }
    canTurnAtCenterAhead(dir, ghost) {
        const { col, row } = this.centerAheadTile();
        return this.tileMap.exitsFrom(col, row, ghost).includes(dir);
    }
    advance(px) {
        const v = DIR_VECTORS[this.dir];
        this.x += v.x * px;
        this.y += v.y * px;
    }
}
