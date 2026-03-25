from __future__ import annotations

import argparse
import json
import math
import statistics
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime, UTC
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


DEFAULT_WEB_BASE = "http://127.0.0.1:3000"
DEFAULT_API_BASE = "http://127.0.0.1:8000"


@dataclass(frozen=True)
class Scenario:
    name: str
    url: str
    headers: dict[str, str]


def _request_json(url: str, *, method: str = "GET", headers: dict[str, str] | None = None, body: bytes | None = None) -> tuple[int, bytes]:
    request = Request(url=url, method=method, headers=headers or {}, data=body)
    with urlopen(request, timeout=20) as response:
        return response.status, response.read()


def fetch_demo_token(api_base: str, identifier: str, password: str) -> str:
    payload = json.dumps({"identifier": identifier, "password": password}).encode("utf-8")
    status, raw = _request_json(
        f"{api_base}/api/v1/auth/login",
        method="POST",
        headers={"Content-Type": "application/json"},
        body=payload,
    )
    if status != 200:
        raise RuntimeError(f"Login failed with status {status}")
    data = json.loads(raw.decode("utf-8"))
    token = data.get("access_token")
    if not isinstance(token, str) or not token:
        raise RuntimeError("Access token missing in login response")
    return token


def percentile(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = max(0, min(len(ordered) - 1, math.ceil((p / 100) * len(ordered)) - 1))
    return ordered[index]


def single_request(url: str, headers: dict[str, str]) -> dict[str, Any]:
    started = time.perf_counter()
    try:
        status, raw = _request_json(url, headers=headers)
        elapsed_ms = (time.perf_counter() - started) * 1000
        return {
            "ok": 200 <= status < 400,
            "status": status,
            "elapsed_ms": round(elapsed_ms, 2),
            "bytes": len(raw),
            "error": None,
        }
    except HTTPError as exc:
        elapsed_ms = (time.perf_counter() - started) * 1000
        return {
            "ok": False,
            "status": exc.code,
            "elapsed_ms": round(elapsed_ms, 2),
            "bytes": 0,
            "error": f"HTTPError {exc.code}",
        }
    except URLError as exc:
        elapsed_ms = (time.perf_counter() - started) * 1000
        return {
            "ok": False,
            "status": None,
            "elapsed_ms": round(elapsed_ms, 2),
            "bytes": 0,
            "error": f"URLError {exc.reason}",
        }
    except Exception as exc:  # pragma: no cover - operational path
        elapsed_ms = (time.perf_counter() - started) * 1000
        return {
            "ok": False,
            "status": None,
            "elapsed_ms": round(elapsed_ms, 2),
            "bytes": 0,
            "error": str(exc),
        }


def run_level(scenario: Scenario, *, concurrency: int, total_requests: int) -> dict[str, Any]:
    started = time.perf_counter()
    results: list[dict[str, Any]] = []
    lock = threading.Lock()

    def job() -> dict[str, Any]:
        return single_request(scenario.url, scenario.headers)

    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = [executor.submit(job) for _ in range(total_requests)]
        for future in as_completed(futures):
            result = future.result()
            with lock:
                results.append(result)

    total_duration = time.perf_counter() - started
    latencies = [float(item["elapsed_ms"]) for item in results]
    success_count = sum(1 for item in results if item["ok"])
    error_count = total_requests - success_count
    status_counts: dict[str, int] = {}
    for item in results:
        key = str(item["status"])
        status_counts[key] = status_counts.get(key, 0) + 1

    return {
        "scenario": scenario.name,
        "concurrency": concurrency,
        "requests": total_requests,
        "success_count": success_count,
        "error_count": error_count,
        "success_rate": round((success_count / total_requests) * 100, 2) if total_requests else 0.0,
        "duration_seconds": round(total_duration, 2),
        "throughput_rps": round(total_requests / total_duration, 2) if total_duration else 0.0,
        "latency_ms": {
            "avg": round(statistics.mean(latencies), 2) if latencies else 0.0,
            "p50": round(percentile(latencies, 50), 2),
            "p95": round(percentile(latencies, 95), 2),
            "max": round(max(latencies), 2) if latencies else 0.0,
        },
        "status_counts": status_counts,
        "sample_errors": [item["error"] for item in results if item["error"]][:5],
    }


def build_scenarios(web_base: str, api_base: str, bearer_token: str) -> list[Scenario]:
    return [
        Scenario(name="web_home", url=f"{web_base}/", headers={}),
        Scenario(name="api_home_content", url=f"{api_base}/api/v1/home-content", headers={}),
        Scenario(
            name="api_products_search",
            url=f"{api_base}/api/v1/products/search?limit=12&offset=0&sort=newest",
            headers={},
        ),
        Scenario(
            name="api_storefronts",
            url=f"{api_base}/api/v1/storefronts?limit=24&storefront_tier=premium",
            headers={},
        ),
        Scenario(
            name="api_auth_me",
            url=f"{api_base}/api/v1/auth/me",
            headers={"Authorization": f"Bearer {bearer_token}"},
        ),
    ]


def write_report(report: dict[str, Any], output_dir: Path) -> tuple[Path, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
    json_path = output_dir / f"amazer_load_test_{timestamp}.json"
    md_path = output_dir / f"amazer_load_test_{timestamp}.md"
    json_path.write_text(json.dumps(report, indent=2, ensure_ascii=True), encoding="utf-8")

    lines = [
        "# AMAZER Load Test Report",
        "",
        f"- Generated at: `{report['generated_at_utc']}`",
        f"- Web base: `{report['web_base']}`",
        f"- API base: `{report['api_base']}`",
        f"- Concurrency levels: `{', '.join(map(str, report['concurrency_levels']))}`",
        f"- Requests per level: `{report['requests_per_level']}`",
        "",
    ]
    for result in report["results"]:
        lines.extend(
            [
                f"## {result['scenario']} @ {result['concurrency']} users",
                "",
                f"- Success rate: `{result['success_rate']}%`",
                f"- Throughput: `{result['throughput_rps']} req/s`",
                f"- Avg latency: `{result['latency_ms']['avg']} ms`",
                f"- P50 latency: `{result['latency_ms']['p50']} ms`",
                f"- P95 latency: `{result['latency_ms']['p95']} ms`",
                f"- Max latency: `{result['latency_ms']['max']} ms`",
                f"- Status counts: `{result['status_counts']}`",
                "",
            ]
        )
    md_path.write_text("\n".join(lines), encoding="utf-8")
    return json_path, md_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Run a practical concurrent load test for AMAZER.")
    parser.add_argument("--web-base", default=DEFAULT_WEB_BASE)
    parser.add_argument("--api-base", default=DEFAULT_API_BASE)
    parser.add_argument("--concurrency", default="1,5,10,20,40")
    parser.add_argument("--requests-per-level", type=int, default=40)
    parser.add_argument(
        "--output-dir",
        default=r"C:\Users\User\Documents\amazer donnee\load-tests",
    )
    parser.add_argument("--login-identifier", default="demo.client@amazer.demo")
    parser.add_argument("--login-password", default="AmazerDemo2026!")
    args = parser.parse_args()

    levels = [int(chunk.strip()) for chunk in args.concurrency.split(",") if chunk.strip()]
    token = fetch_demo_token(args.api_base, args.login_identifier, args.login_password)
    scenarios = build_scenarios(args.web_base, args.api_base, token)

    results: list[dict[str, Any]] = []
    for scenario in scenarios:
        for level in levels:
            results.append(run_level(scenario, concurrency=level, total_requests=args.requests_per_level))

    report = {
        "generated_at_utc": datetime.now(UTC).isoformat(),
        "web_base": args.web_base,
        "api_base": args.api_base,
        "concurrency_levels": levels,
        "requests_per_level": args.requests_per_level,
        "results": results,
    }
    json_path, md_path = write_report(report, Path(args.output_dir))
    print(f"JSON report: {json_path}")
    print(f"Markdown report: {md_path}")


if __name__ == "__main__":
    main()
