// Blueprint §4 core data: id, authSubject, email, status, createdAt, deletedAt.
// Deliberately no password/credential field here - that belongs to whichever
// AuthProvider adapter is in use (Blueprint §2 identity boundary), so this shape
// doesn't change when a local adapter is later replaced by a managed provider.
export type UserStatus = 'active' | 'deleted';

export interface User {
  id: string;
  authSubject: string;
  email: string;
  status: UserStatus;
  createdAt: string;
  deletedAt?: string;
}

export interface SignUpInput {
  email: string;
  password: string;
}

export interface SignInInput {
  email: string;
  password: string;
}
