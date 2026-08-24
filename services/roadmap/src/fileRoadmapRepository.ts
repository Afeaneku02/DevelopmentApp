import type { Roadmap } from '@better-you/contracts';
import { readJsonArray, writeJsonArrayAtomic } from '@better-you/persistence';
import type { RoadmapRepository } from './roadmapRepository';

// File-backed adapter (ADR 0016 pattern) - same semantics as
// InMemoryRoadmapRepository, persisted to a JSON file.
export class FileRoadmapRepository implements RoadmapRepository {
  private roadmaps: Roadmap[];

  constructor(private readonly filePath: string) {
    this.roadmaps = readJsonArray<Roadmap>(filePath);
  }

  async create(roadmap: Roadmap): Promise<Roadmap> {
    this.roadmaps.push(roadmap);
    writeJsonArrayAtomic(this.filePath, this.roadmaps);
    return roadmap;
  }

  async findById(id: string): Promise<Roadmap | null> {
    return this.roadmaps.find((roadmap) => roadmap.id === id) ?? null;
  }

  async findByGoalId(goalId: string): Promise<Roadmap | null> {
    return this.roadmaps.find((roadmap) => roadmap.goalId === goalId) ?? null;
  }

  async listByUser(userId: string): Promise<Roadmap[]> {
    return this.roadmaps.filter((roadmap) => roadmap.userId === userId);
  }

  async update(roadmap: Roadmap): Promise<Roadmap> {
    const index = this.roadmaps.findIndex((r) => r.id === roadmap.id);
    if (index !== -1) {
      this.roadmaps[index] = roadmap;
      writeJsonArrayAtomic(this.filePath, this.roadmaps);
    }
    return roadmap;
  }
}
