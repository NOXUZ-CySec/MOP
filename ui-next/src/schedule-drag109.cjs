'use strict';
/**
 * Continuous date range that responds to pointer reversal.
 * The action is anchored at the day where pointer-down started.
 * Reversing back to the anchor removes dates that are no longer inside the interval.
 * A Ctrl/Meta action preserves the selection that existed before pointer-down.
 */
function rangeSelection(dates,start,current,baseline=[]){
 const a=dates.indexOf(start),b=dates.indexOf(current);
 if(a<0||b<0)return [...baseline];
 const interval=dates.slice(Math.min(a,b),Math.max(a,b)+1);
 return [...new Set([...baseline,...interval])];
}
module.exports={rangeSelection};
