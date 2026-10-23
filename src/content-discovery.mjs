import {playbackMode,canAttachInteractiveCheckpoint} from './content-policy.mjs';
export function reviewContentCandidate(item){
  const mode=playbackMode(item);const checkpointPlacements=['before','during','after'].filter(p=>canAttachInteractiveCheckpoint(item,p));
  return{...item,mode,checkpointPlacements,parentApprovalRequired:true,status:mode==='external-link'?'link-only':'eligible'};
}
export function createLesson({candidate,skill,ageBand,questions}){
  const reviewed=reviewContentCandidate(candidate);
  if(reviewed.status!=='eligible')throw Error('Content is not eligible for an interactive lesson');
  if(!questions?.length)throw Error('At least one checkpoint is required');
  return{contentId:candidate.id,skill,ageBand,questions,playbackMode:reviewed.mode,placements:reviewed.checkpointPlacements,status:'awaiting-parent-approval'};
}
