import type { User } from '@better-you/contracts';

export interface UserRepository {
  create(user: User): Promise<User>;
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  findByAuthSubject(authSubject: string): Promise<User | null>;
  markDeleted(id: string, deletedAt: string): Promise<void>;
}

// In-memory only, same adapter pattern as GoalRepository (ADR 0001).
export class InMemoryUserRepository implements UserRepository {
  private users: User[] = [];

  async create(user: User): Promise<User> {
    this.users.push(user);
    return user;
  }

  // Only matches active users, so a deleted account's email becomes available
  // again for a fresh signup - consistent with deleteAccount() actually revoking
  // the identity in AuthProvider rather than permanently reserving the address.
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
    }
  }
}
