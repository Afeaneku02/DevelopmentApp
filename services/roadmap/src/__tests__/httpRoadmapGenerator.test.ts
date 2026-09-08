import { describe, expect, it, vi } from 'vitest';
import type { RoadmapDraft } from '@better-you/contracts';
import { HttpRoadmapGenerator } from '../httpRoadmapGenerator';
import { RoadmapGeneratorUnavailableError } from '../errors';

function makeDraft(): RoadmapDraft {
  return {
    milestones: [{ title: 'Milestone', actionSteps: [{ title: 'Step' }] }],
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('HttpRoadmapGenerator', () => {
  it('POSTs exactly the sanitized input to <baseUrl>/roadmaps/generate and returns the parsed draft', async () => {
    const draft = makeDraft();
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, draft));
    const generator = new HttpRoadmapGenerator({ baseUrl: 'http://localhost:4100', fetchImpl });

    const result = await generator.generateRoadmap({ goalCategory: 'career', goalTitle: 'Ship the MVP' });

    expect(result).toEqual(draft);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('http://localhost:4100/roadmaps/generate');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ goalCategory: 'career', goalTitle: 'Ship the MVP' });
  });

  it('strips a trailing slash from baseUrl', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, makeDraft()));
    const generator = new HttpRoadmapGenerator({ baseUrl: 'http://localhost:4100/', fetchImpl });

    await generator.generateRoadmap({ goalCategory: 'career', goalTitle: 'X' });

    expect(fetchImpl.mock.calls[0][0]).toBe('http://localhost:4100/roadmaps/generate');
  });

  it('includes an Authorization header only when a service token is provided', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, makeDraft()));

    await new HttpRoadmapGenerator({ baseUrl: 'http://localhost:4100', fetchImpl }).generateRoadmap({
      goalCategory: 'career',
      goalTitle: 'X',
    });
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBeUndefined();

    fetchImpl.mockClear();
    await new HttpRoadmapGenerator({ baseUrl: 'http://localhost:4100', serviceToken: 'secret-token', fetchImpl }).generateRoadmap({
      goalCategory: 'career',
      goalTitle: 'X',
    });
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer secret-token');
  });

  it('never sends anything beyond the goalCategory/goalTitle allowlist, even if given extra fields', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, makeDraft()));
    const generator = new HttpRoadmapGenerator({ baseUrl: 'http://localhost:4100', fetchImpl });

    // Cast bypasses the compile-time contract to prove the runtime request
    // body isn't widened even if a caller somehow passed extra data.
    await generator.generateRoadmap({
      goalCategory: 'career',
      goalTitle: 'X',
      description: 'should never be sent',
      userId: 'user-1',
    } as never);

    const sentBody = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(Object.keys(sentBody).sort()).toEqual(['goalCategory', 'goalTitle']);
  });

  it('throws RoadmapGeneratorUnavailableError on a non-2xx response, without attempting to parse a draft', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(503, { error: 'service unavailable' }));
    const generator = new HttpRoadmapGenerator({ baseUrl: 'http://localhost:4100', fetchImpl });

    await expect(generator.generateRoadmap({ goalCategory: 'career', goalTitle: 'X' })).rejects.toThrow(
      RoadmapGeneratorUnavailableError
    );
  });

  it('throws RoadmapGeneratorUnavailableError on a network error', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND'));
    const generator = new HttpRoadmapGenerator({ baseUrl: 'http://localhost:4100', fetchImpl });

    await expect(generator.generateRoadmap({ goalCategory: 'career', goalTitle: 'X' })).rejects.toThrow(
      RoadmapGeneratorUnavailableError
    );
  });

  it('throws RoadmapGeneratorUnavailableError when the response body is not valid JSON', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token in JSON');
      },
    } as unknown as Response);
    const generator = new HttpRoadmapGenerator({ baseUrl: 'http://localhost:4100', fetchImpl });

    await expect(generator.generateRoadmap({ goalCategory: 'career', goalTitle: 'X' })).rejects.toThrow(
      RoadmapGeneratorUnavailableError
    );
  });

  it('throws RoadmapGeneratorUnavailableError when the request times out', async () => {
    // Mimics real fetch's behavior on AbortController.abort(): rejects with
    // an Error named 'AbortError'. Never actually resolves on its own, so
    // this proves the timeout - not a lucky race - is what ends the call.
    const fetchImpl = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    });
    const generator = new HttpRoadmapGenerator({ baseUrl: 'http://localhost:4100', timeoutMs: 20, fetchImpl });

    await expect(generator.generateRoadmap({ goalCategory: 'career', goalTitle: 'X' })).rejects.toThrow(
      RoadmapGeneratorUnavailableError
    );
  });
});
