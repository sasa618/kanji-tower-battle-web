import { WORLD_WIDTH, STAGE_Y, STAGE_WIDTH, STAGE_THICKNESS, START_BOTTOM, SPAWN_CLEARANCE, GLYPH_SIZE } from './physics';

export const VIEW_TOP=START_BOTTOM-GLYPH_SIZE-80;
export const FLOOR_MARGIN=12;
export const VIEW_BOTTOM=STAGE_Y+STAGE_THICKNESS+FLOOR_MARGIN;
export const VIEW_HEIGHT=VIEW_BOTTOM-VIEW_TOP;

// Four character cells for the stage, plus half a cell of space on either side.
export const PLAY_VIEW_WIDTH=STAGE_WIDTH+GLYPH_SIZE;
/** Use the available width for larger pieces while keeping the start and floor visible. */
export function canvasViewport(width:number,height:number){
  const scale=Math.min(width/PLAY_VIEW_WIDTH,height/VIEW_HEIGHT);
  const x=(width-WORLD_WIDTH*scale)/2;
  return {scale,x,y:height-VIEW_BOTTOM*scale,left:-x/scale,right:(width-x)/scale};
}
export const cameraTarget=(towerTop:number)=>Math.min(0,towerTop-SPAWN_CLEARANCE-START_BOTTOM);

export function visibleRulerMarks(camera:number){
  const first=Math.max(1,Math.ceil((STAGE_Y-camera-VIEW_BOTTOM)/GLYPH_SIZE));
  // Reserve the top band for the held character and gesture cue.
  const last=Math.max(5,Math.floor((STAGE_Y-camera-START_BOTTOM-18)/GLYPH_SIZE));
  return Array.from({length:Math.max(0,last-first+1)},(_,i)=>first+i);
}
