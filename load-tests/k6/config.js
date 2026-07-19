export const BASE_URL = __ENV.BASE_URL || "http://host.docker.internal:8000";
export const SELECTED_SCENARIO =
  __ENV.SCENARIO || "repeated-identical";
export const CACHE_CAPACITY = Number.parseInt(
  __ENV.CACHE_CAPACITY || "500",
  10,
);
export const P95_LIMIT_MS = Number.parseInt(
  __ENV.P95_LIMIT_MS || "5000",
  10,
);

if (__ENV.LOAD_ACKNOWLEDGE_PROVIDER_CALLS !== "true") {
  throw new Error(
    "Set LOAD_ACKNOWLEDGE_PROVIDER_CALLS=true after selecting safe providers.",
  );
}

if (!Number.isInteger(CACHE_CAPACITY) || CACHE_CAPACITY < 1) {
  throw new Error("CACHE_CAPACITY must be a positive integer.");
}

if (
  SELECTED_SCENARIO === "near-capacity" &&
  __ENV.LOAD_ALLOW_CACHE_EVICTION !== "true"
) {
  throw new Error(
    "Set LOAD_ALLOW_CACHE_EVICTION=true on an isolated test stack.",
  );
}

if (
  SELECTED_SCENARIO === "threshold-changes" &&
  __ENV.LOAD_ALLOW_THRESHOLD_CHANGES !== "true"
) {
  throw new Error(
    "Set LOAD_ALLOW_THRESHOLD_CHANGES=true on an isolated test stack.",
  );
}
