#!/usr/bin/env python3
"""Audit maximum five-year source-backed financial data for all 47 company panels."""
import datetime as dt
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
NOW = dt.date.today()
CUTOFF = NOW.replace(year=NOW.year - 5, day=min(NOW.day, 28)) if NOW.month == 2 else NOW.replace(year=NOW.year - 5)
UNIVERSE = re.findall(r'"([A-Z]{2,8})":\{"period":', (ROOT / "earnings-periods.js").read_text())
assert len(UNIVERSE) == 47, f"Expected 47 industry-map companies, got {len(UNIVERSE)}"


def read(name):
    path = ROOT / name
    return json.loads(path.read_text()).get("companies", {}) if path.exists() else {}


def points_of(record, key, compact=False):
    if compact:
        dates = record.get("dates", [])
        vals = record.get("metrics", {}).get(key, [])
        return [{"end": end, "value": val} for end, val in zip(dates, vals)]
    return record.get(key, {}).get("points", [])


BASE = read("timeseries.json")
COMPACT = read("timeseries-v56.json")
EXTRA = read("timeseries-v58.json")
BOOT = read("timeseries-bootstrap5y.json")
SEC = read("timeseries-sec5y.json")
TWSE = read("timeseries-twse5y.json")
report = []
for ticker in UNIVERSE:
    candidates = []
    for kind, database, compact in (
        ("manual", BASE, False), ("supplement", COMPACT, True),
        ("global", EXTRA, False), ("bootstrap", BOOT, False),
        ("SEC EDGAR", SEC, False), ("TWSE MOPS", TWSE, False),
    ):
        r = database.get(ticker, {})
        keys = r.get("metrics", {}) if compact else r
        for key in keys:
            eligible = [p for p in points_of(r, key, compact)
                        if isinstance(p.get("value"), (int, float)) and
                        re.fullmatch(r"20\d{2}-\d{2}-\d{2}", p.get("end", "")) and
                        CUTOFF.isoformat() <= p["end"] <= NOW.isoformat()]
            if eligible:
                candidates.append((key, kind, len({p["end"] for p in eligible})))
    core = [x for x in candidates if x[0] == "revenue" and x[1] != "TWSE MOPS"]
    tw = [x for x in candidates if x[0] == "quarterlyRevenue"]
    best = max(core or tw or [], key=lambda x: x[2], default=None)
    metric_keys = {item[0] for item in candidates}
    srcs = sorted({item[1] for item in candidates})
    report.append({
        "ticker": ticker, "history_available": bool(candidates),
        "reported_revenue_quarters": best[2] if best else 0,
        "revenue_basis": best[1] if best else None,
        "unique_metric_names": len(metric_keys),
        "raw_source_points_including_overlaps": sum(v[2] for v in candidates),
        "sources": srcs,
    })
summary = {
    "as_of": NOW.isoformat(), "window_start": CUTOFF.isoformat(),
    "universe": len(UNIVERSE),
    "with_any_history": sum(x["history_available"] for x in report),
    "with_revenue_16_plus_quarters": sum(x["reported_revenue_quarters"] >= 16 for x in report),
    "with_revenue_20_plus_quarters": sum(x["reported_revenue_quarters"] >= 20 for x in report),
    "sec_company_count": len(SEC),
    "twse_company_count": len(TWSE),
    "sec_metric_count": sum(len(s) for s in SEC.values()),
    "sec_points": sum(len(v.get("points", [])) for s in SEC.values() for v in s.values()),
}
print(json.dumps(summary, ensure_ascii=False))
for item in report:
    print(item["ticker"], item["reported_revenue_quarters"], "revenue quarters", item["unique_metric_names"], "metrics", ",".join(item["sources"]))
assert summary["universe"] == 47
assert summary["with_any_history"] >= 40
assert summary["sec_points"] >= 10000, "5-year SEC cache must be populated"
(ROOT / "timeseries-coverage.json").write_text(json.dumps({"summary": summary, "companies": report}, ensure_ascii=False, separators=(",", ":")) + "\n")
