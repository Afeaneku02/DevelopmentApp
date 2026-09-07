import type { RoadmapDraft, RoadmapGenerationInput } from '@better-you/contracts';
import type { RoadmapGenerator } from './roadmapGenerator';

// Deterministic, rule-based stand-in for the real AI roadmap generator
// (being built and validated in a separate project - see ADR 0020). Exists
// so the full generate -> validate -> persist -> display flow can be built
// and tested end to end now, with the same RoadmapGenerator interface a real
// AI implementation will satisfy later. Produces the same fixed three-phase
// structure for every goal; it deliberately does not read Profile,
// Check-ins, or Progress data, since those inputs matter for a real
// AI-generated plan, not for a "does the shape work" placeholder.
export class PlaceholderRoadmapGenerator implements RoadmapGenerator {
  async generateRoadmap(input: RoadmapGenerationInput): Promise<RoadmapDraft> {
    const { goalTitle: title } = input;

    return {
      milestones: [
        {
          title: `Get started on "${title}"`,
          description: 'Lay the groundwork so this goal has real momentum.',
          actionSteps: [
            { title: 'Write down why this goal matters to you' },
            { title: 'Identify one small action you can take this week' },
          ],
        },
        {
          title: 'Build consistency',
          description: 'Turn early effort into a repeatable habit.',
          actionSteps: [
            { title: 'Check in on this goal at least twice' },
            { title: 'Adjust your approach based on what is working' },
          ],
        },
        {
          title: `Reach "${title}"`,
          description: 'Close the gap between where you are and your goal.',
          actionSteps: [
            { title: 'Review your overall progress toward this goal' },
            { title: 'Decide your next goal, or how to go deeper on this one' },
          ],
        },
      ],
    };
  }
}
