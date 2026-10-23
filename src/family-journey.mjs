const NEXT={
  'parent-account':['child-profile'],'child-profile':['content-discovery'],'content-discovery':['lesson-ready'],
  'lesson-ready':['learning'],'learning':['feedback'],'feedback':['parent-insight'],'parent-insight':['lesson-ready']
};
export function advanceFamilyJourney(journey,next,evidence={}){
  if(!NEXT[journey.stage]?.includes(next))throw Error(`Invalid family transition: ${journey.stage} -> ${next}`);
  if(next==='lesson-ready'&&!evidence.parentApproved)throw Error('Parent approval required');
  if(next==='learning'&&!evidence.inputMode)throw Error('Voice or remote input mode required');
  return{...journey,stage:next,history:[...(journey.history||[]),{stage:next}]};
}
export function feedbackForAttempt({correct,attempt,hint}){
  if(correct)return{tone:'celebrate',message:attempt===1?'You found it! Tell me how you knew.':'Yes—your practice worked!',next:'explain'};
  return{tone:'support',message:hint||'Let’s listen to the first sound together.',next:attempt>=2?'model':'retry'};
}
