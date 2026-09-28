import { describe, expect, it, vi } from 'vitest';
import type { Goal } from '@better-you/contracts';
import { GoalNotFoundError } from '@better-you/goals';
import { HttpMentorGuidanceClient } from '../httpMentorGuidanceClient';
import { buildMentorGuidanceInput, validateMentorGuidanceClarifications } from '../mentorGuidanceInput';
import { MentorGuidanceService } from '../mentorGuidanceService';
import { MentorGuidanceValidationError } from '../errors';

// ADR 0029, "Clarification replies": the interaction's question/answer turns
// (oldest first, last = the answer just submitted), forwarded as the AI
// endpoint's `clarifications` for that one request.

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

const INPUT = { contextKey: 'fitness_scheduling', goalTitle: 'Walk every morning' };
const Q1 = 'What time of day could you usually walk?';
const TURN = { question: Q1, answer: '10 minutes' };

function guidanceBody(status = 'openai') {
  return {
    status,
    reason_code: null,
    guidance: {
      summary: 'Short walks fit your routine.',
      recommendations: [
        { action: 'Walk 10 minutes before work.', reason: 'Matches your check-ins.', grounded_in_belief_ids: ['bel_1'] },
      ],
      clarifying_question: null,
      needs_more_information: false,
      needs_web: false,
    },
    snapshot_id: 's',
    telemetry: { provider: status === 'mock' ? 'mock' : 'openai', model: 'm', success: true },
  };
}

function modelClarification(overrides: Record<string, unknown> = {}) {
  return {
    status: 'needs_more_information',
    reason_code: null,
    guidance: {
      summary: 'A little more context would help choose a small next step.',
      recommendations: [],
      clarifying_question: Q1,
      needs_more_information: true,
      needs_web: false,
    },
    snapshot_id: 's',
    telemetry: { provider: 'openai', model: 'm', success: true },
    ...overrides,
  };
}

function client(fetchImpl: ReturnType<typeof vi.fn>) {
  return new HttpMentorGuidanceClient({ baseUrl: 'http://localhost:8100', fetchImpl });
}

function goal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'goal-1',
    userId: 'user-1',
    title: 'Walk every morning',
    description: 'Private: my blood pressure is high',
    category: 'fitness',
    status: 'active',
    source: 'custom',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  } as Goal;
}

describe('HttpMentorGuidanceClient with clarification turns', () => {
  it('sends the turns as `clarifications` (question + answer pairs, in order), never as `question`', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, guidanceBody()));
    const turns = [{ question: 'Which activity?', answer: 'Walking' }, TURN];
    await client(fetchImpl).getGuidance('u1', { ...INPUT, clarifications: turns });

    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({
      context_key: 'fitness_scheduling',
      goal: 'Walk every morning',
      clarifications: turns,
    });
  });

  it('rebuilds each turn from its two named fields', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, guidanceBody()));
    const widened = { ...TURN, note: 'PRIVATE', confidence: 1 };
    await client(fetchImpl).getGuidance('u1', { ...INPUT, clarifications: [widened] });
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.clarifications).toEqual([TURN]);
  });

  it('omits `clarifications` entirely when there are none', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, guidanceBody()));
    await client(fetchImpl).getGuidance('u1', { ...INPUT, clarifications: [] });
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body).not.toHaveProperty('clarifications');
    expect(body).not.toHaveProperty('question');
  });

  it.each(['openai', 'mock'])('marks a %s-generated clarifying question as answerable', async (provider) => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, modelClarification({ telemetry: { provider, model: 'm', success: true } })));
    const result = await client(fetchImpl).getGuidance('u1', INPUT);
    expect(result).toMatchObject({
      status: 'needs_more_information',
      source: provider,
      clarifyingQuestion: Q1,
      reasonCode: null,
      acceptsReply: true,
    });
  });

  it.each(['insufficient_authorized_evidence', 'policy_requires_resolution', 'consequential_request'])(
    'never marks the deterministic %s gate as answerable',
    async (reasonCode) => {
      const fetchImpl = vi
        .fn()
        .mockResolvedValue(jsonResponse(200, modelClarification({ reason_code: reasonCode, telemetry: null })));
      const result = await client(fetchImpl).getGuidance('u1', INPUT);
      expect(result.status).toBe('needs_more_information');
      expect(result.acceptsReply).toBe(false);
    }
  );

  it('is not answerable when a clarification carries a reason code, even with provider telemetry', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, modelClarification({ reason_code: 'insufficient_authorized_evidence' })));
    expect((await client(fetchImpl).getGuidance('u1', INPUT)).acceptsReply).toBe(false);
  });

  it('is not answerable when the question is blank', async () => {
    const body = modelClarification();
    body.guidance = { ...body.guidance, clarifying_question: '   ' };
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, body));
    const result = await client(fetchImpl).getGuidance('u1', INPUT);
    expect(result.clarifyingQuestion).toBeNull();
    expect(result.acceptsReply).toBe(false);
  });

  it.each(['openai', 'mock', 'deterministic_fallback', 'unavailable'])('a %s response never accepts a reply', async (status) => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, guidanceBody(status)));
    expect((await client(fetchImpl).getGuidance('u1', INPUT)).acceptsReply).toBe(false);
  });

  it('an AI service that predates `clarifications` (422) degrades to unavailable, not an error', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(422, { detail: [{ msg: 'Extra inputs are not permitted' }] }));
    expect(await client(fetchImpl).getGuidance('u1', { ...INPUT, clarifications: [TURN] })).toMatchObject({
      status: 'unavailable',
      reasonCode: 'http_422',
      acceptsReply: false,
    });
  });
});

describe('validateMentorGuidanceClarifications', () => {
  it('treats missing turns as none', () => {
    expect(validateMentorGuidanceClarifications(undefined)).toBeUndefined();
  });

  it('trims and rebuilds each turn, dropping extra keys', () => {
    expect(validateMentorGuidanceClarifications([{ question: `  ${Q1} `, answer: ' 10 minutes ', extra: 'x' }])).toEqual([
      TURN,
    ]);
  });

  it('accepts two turns and rejects three (the per-interaction bound)', () => {
    expect(validateMentorGuidanceClarifications([TURN, TURN])).toHaveLength(2);
    expect(() => validateMentorGuidanceClarifications([TURN, TURN, TURN])).toThrow(/at most 2/);
  });

  it.each([
    ['not an array', 'hello'],
    ['an empty array', []],
    ['a non-object turn', ['10 minutes']],
    ['a null turn', [null]],
    ['a missing question', [{ answer: 'a' }]],
    ['a missing answer', [{ question: 'q' }]],
    ['a non-string answer', [{ question: 'q', answer: 10 }]],
    ['a blank answer', [{ question: 'q', answer: '   ' }]],
    ['a blank question', [{ question: '\n', answer: 'a' }]],
  ])('rejects %s', (_label, value) => {
    expect(() => validateMentorGuidanceClarifications(value)).toThrow(MentorGuidanceValidationError);
  });

  it('accepts exactly 500 characters per field and rejects 501 (no silent truncation)', () => {
    expect(validateMentorGuidanceClarifications([{ question: 'q', answer: 'a'.repeat(500) }])![0].answer).toHaveLength(500);
    expect(() => validateMentorGuidanceClarifications([{ question: 'q', answer: 'a'.repeat(501) }])).toThrow(/at most 500/);
    expect(() => validateMentorGuidanceClarifications([{ question: 'q'.repeat(501), answer: 'a' }])).toThrow(/at most 500/);
  });

  it('counts code points like the AI endpoint does, not UTF-16 units', () => {
    expect(() => validateMentorGuidanceClarifications([{ question: 'q', answer: '\u{1F642}'.repeat(500) }])).not.toThrow();
    expect(() => validateMentorGuidanceClarifications([{ question: 'q', answer: '\u{1F642}'.repeat(501) }])).toThrow(
      MentorGuidanceValidationError
    );
  });

  it('reports the clarifications field', () => {
    try {
      validateMentorGuidanceClarifications([{ question: 'q', answer: '' }]);
    } catch (err) {
      expect((err as MentorGuidanceValidationError).field).toBe('clarifications');
    }
  });
});

describe('MentorGuidanceService with clarification turns', () => {
  it('forwards validated turns in the sanitized input', async () => {
    const aiClient = { getGuidance: vi.fn().mockResolvedValue({ status: 'unavailable' }) };
    const service = new MentorGuidanceService({ getGoal: async () => goal() }, aiClient);

    await service.getGuidance('user-1', 'goal-1', [{ question: Q1, answer: '  10 minutes  ' }]);

    expect(aiClient.getGuidance).toHaveBeenCalledWith('user-1', {
      contextKey: 'fitness_scheduling',
      goalTitle: 'Walk every morning',
      clarifications: [TURN],
    });
  });

  it('rejects invalid turns without calling the AI client', async () => {
    const aiClient = { getGuidance: vi.fn() };
    const service = new MentorGuidanceService({ getGoal: async () => goal() }, aiClient);

    await expect(service.getGuidance('user-1', 'goal-1', [TURN, TURN, TURN])).rejects.toBeInstanceOf(
      MentorGuidanceValidationError
    );
    expect(aiClient.getGuidance).not.toHaveBeenCalled();
  });

  it("checks ownership first: someone else's goal is a 404 even with invalid turns", async () => {
    const getGoal = vi.fn().mockRejectedValue(new GoalNotFoundError());
    const aiClient = { getGuidance: vi.fn() };
    const service = new MentorGuidanceService({ getGoal }, aiClient);

    await expect(service.getGuidance('user-1', 'goal-x', 'garbage')).rejects.toBeInstanceOf(GoalNotFoundError);
    expect(aiClient.getGuidance).not.toHaveBeenCalled();
  });

  it('never adds the goal description to the input, even alongside turns', () => {
    const input = buildMentorGuidanceInput(goal(), [TURN]);
    expect(Object.keys(input).sort()).toEqual(['clarifications', 'contextKey', 'goalTitle']);
    expect(JSON.stringify(input)).not.toContain('blood pressure');
  });
});
