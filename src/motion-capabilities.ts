export const maxNativeServiceCopies=256;

/** Row and Stack can need one native service copy per source and visible slot. */
export function editableVisibleMax(sourceCount:number):number{
  const count=Math.max(1,Math.min(20,sourceCount));
  return Math.min(20,Math.max(1,Math.floor(maxNativeServiceCopies/count)));
}
