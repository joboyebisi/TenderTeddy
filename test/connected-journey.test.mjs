import test from 'node:test';import assert from 'node:assert/strict';
import {advanceJourney,occasionCandidates,CONNECTOR_CAPABILITIES} from '../src/connected-journey.mjs';
import {createPersonalAgent,activateAgent,recordPreference,mayReadChannel} from '../src/personal-agent.mjs';
import {buildChristmasPlan} from '../src/christmas-plan.mjs';

test('journey requires consent and approval gates',()=>{let j={stage:'signed-out',history:[]};j=advanceJourney(j,'onboarding');assert.throws(()=>advanceJourney(j,'sources-connected',{}));j=advanceJourney(j,'sources-connected',{consentReceipt:'r1'});j=advanceJourney(j,'occasion-found');j=advanceJourney(j,'preferences-confirmed',{confirmedByGiver:true});j=advanceJourney(j,'ideas-ready');assert.throws(()=>advanceJourney(j,'approved',{}));assert.equal(advanceJourney(j,'approved',{approvedByUser:true}).stage,'approved')});
test('occasion candidates are future-first and disclose unmatched people',()=>{const items=occasionCandidates([{date:'2026-12-25',name:'Christmas'},{date:'2026-11-03',name:'Maya',recipientId:'r1'}],new Date('2026-10-19'));assert.equal(items[0].name,'Maya');assert.equal(items[1].needsRecipientMatch,true)});
test('personal agent cannot silently monitor chats',()=>{let a=createPersonalAgent({ownerId:'u1',channels:['whatsapp'],expiresAt:'2026-12-26'});assert.equal(mayReadChannel(a,'whatsapp'),false);a=activateAgent(a,{ownerConsent:true,participantInviteAccepted:true});a=recordPreference(a,{value:'travel books',participantConfirmed:true,provenance:'chat:42'});assert.equal(mayReadChannel(a,'whatsapp'),true);assert.equal(a.facts[0].confidence,'confirmed')});
test('enterprise Christmas plan calculates governed budget',()=>{const p=buildChristmasPlan({mode:'enterprise',recipients:['a','b'],budget:100,deadline:'2026-12-10'});assert.equal(p.perPerson,50);assert.deepEqual(p.approvals,['campaign-owner','finance-owner'])});
test('restricted social saves use explicit fallback',()=>{assert.equal(CONNECTOR_CAPABILITIES.instagram.mode,'shared-link');assert.equal(CONNECTOR_CAPABILITIES.xBookmarks.mode,'oauth')});

