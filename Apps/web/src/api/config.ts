const env = import.meta.env as unknown as Record<string, string | undefined>;

export const API_BASE_URL = env.VITE_API_BASE_URL ?? 'http://localhost:4000';
