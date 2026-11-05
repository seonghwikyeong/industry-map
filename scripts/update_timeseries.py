#!/usr/bin/env python3
"""Collect point-in-time, source-linked US-GAAP financial history from SEC XBRL.
Does not fill non-reported periods, invent product-level revenue, or mix YTD with quarters.
Retains manually sourced segment histories already in timeseries.json.
"""
import concurrent.futures
import datetime as dt
import json
import pathlib
import time
import urllib.request
import urllib.error

ROOT=pathlib.Path(__file__).resolve().parents[1]
DEST=ROOT/"timeseries.json"
TODAY=dt.datetime.now(dt.timezone.utc).date()
UA="AIIndustryMapResearch/1.0 (github.com/seonghwikyeong/industry-map; github-actions[bot]@users.noreply.github.com)"
TICKERS=[
"MSFT","AMZN","GOOGL","META","ORCL","NVDA","AMD","AVGO","MRVL","MU","INTC",
"AMAT","LRCX","KLAC","AMKR","ANET","CSCO","COHR","LITE","DELL","SMCI",
"HPE","VRT","ETN","GEV","CARR","TT","PWR","CEG","VST","NEE","WMB","CRWV",
"IREN","NBIS","ASML","TSM","ASE"
]
ALIASES={"GOOGL":["GOOGL","GOOG"],"IREN":["IREN","IRENQ"],"NBIS":["NBIS"],
"ASML":["ASML"],"TSM":["TSM"],"ASE":["ASX"]}
TAGS={
"revenue":["RevenueFromContractWithCustomerExcludingAssessedTax","Revenues","SalesRevenueNet","RevenueFromContractWithCustomerIncludingAssessedTax","SalesRevenueServicesNet"],
"operatingIncome":["OperatingIncomeLoss"],
"grossProfit":["GrossProfit"],
"netIncome":["NetIncomeLoss","ProfitLoss"],
"eps":["EarningsPerShareDiluted"],
"operatingCashFlow":["NetCashProvidedByUsedInOperatingActivities"],
"capex":["PaymentsToAcquirePropertyPlantAndEquipment","PaymentsToAcquireProductiveAssets"],
"assets":["Assets"],
"liabilities":["Liabilities"],
"cash":["CashAndCashEquivalentsAtCarryingValue"],
}
FLOW={"operatingCashFlow","capex"}
INSTANT={"assets","liabilities","cash"}
MAX_POINTS=36

def get(url):
  req=urllib.request.Request(url,headers={"User-Agent":UA,"Accept":"application/json","Accept-Encoding":"identity"})
  with urllib.request.urlopen(req,timeout=28) as response:
    return json.loads(response.read(15_000_000))

def date(s):
  try:return dt.date.fromisoformat(s)
  except (TypeError,ValueError):return None

def select(facts,tag,metric):
  block=facts.get(tag,{})
  units=block.get("units",{})
  unit="USD/shares" if metric=="eps" else "USD"
  rows=units.get(unit,[])
  candidates=[]
  for row in rows:
    if row.get("form") not in ("10-K","10-Q"):continue
    filed=date(row.get("filed"));end=date(row.get("end"));start=date(row.get("start"))
    if not filed or filed>TODAY or not end or end>TODAY or end<TODAY-dt.timedelta(days=365*9):continue
    val=row.get("val")
    if not isinstance(val,(int,float)):continue
    length=(end-start).days+1 if start else 0
    if metric in INSTANT:
      if start:continue
    elif not start or length<67 or length>385:
      continue
    candidates.append({"start":str(start) if start else None,"end":str(end),"filed":str(filed),
                       "value":float(val),"days":length,"fy":row.get("fy"),"fp":row.get("fp"),
                       "accn":row.get("accn")})
  return candidates

def choose(rows):
  if not rows:return {}
  rank=lambda row:(row["filed"],row.get("accn") or "")
  selected={}
  for row in rows:
    key=(row["end"],row["start"])
    if key not in selected or rank(row)>rank(selected[key]):selected[key]=row
  return selected

def points_for_metric(rows,metric,cik):
  original=choose(rows)
  if not original:return []
  url=lambda r:"https://www.sec.gov/Archives/edgar/data/"+str(int(cik))+"/"+str(r.get("accn") or "").replace("-","")+"/"
  output={}
  for row in original.values():
    if metric in INSTANT:
      point={"end":row["end"],"value":row["value"],"source":url(row),"kind":"reported"}
    elif 68<=row["days"]<=110:
      point={"end":row["end"],"value":row["value"],"source":url(row),"kind":"reported"}
    else:continue
    old=output.get(row["end"])
    if old is None or row["filed"]>old["_filed"]:
      point["_filed"]=row["filed"];output[row["end"]]=point
  if metric not in INSTANT:
    # For YTD cash flow, subtract the preceding YTD balance within the same
    # fiscal-year start; no 6-month YTD is mislabeled as a quarter.
    if metric in FLOW:
      by_start={}
      for row in original.values():
        if 70<=row["days"]<=385:
          by_start.setdefault(row["start"],[]).append(row)
      for start,seq in by_start.items():
        seq.sort(key=lambda r:r["end"])
        for current in seq:
          if 68<=current["days"]<=110:continue
          previous=[r for r in seq if r["end"]<current["end"] and
                    68<=(current["days"]-r["days"])<=110]
          if not previous:continue
          prev=max(previous,key=lambda r:r["end"])
          value=current["value"]-prev["value"]
          point={"end":current["end"],"value":value,"source":url(current),"kind":"derived",
                 "note":"분기 현금흐름 = 누적 YTD - 직전 누적 YTD"}
          if current["end"] not in output:output[current["end"]]=point
    else:
      # 10-K annual value minus its matching first 9 months can produce a
      # Q4 value; only when the periods share an identical fiscal-year start.
      annual=[r for r in original.values() if 340<=r["days"]<=385]
      ytd=[r for r in original.values() if 250<=r["days"]<=300]
      for a in annual:
        prior=[r for r in ytd if r["start"]==a["start"] and 68<=(a["days"]-r["days"])<=110]
        if not prior or a["end"] in output:continue
        p=max(prior,key=lambda r:r["end"])
        output[a["end"]]={"end":a["end"],"value":a["value"]-p["value"],"source":url(a),
                          "kind":"derived","note":"4분기 = 연간 공시 - 첫 9개월 누적"}
  series=[]
  for pt in sorted(output.values(),key=lambda p:p["end"])[-MAX_POINTS:]:
    pt.pop("_filed",None)
    if metric=="eps":pt["value"]=round(pt["value"],5)
    else:pt["value"]=round(pt["value"]/1e6,5)  # Million USD
    series.append(pt)
  return series

def build(company,cik):
  try:
    raw=get("https://data.sec.gov/api/xbrl/companyfacts/CIK"+str(int(cik)).zfill(10)+".json")
  except Exception as exc:
    return company,{},str(exc)
  facts=raw.get("facts",{}).get("us-gaap",{})
  result={}
  for metric,tags in TAGS.items():
    for tag in tags:
      pts=points_for_metric(select(facts,tag,metric),metric,cik)
      if len(pts)>=2 or (pts and metric in INSTANT):
        result[metric]={"unit":"USD/share" if metric=="eps" else "USD million",
                        "frequency":"quarterly" if metric not in INSTANT else "reported instant",
                        "basis":"SEC US-GAAP "+tag,"points":pts}
        break
  # Derive correctly matched periods, not mixing arbitrary filings or periods.
  def paired(metric_a,metric_b,dest,operation,basis):
    a=result.get(metric_a,{}).get("points",[]);b=result.get(metric_b,{}).get("points",[])
    B={p["end"]:p for p in b};items=[]
    for p in a:
      q=B.get(p["end"])
      if not q:continue
      value=operation(p["value"],q["value"])
      if value is None:continue
      items.append({"end":p["end"],"value":round(value,5),"source":p["source"],
                    "kind":"derived","note":basis})
    if items:result[dest]={"unit":"%" if dest.endswith("Margin") else "USD million",
                           "frequency":"quarterly","basis":basis,"points":items}
  paired("grossProfit","revenue","grossMargin",lambda a,b:100*a/b if b else None,"SEC 동일 분기 매출총이익/매출")
  paired("operatingIncome","revenue","operatingMargin",lambda a,b:100*a/b if b else None,"SEC 동일 분기 영업이익/매출")
  paired("netIncome","revenue","netMargin",lambda a,b:100*a/b if b else None,"SEC 동일 분기 순이익/매출")
  paired("operatingCashFlow","capex","freeCashFlow",lambda a,b:a-b,"SEC 분기 CFO - 설비투자")
  rev=result.get("revenue",{}).get("points",[])
  growth=[]
  for p in rev:
    old=[x for x in rev if 350<=(date(p["end"])-date(x["end"])).days<=380]
    if not old:continue
    prev=min(old,key=lambda x:abs((date(p["end"])-date(x["end"])).days-365))
    if prev["value"]==0:continue
    growth.append({"end":p["end"],"value":round((p["value"]/prev["value"]-1)*100,4),
                   "source":p["source"],"kind":"derived","note":"동일 분기 전년 대비 매출 증가율"})
  if growth:result["yoyGrowth"]={"unit":"%","frequency":"quarterly","basis":"SEC Revenue YoY","points":growth}
  return company,result,None

def main():
  base=json.loads(DEST.read_text(encoding="utf-8")) if DEST.exists() else {"companies":{}}
  comps=base.setdefault("companies",{})
  # Static, independently sourced CIK map avoids the SEC's company_tickers.json
  # 403 block on GitHub-hosted runners. Still fetches actual financial facts from SEC.
  tick=json.loads((ROOT/"scripts"/"sec-cik-map.json").read_text(encoding="utf-8"))["tickers"]
  targets={}
  for ticker in TICKERS:
    for alias in ALIASES.get(ticker,[ticker]):
      if alias in tick:targets[ticker]=tick[alias];break
  print("Matched",len(targets),"SEC CIKs among",len(TICKERS),"possible")
  failures=[]
  with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    futs={pool.submit(build,ticker,cik):ticker for ticker,cik in targets.items()}
    for f in concurrent.futures.as_completed(futs):
      ticker=futs[f]
      try:key,series,error=f.result()
      except Exception as exc:failures.append(ticker);print("FAIL",ticker,exc);continue
      if error:failures.append(ticker);print("WARN",ticker,error);continue
      if not series:print("EMPTY",ticker);continue
      company=comps.setdefault(key,{})
      for metric,data in series.items():
        if metric in company and company[metric].get("basis","").startswith("Microsoft FY27"):
          continue
        if metric in company and company[metric].get("basis","").startswith("GAAP consolidated"):
          # SEC series supersedes a short hand-curated consolidated series if
          # it contains more observations; no manual Azure segments touched.
          if len(data["points"])<=len(company[metric].get("points",[])):continue
        company[metric]=data
      print(key,len(series),"metrics",sum(len(s["points"]) for s in series.values()),"points")
  if len(failures)==len(targets):raise RuntimeError("SEC source unavailable for every issuer; keeping previous file")
  base["generated_at"]=dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds").replace("+00:00","Z")
  base["description"]="Historical SEC US-GAAP points and Microsoft IR recast product/segment data. Missing means unavailable, not zero. Derived Q4/YTD calculations labeled. No forecasts mixed into reported series."
  DEST.write_text(json.dumps(base,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
  print("Companies",len(comps),"unavailable issuers",failures)
if __name__=="__main__":main()
