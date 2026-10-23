import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import crypto from 'node:crypto';

const clone = value => structuredClone(value);
const now = () => new Date().toISOString();

export function initialFamilyState() {
  return {
    household: { id: 'household-demo', parentName: 'Parent', createdAt: now() },
    children: [], content: [], lessons: [], sessions: [], progress: []
  };
}

export class FamilyStore {
  constructor({ filePath = null, seed = null } = {}) {
    this.filePath = filePath;
    this.state = seed ? clone(seed) : initialFamilyState();
    this.ready = this.#load();
  }

  async #load() {
    if (!this.filePath) return;
    try { this.state = JSON.parse(await readFile(this.filePath, 'utf8')); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await this.#persist();
    }
  }

  async #persist() {
    if (!this.filePath) return;
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(this.state, null, 2)}\n`, 'utf8');
  }

  async snapshot() { await this.ready; return clone(this.state); }

  async createChild(input) {
    await this.ready;
    const displayName = String(input.displayName || '').trim();
    if (!displayName) throw new Error('Display name is required');
    if (!new Set(['3-5', '5-7', '7-11', '11-14']).has(input.ageBand)) throw new Error('Choose a supported age band');
    const createdAt = now();
    const child = {
      id: crypto.randomUUID(), householdId: this.state.household.id, displayName,
      ageBand: input.ageBand, avatar: input.avatar || displayName[0].toUpperCase(),
      voiceEnabled: Boolean(input.voiceEnabled), rawAudioStored: false,
      personalisedPractice: input.personalisedPractice !== false,
      dailyLimitMinutes: Number(input.dailyLimitMinutes || 45), createdAt, updatedAt: createdAt
    };
    this.state.children.push(child); await this.#persist(); return clone(child);
  }

  async updateChild(childId, input) {
    await this.ready;
    const child = this.state.children.find(item => item.id === childId);
    if (!child) throw new Error('Child profile not found');
    for (const key of ['displayName', 'ageBand', 'avatar', 'voiceEnabled', 'personalisedPractice', 'dailyLimitMinutes']) {
      if (key in input) child[key] = input[key];
    }
    child.rawAudioStored = false; child.updatedAt = now(); await this.#persist(); return clone(child);
  }

  async deleteChild(childId) {
    await this.ready;
    if (!this.state.children.some(item => item.id === childId)) throw new Error('Child profile not found');
    const lessonIds = new Set(this.state.lessons.filter(item => item.childId === childId).map(item => item.id));
    this.state.children = this.state.children.filter(item => item.id !== childId);
    this.state.lessons = this.state.lessons.filter(item => item.childId !== childId);
    this.state.sessions = this.state.sessions.filter(item => item.childId !== childId && !lessonIds.has(item.lessonId));
    this.state.progress = this.state.progress.filter(item => item.childId !== childId);
    await this.#persist();
    return { deleted: true, childId };
  }

  async addContent(item) { await this.ready; this.state.content.push(item); await this.#persist(); return clone(item); }
  async addLesson(item) { await this.ready; this.state.lessons.push(item); await this.#persist(); return clone(item); }
  async addSession(item) { await this.ready; this.state.sessions.push(item); await this.#persist(); return clone(item); }
  async addProgress(item) { await this.ready; this.state.progress.push(item); await this.#persist(); return clone(item); }

  async updateLesson(id, update) {
    await this.ready; const item = this.state.lessons.find(value => value.id === id);
    if (!item) throw new Error('Lesson not found'); Object.assign(item, update); await this.#persist(); return clone(item);
  }

  async updateSession(id, update) {
    await this.ready; const item = this.state.sessions.find(value => value.id === id);
    if (!item) throw new Error('Session not found'); Object.assign(item, update); await this.#persist(); return clone(item);
  }
}
