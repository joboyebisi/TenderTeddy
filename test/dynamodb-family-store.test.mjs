import test from 'node:test';
import assert from 'node:assert/strict';
import { DynamoDbFamilyStore } from '../src/dynamodb-family-store.mjs';

class MemoryDocumentClient {
  item = null;
  calls = [];

  async send(command) {
    this.calls.push(command.constructor.name);
    if (command.constructor.name === 'GetCommand') return this.item ? { Item: structuredClone(this.item) } : {};
    if (command.constructor.name === 'PutCommand') {
      this.item = structuredClone(command.input.Item);
      return {};
    }
    throw new Error(`Unexpected DynamoDB command: ${command.constructor.name}`);
  }
}

test('DynamoDB store initializes, persists and cascades child deletion', async () => {
  const client = new MemoryDocumentClient();
  const store = new DynamoDbFamilyStore({ tableName: 'test-family-table', householdId: 'family-test', client });

  const initial = await store.snapshot();
  assert.equal(initial.household.id, 'family-test');
  assert.deepEqual(initial.children, []);

  const child = await store.createChild({ displayName: 'Learner', ageBand: '5-7' });
  await store.addLesson({ id: 'lesson-1', childId: child.id, checkpoints: [] });
  await store.addSession({ id: 'session-1', childId: child.id, lessonId: 'lesson-1' });
  await store.addProgress({ id: 'progress-1', childId: child.id, lessonId: 'lesson-1' });

  const persisted = new DynamoDbFamilyStore({ tableName: 'test-family-table', householdId: 'family-test', client });
  assert.equal((await persisted.snapshot()).children[0].displayName, 'Learner');

  await persisted.deleteChild(child.id);
  const deleted = await persisted.snapshot();
  assert.deepEqual(deleted.children, []);
  assert.deepEqual(deleted.lessons, []);
  assert.deepEqual(deleted.sessions, []);
  assert.deepEqual(deleted.progress, []);
  assert.ok(client.calls.includes('GetCommand'));
  assert.ok(client.calls.includes('PutCommand'));
});
