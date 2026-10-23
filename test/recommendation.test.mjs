import test from'node:test';import assert from'node:assert/strict';import{recommend,sourcePermission,nearbyPrompt,giftLink,shoppingHandoff}from'../src/recommendation.mjs';import{handleAlexa}from'../src/alexa.mjs';
test('stated signals outrank weak inference',()=>{const x=recommend({budget:60,signals:[{value:'travel',source:'stated'},{value:'home',source:'inferred'}]});assert.equal(x[0].id,'journal')});
test('data source needs granular revocable consent',()=>assert.equal(sourcePermission({enabled:true,consentAt:'now',scopes:['likes'],revocable:true}),true));
test('nearby idea appears only with location consent',()=>assert.equal(nearbyPrompt({locationEnabled:false,distanceKm:.2,localPreference:true}).show,false));
test('gift link is recipient-safe route',()=>assert.match(giftLink({ownerId:'u 1'}),/u%201/));
test('shopping never auto-purchases',()=>assert.equal(shoppingHandoff({name:'Tea'}).status,'awaiting_user'));
test('Alexa returns an approval-oriented idea',()=>assert.match(handleAlexa({request:{type:'IntentRequest',intent:{name:'FindGiftIntent',slots:{recipient:{value:'Maya'}}}}}).response.outputSpeech.text,/approval/));
