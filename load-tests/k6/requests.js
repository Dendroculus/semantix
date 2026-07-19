import http from "k6/http";
import { check } from "k6";
import { Counter, Trend } from "k6/metrics";

import { BASE_URL } from "./config.js";

export const cacheHits = new Counter("semantix_cache_hits");
export const cacheMisses = new Counter("semantix_cache_misses");
export const providerCalls = new Counter("semantix_provider_calls");
export const queryErrors = new Counter("semantix_query_errors");
export const queryLatency = new Trend("semantix_query_latency_ms", true);

const JSON_HEADERS = {
  headers: {
    "Content-Type": "application/json",
  },
};

export function query(prompt, namespace, policy = {}) {
  const response = http.post(
    `${BASE_URL}/api/v1/query`,
    JSON.stringify({
      prompt,
      namespace,
      ...policy,
    }),
    JSON_HEADERS,
  );
  const succeeded = check(response, {
    "query returned 200": (result) => result.status === 200,
  });
  if (!succeeded) {
    queryErrors.add(1);
    return null;
  }

  const payload = response.json();
  queryLatency.add(payload.latency_ms);
  if (payload.cache_hit) {
    cacheHits.add(1);
  } else {
    cacheMisses.add(1);
  }
  if (payload.provider_called) {
    providerCalls.add(1);
  }
  return payload;
}

export function clearNamespace(namespace) {
  const response = http.del(
    `${BASE_URL}/api/v1/cache?namespace=${encodeURIComponent(namespace)}`,
  );
  check(response, {
    "namespace clear returned 200": (result) => result.status === 200,
  });
}

export function updateThreshold(threshold) {
  const response = http.put(
    `${BASE_URL}/api/v1/cache/threshold`,
    JSON.stringify({ threshold }),
    JSON_HEADERS,
  );
  check(response, {
    "threshold update returned 200": (result) => result.status === 200,
  });
}

export function readThreshold() {
  const response = http.get(`${BASE_URL}/api/v1/cache/threshold`);
  check(response, {
    "threshold read returned 200": (result) => result.status === 200,
  });
  return response.status === 200 ? response.json().threshold : null;
}

export function readMetrics() {
  const response = http.get(`${BASE_URL}/api/v1/metrics`);
  check(response, {
    "metrics returned 200": (result) => result.status === 200,
  });
  return response.status === 200 ? response.json() : null;
}
