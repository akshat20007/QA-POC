import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import { translateTestCase } from './translator.js';
import { runTestCases } from './runner.js';
import type { RunnableTestCase } from './runner.js';
import { createRun, getRun, appendEvent, completeRun, registerEmitter, getEmitter, unregisterEmitter } from './store.js';
import type {
  GenerateRequest,
  GenerateResponse,
  GenerateStoryResult,
  ValidateRequest,
  ValidateResponse,
  CreateRunRequest,
  CreateRunResponse,
  RunReportResponse,
  RunEvent,
} from './apiTypes.js';
import { generateOne } from './generationClient.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const QA_POC_ROOT = path.join(__dirname, '..', '..');
dotenv.config({ path: path.join(QA_POC_ROOT, '.env') });

const PORT = Number(process.env.PORT ?? 3001);

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, geminiKeyConfigured: Boolean(process.env.GEMINI_API_KEY) });
});

app.post('/api/generate', async (req, res) => {
  const { stories } = req.body as GenerateRequest;
  if (!Array.isArray(stories) || stories.length === 0 || !stories.every((s) => typeof s === 'string')) {
    res.status(400).json({ error: 'stories must be a non-empty array of strings' });
    return;
  }

  const results: GenerateStoryResult[] = await Promise.all(
    stories.map(async (story, storyIndex): Promise<GenerateStoryResult> => {
      const outcome = await generateOne(story);
      if (outcome.ok) {
        return { storyIndex, story, status: 'ok', id: randomUUID(), testCase: outcome.testCase };
      }
      return { storyIndex, story, status: 'error', error: outcome.error, errorType: outcome.errorType };
    }),
  );

  const response: GenerateResponse = { batchId: randomUUID(), results };
  res.json(response);
});

app.post('/api/validate', (req, res) => {
  const { testCases } = req.body as ValidateRequest;
  if (!Array.isArray(testCases)) {
    res.status(400).json({ error: 'testCases must be an array' });
    return;
  }

  const response: ValidateResponse = {
    results: testCases.map(({ id, testCase }) => ({ id, errors: translateTestCase(testCase).errors })),
  };
  res.json(response);
});

app.post('/api/runs', (req, res) => {
  const { testCases } = req.body as CreateRunRequest;
  if (!Array.isArray(testCases) || testCases.length === 0) {
    res.status(400).json({ error: 'testCases must be a non-empty array' });
    return;
  }

  const runId = randomUUID();
  createRun(runId);

  const runnable: RunnableTestCase[] = testCases.map(({ id, testCase }) => ({ id, testCase }));
  void startRun(runId, runnable);

  const response: CreateRunResponse = { runId };
  res.json(response);
});

app.get('/api/runs/:runId/events', (req, res) => {
  const { runId } = req.params;
  const state = getRun(runId);
  if (!state) {
    res.status(404).json({ error: 'Run not found. Runs are in-memory only and do not survive a server restart.' });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  // state.events is replayed in the same order on every connection, so a given event
  // always lands at the same seq - Last-Event-ID (sent automatically by EventSource on
  // reconnect) reliably tells us which ones this client has already received.
  const lastEventId = Number(req.headers['last-event-id'] ?? 0);
  let seq = 0;
  const send = (event: RunEvent) => {
    seq += 1;
    if (seq <= lastEventId) return;
    res.write(`id: ${seq}\n`);
    res.write(`event: ${event.type}\n`);
    res.write(`data: ${JSON.stringify(event.payload)}\n\n`);
  };

  for (const event of state.events) send(event);

  if (state.status === 'complete') {
    res.end();
    return;
  }

  const emitter = getEmitter(runId);
  if (!emitter) {
    res.end();
    return;
  }

  const onEvent = (event: RunEvent) => {
    send(event);
    if (event.type === 'run-complete' || event.type === 'error') {
      res.end();
    }
  };
  emitter.on('event', onEvent);
  req.on('close', () => emitter.off('event', onEvent));
});

app.get('/api/runs/:runId/report', (req, res) => {
  const state = getRun(req.params.runId);
  if (!state) {
    res.status(404).json({ error: 'Run not found. Runs are in-memory only and do not survive a server restart.' });
    return;
  }

  const response: RunReportResponse = {
    runId: state.runId,
    status: state.status,
    startedAt: state.startedAt,
    completedAt: state.completedAt,
    reports: state.reports,
    summary: state.summary,
  };
  res.json(response);
});

async function startRun(runId: string, testCases: RunnableTestCase[]): Promise<void> {
  const emitter = new EventEmitter();
  registerEmitter(runId, emitter);
  emitter.on('event', (event: RunEvent) => appendEvent(runId, event));

  // runTestCases never rejects - on failure it emits its own 'error' event and resolves
  // with whatever reports were already completed, so those are never lost here.
  const reports = await runTestCases(runId, testCases, emitter, { headless: true });
  const summary = {
    total: reports.length,
    passed: reports.filter((r) => r.outcome === 'PASS').length,
    failed: reports.filter((r) => r.outcome === 'FAIL').length,
  };
  completeRun(runId, reports, summary);
  unregisterEmitter(runId);
}

app.listen(PORT, () => {
  console.log(`QA PoC web API listening on http://localhost:${PORT}`);
});
