#!/usr/bin/env python3
"""Build static company news feed for GitHub Pages from Google News RSS.
This is a headline index, not verified article content or investment advice.
No third-party dependencies are required.
"""
import concurrent.futures
import datetime as dt
import email.utils
import hashlib
import html
import json
import pathlib
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "news.json"
UTC = dt.timezone.utc
NOW = dt.datetime.now(UTC)
WINDOW = dt.timedelta(days=7)
LIMIT = 15

QUERIES = {
    "MSFT": '"Microsoft" (Azure OR Copilot OR earnings OR Maia OR OpenAI)',
    "AMZN": '"Amazon" (AWS OR Trainium OR earnings OR AI OR data center)',
    "GOOGL": '"Google" (Alphabet OR TPU OR Gemini OR cloud OR earnings)',
    "META": '"Meta Platforms" (AI OR Llama OR earnings OR capex OR glasses)',
    "ORCL": '"Oracle" (OCI OR cloud OR AI OR data center OR earnings)',
    "OPENAI": '"OpenAI" (ChatGPT OR GPT OR Codex OR funding OR partnership)',
    "ANTH": '"Anthropic" (Claude OR AI OR funding OR partnership)',
    "XAI": '"xAI" (Grok OR Colossus OR AI OR Musk)',
    "NVDA": '"Nvidia" (GPU OR Rubin OR Blackwell OR earnings OR AI)',
    "AMD": '"AMD" (Instinct OR EPYC OR MI400 OR GPU OR earnings)',
    "AVGO": '"Broadcom" (AI OR ASIC OR Tomahawk OR VMware OR earnings)',
    "MRVL": '"Marvell Technology" (AI OR ASIC OR optical OR earnings)',
    "MU": '"Micron" (HBM OR DRAM OR earnings OR memory OR NAND)',
    "SKH": '"SK hynix" (HBM OR memory OR earnings OR DRAM)',
    "SAMSUNG": '"Samsung Electronics" (HBM OR foundry OR earnings OR memory)',
    "TSM": '"TSMC" (CoWoS OR 2nm OR AI OR earnings OR capacity)',
    "INTC": '"Intel" (foundry OR Xeon OR 18A OR earnings OR AI)',
    "ASML": '"ASML" (EUV OR High-NA OR order OR earnings)',
    "AMAT": '"Applied Materials" (semiconductor OR earnings OR deposition)',
    "LRCX": '"Lam Research" (etch OR earnings OR semiconductor OR NAND)',
    "KLAC": '"KLA Corporation" (semiconductor OR inspection OR earnings)',
    "ASE": '"ASE Technology" (packaging OR testing OR earnings)',
    "AMKR": '"Amkor Technology" (packaging OR HBM OR earnings)',
    "ANET": '"Arista Networks" (AI OR Ethernet OR earnings OR switch)',
    "CSCO": '"Cisco" (AI OR Silicon One OR earnings OR network)',
    "COHR": '"Coherent Corp" (optical OR transceiver OR AI OR earnings)',
    "LITE": '"Lumentum" (optical OR laser OR earnings OR AI)',
    "INFN": '"Infinera" (Nokia OR optical OR ICE6 OR acquisition)',
    "DELL": '"Dell Technologies" (AI server OR earnings OR infrastructure)',
    "SMCI": '"Super Micro Computer" (AI OR server OR earnings OR rack)',
    "HPE": '"Hewlett Packard Enterprise" (Juniper OR AI OR earnings OR server)',
    "QUANTA": '"Quanta Computer" (AI server OR rack OR earnings)',
    "WISTRON": '"Wistron" (AI server OR Nvidia OR earnings)',
    "FOXCONN": '"Foxconn" (AI server OR Nvidia OR earnings OR Hon Hai)',
    "VRT": '"Vertiv" (AI OR data center OR liquid cooling OR earnings)',
    "ETN": '"Eaton Corporation" (data center OR power OR earnings)',
    "GEV": '"GE Vernova" (gas turbine OR grid OR earnings OR AI)',
    "CARR": '"Carrier Global" (HVAC OR data center OR earnings)',
    "TT": '"Trane Technologies" (data center OR chiller OR earnings)',
    "PWR": '"Quanta Services" (electric OR grid OR earnings OR data center)',
    "CEG": '"Constellation Energy" (nuclear OR AI OR data center OR earnings)',
    "VST": '"Vistra Corp" (power OR nuclear OR data center OR earnings)',
    "NEE": '"NextEra Energy" (power OR data center OR earnings)',
    "WMB": '"Williams Companies" (natural gas OR pipeline OR earnings)',
    "CRWV": '"CoreWeave" (AI OR GPU OR cloud OR earnings)',
    "IREN": '"IREN Limited" (AI OR GPU OR data center OR earnings)',
    "NBIS": '"Nebius" (GPU OR AI OR cloud OR earnings)',
}

IMPACT = [
    ("실적", r"\b(earnings|revenue|guidance|quarterly|profit|forecast|results|매출|실적)\b"),
    ("AI·제품", r"\b(AI|GPU|HBM|ASIC|chip|semiconductor|TPU|Rubin|Blackwell|product|launch|server|광통신|반도체|데이터센터)\b"),
    ("공급망·수주", r"\b(order|contract|deal|partnership|supply|capacity|customer|factory|fab|expansion|invest|acquisition|buyout|수주|계약|투자)\b"),
]
PATTERNS = [(category, re.compile(expr, re.I)) for category, expr in IMPACT]

def parse_time(raw):
    try:
        date = email.utils.parsedate_to_datetime(raw)
        if date.tzinfo is None:
            date = date.replace(tzinfo=UTC)
        return date.astimezone(UTC)
    except (TypeError, ValueError, IndexError):
        return None

def fetch(ticker, query):
    q = query + " when:7d"
    url = "https://news.google.com/rss/search?" + urllib.parse.urlencode(
        {"q": q, "hl": "en-US", "gl": "US", "ceid": "US:en"}
    )
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (compatible; AIIndustryMapNewsCollector/1.0)",
        "Accept": "application/rss+xml, application/xml, text/xml",
    })
    with urllib.request.urlopen(req, timeout=18) as response:
        body = response.read(2_000_000)
    xml = ET.fromstring(body)
    articles = []
    seen = set()
    for item in xml.findall(".//channel/item"):
        title = html.unescape((item.findtext("title") or "").strip())
        link = (item.findtext("link") or "").strip()
        date = parse_time(item.findtext("pubDate"))
        if not title or not link or not date or not (NOW - WINDOW <= date <= NOW + dt.timedelta(hours=1)):
            continue
        if not link.startswith("https://news.google.com/"):
            continue
        publisher = item.find("source")
        source = html.unescape((publisher.text or "").strip()) if publisher is not None else ""
        if not source and " - " in title:
            title, source = title.rsplit(" - ", 1)
        elif source and title.endswith(" - " + source):
            title = title[:-(len(source) + 3)]
        title = re.sub(r"\s+", " ", title).strip()
        key = re.sub(r"\W+", "", title.casefold())
        if key in seen or len(title) < 12:
            continue
        seen.add(key)
        categories = [k for k, expr in PATTERNS if expr.search(title)]
        priority = 2 if categories else 0
        if any(c in categories for c in ("실적", "공급망·수주")):
            priority += 1
        articles.append({
            "id": hashlib.sha256((ticker + "|" + key).encode()).hexdigest()[:18],
            "title": title[:240],
            "url": link,
            "source": source[:80] or "Google News",
            "published_at": date.isoformat(timespec="seconds").replace("+00:00", "Z"),
            "category": categories[0] if categories else "기업 뉴스",
            "priority": priority
        })
    articles.sort(key=lambda a: (a["priority"], a["published_at"]), reverse=True)
    selected = articles[:LIMIT]
    selected.sort(key=lambda a: a["published_at"], reverse=True)
    return ticker, selected

def main():
    previous = {}
    if OUT.exists():
        try:
            previous = json.loads(OUT.read_text(encoding="utf-8")).get("companies", {})
        except (ValueError, OSError):
            pass
    results = {}
    failures = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        tasks = {pool.submit(fetch, ticker, query): ticker for ticker, query in QUERIES.items()}
        for future in concurrent.futures.as_completed(tasks):
            ticker = tasks[future]
            try:
                _, stories = future.result()
                # Keep recent prior stories when news search is temporarily empty.
                old = previous.get(ticker, [])
                seen = {a["id"] for a in stories}
                for article in old:
                    if article.get("id") in seen:
                        continue
                    published = article.get("published_at", "")
                    try:
                        d = dt.datetime.fromisoformat(published.replace("Z", "+00:00"))
                    except ValueError:
                        continue
                    if NOW - d <= WINDOW and len(stories) < LIMIT:
                        stories.append(article)
                stories.sort(key=lambda a: a["published_at"], reverse=True)
                results[ticker] = stories[:LIMIT]
                print(f"{ticker}: {len(results[ticker])}")
            except Exception as exc:
                failures.append((ticker, str(exc)))
                results[ticker] = previous.get(ticker, [])[:LIMIT]
                print(f"WARNING {ticker}: {exc}")
    if len(failures) == len(QUERIES):
        raise SystemExit("All feeds failed. Keeping existing news.json unchanged.")
    payload = {
        "generated_at": NOW.isoformat(timespec="seconds").replace("+00:00", "Z"),
        "source": "Google News RSS",
        "description": "Public headline discovery, not full-article verification",
        "companies": {ticker: results.get(ticker, []) for ticker in QUERIES}
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Updated {len(results)} companies, {sum(map(len, results.values()))} headlines, {len(failures)} feed errors.")

if __name__ == "__main__":
    main()
