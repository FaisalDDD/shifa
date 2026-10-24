import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "@/lib/errors";

export interface ApiMeta {
  total?: number;
  page?: number;
  pageSize?: number;
  hasMore?: boolean;
}

export function ok<T>(data: T, meta?: ApiMeta): NextResponse {
  return NextResponse.json({ ok: true, data, ...(meta ? { meta } : {}) });
}

export function created<T>(data: T, meta?: ApiMeta): NextResponse {
  return NextResponse.json(
    { ok: true, data, ...(meta ? { meta } : {}) },
    { status: 201 },
  );
}

export function errorResponse(
  status: number,
  code: string,
  message: string,
  fields?: Record<string, string>,
): NextResponse {
  return NextResponse.json(
    { ok: false, error: { code, message, ...(fields ? { fields } : {}) } },
    { status },
  );
}

/**
 * Convert any thrown error into a safe JSON response. Never leaks stack
 * traces, credentials, or internal implementation details.
 */
export function handleError(err: unknown): NextResponse {
  if (err instanceof AppError) {
    return errorResponse(err.status, err.code, err.message);
  }
  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.length ? issue.path.join(".") : "form";
      if (!(key in fields)) fields[key] = issue.message;
    }
    return errorResponse(422, "validation", "Invalid request.", fields);
  }
  // Log the full error server-side, return a neutral message to the client.
  console.error("[unhandled]", err);
  return errorResponse(500, "internal", "Something went wrong.");
}
