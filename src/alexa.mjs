import{recommend}from'./recommendation.mjs';
const speech=(text,end=false)=>({version:'1.0',response:{outputSpeech:{type:'PlainText',text},shouldEndSession:end}});
export function handleAlexa(request){
 const type=request?.request?.type;const intent=request?.request?.intent?.name;
 if(type==='LaunchRequest')return speech('Welcome to WanderWrap. Are we finding something for you, or for someone you love?');
 if(intent==='FindGiftIntent'){const who=request.request.intent.slots?.recipient?.value||'them';const idea=recommend({budget:50,signals:[{value:'travel',source:'stated',confidence:1}]})[0];return speech(`For ${who}, I found ${idea.name} at about ${idea.price} pounds. I can send the idea to your WanderWrap app for approval.`)}
 if(intent==='AMAZON.HelpIntent')return speech('Say, find a gift for Maya, or say, surprise me with something for myself.');
 return speech('I did not catch that. Should we find a gift for you or someone else?');
}
