# TASK: Spec-Driven Development (SDD) — 100% Faithful Pac-Man Arcade Engine (1980)

Act as a Principal Game Systems Engineer and Specification-Driven Development agent. 
Your objective is to generate the technical specification (`spec.md`), system architecture, and production-grade implementation of an exact, cycle-accurate replica of the original 1980 Namco Pac-Man arcade game running in modern web environments (HTML5 Canvas / TypeScript or ES2022).

---

## 1. SDD EXECUTION PROTOCOL

Do NOT implement the code in a single generic file. Follow the SDD workflow strictly:
1. **Phase 1 (Spec & Architecture):** Generate a exhaustive specification covering exact grid coordinate math, timing cycles, state machines, and ghost AI vector formulas.
2. **Phase 2 (Contract & State Design):** Define all interfaces, types, constants, and deterministic state transitions.
3. **Phase 3 (Modular Implementation):** Implement independent, loosely coupled modules for Renderer, Audio (Web Audio API synthesis), Input Buffer, Map Grid, Entity Engine, and Ghost AI controllers.

---

## 2. STRICT ARCADE REQUIREMENTS (100% FAITHFUL REPRODUCTION)

### A. Display & Resolution
- **Native Resolution:** 224 x 288 pixels (28 columns x 36 rows of 8x8 px tiles).
- **Scale:** Maintain an integer aspect ratio or responsive CSS scaling using `image-rendering: pixelated` with letterboxing/black bars.
- **Palette:** Exact original RGB values for Maze borders (Blue #2121ff), Pac-Man (#ffff00), Blinky (#ff0000), Pinky (#ffb8ff), Inky (#00ffff), Clyde (#ffb852), Dots/Pellets (#ffb8ae), and Energizers.

### B. Grid, Sub-pixel Movement & Speed Curves
- Movement must operate with sub-pixel floating/fixed-point accumulator math, aligned to an 8x8 tile grid.
- **Speeds by Level:** Implement original speed charts (percentages based on standard 100% = 75.75 pixels/second):
  - Normal Pac-Man speed vs. Eating Dots speed reduction (-1 frame delay per dot).
  - Normal Ghost speed vs. Ghost in Tunnel speed reduction (50% speed limit in side warp tunnels).
  - Frightened Ghost speed and Pac-Man Frightened speed.
- **Cornering / Pre-turning Mechanic:** Pac-Man can turn up to 3-4 pixels before reaching the tile center to allow smooth, snappy arcade cornering.

### C. Ghost AI Subsystems (Non-negotiable Determinism)
Each ghost must feature its exact mathematical target tile algorithm:
1. **Blinky (Shadow / Red):**
   - *Target Tile:* Current Pac-Man tile.
   - *Cruise Elroy:* Speed increases at thresholds of 20 and 10 remaining dots (Elroy 1 and 2).
2. **Pinky (Speedy / Pink):**
   - *Target Tile:* 4 tiles ahead of Pac-Man's current facing direction.
   - *Original Direction Bug:* When Pac-Man faces UP, Pinky's target must calculate 4 tiles up AND 4 tiles left (reproducing the original 16-bit overflow offset).
3. **Inky (Bashful / Cyan):**
   - *Target Tile:* Take the tile 2 spaces ahead of Pac-Man (reproduce the UP bug: 2 up + 2 left). Draw a vector from Blinky's current tile to that offset tile. Double that vector's length to find Inky's target.
4. **Clyde (Pokey / Orange):**
   - *Target Tile:* If Euclidean distance to Pac-Man >= 8 tiles: target Pac-Man's tile. If distance < 8 tiles: retreat to his home scatter corner (bottom-left).

### D. Global Wave Timers & Modes
- **Scatter / Chase Timer Engine:** Maintain the exact frame-accurate timer schedule:
  - Wave 1: 7s Scatter -> 20s Chase -> 7s Scatter -> 20s Chase -> 5s Scatter -> 20s Chase -> 5s Scatter -> Chase permanently.
- **Direction Inversion:** Force all ghosts to reverse direction immediately when transitioning between Scatter, Chase, and Frightened modes.
- **Intersection Decision Logic:** At an intersection tile, evaluate available exits (excluding an immediate 180° reverse, unless forced by mode switch). Select the neighbor tile whose straight-line Euclidean distance to the Target Tile is minimal. Tie-breaker priority order: UP > LEFT > DOWN > RIGHT.
- **Special Forbidden Zones:** Ghosts cannot turn UP at the two specific intersections directly above the ghost house (tiles (12, 11) and (15, 11)).

### E. Game Rules & Mechanics
- **Side Warp Tunnels:** Wrap around horizontally from column 0 to column 27.
- **Energizers & Frightened Mode:**
  - Blue ghosts, pseudo-random turn generation at intersections.
  - Flashing phase before expiring.
  - Ghost score cascade: 200 -> 400 -> 800 -> 1600 points.
  - Eaten ghosts become eyes and pathfind directly to the ghost house door tile.
- **Fruit / Bonus Items:** Spawns after 70 dots, then after 170 dots. Disappears after ~9-10 seconds.
- **Original Audio Synthesis:** Synthesize siren loops, waka-waka dot eating, energizer loop, and death sound using the Web Audio API (custom oscillators/noise nodes) without relying on external `.mp3` assets.

---

## 3. PROJECT OUTPUT STRUCTURE

Organize the generated codebase as follows:
/src
├── /audio        # Web Audio API synthesizers for original SFX/Siren
├── /constants    # Speeds, Timers, Palette, Level data matrices
├── /core         # Game loop (delta-time accumulator), State Machine
├── /entities     # Pacman, Ghost (Blinky, Pinky, Inky, Clyde)
├── /grid         # Tilemap, Collision detection, Warp Tunnels, Intersections
├── /rendering    # 224x288 Canvas renderer, Sprite animator, UI overlays
└── main.ts       # Entry point and wiring