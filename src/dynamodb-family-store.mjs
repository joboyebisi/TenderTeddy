import crypto from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { initialFamilyState } from './family-store.mjs';

const clone = value => structuredClone(value);
const now = () => new Date().toISOString();

export class DynamoDbFamilyStore {
  constructor({ tableName = process.env.DYNAMODB_TABLE, householdId = process.env.HOUSEHOLD_ID || 'household-demo', client } = {}) {
    if (!tableName) throw new Error('DYNAMODB_TABLE is required');
    this.tableName = tableName;
    this.householdId = householdId;
    this.client = client || DynamoDBDocumentClient.from(new DynamoDBClient({}));
  }

  async snapshot() {
    const result = await this.client.send(new GetCommand({ TableName: this.tableName, Key: { householdId: this.householdId } }));
    if (result.Item?.state) return clone(result.Item.state);
    const state = initialFamilyState();
    state.household.id = this.householdId;
    await this.#save(state);
    return clone(state);
  }

  async #save(state) {
    await this.client.send(new PutCommand({ TableName: this.tableName, Item: { householdId: this.householdId, state, updatedAt: now() } }));
  }

  async #mutate(change) {
    const state = await this.snapshot();
    const result = change(state);
    await this.#save(state);
    return clone(result);
  }

  async createChild(input) {
    return this.#mutate(state => {
      const displayName = String(input.displayName || '').trim();
      if (!displayName) throw new Error('Display name is required');
      if (!new Set(['3-5', '5-7', '7-11', '11-14']).has(input.ageBand)) throw new Error('Choose a supported age band');
      const createdAt = now();
      const child = { id: crypto.randomUUID(), householdId: state.household.id, displayName, ageBand: input.ageBand,
        avatar: input.avatar || displayName[0].toUpperCase(), voiceEnabled: Boolean(input.voiceEnabled), rawAudioStored: false,
        personalisedPractice: input.personalisedPractice !== false, dailyLimitMinutes: Number(input.dailyLimitMinutes || 45), createdAt, updatedAt: createdAt };
      state.children.push(child); return child;
    });
  }

  async updateChild(id, input) { return this.#mutate(state => { const item = state.children.find(value => value.id === id); if (!item) throw new Error('Child profile not found'); for (const key of ['displayName','ageBand','avatar','voiceEnabled','personalisedPractice','dailyLimitMinutes']) if (key in input) item[key] = input[key]; item.rawAudioStored = false; item.updatedAt = now(); return item; }); }
  async deleteChild(id) { return this.#mutate(state => { if (!state.children.some(item => item.id === id)) throw new Error('Child profile not found'); const lessonIds = new Set(state.lessons.filter(item => item.childId === id).map(item => item.id)); state.children = state.children.filter(item => item.id !== id); state.lessons = state.lessons.filter(item => item.childId !== id); state.sessions = state.sessions.filter(item => item.childId !== id && !lessonIds.has(item.lessonId)); state.progress = state.progress.filter(item => item.childId !== id); return { deleted: true, childId: id }; }); }
  async addContent(item) { return this.#mutate(state => { state.content.push(item); return item; }); }
  async addLesson(item) { return this.#mutate(state => { state.lessons.push(item); return item; }); }
  async addSession(item) { return this.#mutate(state => { state.sessions.push(item); return item; }); }
  async addProgress(item) { return this.#mutate(state => { state.progress.push(item); return item; }); }
  async updateLesson(id, update) { return this.#mutate(state => { const item = state.lessons.find(value => value.id === id); if (!item) throw new Error('Lesson not found'); Object.assign(item, update); return item; }); }
  async updateSession(id, update) { return this.#mutate(state => { const item = state.sessions.find(value => value.id === id); if (!item) throw new Error('Session not found'); Object.assign(item, update); return item; }); }
}
