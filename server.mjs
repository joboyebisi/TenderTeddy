import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApi, handleApiError } from './src/api.mjs';
import { FamilyStore } from './src/family-store.mjs';
import { DynamoDbFamilyStore } from './src/dynamodb-family-store.mjs';
import { createGeminiLessonService } from './src/gemini-service.mjs';

const publicRoot = fileURLToPath(new URL('./public/', import.meta.url));
const dataPath = fileURLToPath(new URL('./data/family.json', import.meta.url));
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.apk': 'application/vnd.android.package-archive'
};

function defaultStore() {
  return process.env.DYNAMODB_TABLE
    ? new DynamoDbFamilyStore({ tableName: process.env.DYNAMODB_TABLE })
    : new FamilyStore({ filePath: dataPath });
}

export function createTenderTeddyServer({ store = defaultStore(), geminiService = createGeminiLessonService() } = {}) {
  const api = createApi(store, { geminiService });
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) {
        if (!(await api(req, res, url))) {
          res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'API route not found' }));
        }
        return;
      }
      const wanted = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      const path = normalize(join(publicRoot, wanted));
      if (!path.startsWith(publicRoot)) throw new Error('Invalid path');
      const data = await readFile(path);
      res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' });
      res.end(data);
    } catch (error) {
      if (req.url.startsWith('/api/')) return handleApiError(res, error);
      res.writeHead(404); res.end('Not found');
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4201);
  createTenderTeddyServer().listen(port, () => console.log(`TenderTeddy http://localhost:${port}`));
}
