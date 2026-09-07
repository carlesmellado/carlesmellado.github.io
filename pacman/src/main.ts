/**
 * Entry point and wiring (spec: /src/main.ts). Boots canvas, scaling,
 * input, audio, game and the fixed-timestep loop.
 */

import { CANVAS_WIDTH, CANVAS_HEIGHT } from './constants/index.js';
import { TileMap } from './grid/tilemap.js';
import { InputBuffer } from './core/input.js';
import { GameLoop } from './core/gameLoop.js';
import { Game } from './core/game.js';
import { Autopilot, AutoStrategy } from './core/autopilot.js';
import { Renderer } from './rendering/renderer.js';
import { AudioManager } from './audio/audioManager.js';

function main(): void {
  const canvas = document.getElementById('game') as HTMLCanvasElement | null;
  if (!canvas) throw new Error('#game canvas not found');

  // Integer-size scaling with letterboxing on black (spec A).
  const fit = () => {
    const scale = Math.max(
      1,
      Math.min(
        Math.floor(window.innerWidth / CANVAS_WIDTH),
        Math.floor(window.innerHeight / CANVAS_HEIGHT),
      ),
    );
    canvas.style.width = `${CANVAS_WIDTH * scale}px`;
    canvas.style.height = `${CANVAS_HEIGHT * scale}px`;
  };
  window.addEventListener('resize', fit);
  fit();

  const input = new InputBuffer();
  input.attach();

  const audio = new AudioManager();
  input.onAnyKey = () => audio.unlock();

  const game = new Game(new TileMap(), input, audio);
  const renderer = new Renderer(canvas);
  // Debug handle: inspect live state from devtools (window.game.state, .pacman, .ghosts).
  (window as unknown as { game: Game }).game = game;

  // Demo autopilot: B cycles off → AUTO 1 (simple) → AUTO 2 (smart) → off.
  const autopilot = new Autopilot();
  let autoStrategy: '' | AutoStrategy = '';
  input.onToggleAuto = () => {
    autoStrategy =
      autoStrategy === '' ? 'simple' : autoStrategy === 'simple' ? 'smart' : '';
  };

  const loop = new GameLoop(
    () => {
      if (autoStrategy) {
        if (game.state === 'OVER') input.onStart?.(); // eternal demo
        autopilot.step(game.map, game.pacman, game.ghosts, autoStrategy);
      }
      game.update();
    },
    () => {
      const state = game.renderState();
      state.auto = autoStrategy === 'simple' ? 'AUTO 1' : autoStrategy === 'smart' ? 'AUTO 2' : '';
      renderer.draw(game.map, game.pacman, game.ghosts, state, game.frame);
    },
  );
  loop.start();
}

window.addEventListener('DOMContentLoaded', main);
