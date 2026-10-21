const paths={
  merge:'<rect x="3" y="7" width="11" height="11" rx="3"/><rect x="10" y="3" width="11" height="11" rx="3"/>',
  left:'<path d="M19 12H5m6-6-6 6 6 6"/>',
  right:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
  rotate:'<path d="M20 10a8 8 0 1 0-1 7M20 4v6h-6"/>',
  drop:'<path d="M12 3v12m-5-5 5 5 5-5M5 18v3h14v-3"/>',
  share:'<path d="m13.5 3.5 7 6.5-7 6.5V12C8.8 12 5.4 14.1 3 18.5 3.5 11 6.9 7.5 13.5 7.5Z" fill="currentColor" stroke-width="1.4"/>',
  download:'<path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" stroke-width="2"/><path d="M12 3v12m-4-4 4 4 4-4" stroke-width="2.6"/>',
  pause:'<path d="M8 5v14M16 5v14"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.4 9a2.7 2.7 0 0 1 5.2 1c0 2-2.6 2-2.6 4m0 3h.01"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="m10 3-.7 2.4-2.1 1L5 5.8 3 9.2l1.8 1.7v2.2L3 14.8l2 3.4 2.2-.6 2.1 1L10 21h4l.7-2.4 2.1-1 2.2.6 2-3.4-1.8-1.7v-2.2L21 9.2l-2-3.4-2.2.6-2.1-1L14 3z"/>',
};
export const icon=(name:keyof typeof paths)=>`<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`;
export const actionIcon=(name:'share'|'download')=>`<span class="action-icon action-icon-${name}" aria-hidden="true">${icon(name)}</span>`;
export const swipeCue=`<svg viewBox="0 0 132 34" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 16h32M15 8l-8 8 8 8m78-8h32m-8-8 8 8-8 8"/><g class="swipe-hand"><path d="M55 27V8a4 4 0 0 1 8 0v12l5-3 12 5v9H60z"/><path d="M63 10h5" opacity=".45"/></g></svg><span>動かして離す</span>`;
