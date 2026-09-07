/**
 * Autopilot (demo mode): a BFS "nearest pellet" Pac-Man player with optional
 * ghost-avoidance. It drives the game exactly like a human — by deciding a
 * desired direction each frame — so every game rule applies unchanged.
 *
 * Strategies:
 *  - simple: always head to the nearest pellet, ignoring ghosts entirely.
 *  - smart:  same search, but tiles a ghost can reach no later than Pac-Man
 *            are avoided; adds an energizer tactic when ghosts are near.
 */
import { Direction, GRID_COLS, GRID_ROWS } from '../constants/index.js';
const AREA = GRID_COLS * GRID_ROWS;
/** BFS expansion order mirrors the arcade tie-breaker UP>LEFT>DOWN>RIGHT. */
const DIRS = [Direction.UP, Direction.LEFT, Direction.DOWN, Direction.RIGHT];
const DX = [0, -1, 0, 1]; // indexed by Direction
const DY = [-1, 0, 1, 0];
const INF = 0x7fff;
/** Manhattan radius where a roaming ghost makes the energizer worth it. */
const ENERGIZER_BAIT_RADIUS = 6;
export class Autopilot {
    /** Distance (tiles) from Pac-Man to each tile. */
    pacDist = new Int16Array(AREA);
    /** First move of the shortest path from Pac-Man (Direction+1, -1 = none). */
    firstMove = new Int8Array(AREA);
    /** Distance from the nearest threatening ghost to each tile. */
    ghostDist = Int16Array.from({ length: AREA }, () => INF);
    /** Tiles a roaming ghost can reach no later than Pac-Man (+1 margin). */
    danger = new Uint8Array(AREA);
    queue = new Int16Array(AREA);
    /** Roaming, non-frightened ghosts for the current frame. */
    threats = [];
    /**
     * Decide and apply Pac-Man's desired direction. Called once per frame
     * before the game update — exactly where a human key press would land.
     */
    step(map, pacman, ghosts, strategy) {
        this.collectThreats(ghosts);
        const start = this.clampToBoard(pacman.tile());
        const si = start.row * GRID_COLS + start.col;
        // Baseline pacDist drives tactics and the danger comparison.
        this.bfs(map, si, (c, r) => map.isWalkableByPacman(c, r), null, this.pacDist, this.firstMove);
        const tactic = strategy === 'smart' ? this.energizerTarget(map, start) : null;
        let dir = this.walkToPellet(map, si, strategy, tactic);
        if (dir === null) {
            // Cornered by danger: take the shortest unsafe path instead of freezing.
            dir = this.walkToPellet(map, si, 'simple', tactic);
        }
        if (dir !== null)
            pacman.desired = dir;
    }
    // ─── Threats & tactics ────────────────────────────────────────────────────
    collectThreats(ghosts) {
        this.threats = Object.values(ghosts).filter((g) => (g.stage === 'out' || g.stage === 'exiting') && !g.frightened);
    }
    /**
     * Smart tactic: head for the nearest energizer instead of a dot when it is
     * not much farther and at least two hungry ghosts are within reach.
     */
    energizerTarget(map, start) {
        let bestDot = INF;
        let bestEnergizer = INF;
        let energizerIdx = null;
        for (let row = 0; row < GRID_ROWS; row++) {
            for (let col = 0; col < GRID_COLS; col++) {
                const pellet = map.pelletAt(col, row);
                if (!pellet)
                    continue;
                const d = this.pacDist[row * GRID_COLS + col];
                if (d >= INF)
                    continue;
                if (pellet === 'dot' && d < bestDot)
                    bestDot = d;
                if (pellet === 'energizer' && d < bestEnergizer) {
                    bestEnergizer = d;
                    energizerIdx = row * GRID_COLS + col;
                }
            }
        }
        if (energizerIdx === null || bestEnergizer > bestDot * 2)
            return null;
        let near = 0;
        for (const g of this.threats) {
            const t = this.clampToBoard(g.tile());
            if (Math.abs(t.col - start.col) + Math.abs(t.row - start.row) <= ENERGIZER_BAIT_RADIUS) {
                near++;
            }
        }
        return near >= 2 ? energizerIdx : null;
    }
    // ─── Search ───────────────────────────────────────────────────────────────
    /** BFS from `start`; fills dist and, when given, firstMove. */
    bfs(map, start, walk, blocked, dist, firstMove) {
        dist.fill(INF);
        if (firstMove)
            firstMove.fill(-1);
        let head = 0;
        let tail = 0;
        dist[start] = 0;
        this.queue[tail++] = start;
        while (head < tail) {
            const cur = this.queue[head++];
            const col = cur % GRID_COLS;
            const row = (cur - col) / GRID_COLS;
            for (const d of DIRS) {
                let nc = col + DX[d];
                const nr = row + DY[d];
                // Tunnel corridor connects the two board edges.
                if (nc < 0)
                    nc = GRID_COLS - 1;
                else if (nc >= GRID_COLS)
                    nc = 0;
                if (nr < 0 || nr >= GRID_ROWS)
                    continue;
                if (!walk(nc, nr))
                    continue;
                const ni = nr * GRID_COLS + nc;
                if (dist[ni] !== INF)
                    continue;
                if (blocked && blocked(nc, nr) && ni !== start)
                    continue;
                dist[ni] = dist[cur] + 1;
                if (firstMove)
                    firstMove[ni] = cur === start ? d + 1 : firstMove[cur];
                this.queue[tail++] = ni;
            }
        }
    }
    /**
     * First step toward the nearest pellet (or `specificTarget`), optionally
     * avoiding danger tiles. Null when unreachable under those constraints.
     */
    walkToPellet(map, start, strategy, specificTarget) {
        let blocked = null;
        if (strategy === 'smart') {
            this.buildDanger(map, start);
            blocked = (col, row) => this.danger[row * GRID_COLS + col] === 1;
        }
        this.bfs(map, start, (c, r) => map.isWalkableByPacman(c, r), blocked, this.pacDist, this.firstMove);
        if (specificTarget !== null) {
            const fm = this.firstMove[specificTarget];
            return fm > 0 ? (fm - 1) : null;
        }
        for (let i = 0; i < AREA; i++) {
            if (this.pacDist[i] >= INF)
                continue;
            const col = i % GRID_COLS;
            const row = (i - col) / GRID_COLS;
            if (!map.pelletAt(col, row))
                continue;
            const fm = this.firstMove[i];
            if (fm > 0)
                return (fm - 1);
        }
        return null;
    }
    /** danger[t]: some roaming ghost reaches t no later than Pac-Man (+1). */
    buildDanger(map, start) {
        this.danger.fill(0);
        const gd = this.ghostDist;
        gd.fill(INF);
        let head = 0;
        let tail = 0;
        for (const g of this.threats) {
            const t = this.clampToBoard(g.tile());
            const i = t.row * GRID_COLS + t.col;
            if (gd[i] === INF) {
                gd[i] = 0;
                this.queue[tail++] = i;
            }
        }
        while (head < tail) {
            const cur = this.queue[head++];
            const col = cur % GRID_COLS;
            const row = (cur - col) / GRID_COLS;
            for (const d of DIRS) {
                let nc = col + DX[d];
                const nr = row + DY[d];
                if (nc < 0)
                    nc = GRID_COLS - 1;
                else if (nc >= GRID_COLS)
                    nc = 0;
                if (nr < 0 || nr >= GRID_ROWS)
                    continue;
                // Ghosts roam through doors and the ghost house.
                if (!map.isWalkableByGhost(nc, nr))
                    continue;
                const ni = nr * GRID_COLS + nc;
                if (gd[ni] !== INF)
                    continue;
                gd[ni] = gd[cur] + 1;
                this.queue[tail++] = ni;
            }
        }
        for (let i = 0; i < AREA; i++) {
            if (i === start)
                continue;
            if (gd[i] !== INF && this.pacDist[i] !== INF && gd[i] <= this.pacDist[i] + 1) {
                this.danger[i] = 1;
            }
        }
    }
    /**
     * Entities drift briefly outside the board while wrapping the tunnel;
     * clamp so BFS starts land on a real tile.
     */
    clampToBoard(t) {
        const col = Math.min(GRID_COLS - 1, Math.max(0, t.col));
        const row = Math.min(GRID_ROWS - 1, Math.max(0, t.row));
        return { col, row };
    }
}
