// Consistent application errors, converted to safe HTTP responses in lib/api.ts.

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const Errors = {
  unauthenticated: (msg = "You must be signed in.") =>
    new AppError("unauthenticated", msg, 401),
  forbidden: (msg = "You do not have permission to perform this action.") =>
    new AppError("forbidden", msg, 403),
  notFound: (what = "Resource") =>
    new AppError("not_found", `${what} was not found.`, 404),
  conflict: (msg: string) => new AppError("conflict", msg, 409),
  badRequest: (msg: string) => new AppError("bad_request", msg, 400),
  validation: (msg: string) => new AppError("validation", msg, 422),
};
