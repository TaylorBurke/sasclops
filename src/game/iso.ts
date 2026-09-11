export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;
export const GRID_WIDTH = 16;
export const GRID_HEIGHT = 12;

// Shift the projected grid so every tile lands at a positive world coordinate.
const ORIGIN_X = ((GRID_HEIGHT - 1) * TILE_WIDTH) / 2;
const ORIGIN_Y = TILE_HEIGHT;

export function tileToWorld(gridX: number, gridY: number) {
  return {
    x: ORIGIN_X + ((gridX - gridY) * TILE_WIDTH) / 2,
    y: ORIGIN_Y + ((gridX + gridY) * TILE_HEIGHT) / 2,
  };
}

export const WORLD_WIDTH = (GRID_WIDTH - 1 + GRID_HEIGHT - 1) * (TILE_WIDTH / 2) + TILE_WIDTH;
export const WORLD_HEIGHT = (GRID_WIDTH - 1 + GRID_HEIGHT - 1) * (TILE_HEIGHT / 2) + TILE_HEIGHT * 3;
