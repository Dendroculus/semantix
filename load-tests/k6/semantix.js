import { P95_LIMIT_MS, SELECTED_SCENARIO } from "./config.js";
import {
  clearNamespace,
  readMetrics,
  readThreshold,
  updateThreshold,
} from "./requests.js";
import {
  concurrentIdenticalMiss,
  highCardinality,
  mixedTraffic,
  nearCapacity,
  nearCapacityIterations,
  repeatedIdentical,
  thresholdController,
  thresholdTraffic,
} from "./scenarios.js";

const SINGLE_SCENARIOS = {
  "repeated-identical": {
    executor: "constant-vus",
    exec: "repeatedIdentical",
    vus: 5,
    duration: "20s",
  },
  "mixed-hits-misses": {
    executor: "constant-vus",
    exec: "mixedTraffic",
    vus: 5,
    duration: "20s",
  },
  "concurrent-identical-misses": {
    executor: "per-vu-iterations",
    exec: "concurrentIdenticalMiss",
    vus: 20,
    iterations: 1,
    maxDuration: "1m",
  },
  "high-cardinality": {
    executor: "constant-arrival-rate",
    exec: "highCardinality",
    rate: 10,
    timeUnit: "1s",
    duration: "20s",
    preAllocatedVUs: 10,
    maxVUs: 30,
  },
  "near-capacity": {
    executor: "shared-iterations",
    exec: "nearCapacity",
    vus: 10,
    iterations: nearCapacityIterations,
    maxDuration: "10m",
  },
};

function selectedScenarios() {
  if (SELECTED_SCENARIO === "threshold-changes") {
    return {
      threshold_traffic: {
        executor: "constant-vus",
        exec: "thresholdTraffic",
        vus: 5,
        duration: "20s",
      },
      threshold_controller: {
        executor: "constant-vus",
        exec: "thresholdController",
        vus: 1,
        duration: "20s",
      },
    };
  }

  const scenario = SINGLE_SCENARIOS[SELECTED_SCENARIO];
  if (scenario === undefined) {
    throw new Error(`Unknown SCENARIO: ${SELECTED_SCENARIO}`);
  }
  return { [SELECTED_SCENARIO]: scenario };
}

export const options = {
  scenarios: selectedScenarios(),
  thresholds: {
    checks: ["rate>0.99"],
    http_req_failed: ["rate<0.01"],
    http_req_duration: [`p(95)<${P95_LIMIT_MS}`],
  },
};

export function setup() {
  const runId = `${Date.now()}`;
  const namespace = `phase9-${runId}`;
  clearNamespace(namespace);
  const originalThreshold = readThreshold();
  if (SELECTED_SCENARIO === "threshold-changes") {
    updateThreshold(0.92);
  }
  return { namespace, originalThreshold, runId };
}

export function teardown(data) {
  const metrics = readMetrics();
  console.log(`Semantix metrics: ${JSON.stringify(metrics)}`);
  clearNamespace(data.namespace);
  if (
    SELECTED_SCENARIO === "threshold-changes" &&
    data.originalThreshold !== null
  ) {
    updateThreshold(data.originalThreshold);
  }
}

export {
  concurrentIdenticalMiss,
  highCardinality,
  mixedTraffic,
  nearCapacity,
  repeatedIdentical,
  thresholdController,
  thresholdTraffic,
};
