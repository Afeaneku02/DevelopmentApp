import type { Roadmap } from '@better-you/contracts';

export interface RoadmapRepository {
  create(roadmap: Roadmap): Promise<Roadmap>;
  findById(id: string): Promise<Roadmap | null>;
  findByGoalId(goalId: string): Promise<Roadmap | null>;
  listByUser(userId: string): Promise<Roadmap[]>;
  update(roadmap: Roadmap): Promise<Roadmap>;
}

// In-memory only. Swap for a real adapter once a database is chosen -
// RoadmapService does not change (ADR 0001 adapter pattern, same as every
// other repository in this project).
export class InMemoryRoadmapRepository implements RoadmapRepository {
  private roadmaps: Roadmap[] = [];

  async create(roadmap: Roadmap): Promise<Roadmap> {
    this.roadmaps.push(roadmap);
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
    }
    return roadmap;
  }
}
