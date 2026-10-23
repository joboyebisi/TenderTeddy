export const CATALOG=[
 {id:'ceramic',name:'Make-your-own ceramic cup',price:38,categories:['creative','home','experience'],local:true,story:'A tactile afternoon and something useful to keep.'},
 {id:'tasting',name:'Neighbourhood tasting walk',price:45,categories:['food','travel','experience'],local:true,story:'A small adventure through independent favourites.'},
 {id:'journal',name:'Pocket travel journal',price:24,categories:['travel','books','creative'],local:false,story:'For collecting plans, places and tiny memories.'},
 {id:'tea',name:'Slow Sunday tea set',price:29,categories:['food','home','wellbeing'],local:false,story:'A calm ritual, wrapped and ready.'},
 {id:'speaker',name:'Mini adventure speaker',price:49,categories:['music','tech','travel'],local:false,story:'A soundtrack for kitchens, picnics and weekends away.'}
];

export const SOURCE_WEIGHT=Object.freeze({
 stated:1,
 recipient_confirmed:1,
 saved:.85,
 liked:.65,
 feed:.45,
 location:.35,
 inferred:.25,
 personality_hypothesis:.1
});

const HARD_EXCLUSIONS=new Set(['allergy','unsafe','prohibited','sensitive-trait']);

function signalContribution(signal){
 const confirmed=signal.confirmed===true||signal.source==='stated'||signal.source==='recipient_confirmed';
 const confirmationFactor=confirmed?1:.55;
 const freshnessFactor=signal.expiresAt&&new Date(signal.expiresAt)<new Date()?0:.9+(signal.capturedAt?0.1:0);
 const weight=(SOURCE_WEIGHT[signal.source]??.2)*(signal.confidence??1)*confirmationFactor*freshnessFactor;
 return Number(weight.toFixed(4));
}

export function scoreGift(gift,{signals=[],budget=100,excluded=[]}={}){
 if(gift.price>budget||gift.categories.some(x=>excluded.includes(x)))return null;
 const evidence=signals
  .filter(s=>s.rankEligible!==false)
  .filter(s=>gift.categories.includes(s.value))
  .filter(s=>!s.sensitivityLabels?.some(label=>HARD_EXCLUSIONS.has(label)))
  .map(s=>({...s,weight:signalContribution(s)}))
  .filter(s=>s.weight>0);
 const rawLedger=evidence.map(({id,value,source,weight,confidence,confirmed})=>({evidenceId:id||null,feature:value,source,contribution:weight,confidence:confidence??1,confirmed:Boolean(confirmed||source==='stated'||source==='recipient_confirmed')}));
 const personalityTotal=rawLedger.filter(item=>item.source==='personality_hypothesis').reduce((sum,item)=>sum+item.contribution,0);
 const personalityScale=personalityTotal>.1?.1/personalityTotal:1;
 const contributionLedger=rawLedger.map(item=>item.source==='personality_hypothesis'?{...item,contribution:Number((item.contribution*personalityScale).toFixed(4))}:item);
 return{...gift,score:Number(contributionLedger.reduce((n,e)=>n+e.contribution,0).toFixed(2)),evidence,contributionLedger};
}
export function recommend(profile){return CATALOG.map(g=>scoreGift(g,profile)).filter(Boolean).sort((a,b)=>b.score-a.score||a.price-b.price).slice(0,4)}
export function rankGifts(profile,catalog=CATALOG){return catalog.map(g=>scoreGift(g,profile)).filter(Boolean).sort((a,b)=>b.score-a.score||a.price-b.price).slice(0,4)}

export function rankExplainableGifts(profile,catalog=CATALOG){
 const now=profile.now?new Date(profile.now):new Date();
 const filtered=catalog.filter(gift=>{
  if(gift.price>profile.budget)return false;
  if(gift.categories.some(category=>(profile.excluded||[]).includes(category)))return false;
  if(gift.available===false)return false;
  if(profile.destinationCountry&&gift.countries&&!gift.countries.includes(profile.destinationCountry))return false;
  if(profile.requiredBy&&gift.deliversBy&&new Date(gift.deliversBy)>new Date(profile.requiredBy))return false;
  return true;
 });
 return filtered.map(gift=>{
  const ranked=scoreGift(gift,profile);
  const occasionFit=gift.occasions?.includes(profile.occasion)?0.14:0;
  const deliveryConfidence=gift.deliversBy&&new Date(gift.deliversBy)>=now?Number((.14*(gift.deliveryConfidence??.5)).toFixed(4)):0;
  const budgetFit=gift.price<=profile.budget?Number((.08*(1-gift.price/profile.budget*.25)).toFixed(4)):0;
  const deterministicContributions=[
   {feature:'occasionFit',contribution:occasionFit},
   {feature:'deliveryConfidence',contribution:deliveryConfidence},
   {feature:'budgetFit',contribution:budgetFit}
  ];
  const score=Number((ranked.score+deterministicContributions.reduce((sum,x)=>sum+x.contribution,0)).toFixed(4));
  return{...ranked,score,contributionLedger:[...ranked.contributionLedger,...deterministicContributions],rankerVersion:'wanderwrap-context-v1',uncertainty:gift.providerObservedAt?[]:['provider freshness unavailable']};
 }).sort((a,b)=>b.score-a.score||a.price-b.price).slice(0,4);
}
export function sourcePermission(source){return Boolean(source?.enabled&&source?.consentAt&&source?.scopes?.length&&source?.revocable)}
export function nearbyPrompt({locationEnabled,distanceKm,localPreference}){return locationEnabled&&localPreference&&distanceKm<=2?{show:true,message:'You are close to a saved independent maker. See the idea?'}:{show:false}}
export function giftLink({ownerId,mode='receive'}){return `https://wanderwrap.co.uk/g/${encodeURIComponent(ownerId)}?mode=${mode}`}
export function shoppingHandoff(item){return{status:'awaiting_user',label:`Search Amazon for ${item.name}`,url:`https://www.amazon.co.uk/s?k=${encodeURIComponent(item.name)}`}}
