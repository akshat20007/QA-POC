import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { getCheck, loadChecks, updateCheck } from './checkRegistry.js';
import { lastRun, readRuns, runsForCheck } from './excelStore.js';
import { ENV_FILE } from './paths.js';
import { isRunning, runCheck, runningIds, startScheduler } from './scheduler.js';
import { readScript, writeScript } from './scriptStore.js';
import { runTimeline24h, uptimePercent } from './uptime.js';
import type { CheckDetail, CheckSummary } from './types.js';

dotenv.config({ path: ENV_FILE });

const PORT = Number(process.env.PORT) || 3002;

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function toSummary(): Promise<CheckSummary[]> {
  const checks = await loadChecks();
  const records = await readRuns();
  return checks.map((check) => {
    const mine = runsForCheck(records, check.id);
    return {
      ...check,
      lastRun: lastRun(records, check.id),
      uptime24h: uptimePercent(mine),
      history24h: runTimeline24h(mine),
      running: isRunning(check.id),
    };
  });
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    running: runningIds(),
    note: 'Uptime only accumulates while this server is running.',
  });
});

app.get('/api/checks', async (_req, res) => {
  try {
    const checks = await toSummary();
    res.json({ checks });
  } catch (err) {
    res.status(500).json({ error: errorMessage(err) });
  }
});

app.get('/api/checks/:id', async (req, res) => {
  try {
    const check = await getCheck(req.params.id);
    if (!check) {
      res.status(404).json({ error: `Unknown check: ${req.params.id}` });
      return;
    }
    const records = await readRuns();
    const mine = runsForCheck(records, check.id);
    const history = [...mine].sort((a, b) => (a.ranAt < b.ranAt ? 1 : -1)).slice(0, 50);
    const body: CheckDetail = {
      ...check,
      lastRun: lastRun(records, check.id),
      uptime24h: uptimePercent(mine),
      history24h: runTimeline24h(mine),
      running: isRunning(check.id),
      script: await readScript(check),
      history,
    };
    res.json(body);
  } catch (err) {
    res.status(500).json({ error: errorMessage(err) });
  }
});

app.put('/api/checks/:id', async (req, res) => {
  try {
    const check = await getCheck(req.params.id);
    if (!check) {
      res.status(404).json({ error: `Unknown check: ${req.params.id}` });
      return;
    }

    const { script, intervalMinutes } = req.body as { script?: string; intervalMinutes?: number };
    if (typeof script === 'string') {
      await writeScript(check, script);
    }
    if (intervalMinutes !== undefined) {
      await updateCheck(check.id, { intervalMinutes: Number(intervalMinutes) });
    }

    const updated = await getCheck(check.id);
    res.json({ ok: true, check: updated });
  } catch (err) {
    res.status(400).json({ error: errorMessage(err) });
  }
});

app.post('/api/checks/:id/run', async (req, res) => {
  try {
    const check = await getCheck(req.params.id);
    if (!check) {
      res.status(404).json({ error: `Unknown check: ${req.params.id}` });
      return;
    }
    const record = await runCheck(check, 'manual');
    res.json({ record });
  } catch (err) {
    const message = errorMessage(err);
    const status = message.includes('already running') ? 409 : 500;
    res.status(status).json({ error: message });
  }
});

app.listen(PORT, () => {
  console.log(`Monitoring POC server on http://localhost:${PORT}`);
  startScheduler();
});
