import type { ErrorCode } from './codes';

export class AppError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode) {
    super(code); // ← el message ES el código, a propósito.

    this.name = 'RifateError';
    this.code = code;
  }
}
