import type { RoadmapDraft, RoadmapGenerationInput } from '@better-you/contracts';
import type { RoadmapGenerator } from './roadmapGenerator';
import { RoadmapGeneratorUnavailableError } from './errors';

export interface HttpRoadmapGeneratorOptions {
  baseUrl: string;
  serviceToken?: string;
  timeoutMs?: number;
  // Injected for testability (this project's usual "inject for testing,
  // default to the real implementation" pattern - see e.g. `now` elsewhere
  // in this domain) - tests never need a real network call or a running
  // AI Models server to exercise this class.
  fetchImpl?: typeof fetch;
}

const DEFAULT_TIMEOUT_MS = 10_000;

// Optional, config-gated RoadmapGenerator implementation that calls an
// external AI service (the separate DevelopmentApp_AI_Models project's
// `POST /roadmaps/generate`) over plain HTTP - see ADR 0024. This is local
// integration only, never the default: apps/api/src/server.ts only
// constructs this when AI_MODELS_BASE_URL is explicitly configured;
// PlaceholderRoadmapGenerator remains the default generator otherwise, with
// no behavior change. Sends exactly the same RoadmapGenerationInput
// allowlist (goalCategory, goalTitle only - ADR 0023) as the request body;
// this class does not widen what crosses the AI boundary.
//
// Every failure mode - network error, timeout, non-2xx response, a response
// body that isn't valid JSON - is normalized into one
// RoadmapGeneratorUnavailableError rather than leaking a raw
// fetch/AbortError. RoadmapService never catches generator errors itself, so
// whatever this throws propagates straight to the caller and nothing is
// ever persisted. A response that *is* successfully parsed as JSON still
// goes through RoadmapService's existing validateRoadmapDraft() before
// anything is saved, exactly as it does for every other generator - this
// class is not responsible for validating the roadmap shape itself, only
// for getting a usable response or failing cleanly.
export class HttpRoadmapGenerator implements RoadmapGenerator {
  private readonly baseUrl: string;
  private readonly serviceToken: string | undefined;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: HttpRoadmapGeneratorOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.serviceToken = options.serviceToken;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async generateRoadmap(input: RoadmapGenerationInput): Promise<RoadmapDraft> {
    // Rebuilt from named fields rather than serializing `input` directly -
    // defense in depth so this request body can never widen beyond the
    // allowlist even if some future bug or bypass handed this method an
    // object with extra properties on it.
    const requestBody: RoadmapGenerationInput = {
      goalCategory: input.goalCategory,
      goalTitle: input.goalTitle,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/roadmaps/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.serviceToken ? { Authorization: `Bearer ${this.serviceToken}` } : {}),
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
    } catch (err) {
      const timedOut = err instanceof Error && err.name === 'AbortError';
      throw new RoadmapGeneratorUnavailableError(
        timedOut
          ? `Roadmap generator request timed out after ${this.timeoutMs}ms`
          : `Roadmap generator request failed: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new RoadmapGeneratorUnavailableError(`Roadmap generator responded with HTTP ${response.status}`);
    }

    try {
      return (await response.json()) as RoadmapDraft;
    } catch {
      throw new RoadmapGeneratorUnavailableError('Roadmap generator returned a response that was not valid JSON');
    }
  }
}
