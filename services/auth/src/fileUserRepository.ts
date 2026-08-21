import type { User } from '@better-you/contracts';
import { readJsonArray, writeJsonArrayAtomic } from '@better-you/persistence';
import type { UserRepository } from './userRepository';

// File-backed adapter (ADR 0016) - same semantics as InMemoryUserRepository,
// persisted to a JSON file. AuthService does not change (ADR 0001).
export class FileUserRepository implements UserRepository {
  private users: User[];

  constructor(private readonly filePath: string) {
    this.users = readJsonArray<User>(filePath);
  }

  private persist(): void {
    writeJsonArrayAtomic(this.filePath, this.users);
  }

  async create(user: User): Promise<User> {
    this.users.push(user);
    this.persist();
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.users.find((user) => user.email === email && user.status === 'active') ?? null;
  }

  async findById(id: string): Promise<User | null> {
    return this.users.find((user) => user.id === id) ?? null;
  }

  async findByAuthSubject(authSubject: string): Promise<User | null> {
    return this.users.find((user) => user.authSubject === authSubject) ?? null;
  }

  async markDeleted(id: string, deletedAt: string): Promise<void> {
    const user = this.users.find((u) => u.id === id);
    if (user) {
      user.status = 'deleted';
      user.deletedAt = deletedAt;
      this.persist();
    }
  }
}
