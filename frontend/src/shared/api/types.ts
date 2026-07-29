export interface ApiError {
  code: string;
  detail: string | null;
  retryAfterSeconds?: number;
  status: number | null;
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError };
