/**
 * 224x288 canvas renderer (spec A): pixel-perfect tile maze, procedural
 * Pac-Man / ghost sprites, energizer blink, HUD (score/1UP/high score),
 * lives, READY!/GAME OVER overlays and score popups.
 */
import { CANVAS_WIDTH, CANVAS_HEIGHT, TILE_SIZE, GRID_COLS, GRID_ROWS, PALETTE, Direction, FRIGHTENED_FLASH_PERIOD, READY_FRAMES, } from '../constants/index.js';
import { TileType } from '../grid/tilemap.js';
const GHOST_COLORS = {
    blinky: PALETTE.blinky,
    pinky: PALETTE.pinky,
    inky: PALETTE.inky,
    clyde: PALETTE.clyde,
};
export class Renderer {
    canvas;
    ctx;
    constructor(canvas) {
        this.canvas = canvas;
        const ctx = canvas.getContext('2d');
        if (!ctx)
            throw new Error('2D canvas unavailable');
        this.ctx = ctx;
        this.ctx.imageSmoothingEnabled = false;
    }
    draw(map, pacman, ghosts, state, frame) {
        const c = this.ctx;
        c.fillStyle = PALETTE.background;
        c.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        this.drawMaze(map, frame, state.mazeFlash);
        if (state.fruitVisible)
            this.drawFruit(state.fruitX, state.fruitY);
        for (const p of state.popups)
            this.drawPopup(p);
        if (!pacman.dying)
            this.drawPacman(pacman);
        else
            this.drawDeath(pacman);
        for (const name of Object.keys(ghosts)) {
            this.drawGhost(ghosts[name], state, frame);
        }
        this.drawHud(state);
        if (state.overlay)
            this.drawOverlay(state);
    }
    // ─── Maze ─────────────────────────────────────────────────────────────────
    drawMaze(map, frame, flash = false) {
        const c = this.ctx;
        const wallColor = flash ? '#ffffff' : PALETTE.maze;
        const dotColor = flash ? '#ffffff' : PALETTE.dot;
        for (let row = 0; row < GRID_ROWS; row++) {
            for (let col = 0; col < GRID_COLS; col++) {
                const t = map.tileAt(col, row);
                const x = col * TILE_SIZE;
                const y = row * TILE_SIZE;
                if (t === TileType.WALL) {
                    // Blue 2px border lines on edges adjacent to non-wall tiles.
                    c.strokeStyle = wallColor;
                    c.lineWidth = 2;
                    c.beginPath();
                    if (!this.isEdge(map, col, row - 1)) {
                        c.moveTo(x + 1, y + 1);
                        c.lineTo(x + TILE_SIZE - 1, y + 1);
                    }
                    if (!this.isEdge(map, col, row + 1)) {
                        c.moveTo(x + 1, y + TILE_SIZE - 1);
                        c.lineTo(x + TILE_SIZE - 1, y + TILE_SIZE - 1);
                    }
                    if (!this.isEdge(map, col - 1, row)) {
                        c.moveTo(x + 1, y + 1);
                        c.lineTo(x + 1, y + TILE_SIZE - 1);
                    }
                    if (!this.isEdge(map, col + 1, row)) {
                        c.moveTo(x + TILE_SIZE - 1, y + 1);
                        c.lineTo(x + TILE_SIZE - 1, y + TILE_SIZE - 1);
                    }
                    c.stroke();
                }
                else if (t === TileType.DOT) {
                    c.fillStyle = dotColor;
                    c.fillRect(x + 3, y + 3, 2, 2);
                }
                else if (t === TileType.ENERGIZER) {
                    if (Math.floor(frame / 16) % 2 === 0) {
                        c.fillStyle = dotColor;
                        c.fillRect(x + 1, y + 1, 6, 6);
                    }
                }
                else if (t === TileType.DOOR) {
                    c.fillStyle = PALETTE.door;
                    c.fillRect(x, y + 3, TILE_SIZE, 2);
                }
            }
        }
    }
    /** Neighbor used for wall-border suppression: walls/OOB connect, paths don't. */
    isEdge(map, col, row) {
        const t = map.tileAt(col, row);
        return t === TileType.WALL || t === TileType.OUT_OF_BOUNDS;
    }
    // ─── Sprites ──────────────────────────────────────────────────────────────
    drawPacman(p) {
        const c = this.ctx;
        const phases = [0.28, 0.12, 0]; // open, mid, closed (fraction of PI)
        const mouth = phases[Math.floor(p.mouthPhase / 4) % 3] * Math.PI;
        // RIGHT→0°, DOWN→90°, LEFT→180°, UP→270° (enum order is UP,LEFT,DOWN,RIGHT)
        const rot = (Direction.RIGHT - p.dir) * (Math.PI / 2);
        c.save();
        c.translate(p.x, p.y);
        c.rotate(rot);
        c.fillStyle = PALETTE.pacman;
        c.beginPath();
        c.moveTo(0, 0);
        c.arc(0, 0, 7, mouth, Math.PI * 2 - mouth);
        c.closePath();
        c.fill();
        c.restore();
    }
    drawDeath(p) {
        const c = this.ctx;
        const t = Math.min(1, p.dyingFrames / 120); // mouth opens to full over 2s
        c.save();
        c.translate(p.x, p.y);
        c.strokeStyle = PALETTE.pacman;
        c.lineWidth = 2;
        c.beginPath();
        c.arc(0, 0, 7, -Math.PI / 2 + t * Math.PI, -Math.PI / 2 - t * Math.PI + Math.PI * 2 * (1 - t));
        c.stroke();
        c.restore();
    }
    drawGhost(g, state, frame) {
        const c = this.ctx;
        const flashing = g.frightened &&
            state.frightenedFrames > 0 &&
            state.frightenedFrames <= state.frightenedFlashOut &&
            Math.floor(frame / FRIGHTENED_FLASH_PERIOD) % 2 === 1;
        let body = GHOST_COLORS[g.name];
        if (g.frightened && g.stage !== 'eyes')
            body = flashing ? PALETTE.frightenedFlash : PALETTE.frightened;
        c.save();
        c.translate(g.x, g.y);
        if (g.stage !== 'eyes') {
            // Dome + wavy skirt
            c.fillStyle = body;
            c.beginPath();
            c.arc(0, -1, 7, Math.PI, 0);
            c.lineTo(7, 6);
            const wig = Math.floor(frame / 8) % 2;
            for (let i = 0; i < 3; i++) {
                const x0 = 7 - i * (14 / 3);
                const x1 = x0 - 14 / 6 + (wig === i % 2 ? 0.8 : -0.8);
                c.lineTo(x1, 4);
                c.lineTo(x0 - 14 / 3, 6);
            }
            c.closePath();
            c.fill();
        }
        // Eyes (pupils look in travel direction)
        const v = { x: [0, -1, 0, 1][g.dir], y: [-1, 0, 1, 0][g.dir] };
        for (const ex of [-3, 3]) {
            c.fillStyle = '#ffffff';
            c.beginPath();
            c.ellipse(ex, -2, 2.4, 3, 0, 0, Math.PI * 2);
            c.fill();
            c.fillStyle = flashing ? PALETTE.frightened : '#0000ff';
            c.beginPath();
            c.arc(ex + v.x * 1.2, -2 + v.y * 1.2, 1.3, 0, Math.PI * 2);
            c.fill();
        }
        if (g.frightened && g.stage !== 'eyes') {
            // Simple frightened face
            c.fillStyle = flashing ? PALETTE.maze : PALETTE.dot;
            c.fillRect(-4, -3, 1.6, 1.6);
            c.fillRect(2.4, -3, 1.6, 1.6);
            c.beginPath();
            for (let i = 0; i < 4; i++) {
                c.moveTo(-4 + i * 2.2, 2 - (i % 2) * 1.4);
                c.lineTo(-4 + (i + 1) * 2.2, 2 - ((i + 1) % 2) * 1.4);
            }
            c.strokeStyle = flashing ? PALETTE.maze : PALETTE.dot;
            c.lineWidth = 1;
            c.stroke();
        }
        c.restore();
    }
    drawFruit(x, y) {
        const c = this.ctx;
        c.fillStyle = '#ff0000';
        c.beginPath();
        c.arc(x - 3, y + 1, 3.4, 0, Math.PI * 2);
        c.arc(x + 3, y + 1, 3.4, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = '#00ff00';
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(x, y - 2);
        c.quadraticCurveTo(x + 3, y - 7, x + 6, y - 6);
        c.stroke();
    }
    drawPopup(p) {
        const c = this.ctx;
        c.fillStyle = PALETTE.hudText;
        c.font = '8px monospace';
        c.textAlign = 'center';
        c.fillText(p.text, p.x, p.y - Math.floor((60 - p.frames) / 8));
    }
    // ─── HUD & overlays ───────────────────────────────────────────────────────
    drawHud(state) {
        const c = this.ctx;
        c.font = '8px monospace';
        c.textAlign = 'left';
        c.fillStyle = PALETTE.hudText;
        c.fillText('1UP', 4 * TILE_SIZE, 20);
        c.fillText(String(state.score).padStart(6, '0'), 4 * TILE_SIZE, 28);
        c.textAlign = 'center';
        c.fillText('HIGH SCORE', CANVAS_WIDTH / 2, 20);
        c.fillText(String(state.highScore).padStart(6, '0'), CANVAS_WIDTH / 2, 28);
        if (state.auto) {
            c.textAlign = 'right';
            c.fillStyle = PALETTE.pacman;
            c.fillText(state.auto, CANVAS_WIDTH - 4, 20);
        }
        // Lives (pac icons) bottom-left, level fruit bottom-right.
        for (let i = 0; i < state.lives - 1; i++) {
            const x = 16 + i * 14;
            const y = CANVAS_HEIGHT - 8;
            c.fillStyle = PALETTE.pacman;
            c.beginPath();
            c.moveTo(x, y);
            c.arc(x, y, 5, 0.25 * Math.PI, Math.PI * 2 - 0.25 * Math.PI);
            c.closePath();
            c.fill();
        }
        if (state.level > 0) {
            this.drawFruit(CANVAS_WIDTH - 24, CANVAS_HEIGHT - 9);
            c.fillStyle = PALETTE.hudText;
            c.textAlign = 'right';
            c.fillText(String(state.level), CANVAS_WIDTH - 4, CANVAS_HEIGHT - 6);
        }
    }
    drawOverlay(state) {
        const c = this.ctx;
        const y = 20 * TILE_SIZE + TILE_SIZE / 2;
        // Black backing so text stays readable over maze rows.
        c.fillStyle = PALETTE.background;
        c.fillRect(3 * TILE_SIZE, y - 8, CANVAS_WIDTH - 6 * TILE_SIZE, state.overlaySub ? 24 : 12);
        c.fillStyle = state.overlay === 'GAME OVER' ? PALETTE.blinky : '#ffff00';
        c.font = '8px monospace';
        c.textAlign = 'center';
        c.fillText(state.overlay, CANVAS_WIDTH / 2, y);
        if (state.overlaySub) {
            c.fillStyle = PALETTE.hudText;
            c.fillText(state.overlaySub, CANVAS_WIDTH / 2, y + 12);
        }
    }
    /** READY! hides after READY_FRAMES; helper used by the game overlay logic. */
    static readyVisible(framesLeft) {
        return framesLeft > 0 && framesLeft <= READY_FRAMES;
    }
}
