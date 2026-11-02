import { recipeFor, rarityOf, type Rarity } from './data';
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

export type HintTier = 'normal' | Rarity;
/** The glow color follows what the merge would produce: yellow, ice-silver for rare, rainbow for legend. */
export function mergeHintTier(selected: string, tile: Tile): HintTier {
  const recipe = recipeFor(selected, tile.char);
  return (recipe && rarityOf(recipe.result)) || 'normal';
}
