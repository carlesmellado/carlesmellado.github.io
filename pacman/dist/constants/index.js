/**
 * Central game constants — faithful to spec.md (1980 Pac-Man arcade replica).
 * All coordinates are in grid units unless noted "px". One grid unit = 8 px.
 */
// ─── Display & Grid ─────────────────────────────────────────────────────────
export const TILE_SIZE = 8;
export const GRID_COLS = 28;
export const GRID_ROWS = 36; // 3 top HUD rows + 31 playfield rows + 2 bottom HUD rows
export const PLAYFIELD_TOP = 3; // playfield row 0 == grid row 3
export const CANVAS_WIDTH = GRID_COLS * TILE_SIZE; // 224
export const CANVAS_HEIGHT = GRID_ROWS * TILE_SIZE; // 288
export const FPS = 60;
export const FRAME_MS = 1000 / FPS;
// ─── Original Palette (exact RGB values from spec) ─────────────────────────
export const PALETTE = {
    maze: '#2121ff',
    pacman: '#ffff00',
    blinky: '#ff0000',
    pinky: '#ffb8ff',
    inky: '#00ffff',
    clyde: '#ffb852',
    dot: '#ffb8ae',
    frightened: '#2121ff',
    frightenedFlash: '#ffffff',
    eyes: '#ffffff',
    door: '#ffb8de',
    background: '#000000',
    hudText: '#ffffff',
    scoreFruit: '#ffb852',
};
// ─── Directions ─────────────────────────────────────────────────────────────
/** Numeric order encodes the ghost intersection tie-breaker: UP > LEFT > DOWN > RIGHT. */
export var Direction;
(function (Direction) {
    Direction[Direction["UP"] = 0] = "UP";
    Direction[Direction["LEFT"] = 1] = "LEFT";
    Direction[Direction["DOWN"] = 2] = "DOWN";
    Direction[Direction["RIGHT"] = 3] = "RIGHT";
})(Direction || (Direction = {}));
export const DIR_VECTORS = {
    [Direction.UP]: { x: 0, y: -1 },
    [Direction.LEFT]: { x: -1, y: 0 },
    [Direction.DOWN]: { x: 0, y: 1 },
    [Direction.RIGHT]: { x: 1, y: 0 },
};
export const ALL_DIRECTIONS = [
    Direction.UP,
    Direction.LEFT,
    Direction.DOWN,
    Direction.RIGHT,
];
/** Tie-breaker priority order used by ghost intersection logic. */
export const DIRECTION_PRIORITY = ALL_DIRECTIONS;
// ─── Maze Layout ────────────────────────────────────────────────────────────
// Legend:
//   '#' wall | '.' dot | 'o' energizer | ' ' empty path
//   '=' ghost house door (ghost-passable, blocks Pac-Man)
//   'H' ghost house interior (ghost-passable, blocks Pac-Man)
//   'T' side warp tunnel corridor (wraps horizontally, no pellets)
// Rows 0-2 and 34-35 are HUD bands (black); playfield occupies rows 3..33.
export const MAZE_LAYOUT = [
    '                            ', //  0 HUD
    '                            ', //  1 HUD
    '                            ', //  2 HUD
    '############################', //  3
    '#............##............#', //  4
    '#.####.#####.##.#####.####.#', //  5
    '#o####.#####.##.#####.####o#', //  6
    '#.####.#####.##.#####.####.#', //  7
    '#..........................#', //  8
    '#.####.##.########.##.####.#', //  9
    '#.####.##.########.##.####.#', // 10
    '#......##....##....##......#', // 11
    '######.#####.##.#####.######', // 12
    '######.#####.##.#####.######', // 13
    '######.##          ##.######', // 14
    '######.######==######.######', // 15 ghost house door (cols 13-14)
    '######.#####HHHH#####.######', // 16
    'TTTTTTTTTTT#HHHH#TTTTTTTTTTT', // 17 side warp tunnel row
    '######.#####HHHH#####.######', // 18
    '######.##############.######', // 19
    '######.##############.######', // 20
    '######.##############.######', // 21
    '#............##............#', // 22
    '#.####.#####.##.#####.####.#', // 23
    '#.####.#####.##.#####.####.#', // 24
    '#o..##.......##.......##..o#', // 25
    '###.##.##.########.##.##.###', // 26
    '###.##.##.########.##.##.###', // 27
    '#......##....  ....##......#', // 28 Pac-Man spawn niche (cols 13-14 empty)
    '#.##########.##.##########.#', // 29
    '#.##########.##.##########.#', // 30
    '#..........................#', // 31
    '############################', // 32
    '                            ', // 33 HUD
    '                            ', // 34 HUD
    '                            ', // 35 HUD (lives row)
];
export const TUNNEL_ROW = 17; // grid row where x wraps between col 0 and col 27
/**
 * Intersections directly above the ghost house where ghosts must NOT turn UP
 * (spec section D). Grid coords (cols 12/15, row 11 of playfield = grid row 14).
 */
export const NO_UP_TURN_TILES = [
    { col: 12, row: PLAYFIELD_TOP + 11 },
    { col: 15, row: PLAYFIELD_TOP + 11 },
];
/** Tile just outside the door where Blinky waits (grid row 14, col 13 center). */
export const BLINKY_HOLDER_TILE = { col: 13, row: PLAYFIELD_TOP + 11 };
/** Door tile ghosts pass through to enter/exit the house (grid row 15). */
export const GHOST_DOOR_TILE = { col: 13, row: PLAYFIELD_TOP + 12 };
/** Ghost house interior center (bounce lane for caged ghosts). */
export const HOUSE_CENTER_PX = {
    x: 13 * TILE_SIZE + TILE_SIZE / 2, // col 13 center
    y: 17 * TILE_SIZE + TILE_SIZE / 2, // tunnel row inside the house band
};
/** Vertical bounce limits while waiting inside the house. */
export const HOUSE_BOUNCE_PX = { minY: 16 * TILE_SIZE + TILE_SIZE / 2, maxY: 18 * TILE_SIZE + TILE_SIZE / 2 };
/** Pac-Man start: grid (13, 28), facing LEFT (classic start row below center). */
export const PACMAN_START_PX = {
    x: 13 * TILE_SIZE + TILE_SIZE / 2,
    y: 28 * TILE_SIZE + TILE_SIZE / 2,
};
export const PACMAN_START_DIR = Direction.LEFT;
/** Fruit appears on Pac-Man's spawn tile (center-bottom, always reachable). */
export const FRUIT_SPAWN_PX = { ...PACMAN_START_PX };
/** Spawn px for the four ghosts (Pinky/Inky/Clyde start caged). */
export const GHOST_SPAWNS_PX = {
    blinky: { x: 13 * TILE_SIZE + TILE_SIZE / 2, y: 14 * TILE_SIZE + TILE_SIZE / 2 },
    pinky: { x: 13 * TILE_SIZE + TILE_SIZE / 2, y: 17 * TILE_SIZE + TILE_SIZE / 2 },
    inky: { x: 12 * TILE_SIZE + TILE_SIZE / 2, y: 17 * TILE_SIZE + TILE_SIZE / 2 },
    clyde: { x: 15 * TILE_SIZE + TILE_SIZE / 2, y: 17 * TILE_SIZE + TILE_SIZE / 2 },
};
/** Scatter-target corners per ghost (grid tiles; spec C4 bottom-left for Clyde). */
export const SCATTER_TARGETS = {
    blinky: { col: 26, row: 3 },
    pinky: { col: 1, row: 3 },
    inky: { col: 26, row: 32 },
    clyde: { col: 1, row: 32 },
};
/** Columns (inclusive) where ghosts take the 50% tunnel slow-down. */
export const TUNNEL_SLOW_COLS = { leftMax: 5, rightMin: 22 };
/** Wrap margin: an entity fully off-screen reappears on the other side. */
export const TUNNEL_WRAP_MARGIN = TILE_SIZE;
// ─── Speed Curves (spec B: 100% = 75.75 px/s) ───────────────────────────────
export const BASE_SPEED_PX_PER_SEC = 75.75;
const pxPerFrame = (pct) => (BASE_SPEED_PX_PER_SEC * pct) / FPS;
export const SPEEDS = {
    /** Pac-Man full speed (100%). */
    pacmanNormal: pxPerFrame(1.0),
    /** Pac-Man slow-down while eating dots (-1 frame delay per dot ≈ -7%). */
    pacmanEating: pxPerFrame(0.93),
    /** Pac-Man speed while ghosts are frightened (~80%). */
    pacmanFrightened: pxPerFrame(0.8),
    /** Ghost speed in open maze (95% of Pac-Man normal). */
    ghostNormal: pxPerFrame(0.95),
    /** Elroy 1: Blinky speed-up at 20 dots remaining. */
    ghostElroy1: pxPerFrame(1.0),
    /** Elroy 2: Blinky speed-up at 10 dots remaining. */
    ghostElroy2: pxPerFrame(1.05),
    /** Ghost speed inside side warp tunnels (50% limit, spec B/E). */
    ghostTunnel: pxPerFrame(0.5),
    /** Frightened ghost speed (~50%). */
    ghostFrightened: pxPerFrame(0.52),
    /** Eyes returning to the house. */
    ghostEyes: pxPerFrame(1.5),
    /** Pac-Man speed while dying sequence (frozen-ish crawl). */
    pacmanDying: pxPerFrame(0.0),
};
export const ELROY_THRESHOLDS = { elroy1: 20, elroy2: 10 };
/** Which SPEEDS keys back each Elroy tier (kept explicit so ghost AI is typed). */
export const ELROY_SPEED_KEYS = { elroy1: 'ghostElroy1', elroy2: 'ghostElroy2' };
/** Pixels before a tile center within which Pac-Man may pre-turn (spec B). */
export const PRETURN_DISTANCE_PX = 4;
const SEC = FPS;
/** Wave 1 schedule: 7s scatter, 20s chase, 7s, 20s, 5s, 20s, 5s, chase forever. */
export const WAVE_SCHEDULE = [
    { mode: 'SCATTER', frames: 7 * SEC },
    { mode: 'CHASE', frames: 20 * SEC },
    { mode: 'SCATTER', frames: 7 * SEC },
    { mode: 'CHASE', frames: 20 * SEC },
    { mode: 'SCATTER', frames: 5 * SEC },
    { mode: 'CHASE', frames: 20 * SEC },
    { mode: 'SCATTER', frames: 5 * SEC },
    { mode: 'CHASE', frames: Infinity },
];
/** Frightened duration by level (index = level-1, clamped). Last ≈2s flash. */
export const FRIGHTENED_FRAMES_BY_LEVEL = [
    6 * SEC, 5 * SEC, 4 * SEC, 3 * SEC, 2 * SEC, 5 * SEC, 2 * SEC, 2 * SEC,
    1 * SEC, 5 * SEC, 2 * SEC, 1 * SEC, 1 * SEC, 3 * SEC, 1 * SEC, 1 * SEC,
];
export const FRIGHTENED_FLASH_FRAMES = 2 * SEC;
export const FRIGHTENED_FLASH_PERIOD = 14; // blink every ~14 frames
// ─── Scoring (spec E) ───────────────────────────────────────────────────────
export const SCORING = {
    dot: 10,
    energizer: 50,
    ghostCascade: [200, 400, 800, 1600],
    extraLifeAt: 10_000,
};
// ─── Fruit / Bonus (spec E) ─────────────────────────────────────────────────
export const FRUIT = {
    /** Spawns after this many dots eaten... */
    spawnAfterDots: [70, 170],
    /** ...and disappears after ~9.5 s. */
    lifetimeFrames: Math.round(9.5 * SEC),
    /** Point values by level (index = level-1, clamped). */
    pointsByLevel: [100, 300, 500, 700, 1000, 2000, 3000, 5000],
};
// ─── Misc Timings ───────────────────────────────────────────────────────────
export const READY_FRAMES = 3 * SEC;
export const LEVEL_CLEAR_FRAMES = 3 * SEC;
/** On/off period of the arcade maze flash during level clear. */
export const MAZE_FLASH_FRAMES = 20;
export const DEATH_ANIM_FRAMES = 4 * SEC;
export const POPUP_FRAMES = 60; // floating score popups last 1 s
export const PAUSE_AFTER_LEVEL_CLEAR_FRAMES = 1 * SEC;
export const GHOST_RELEASE_FRAMES = [0, 3 * SEC, 6 * SEC, 9 * SEC];
export const GHOST_ORDER = ['blinky', 'pinky', 'inky', 'clyde'];
