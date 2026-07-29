import { API_BASE_URL } from "../config/env";
import { getAuthToken } from "./authToken";
import type { ApiError, ApiResult } from "./types";
import { isRecord } from "./validators";

export type Decoder<T> = (value: unknown) => T;

function retryAfterSeconds(headers: Headers): number | undefined {
  const value = headers.get("Retry-After");
  if (value === null || !/^\d+$/.test(value.trim())) {
    return undefined;
  }

  const seconds = Number(value);
  return Number.isSafeInteger(seconds) && seconds > 0 ? seconds : undefined;
}

function decodeApiError(
  value: unknown,
  status: number,
  headers: Headers,
): ApiError {
  if (
    isRecord(value) &&
    typeof value.error === "string" &&
    (value.detail === null || typeof value.detail === "string")
  ) {
    const retryAfter = retryAfterSeconds(headers);
    return {
      code: value.error,
      detail: value.detail,
      ...(retryAfter === undefined
        ? {}
        : { retryAfterSeconds: retryAfter }),
      status,
    };
  }

  return {
    code: "invalid_error_response",
    detail: "The server returned an unexpected response.",
    status,
  };
}

export async function request<T>(
  path: string,
  decoder: Decoder<T>,
  init: RequestInit,
): Promise<ApiResult<T>> {
  let response: Response;
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const token = getAuthToken();
  if (token !== null) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
    });
  } catch (error: unknown) {
    return {
      ok: false,
      error: {
        code: "network_error",
        detail:
          error instanceof Error
            ? error.message
            : "Network request failed.",
        status: null,
      },
    };
  }

  let payload: unknown;

  try {
    const text = await response.text();
    payload = text.trim() === "" ? null : (JSON.parse(text) as unknown);
  } catch {
    return {
      ok: false,
      error: {
        code: "invalid_response",
        detail: "The server returned malformed JSON.",
        status: response.status,
      },
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      error: decodeApiError(payload, response.status, response.headers),
    };
  }

  try {
    return {
      ok: true,
      data: decoder(payload),
    };
  } catch (error: unknown) {
    return {
      ok: false,
      error: {
        code: "invalid_response",
        detail:
          error instanceof Error ? error.message : "Invalid response.",
        status: response.status,
      },
    };
  }
}

export function withSignal(
  init: RequestInit,
  signal?: AbortSignal,
): RequestInit {
  return signal === undefined ? init : { ...init, signal };
}
