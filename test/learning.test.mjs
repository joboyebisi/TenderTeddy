import test from'node:test';import assert from'node:assert/strict';import{screenLiteracy,nextChallenge,checkpointResponse,reviewVideo,progressEvent}from'../src/learning.mjs';
test('screening identifies lowest literacy skills',()=>assert.deepEqual(screenLiteracy({phonologicalAwareness:20,letterSound:30,decoding:70,fluency:80,comprehension:90}).focus,['phonologicalAwareness','letterSound']));
test('gradual challenge rises after first try success',()=>assert.equal(nextChallenge({ability:60,difficulty:2,correct:true,attempts:1}),3));
test('wrong answer gives scaffold before reveal',()=>assert.equal(checkpointResponse({answer:'cat',accepted:['ball'],hint:'Stretch the b sound.',attempt:1}).needsScaffold,true));
test('video requires parent and rights basis',()=>assert.equal(reviewVideo({url:'https://youtu.be/demo',parentApproved:true,rightsBasis:'creator allows embed',ageMin:4,ageMax:6}).allowed,true));
test('progress explicitly avoids raw audio',()=>assert.equal(progressEvent({childId:'c',lessonId:'l',skill:'decoding',correct:true,attempts:1}).rawAudioStored,false));
