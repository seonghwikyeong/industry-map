#!/usr/bin/env python3
"""Five years of company-reported Taiwan MOPS consolidated monthly revenues.
Source: TWSE MOPS bulk monthly reports (Big5), Open Government Data License 1.0.
Raw monthly values are NTD thousand; output is NTD million (divide by 1,000).
"""
import calendar
import datetime as dt
import json
import pathlib
import re
import time
import urllib.error
import urllib.request
from html.parser import HTMLParser

ROOT = pathlib.Path(__file__).resolve().parents[1]
TODAY = dt.date.today()
START = dt.date(TODAY.year - 5, TODAY.month, 1)
TICKERS = {"2330": "TSM", "3711": "ASE", "2382": "QUANTA",
           "3231": "WISTRON", "2317": "FOXCONN"}
HEADERS = {"User-Agent": "AI Industry Map financial research (https://github.com/seonghwikyeong/industry-map/issues)",
           "Accept": "text/html"}
MOPS = "https://mopsov.twse.com.tw/nas/t21/sii/t21sc03_{}_{}_0.html"


class TableRows(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.rows = []
        self.tr = False
        self.in_cell = False
        self.cells = []
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag == "tr":
            self.tr = True
            self.cells = []
        if self.tr and tag in ("td", "th"):
            self.in_cell = True
            self.parts = []

    def handle_data(self, data):
        if self.in_cell:
            self.parts.append(data)

    def handle_endtag(self, tag):
        if tag in ("td", "th") and self.in_cell:
            self.cells.append("".join(self.parts).strip())
            self.in_cell = False
        if tag == "tr" and self.tr:
            if len(self.cells) >= 4:
                self.rows.append(self.cells[:])
            self.tr = False
            self.in_cell = False


def fetch(url):
    error = None
    for attempt in range(3):
        try:
            request = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(request, timeout=38) as response:
                body = response.read()
                return body.decode("big5", errors="replace")
        except (urllib.error.URLError, TimeoutError) as exc:
            error = exc
            time.sleep(1 + attempt * 2)
    raise RuntimeError(str(error))


def parse_revenue(table, ticker):
    parser = TableRows()
    parser.feed(table)
    for row in parser.rows:
        code = row[0].strip().replace(" ", "")
        if code != ticker:
            continue
        raw = row[2].replace(",", "").replace(" ", "").replace("\u3000", "")
        raw = re.sub(r"\([^)]*\)", "", raw) if raw.endswith("%") else raw
        if not re.fullmatch(r"-?\d+(?:\.\d+)?", raw):
            return None
        return float(raw) / 1000.0  # NTD thousand -> NTD million
    return None


def month_ends():
    y, m = START.year, START.month
    while (y, m) < (TODAY.year, TODAY.month):  # the current month's numbers are not filed
        end = dt.date(y, m, calendar.monthrange(y, m)[1])
        if end >= TODAY - dt.timedelta(days=365 * 5 + 2):
            yield y, m, end
        if m == 12:
            y, m = y + 1, 1
        else:
            m += 1


def main():
    histories = {v: [] for v in TICKERS.values()}
    errors = []
    for year, month, end in month_ends():
        url = MOPS.format(year - 1911, month)
        try:
            data = fetch(url)
            for code, ticker in TICKERS.items():
                value = parse_revenue(data, code)
                if value is not None:
                    histories[ticker].append({
                        "end": end.isoformat(), "period": f"{year}-{month:02}",
                        "value": round(value, 6), "kind": "reported", "source": url
                    })
        except Exception as exc:
            errors.append(f"{year}-{month:02}: {exc}")
        time.sleep(.24)
    companies = {}
    for ticker, monthly in histories.items():
        if not monthly:
            continue
        monthly.sort(key=lambda p: p["end"])
        quarterly = []
        groups = {}
        for point in monthly:
            year, month = map(int, point["end"][:7].split("-"))
            key = (year, (month - 1) // 3 + 1)
            groups.setdefault(key, []).append(point)
        for (year, q), group in sorted(groups.items()):
            if len(group) != 3:
                continue
            quarterly.append({
                "end": group[-1]["end"], "period": f"{year} Q{q}",
                "value": round(sum(p["value"] for p in group), 6),
                "source": group[-1]["source"], "kind": "derived",
                "note": "Sum of 3 official MOPS monthly consolidated revenue releases, NTD million",
            })
        companies[ticker] = {
            "monthlyRevenue": {
                "unit": "TWD million", "frequency": "monthly",
                "basis": "Taiwan TWSE MOPS monthly consolidated revenue; raw NTD thousand / 1000",
                "points": monthly,
            },
            "quarterlyRevenue": {
                "unit": "TWD million", "frequency": "quarterly",
                "basis": "Derived from 3 official MOPS reported monthly revenues, NTD million",
                "points": quarterly,
            }
        }
        print(ticker, len(monthly), "months", len(quarterly), "quarters", flush=True)
    outfile = ROOT / "timeseries-twse5y.json"
    previous = json.loads(outfile.read_text()) if outfile.exists() else {"companies": {}}
    for ticker, metrics in previous.get("companies", {}).items():
        if ticker not in companies or len(companies[ticker]["monthlyRevenue"]["points"]) < len(metrics.get("monthlyRevenue", {}).get("points", [])):
            companies[ticker] = metrics  # do not regress coverage on temporary MOPS gaps
    count = sum(len(v["monthlyRevenue"]["points"]) for v in companies.values())
    if count < 80:
        raise RuntimeError(f"Only {count} TWSE points fetched; preserving old file. Errors: {errors[:5]}")
    outfile.write_text(json.dumps({
        "generated_at": TODAY.isoformat(), "window_years": 5,
        "source": "TWSE MOPS historical company monthly revenues (Open Government Data License 1.0)",
        "companies": companies, "errors": errors[:20],
    }, ensure_ascii=False, separators=(",", ":")) + "\n")
    print("TOTAL", len(companies), "issuers", count, "monthly points", flush=True)


if __name__ == "__main__":
    main()
