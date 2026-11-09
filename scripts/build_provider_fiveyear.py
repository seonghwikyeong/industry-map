#!/usr/bin/env python3
"""Persist five years of quarterly, sourced US-GAAP statements from TGMCharts.

TGMCharts normalizes SEC EDGAR companyfacts with per-concept source filing IDs.
This provider is a fallback when SEC.gov denies GitHub Actions IPs (403).
No private-company estimates, forecasts, interpolation, or silent zero-filling.
"""
import datetime as dt
import json
import pathlib
import time
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "timeseries-sec5y.json"
TODAY = dt.datetime.now(dt.timezone.utc).date()
CUTOFF = TODAY.replace(year=TODAY.year - 5, day=min(TODAY.day, 28)) if TODAY.month == 2 else TODAY.replace(year=TODAY.year - 5)
TICKERS = ("MSFT AMZN GOOGL META ORCL NVDA AMD AVGO MRVL MU INTC AMAT LRCX KLAC "
           "AMKR ANET CSCO COHR LITE DELL SMCI HPE VRT ETN GEV CARR TT PWR "
           "CEG VST NEE WMB CRWV IREN NBIS").split()
GROUPS = ("income-statement", "balance-sheet", "cash-flow")
TAG_GROUP = {
    "income-statement": {
        "revenue": "revenue",
        "costOfRevenue": "costOfRevenue",
        "grossProfit": "grossProfit",
        "operatingIncome": "operatingIncome",
        "netIncome": "netIncome",
        "epsDiluted": "eps",
        "epsBasic": "epsBasic",
        "researchAndDevelopmentExpenses": "researchAndDevelopment",
        "operatingExpenses": "operatingExpenses",
        "sellingGeneralAndAdministrativeExpenses": "sellingGeneralAdministrative",
        "interestExpense": "interestExpense",
        "pretaxIncome": "pretaxIncome",
        "incomeTaxExpense": "incomeTaxExpense",
    },
    "balance-sheet": {
        "cashAndCashEquivalents": "cash",
        "shortTermInvestments": "shortTermInvestments",
        "netReceivables": "accountsReceivable",
        "inventory": "inventory",
        "totalCurrentAssets": "currentAssets",
        "propertyPlantEquipmentNet": "propertyPlantEquipment",
        "goodwill": "goodwill",
        "intangibleAssets": "intangibleAssets",
        "totalAssets": "assets",
        "accountPayables": "accountsPayable",
        "totalCurrentLiabilities": "currentLiabilities",
        "shortTermDebt": "shortTermDebt",
        "longTermDebt": "longTermDebt",
        "totalLiabilities": "liabilities",
        "totalStockholdersEquity": "equity",
        "retainedEarnings": "retainedEarnings",
    },
    "cash-flow": {
        "operatingCashFlow": "operatingCashFlow",
        "capitalExpenditure": "capex",
        "depreciationAndAmortization": "depreciationAmortization",
        "stockBasedCompensation": "stockBasedCompensation",
        "investingCashFlow": "investingCashFlow",
        "acquisitionsNet": "acquisitionsNet",
        "financingCashFlow": "financingCashFlow",
        "dividendsPaid": "dividendsPaid",
        "commonStockRepurchased": "shareRepurchases",
        "debtIssuance": "debtIssuance",
        "debtRepayment": "debtRepayment",
    },
}
EPS = {"eps", "epsBasic"}
MONEY_KEYS = {key for mapping in TAG_GROUP.values() for key in mapping.values()} - EPS
AGENT = "AIIndustryMap/5.9 historical research (https://github.com/seonghwikyeong/industry-map)"
HEADERS = {"User-Agent": AGENT, "Accept": "application/json", "Origin": "https://seonghwikyeong.github.io"}


def get(url):
    for attempt in range(3):
        try:
            request = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(request, timeout=40) as resp:
                return json.load(resp)
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, ValueError) as exc:
            if attempt == 2:
                raise RuntimeError(f"{type(exc).__name__}: {exc}") from exc
            time.sleep(2 + attempt * 4)


def date(value):
    try:
        return dt.date.fromisoformat(value)
    except (ValueError, TypeError):
        return None


def money(x):
    return round(x / 1_000_000, 6)


def source(cik, ticker, provenance):
    accn = (provenance or {}).get("accn")
    if cik and accn:
        return f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{accn.replace('-', '')}/"
    return "https://tgmcharts.com/stocks/" + ticker + "/financials"


def collect(rows, cik, ticker, group, storage):
    mapping = TAG_GROUP[group]
    for row in rows:
        if not isinstance(row, dict):
            continue
        end = date(row.get("periodEnd"))
        filed = date(row.get("filed"))
        if end is None or end < CUTOFF or end > TODAY or (filed is not None and filed > TODAY):
            continue
        if not str(row.get("fiscalPeriod", "")).startswith("Q"):
            continue
        metrics = row.get("metrics") or {}
        prov = row.get("provenance") or {}
        for remote_key, key in mapping.items():
            value = metrics.get(remote_key)
            if not isinstance(value, (int, float)) or isinstance(value, bool):
                continue
            p = prov.get(remote_key) or {}
            if not isinstance(p, dict):
                p = {}
            pfiled = date(p.get("filed")) or filed
            if pfiled and pfiled > TODAY:
                continue
            converted = value if key in EPS else money(value)
            item = {
                "end": end.isoformat(),
                "period": f"FY{str(row.get('fiscalYear', ''))[-2:]} {row['fiscalPeriod']}",
                "value": round(converted, 6),
                "source": source(cik, ticker, p),
                "kind": "derived" if p.get("derived") else "reported",
                "filed": (pfiled or filed).isoformat() if pfiled or filed else None,
            }
            if p.get("derived"):
                item["note"] = f"SEC-XBRL YTD difference: {p['derived']}"
            storage.setdefault(key, {})[end.isoformat()] = item


def calculated(series):
    def derive(key, base, denom, f, note, unit):
        a = series.get(base, {}).get("points", [])
        b = {p["end"]: p for p in series.get(denom, {}).get("points", [])}
        points = []
        for p in a:
            q = b.get(p["end"])
            if not q or q["value"] == 0:
                continue
            points.append({**p, "value": round(f(p["value"], q["value"]), 6),
                           "kind": "derived", "note": note})
        if len(points) >= 2:
            series[key] = {"unit": unit, "frequency": "quarterly", "basis": "Derived from same-quarter SEC XBRL",
                           "points": points}
    derive("grossMargin", "grossProfit", "revenue", lambda x, y: x / y * 100, "Gross profit / revenue", "%")
    derive("operatingMargin", "operatingIncome", "revenue", lambda x, y: x / y * 100, "Operating income / revenue", "%")
    derive("netMargin", "netIncome", "revenue", lambda x, y: x / y * 100, "Net income / revenue", "%")
    derive("freeCashFlow", "operatingCashFlow", "capex", lambda x, y: x - y, "OCF - capex", "USD million")
    a = series.get("revenue", {}).get("points", [])
    yoy = []
    for p in a:
        x = date(p["end"])
        match = [q for q in a if 345 <= (x - date(q["end"])).days <= 385]
        if not match:
            continue
        q = min(match, key=lambda z: abs((x - date(z["end"])).days - 365))
        if not q["value"]:
            continue
        yoy.append({**p, "value": round((p["value"] / q["value"] - 1) * 100, 6),
                    "kind": "derived", "note": "Year-over-year SEC XBRL revenue growth"})
    if len(yoy) >= 2:
        series["yoyGrowth"] = {"unit": "%", "frequency": "quarterly",
                               "basis": "Derived from SEC XBRL comparable quarters", "points": yoy}


def main():
    previous = json.loads(OUT.read_text()) if OUT.exists() else {}
    existing = previous.get("companies") or {}
    companies = {}
    errors = {}
    total_api_rows = 0
    for ticker in TICKERS:
        staging = {}
        cik = None
        for group in GROUPS:
            url = f"https://tgmcharts.com/api/v1/statements/{ticker}/{group}?period=quarterly&years=5"
            try:
                payload = get(url)
                if payload.get("currency") != "USD":
                    errors[f"{ticker}/{group}"] = "Non-USD XBRL: do not convert"
                    continue
                cik = cik or payload.get("cik")
                rows = payload.get("rows")
                if not isinstance(rows, list):
                    errors[f"{ticker}/{group}"] = payload.get("status", "no rows returned")
                    continue
                total_api_rows += len(rows)
                collect(rows, cik, ticker, group, staging)
            except Exception as e:
                errors[f"{ticker}/{group}"] = str(e)
            time.sleep(.18)
        series = {}
        for key, dated_points in staging.items():
            points = sorted(dated_points.values(), key=lambda p: p["end"])
            if len(points) < 2:
                continue
            unit = "USD/share" if key in EPS else "USD million"
            series[key] = {
                "unit": unit,
                "frequency": "quarterly instant" if key in TAG_GROUP["balance-sheet"].values() else "quarterly",
                "basis": "TGMCharts normalized SEC EDGAR XBRL, filing-level provenance; data by TGMCharts",
                "points": points[-21:],
            }
        calculated(series)
        if series:
            companies[ticker] = series
            print(ticker, len(series), "metrics", sum(len(v["points"]) for v in series.values()), "points", flush=True)
        elif ticker in existing:
            companies[ticker] = existing[ticker]
            errors[ticker] = "Provider unavailable; preserved prior SEC data"
        else:
            errors[ticker] = "No eligible normalized SEC facts; older IR data remains available"
    count = sum(len(s["points"]) for m in companies.values() for s in m.values())
    print("Provider rows", total_api_rows, "companies", len(companies), "points", count, flush=True)
    if count < 100:
        raise RuntimeError(f"Only {count} sourced financial points; refusing to overwrite previous cache")
    payload = {
        "generated_at": TODAY.isoformat(),
        "window_years": 5,
        "source": "TGMCharts normalized SEC EDGAR XBRL. Attribution: data by TGMCharts (https://tgmcharts.com/)",
        "companies": companies,
        "errors": errors,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n")
    print("Coverage complete", len(companies), "issuers", count, "points", flush=True)


if __name__ == "__main__":
    main()
