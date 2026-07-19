import pytest

from app.benchmark.domain.metrics import calculate_metrics, evaluate_thresholds
from app.benchmark.domain.models import BenchmarkObservation


def observations() -> list[BenchmarkObservation]:
    return [
        BenchmarkObservation(True, True, 10, False, 0.95, 100),
        BenchmarkObservation(True, False, 100, True, 0.85),
        BenchmarkObservation(False, True, 20, False, 0.93, 50),
        BenchmarkObservation(False, False, 110, True, 0.20),
    ]


def test_metric_calculations_match_hand_computed_values() -> None:
    metrics = calculate_metrics(
        observations(),
        estimated_cost_per_request_usd=0.01,
        estimated_cost_per_1k_tokens_usd=0.02,
    )

    assert metrics.total_queries == 4
    assert metrics.cache_hits == 2
    assert metrics.cache_misses == 2
    assert metrics.provider_calls == 2
    assert metrics.provider_calls_avoided == 2
    assert metrics.hit_rate == pytest.approx(0.5)
    assert metrics.average_latency_ms == pytest.approx(60)
    assert metrics.median_latency_ms == pytest.approx(60)
    assert metrics.p95_latency_ms == pytest.approx(108.5)
    assert metrics.average_cache_hit_latency_ms == pytest.approx(15)
    assert metrics.average_cache_miss_latency_ms == pytest.approx(105)
    assert metrics.estimated_latency_saved_ms == pytest.approx(180)
    assert metrics.estimated_tokens_saved == 150
    assert metrics.estimated_provider_cost_saved_usd == pytest.approx(0.023)
    assert metrics.false_positive_hits == 1
    assert metrics.false_negative_misses == 1
    assert metrics.precision == pytest.approx(0.5)
    assert metrics.recall == pytest.approx(0.5)
    assert metrics.f1_score == pytest.approx(0.5)


def test_threshold_evaluation_reclassifies_scores_without_defaulting_null() -> None:
    source = [
        *observations(),
        BenchmarkObservation(True, False, 120, True, None),
    ]
    evaluations = evaluate_thresholds(source, [0.90, 0.94])

    lower, higher = evaluations
    assert lower.threshold == pytest.approx(0.90)
    assert lower.provider_calls_avoided == 2
    assert lower.false_positive_hits == 1
    assert lower.false_negative_misses == 2

    assert higher.threshold == pytest.approx(0.94)
    assert higher.provider_calls_avoided == 1
    assert higher.false_positive_hits == 0
    assert higher.false_negative_misses == 2
    assert higher.precision == pytest.approx(1)
    assert higher.recall == pytest.approx(1 / 3)


def test_metrics_report_missing_hit_average_as_null() -> None:
    metrics = calculate_metrics(
        [BenchmarkObservation(False, False, 25, True, None)],
        estimated_cost_per_request_usd=0,
        estimated_cost_per_1k_tokens_usd=0,
    )

    assert metrics.average_cache_hit_latency_ms is None
    assert metrics.average_cache_miss_latency_ms == pytest.approx(25)
    assert metrics.precision == 0
    assert metrics.recall == 0
    assert metrics.f1_score == 0
