import { sleep } from "k6";

import { CACHE_CAPACITY } from "./config.js";
import { query, updateThreshold } from "./requests.js";

const MIXED_PROMPTS = [
  "Explain semantic caching",
  "Explain semantic caching",
  "What is a vector cache?",
  "How does request coalescing work?",
  "Explain semantic caching",
  "What causes cache eviction?",
];

export function repeatedIdentical(data) {
  query(`Repeated prompt ${data.runId}`, data.namespace);
  sleep(0.1);
}

export function mixedTraffic(data) {
  const prompt = MIXED_PROMPTS[__ITER % MIXED_PROMPTS.length];
  query(`${prompt} [${data.runId}]`, data.namespace);
  sleep(0.1);
}

export function concurrentIdenticalMiss(data) {
  query(`Concurrent cold miss ${data.runId}`, data.namespace);
}

export function highCardinality(data) {
  query(
    `High cardinality ${data.runId} vu-${__VU} iteration-${__ITER}`,
    data.namespace,
  );
}

export function thresholdTraffic(data) {
  const prompt =
    __ITER % 2 === 0
      ? `Threshold semantic cache ${data.runId}`
      : `Threshold caching semantics ${data.runId}`;
  query(prompt, data.namespace);
  sleep(0.1);
}

export function thresholdController() {
  const threshold = __ITER % 2 === 0 ? 0.75 : 0.98;
  updateThreshold(threshold);
  sleep(2);
}

export function nearCapacity(data) {
  const index = (__VU - 1) * 1_000_000 + __ITER;
  query(
    `Capacity entry ${data.runId}-${index}`,
    data.namespace,
    {
      cache_read_enabled: false,
      cache_write_enabled: true,
    },
  );
}

export const nearCapacityIterations = CACHE_CAPACITY + 25;
