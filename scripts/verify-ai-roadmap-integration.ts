/**
 * Manual end-to-end check of the optional DevelopmentApp_AI_Models roadmap
 * integration (ADR 0024). This is NOT part of `npm run verify` -- it needs
 * that separate project's API server running locally, which is a localhost
 * internal-alpha service with no real auth (so this is local-only).
 *
 * 1. Start the AI Models API, e.g. from the DevelopmentApp_AI_Models repo:
 *      python tools/serve_api.py --db alpha.sqlite3 --init-db --port 8100
 * 2. Run this from the Better You repo root:
 *      npm run verify:ai-roadmap
 *      # or point it elsewhere:
 *      AI_MODELS_BASE_URL=http://127.0.0.1:8100 npm run verify:ai-roadmap
 *
 * It exercises the real HTTP round-trip through Better You's own
 * `HttpRoadmapGenerator` + `RoadmapService`, and checks:
 *
 *   1. the AI Models base URL is usable
 *   2. a Better You goal is created
 *   3. RoadmapService.generateRoadmap() runs through HttpRoadmapGenerator
 *      (a real POST /roadmaps/generate happened), sending exactly
 *      { goalCategory, goalTitle }
 *   4. the persisted Roadmap carries Better You-owned id / status / userId /
 *      goalId / createdAt / updatedAt (+ milestone/step ids and statuses) --
 *      none of which the AI response contained
 *   5. the raw AI response body contained ONLY RoadmapDraft fields
 *      (milestones -> title/description?/actionSteps -> title/description?),
 *      and no id / userId / status / timestamp / persistence field
 *   6. the same flow with AI_MODELS_BASE_URL unset still works, via
 *      PlaceholderRoadmapGenerator, making zero calls to the AI server
 *   7. malformed AI-shaped responses fail safely and persist nothing
 *
 * Exits 0 only if every check passes.
 */
import { GoalService, InMemoryGoalRepository, InMemoryGoalHistoryRepository } from '@better-you/goals';
import {
  RoadmapService,
  InMemoryRoadmapRepository,
  HttpRoadmapGenerator,
} from '@better-you/roadmap';
import type { RoadmapGenerationInput } from '@better-you/contracts';
import { createDefaultDependencies } from '@better-you/api';

const BASE_URL = (process.env.AI_MODELS_BASE_URL?.trim() || 'http://127.0.0.1:8100').replace(/\/+$/, '');
const GENERATE_PATH = '/roadmaps/generate';

const USER_ID = 'verify-user-1';
const GOAL_TITLE = 'Ship the Better You MVP';
const GOAL_CATEGORY = 'career' as const;

const BETTER_YOU_OWNED_KEYS = ['"id"', '"userId"', '"user_id"', '"goalId"', '"goal_id"', '"status"', '"createdAt"', '"updatedAt"', '"source"'];
const EXPECTED_GENERATION_INPUT: RoadmapGenerationInput = {
  goalCategory: GOAL_CATEGORY,
  goalTitle: GOAL_TITLE,
};

interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
}
const results: CheckResult[] = [];

function record(name: string, ok: boolean, detail = ''): void {
  results.push({ name, ok, detail });
  process.stdout.write(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  --  ${detail}` : ''}\n`);
}

function finish(): never {
  const passed = results.filter((r) => r.ok).length;
  process.stdout.write(`\n${passed}/${results.length} checks passed\n`);
  process.exit(passed === results.length ? 0 : 1);
}

function roadmapDraftShapeProblems(value: unknown): string[] {
  const problems: string[] = [];
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return ['response body is not a JSON object'];
  }
  const obj = value as Record<string, unknown>;
  const topKeys = Object.keys(obj);
  if (topKeys.length !== 1 || topKeys[0] !== 'milestones') {
    problems.push(`top-level keys are [${topKeys.join(', ')}], expected exactly [milestones]`);
  }
  if (!Array.isArray(obj.milestones)) {
    problems.push('milestones is not an array');
    return problems;
  }
  obj.milestones.forEach((milestone, i) => {
    if (typeof milestone !== 'object' || milestone === null) {
      problems.push(`milestones[${i}] is not an object`);
      return;
    }
    const m = milestone as Record<string, unknown>;
    for (const key of Object.keys(m)) {
      if (!['title', 'description', 'actionSteps'].includes(key)) {
        problems.push(`milestones[${i}] has unexpected key "${key}"`);
      }
    }
    if (typeof m.title !== 'string') problems.push(`milestones[${i}].title is not a string`);
    if (m.description !== undefined && typeof m.description !== 'string') {
      problems.push(`milestones[${i}].description is neither a string nor omitted`);
    }
    if (!Array.isArray(m.actionSteps)) {
      problems.push(`milestones[${i}].actionSteps is not an array`);
      return;
    }
    m.actionSteps.forEach((step, j) => {
      if (typeof step !== 'object' || step === null) {
        problems.push(`milestones[${i}].actionSteps[${j}] is not an object`);
        return;
      }
      const s = step as Record<string, unknown>;
      for (const key of Object.keys(s)) {
        if (!['title', 'description'].includes(key)) {
          problems.push(`milestones[${i}].actionSteps[${j}] has unexpected key "${key}"`);
        }
      }
      if (typeof s.title !== 'string') problems.push(`milestones[${i}].actionSteps[${j}].title is not a string`);
      if (s.description !== undefined && typeof s.description !== 'string') {
        problems.push(`milestones[${i}].actionSteps[${j}].description is neither a string nor omitted`);
      }
    });
  });
  const serialized = JSON.stringify(value);
  for (const banned of BETTER_YOU_OWNED_KEYS) {
    if (serialized.includes(banned)) problems.push(`response contains a persistence key ${banned}`);
  }
  return problems;
}

async function main(): Promise<void> {
  process.stdout.write(`AI Models base URL: ${BASE_URL}\n\n`);

  // ---- 1. base URL sanity --------------------------------------------
  try {
    const parsed = new URL(BASE_URL);
    record('1. AI Models base URL is usable', parsed.protocol === 'http:' || parsed.protocol === 'https:', BASE_URL);
  } catch (err) {
    record('1. AI Models base URL is usable', false, err instanceof Error ? err.message : String(err));
    finish();
  }

  // Capture the raw AI request/response bodies so checks 3-5 can inspect
  // exactly what crossed the boundary. The generator still reads the
  // untouched response via Response.clone().
  let rawAiResponse: unknown;
  let rawAiRequestBody: unknown;
  const teeFetch: typeof fetch = async (input, init) => {
    if (String(input).endsWith(GENERATE_PATH) && typeof init?.body === 'string') {
      rawAiRequestBody = JSON.parse(init.body);
    }
    const res = await fetch(input as Parameters<typeof fetch>[0], init);
    if (String(input).endsWith(GENERATE_PATH)) {
      rawAiResponse = await res.clone().json().catch(() => undefined);
    }
    return res;
  };

  const goalService = new GoalService(new InMemoryGoalRepository(), new InMemoryGoalHistoryRepository());
  const roadmapService = new RoadmapService(
    new InMemoryRoadmapRepository(),
    goalService,
    new HttpRoadmapGenerator({ baseUrl: BASE_URL, fetchImpl: teeFetch })
  );

  // ---- 2. create a goal -------------------------------------------
  let goal;
  try {
    goal = await goalService.createGoal({
      userId: USER_ID,
      source: 'custom',
      category: GOAL_CATEGORY,
      title: GOAL_TITLE,
    });
    record('2. Better You goal created', typeof goal.id === 'string' && goal.id.length > 0, `goalId=${goal.id}`);
  } catch (err) {
    record('2. Better You goal created', false, err instanceof Error ? err.message : String(err));
    finish();
  }

  // ---- 3. generate through HttpRoadmapGenerator ------------------
  let roadmap;
  try {
    roadmap = await roadmapService.generateRoadmap(USER_ID, goal!.id);
    const wentOverHttp = rawAiResponse !== undefined;
    record(
      '3. generateRoadmap() ran through HttpRoadmapGenerator',
      wentOverHttp && roadmap.milestones.length > 0 && JSON.stringify(rawAiRequestBody) === JSON.stringify(EXPECTED_GENERATION_INPUT),
      wentOverHttp
        ? `POST ${GENERATE_PATH}; sent ${JSON.stringify(rawAiRequestBody)}; received ${roadmap.milestones.length} milestones`
        : 'no AI response captured'
    );
  } catch (err) {
    record(
      '3. generateRoadmap() ran through HttpRoadmapGenerator',
      false,
      err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    );
    finish();
  }

  // ---- 4. persisted with Better You-owned fields ----------------
  {
    const problems: string[] = [];
    const stored = await roadmapService.getRoadmap(USER_ID, roadmap!.id);
    const isoLike = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
    if (!stored) {
      problems.push('roadmap was not persisted / not retrievable');
    } else {
      if (!stored.id) problems.push('roadmap.id missing');
      if (stored.userId !== USER_ID) problems.push(`roadmap.userId=${stored.userId}`);
      if (stored.goalId !== goal!.id) problems.push(`roadmap.goalId=${stored.goalId}`);
      if (stored.status !== 'active') problems.push(`roadmap.status=${stored.status}`);
      if (!isoLike.test(stored.createdAt)) problems.push(`roadmap.createdAt=${stored.createdAt}`);
      if (!isoLike.test(stored.updatedAt)) problems.push(`roadmap.updatedAt=${stored.updatedAt}`);
      stored.milestones.forEach((m, i) => {
        if (!m.id) problems.push(`milestones[${i}].id missing`);
        const expected = i === 0 ? 'active' : 'pending';
        if (m.status !== expected) problems.push(`milestones[${i}].status=${m.status} (expected ${expected})`);
        m.actionSteps.forEach((s, j) => {
          if (!s.id) problems.push(`milestones[${i}].actionSteps[${j}].id missing`);
          if (s.status !== 'pending') problems.push(`milestones[${i}].actionSteps[${j}].status=${s.status}`);
        });
      });
      const rawSerialized = JSON.stringify(rawAiResponse);
      for (const owned of BETTER_YOU_OWNED_KEYS) {
        if (rawSerialized.includes(owned)) problems.push(`AI response unexpectedly contained ${owned}`);
      }
      // Prove the content is the AI's, not the placeholder's: the first
      // milestone title should reference the goal title the way the AI
      // Models generator does.
      const firstTitle = (rawAiResponse as { milestones?: Array<{ title?: string }> }).milestones?.[0]?.title ?? '';
      if (stored.milestones[0]?.title !== firstTitle) {
        problems.push('persisted first-milestone title does not match the AI response');
      }
    }
    record(
      '4. Persisted roadmap carries Better You-owned id/status/userId/goalId/timestamps',
      problems.length === 0,
      problems.join('; ') || `roadmapId=${roadmap!.id}, ${roadmap!.milestones.length} milestones`
    );
  }

  // ---- 5. AI response contained only RoadmapDraft fields -------
  {
    const problems = roadmapDraftShapeProblems(rawAiResponse);
    const keys = rawAiResponse && typeof rawAiResponse === 'object' ? Object.keys(rawAiResponse) : [];
    record('5. AI response body contained only RoadmapDraft fields', problems.length === 0, problems.join('; ') || `keys=[${keys.join(', ')}]`);
  }

  // ---- 6. still works with no AI_MODELS_BASE_URL --------------
  {
    const saved = process.env.AI_MODELS_BASE_URL;
    delete process.env.AI_MODELS_BASE_URL;

    let aiCalls = 0;
    const realFetch = globalThis.fetch;
    globalThis.fetch = ((input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      if (String(input).includes(GENERATE_PATH)) aiCalls += 1;
      return realFetch(input, init);
    }) as typeof fetch;

    try {
      const deps = createDefaultDependencies();
      const g2 = await deps.goalService.createGoal({
        userId: 'verify-user-2',
        source: 'custom',
        category: 'fitness',
        title: 'Run a 5k',
      });
      const rm2 = await deps.roadmapService.generateRoadmap('verify-user-2', g2.id);
      record(
        '6. Works with AI_MODELS_BASE_URL unset (placeholder, no AI call)',
        rm2.milestones.length > 0 && aiCalls === 0,
        `${rm2.milestones.length} milestones, ${aiCalls} call(s) to ${GENERATE_PATH}`
      );
    } catch (err) {
      record('6. Works with AI_MODELS_BASE_URL unset (placeholder, no AI call)', false, err instanceof Error ? err.message : String(err));
    } finally {
      globalThis.fetch = realFetch;
      if (saved !== undefined) process.env.AI_MODELS_BASE_URL = saved;
    }
  }

  // ---- 7. malformed AI response fails safely ------------------
  {
    const badGoalService = new GoalService(new InMemoryGoalRepository(), new InMemoryGoalHistoryRepository());
    const badRepository = new InMemoryRoadmapRepository();
    const malformedFetch: typeof fetch = async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({ milestones: [{ title: 'Missing action steps' }] }),
      }) as Response;
    const badRoadmapService = new RoadmapService(
      badRepository,
      badGoalService,
      new HttpRoadmapGenerator({ baseUrl: BASE_URL, fetchImpl: malformedFetch })
    );
    const badGoal = await badGoalService.createGoal({
      userId: 'verify-user-3',
      source: 'custom',
      category: 'career',
      title: 'Validate bad AI output',
    });

    try {
      await badRoadmapService.generateRoadmap('verify-user-3', badGoal.id);
      record('7. Malformed AI responses fail safely and persist nothing', false, 'malformed response was accepted');
    } catch (err) {
      const persisted = await badRepository.findByGoalId(badGoal.id);
      record(
        '7. Malformed AI responses fail safely and persist nothing',
        persisted === null,
        `${err instanceof Error ? err.name : String(err)}; persisted=${persisted === null ? 'no' : 'yes'}`
      );
    }
  }

  finish();
}

main().catch((err) => {
  process.stderr.write(`Unexpected error: ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
