import { GRID_GAP, GRID_TILE_MIN_WIDTH } from '../theme/theme';

export function grid_layout(width) {
  const columns = Math.max(2, Math.floor(width / GRID_TILE_MIN_WIDTH));
  const tile_size = Math.floor((width - GRID_GAP * (columns + 1)) / columns);

  return { columns, tile_size };
}
