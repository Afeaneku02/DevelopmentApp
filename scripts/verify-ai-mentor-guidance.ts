/**
 * Manual end-to-end check of the mentor-guidance journey (ADR 0029). NOT part
 * of `npm run verify` - it needs BOTH servers running locally:
 *
 * 1. DevelopmentApp_AI_Models, e.g. (from that repo):
 *      .\.venv\Scripts\python.exe tools/serve_api.py --db e2e.sqlite3 --init-db --port 8100
 *    (uses the OpenAI key from that project's own .env - a LIVE, billable call
 *    per guidance request; its local budget ledger still applies)
 * 2. Better You's API, pointed at it:
 *      AI_MODELS_BASE_URL=http://127.0.0.1:8100 npm run dev:api
 * 3. From this repo:
 *      npm run verify:ai-mentor-guidance
 *      # options (env): BETTER_YOU_API_URL (default http://127.0.0.1:4000),
 *      #   AI_MODELS_BASE_URL (default http://127.0.0.1:8100),
 *      #   EXPECT_SOURCE=openai|mock|any (default any), CHECK_INS (default 3)
 *
 * Everything goes through Better You's real HTTP API as a real signed-up
 * user; the AI project is only read directly (GET /users/{id}/model) to
 * prove the events actually became usable evidence. Checks:
 *
 *   1. both services are reachable
 *   2. before any check-ins, guidance says needs_more_information
 *      (insufficient evidence) rather than inventing guidance
 *   3. real check-ins recorded in Better You reach the AI project as events,
 *      get processed into observations -> evidence -> a groundable belief
 *   4. no check-in note / goal description text reached the AI project
 *   5. guidance requested through Better You now returns guidance (or the
 *      AI project's deterministic fallback) grounded ONLY in belief ids that
 *      exist in that user's AI-side model
 *
 * Exits 0 only if every check passes.
 */

const API = (process.env.BETTER_YOU_API_URL?.trim() || 'http://127.0.0.1:4000').replace(/\/+$/, '');
const AI = (process.env.AI_MODELS_BASE_URL?.trim() || 'http://127.0.0.1:8100').replace(/\/+$/, '');
const EXPECT_SOURCE = process.env.EXPECT_SOURCE?.trim() || 'any';
const CHECK_INS = Number(process.env.CHECK_INS ?? 3);
const PRIVATE_NOTE = 'E2E-PRIVATE-NOTE do not forward';
const PRIVATE_DESCRIPTION = 'E2E-PRIVATE-DESCRIPTION do not forward';

interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
}
const results: CheckResult[] = [];
function check(name: string, ok: boolean, detail: string): boolean {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}\n      ${detail}`);
  return ok;
}

async function call(method: string, url: string, token?: string, body?: unknown): Promise<{ status: number; json: any }> {
  const res = await fetch(url, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  // 1. Reachability
  const apiHealth = await call('GET', `${API}/health`).catch(() => ({ status: 0, json: null }));
  const aiHealth = await call('GET', `${AI}/health`).catch(() => ({ status: 0, json: null }));
  if (
    !check('services reachable', apiHealth.status === 200 && aiHealth.status === 200, `Better You ${apiHealth.status}, AI Models ${aiHealth.status}`)
  ) {
    return;
  }

  // Sign up a fresh user through Better You.
  const email = `e2e-${Date.now()}@example.com`;
  const password = 'e2e-mentor-guidance-2026';
  await call('POST', `${API}/api/v1/auth/signup`, undefined, { email, password });
  const login = await call('POST', `${API}/api/v1/auth/login`, undefined, { email, password });
  const token = login.json?.token as string;
  const me = await call('GET', `${API}/api/v1/me`, token);
  const userId = me.json?.user?.id as string;
  if (!check('signed up a Better You user', Boolean(token && userId), `userId=${userId}`)) return;

  const goal = await call('POST', `${API}/api/v1/goals`, token, {
    category: 'fitness',
    source: 'custom',
    title: 'Walk every morning',
    description: PRIVATE_DESCRIPTION,
  });
  const goalId = goal.json?.goal?.id as string;
  if (!check('created a fitness goal', goal.status === 201, `goalId=${goalId}`)) return;

  // 2. Before evidence exists.
  const before = await call('POST', `${API}/api/v1/mentor-guidance`, token, { goalId });
  check(
    'guidance before evidence is needs_more_information',
    before.status === 200 && before.json?.mentorGuidance?.status === 'needs_more_information',
    `HTTP ${before.status}, ${JSON.stringify(before.json?.mentorGuidance && { status: before.json.mentorGuidance.status, reasonCode: before.json.mentorGuidance.reasonCode })}`
  );

  // 3. Real product activity: check-ins through Better You.
  for (let i = 0; i < CHECK_INS; i += 1) {
    const res = await call('POST', `${API}/api/v1/check-ins`, token, { goalId, response: 'yes', note: PRIVATE_NOTE });
    if (res.status !== 201) {
      check('recorded check-ins', false, `check-in ${i + 1} -> HTTP ${res.status}`);
      return;
    }
  }
  check('recorded check-ins in Better You', true, `${CHECK_INS} x "yes"`);

  // Wait for the fire-and-forget sync + coalesced processing (ADR 0027/0028).
  let model: any = null;
  let belief: any = null;
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const res = await call('GET', `${AI}/users/${encodeURIComponent(userId)}/model`);
    model = res.json;
    const events = (model?.events ?? []).filter((e: any) => e.event_type === 'check_in_recorded');
    belief = (model?.beliefs ?? []).find((b: any) => b.belief_key === 'checkin_consistency');
    if (events.length >= CHECK_INS && belief && !belief.locked_until_recompute) {
      const activeEvidence = (model?.evidence ?? []).filter((e: any) => e.belief_id === belief.belief_id);
      if (activeEvidence.length >= CHECK_INS) break;
    }
    await sleep(500);
  }

  const checkInEvents = (model?.events ?? []).filter((e: any) => e.event_type === 'check_in_recorded');
  const observations = model?.observations ?? [];
  const evidence = (model?.evidence ?? []).filter((e: any) => belief && e.belief_id === belief.belief_id);
  check(
    'check-ins reached the AI project as events',
    checkInEvents.length >= CHECK_INS,
    `${checkInEvents.length} check_in_recorded events (of ${(model?.events ?? []).length} total)`
  );
  check('events were processed into observations', observations.length >= CHECK_INS, `${observations.length} observations`);
  check(
    'observations became evidence on a belief',
    Boolean(belief) && evidence.length >= CHECK_INS,
    belief
      ? `${belief.belief_id}: status=${belief.status}, confidence=${belief.confidence}, locked=${belief.locked_until_recompute}, evidence=${evidence.length}`
      : 'no checkin_consistency belief'
  );
  check(
    'belief is groundable (unlocked, provisional/validated)',
    Boolean(belief) && !belief.locked_until_recompute && ['provisional', 'validated'].includes(belief.status),
    belief ? `status=${belief.status}` : 'n/a'
  );

  // 4. Privacy boundary over the whole AI-side record for this user.
  const serializedModel = JSON.stringify(model ?? {});
  check(
    'no private note/description text in the AI project',
    !serializedModel.includes('E2E-PRIVATE'),
    'searched events, observations, evidence, beliefs'
  );

  // 5. Guidance now.
  const after = await call('POST', `${API}/api/v1/mentor-guidance`, token, { goalId });
  const guidance = after.json?.mentorGuidance;
  console.log('\nGuidance returned to Better You:\n' + JSON.stringify(guidance, null, 2) + '\n');
  const usable = guidance?.status === 'guidance' || guidance?.status === 'fallback';
  check('guidance is usable after evidence', after.status === 200 && usable, `status=${guidance?.status}, source=${guidance?.source}, reasonCode=${guidance?.reasonCode}`);
  if (EXPECT_SOURCE !== 'any') {
    check(`guidance source is ${EXPECT_SOURCE}`, guidance?.source === EXPECT_SOURCE, `source=${guidance?.source}`);
  }
  const knownBeliefIds = new Set((model?.beliefs ?? []).map((b: any) => b.belief_id));
  const cited: string[] = (guidance?.recommendations ?? []).flatMap((r: any) => r.groundedInBeliefIds);
  check(
    "recommendations are grounded in this user's AI-side beliefs",
    cited.length > 0 && cited.every((id) => knownBeliefIds.has(id)),
    `cited ${JSON.stringify([...new Set(cited)])}`
  );
}

main()
  .catch((err) => {
    check('script ran', false, err instanceof Error ? err.message : String(err));
  })
  .finally(() => {
    const failed = results.filter((r) => !r.ok);
    console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
    process.exit(failed.length === 0 && results.length > 0 ? 0 : 1);
  });
