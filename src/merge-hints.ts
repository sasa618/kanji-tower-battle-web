import { recipeFor } from './data';
import { STAGE_Y, STAGE_THICKNESS, type Game, type Tile } from './physics';

/** Existing pieces that can combine with the currently selected candidate. */
export function mergeHintTargets(game: Game): Tile[] {
  if (game.mode !== 'playing' || !game.ready) return [];
  const selected = game.candidates[game.selected];
  if (!selected) return [];
  return game.tiles.filter(tile => tile.body.isActive()
    && tile.body.getWorldCenter().y * 100 <= STAGE_Y + STAGE_THICKNESS
    && !!recipeFor(selected, tile.char));
}
