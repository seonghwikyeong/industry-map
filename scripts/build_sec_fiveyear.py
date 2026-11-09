#!/usr/bin/env python3
"""Build 5-year quarterly time series directly from SEC EDGAR XBRL companyfacts.
No interpolation, no projections, no fiscal-year/calendar-year substitutions.
Only SEC filings published on or before the run date are eligible.
"""
import datetime as dt
import json
import os
import pathlib
import sys
import time
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
AS_OF = dt.date.today()
START = AS_OF.replace(year=AS_OF.year - 5) if AS_OF.month != 2 or AS_OF.day != 29 else AS_OF.replace(year=AS_OF.year - 5, day=28)
ENDPOINT = "https://data.sec.gov/api/xbrl/companyfacts/CIK{:010d}.json"
HEADERS = {
    "User-Agent": "AI Industry Map Research 122859906+seonghwikyeong@users.noreply.github.com (https://github.com/seonghwikyeong/industry-map)",
    "Accept": "application/json",
}
# Publicly listed issuers; the SEC listing is still consulted for each CIK.
TICKERS = (
    "MSFT AMZN GOOGL META ORCL NVDA AMD AVGO MRVL MU INTC AMAT LRCX KLAC AMKR ANET "
    "CSCO COHR LITE DELL SMCI HPE VRT ETN GEV CARR TT PWR CEG VST NEE WMB CRWV"
).split()
ALIASES = {"GOOGL": {"GOOGL", "GOOG"}}
CONCEPTS = {
    "revenue": ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax",
                "RevenueFromContractWithCustomerIncludingAssessedTax", "SalesRevenueNet"],
    "grossProfit": ["GrossProfit"],
    "operatingIncome": ["OperatingIncomeLoss"],
    "netIncome": ["NetIncomeLoss", "ProfitLoss"],
    "eps": ["EarningsPerShareDiluted"],
    "researchAndDevelopment": ["ResearchAndDevelopmentExpense",
                               "ResearchAndDevelopmentExpenseExcludingAcquiredInProcessCost"],
    "operatingCashFlow": ["NetCashProvidedByUsedInOperatingActivities",
                          "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations"],
    "capex": ["PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsToAcquireProductiveAssets"],
    "stockBasedCompensation": ["ShareBasedCompensation"],
    "cash": ["CashAndCashEquivalentsAtCarryingValue"],
    "assets": ["Assets"],
    "liabilities": ["Liabilities"],
    "equity": ["StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"],
    "inventory": ["InventoryNet"],
    "costOfRevenue": ["CostOfRevenue", "CostOfGoodsAndServicesSold"],
    "operatingExpenses": ["OperatingExpenses"],
    "sellingGeneralAdministrative": ["SellingGeneralAndAdministrativeExpense"],
    "interestExpense": ["InterestExpense", "InterestExpenseNonoperating"],
    "investingCashFlow": ["NetCashProvidedByUsedInInvestingActivities"],
    "financingCashFlow": ["NetCashProvidedByUsedInFinancingActivities"],
    "depreciationAmortization": ["DepreciationDepletionAndAmortization", "DepreciationAndAmortization"],
    "dividendsPaid": ["PaymentsOfDividends", "PaymentsOfDividendsCommonStock"],
    "shareRepurchases": ["PaymentsForRepurchaseOfCommonStock"],
    "accountsReceivable": ["AccountsReceivableNetCurrent", "ReceivablesNetCurrent"],
    "currentAssets": ["AssetsCurrent"],
    "currentLiabilities": ["LiabilitiesCurrent"],
    "longTermDebt": ["LongTermDebtNoncurrent", "LongTermDebt"],
    "shortTermDebt": ["ShortTermBorrowings", "DebtCurrent"],
    "retainedEarnings": ["RetainedEarningsAccumulatedDeficit"],
}
INSTANT_KEYS = {"cash", "assets", "liabilities", "equity", "inventory", "accountsReceivable", "currentAssets", "currentLiabilities", "longTermDebt", "shortTermDebt", "retainedEarnings"}
UNIT = {"eps": "USD/share"}
TIMEOUT = 28


def fetch(url):
    last = None
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=TIMEOUT) as response:
                return json.load(response)
        except (urllib.error.URLError, TimeoutError, ValueError) as exc:
            last = exc
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"{url}: {last}")


def dated(s):
    try:
        return dt.date.fromisoformat(s)
    except (TypeError, ValueError):
        return None


def usable(items, unit, instant):
    valid = []
    for item in items:
        if item.get("form") not in ("10-Q", "10-K", "10-Q/A", "10-K/A"):
            continue
        end = dated(item.get("end"))
        filed = dated(item.get("filed"))
        if not end or not filed or end > AS_OF or filed > AS_OF or end < START - dt.timedelta(days=420):
            continue
        start = dated(item.get("start"))
        duration = (end - start).days + 1 if start else 0
        if instant and start:
            continue
        if not instant and not (58 <= duration <= 396):
            continue
        value = item.get("val")
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            continue
        valid.append(dict(end=end, start=start, filed=filed, duration=duration,
                          value=value, accn=item.get("accn", ""), fy=item.get("fy"),
                          fp=item.get("fp"), unit=unit))
    return valid


def select_facts(gaap, tags, instant, unit):
    # Choose the single best covered concept; never sum competing revenue tags.
    best = []
    best_score = -1
    for priority, tag in enumerate(tags):
        raw = gaap.get(tag, {}).get("units", {}).get(unit, [])
        candidates = usable(raw, unit, instant)
        recent_ends = {x["end"] for x in candidates if x["end"] >= START}
        # Prefer broad coverage; priority breaks ties.
        score = len(recent_ends) * 100 - priority
        if score > best_score:
            best, best_score = candidates, score
    return best


def latest_by_key(records, key_fn):
    output = {}
    for r in records:
        key = key_fn(r)
        prev = output.get(key)
        if prev is None or (r["filed"], r.get("accn", "")) > (prev["filed"], prev.get("accn", "")):
            output[key] = r
    return output


def point(record, value=None, derived=False, note=""):
    accn = record["accn"]
    src = ("https://www.sec.gov/Archives/edgar/data/{}/{}".format(
        CURRENT_CIK, accn.replace("-", "")) + "/") if accn else "https://www.sec.gov/edgar/search/"
    return {
        "end": record["end"].isoformat(),
        "period": record["end"].isoformat() + " quarter-end",
        "value": round((record["value"] if value is None else value) /
                       (1 if CURRENT_KEY == "eps" else 1_000_000), 6),
        "source": src,
        "kind": "derived" if derived else "reported",
        "filed": record["filed"].isoformat(),
        **({"note": note} if note else {}),
    }


def quarterly(records, derive_cumulative=True):
    direct = latest_by_key([r for r in records if 58 <= r["duration"] <= 122],
                           lambda r: r["end"])
    ytd = latest_by_key([r for r in records if 150 <= r["duration"] <= 322],
                        lambda r: (r["start"], r["end"]))
    annual = latest_by_key([r for r in records if 330 <= r["duration"] <= 396],
                           lambda r: (r["start"], r["end"]))
    combined = dict(direct)
    # Derive Q2/Q3 from the year-to-date values only if no discrete filing exists.
    for (start, end), rec in sorted(ytd.items(), key=lambda x: x[0][1]) if derive_cumulative else []:
        if end in combined:
            continue
        prior = [r for (s, e), r in ytd.items()
                 if s == start and 58 <= (end - e).days <= 122 and e < end]
        prior += [r for r in direct.values()
                  if r["start"] == start and 58 <= (end - r["end"]).days <= 122]
        if not prior:
            continue
        p = max(prior, key=lambda x: x["end"])
        if (end - p["end"]).days < 58:
            continue
        new = dict(rec, value=rec["value"] - p["value"])
        new["derived_note"] = "Same-fiscal-year YTD difference; SEC filing accessions: " + str(p["accn"]) + ", " + str(rec["accn"])
        combined[end] = new
    # Q4 = full fiscal-year cumulative minus Q3 YTD, matched by same start.
    for (start, end), rec in annual.items() if derive_cumulative else []:
        if end in combined:
            continue
        prev = [r for (s, e), r in ytd.items()
                if s == start and 58 <= (end - e).days <= 125 and 220 <= r["duration"] <= 322]
        if not prev:
            continue
        p = max(prev, key=lambda x: x["end"])
        new = dict(rec, value=rec["value"] - p["value"])
        new["derived_note"] = "Q4 derived from same-year FY minus Q3 YTD (SEC XBRL)"
        combined[end] = new
    return [combined[k] for k in sorted(combined) if START <= k <= AS_OF][-21:]


def balance(records):
    found = latest_by_key(records, lambda r: r["end"])
    return [found[k] for k in sorted(found) if START <= k <= AS_OF][-21:]


def company_series(doc, cik):
    global CURRENT_CIK, CURRENT_KEY
    CURRENT_CIK = cik
    gaap = doc.get("facts", {}).get("us-gaap", {})
    result = {}
    for key, tags in CONCEPTS.items():
        CURRENT_KEY = key
        unit = "USD/shares" if key == "eps" else "USD"
        raw = select_facts(gaap, tags, key in INSTANT_KEYS, unit)
        chosen = balance(raw) if key in INSTANT_KEYS else quarterly(raw, derive_cumulative=(key != "eps"))
        points = [point(r, derived="derived_note" in r, note=r.get("derived_note", "")) for r in chosen]
        if len(points) < 2:
            continue
        result[key] = {
            "unit": UNIT.get(key, "USD million"),
            "frequency": "quarterly" if key not in INSTANT_KEYS else "quarterly instant",
            "basis": "SEC EDGAR companyfacts: 10-Q / 10-K, per-filing provenance",
            "points": points,
        }
    # GAAP identities are permitted, but are labelled Derived with same-period provenance.
    if "grossProfit" not in result and "revenue" in result and "costOfRevenue" in result:
        a = {p["end"]: p for p in result["revenue"]["points"]}
        out = []
        for p in result["costOfRevenue"]["points"]:
            if p["end"] in a:
                out.append({**p, "value": round(a[p["end"]]["value"] - p["value"], 6),
                            "kind": "derived", "note": "Revenue minus cost of revenue, SEC XBRL same quarter"})
        if len(out) >= 2:
            result["grossProfit"] = {"unit": "USD million", "frequency": "quarterly",
                                     "basis": "Derived from SEC XBRL reported GAAP values", "points": out}
    if "liabilities" not in result and "assets" in result and "equity" in result:
        a = {p["end"]: p for p in result["assets"]["points"]}
        out = []
        for p in result["equity"]["points"]:
            if p["end"] in a:
                out.append({**p, "value": round(a[p["end"]]["value"] - p["value"], 6),
                            "kind": "derived", "note": "Assets minus equity, SEC XBRL same balance-sheet date"})
        if len(out) >= 2:
            result["liabilities"] = {"unit": "USD million", "frequency": "quarterly instant",
                                      "basis": "Derived from SEC XBRL balance-sheet identity", "points": out}
    if "revenue" in result:
        points = sorted(result["revenue"]["points"], key=lambda p: p["end"])
        out = []
        for p in points:
            here = dt.date.fromisoformat(p["end"])
            previous = [(abs((here - dt.date.fromisoformat(q["end"])).days - 365), q)
                        for q in points if 330 <= (here - dt.date.fromisoformat(q["end"])).days <= 400]
            if previous:
                old = min(previous, key=lambda x: x[0])[1]
                if old["value"] != 0:
                    out.append({**p, "value": round((p["value"] / old["value"] - 1) * 100, 5),
                                "kind": "derived", "note": "SEC XBRL quarterly revenue year-on-year growth"})
        if len(out) >= 2:
            result["yoyGrowth"] = {"unit": "%", "frequency": "quarterly",
                                   "basis": "Derived from SEC XBRL same-quarter YoY revenue", "points": out}
    # Financial ratios derived only from same-date, same-basis USD amounts.
    revenue = {p["end"]: p for p in result.get("revenue", {}).get("points", [])}
    for numerator, output in (("grossProfit", "grossMargin"), ("operatingIncome", "operatingMargin"), ("netIncome", "netMargin")):
        ratios = []
        for p in result.get(numerator, {}).get("points", []):
            den = revenue.get(p["end"])
            if not den or den["value"] == 0:
                continue
            ratios.append({**p, "value": round(100 * p["value"] / den["value"], 5),
                           "kind": "derived", "note": numerator + " / revenue × 100 (same quarter)"})
        if len(ratios) >= 2:
            result[output] = {"unit": "%", "frequency": "quarterly",
                              "basis": "Derived from SEC XBRL same-quarter results", "points": ratios}
    ocf = {p["end"]: p for p in result.get("operatingCashFlow", {}).get("points", [])}
    fcf = []
    for p in result.get("capex", {}).get("points", []):
        if p["end"] in ocf:
            fcf.append({**p, "value": round(ocf[p["end"]]["value"] - p["value"], 5),
                        "kind": "derived", "note": "Operating cash flow minus capital expenditure (SEC XBRL)"})
    if len(fcf) >= 2:
        result["freeCashFlow"] = {"unit": "USD million", "frequency": "quarterly",
                                  "basis": "Derived from SEC XBRL OCF and Capex", "points": fcf}
    return result


def main():
    tickers = fetch("https://www.sec.gov/files/company_tickers.json")
    mapping = {}
    for v in tickers.values():
        mapping.setdefault(v["ticker"].upper(), int(v["cik_str"]))
    prior_path = ROOT / "timeseries-sec5y.json"
    previous = json.loads(prior_path.read_text()) if prior_path.exists() else {"companies": {}}
    companies = {}
    errors = {}
    for t in TICKERS:
        matches = ALIASES.get(t, {t})
        cik = next((mapping[x] for x in matches if x in mapping), None)
        if not cik:
            errors[t] = "ticker absent from SEC ticker listing"
            continue
        try:
            facts = fetch(ENDPOINT.format(cik))
            series = company_series(facts, cik)
            if series:
                companies[t] = series
                total = sum(len(item["points"]) for item in series.values())
                print(t, len(series), "series", total, "points", flush=True)
            else:
                errors[t] = "no eligible USD US-GAAP SEC XBRL facts"
        except Exception as e:
            errors[t] = str(e)
            # Preserve previously verified data on transient SEC outages.
            if t in previous.get("companies", {}):
                companies[t] = previous["companies"][t]
        time.sleep(0.22)  # Under SEC fair-access limit.
    out = {
        "generated_at": AS_OF.isoformat(),
        "window_years": 5,
        "source": "SEC EDGAR companyfacts; authentic as-filed values only",
        "description": "Quarterly SEC XBRL; no interpolation. Q4 and YTD discrete cash flow differences explicitly tagged Derived.",
        "companies": companies,
        "errors": errors,
    }
    count = sum(len(p["points"]) for c in companies.values() for p in c.values())
    if count < 100:
        raise RuntimeError(f"SEC ingestion yielded only {count} points; refusing to overwrite valid cache")
    prior_path.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n")
    print("TOTAL", len(companies), "companies", count, "points", "errors", errors)


if __name__ == "__main__":
    main()
