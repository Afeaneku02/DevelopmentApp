export class AuthValidationError extends Error {
  constructor(
    public readonly field: string,
    message: string
  ) {
    super(message);
    this.name = 'AuthValidationError';
  }
}

export class EmailAlreadyInUseError extends Error {
  constructor(email: string) {
    super(`An account with email ${email} already exists`);
    this.name = 'EmailAlreadyInUseError';
  }
}

// Deliberately generic (Blueprint §4 security rule: "generic error messaging for
// account discovery risks") - thrown for both "unknown email" and "wrong password"
// so a caller can't use sign-in failures to enumerate registered accounts.
export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid email or password');
    this.name = 'InvalidCredentialsError';
  }
}

export class SessionInvalidError extends Error {
  constructor() {
    super('Session is invalid or has expired');
    this.name = 'SessionInvalidError';
  }
}
