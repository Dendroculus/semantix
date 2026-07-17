export interface ApiError {
  code: string;
  detail: string | null;
  status: number | null;
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError };
