import { NextResponse } from 'next/server';

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  error: ApiErrorPayload;
}

export class AppError extends Error {
  public code: string;
  public status: number;
  public details?: Record<string, unknown>;

  constructor(code: string, message: string, status: number = 400, details?: Record<string, unknown>) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function createErrorResponse(
  code: string,
  message: string,
  status: number = 400,
  details?: Record<string, unknown>
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        details: details || {},
      },
    },
    { status }
  );
}

export function buildErrorResponse(error: unknown): NextResponse<ApiErrorResponse> {
  if (error instanceof AppError) {
    return createErrorResponse(error.code, error.message, error.status, error.details);
  }

  const message = error instanceof Error ? error.message : 'Terjadi kesalahan internal server';
  if (message.includes('FORBIDDEN') || message.includes('tidak memiliki hak akses')) {
    return createErrorResponse('FORBIDDEN', message, 403);
  }
  if (message.includes('UNAUTHORIZED') || message.includes('Sesi tidak valid')) {
    return createErrorResponse('UNAUTHORIZED', message, 401);
  }

  console.error('Unhandled API error:', error);
  return createErrorResponse('INTERNAL_ERROR', message, 500);
}

export function validationError(
  message: string = 'Input tidak valid.',
  details?: Record<string, unknown>
) {
  return createErrorResponse('VALIDATION_ERROR', message, 400, details);
}

export function unauthorizedError(
  message: string = 'Sesi tidak valid atau telah berakhir. Silakan login kembali.'
) {
  return createErrorResponse('UNAUTHORIZED', message, 401);
}

export function forbiddenError(
  message: string = 'Anda tidak memiliki hak akses untuk tindakan ini.'
) {
  return createErrorResponse('FORBIDDEN', message, 403);
}

export function notFoundError(
  message: string = 'Data tidak ditemukan.'
) {
  return createErrorResponse('NOT_FOUND', message, 404);
}

export function internalError(
  message: string = 'Terjadi kesalahan internal pada server.'
) {
  return createErrorResponse('INTERNAL_ERROR', message, 500);
}
