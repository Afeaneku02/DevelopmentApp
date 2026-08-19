// API-layer-only error: the request body didn't even have the right shape
// (missing/wrong-type field) - distinct from a domain business-rule violation.
export class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BadRequestError';
  }
}
