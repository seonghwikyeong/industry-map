/* AI Industry Map V5.0 · source-backed company financial time-series charts.
   Click an existing numeric metric; never invent missing quarters.
   Works on both the map and company.html imported panels using event delegation.
*/
(function(){
"use strict";
let DB={generated_at:null,companies:{}},loaded=false,loading=null,active=null;
const PERIODS=window.AI_EARNINGS_PERIODS||{};
const money=/^\s*(?:약\s*)?[+\-−]?\s*(?:NT\$|₩|€|£|¥|\$)?\s*\(?\d+(?:[,.]\d+)*(?:\.\d+)?\)?\s*(?:[KMBT]|%|x|X)?/;
const query=".company-panel b,.company-panel strong,.company-panel .product-amount,.company-panel .formula-box,.company-panel .metric-row > span,.company-panel .guidance-range-result,.company-panel .rel2-top > span,.company-panel .rel2-mid > span";
const labels={
"revenue":"revenue","매출":"revenue","total revenue":"revenue","net sales":"revenue","sales":"revenue",
"operating income":"operatingIncome","영업이익":"operatingIncome","gaap 영업이익":"operatingIncome",
"net income":"netIncome","순이익":"netIncome","gaap 순이익":"netIncome",
"gross profit":"grossProfit","매출총이익":"grossProfit",
"gross margin":"grossMargin","매출총이익률":"grossMargin",
"operating margin":"operatingMargin","영업이익률":"operatingMargin",
"net margin":"netMargin","순이익률":"netMargin",
"eps":"eps","gaap eps":"eps","diluted eps":"eps",
"cfo":"operatingCashFlow","operating cash flow":"operatingCashFlow","영업현금흐름":"operatingCashFlow",
"capex":"capex","capital expenditures":"capex","설비투자":"capex",
"free cash flow":"freeCashFlow","fcf":"freeCashFlow",
"yoy growth":"yoyGrowth","매출 성장률":"yoyGrowth",
"total assets":"assets","assets":"assets","liabilities":"liabilities",
"cash":"cash","cash and equivalents":"cash",
"azure":"azureRevenue","azure revenue":"azureRevenue","azure 매출":"azureRevenue",
"microsoft 365 cloud":"microsoft365CloudRevenue",
"productivity and server licensing":"productivityServerLicensingRevenue",
"search and advertising":"searchAdvertisingRevenue",
"xbox":"xboxRevenue","windows oem and devices":"windowsDevicesRevenue",
"industry solutions":"industrySolutionsRevenue",
"frontier and support services":"frontierSupportRevenue",
"agents and infra":"agentsInfraRevenue",
"devices and consumer":"devicesConsumerRevenue"
};

/* On-demand, no-bulk-redistribution external SEC statement fallback.
   TGMCharts keyless API: https://tgmcharts.com/developers/docs/statements
   Public-domain underlying SEC facts; requests occur only on actual chart clicks.
*/
const REMOTE={};
const remoteCalls=new Map();
const RATIO_SLUGS={
 "per":"pe-ratio","p/e":"pe-ratio","p/e ratio":"pe-ratio","pe ratio":"pe-ratio",
 "ps":"ps-ratio","p/s":"ps-ratio","p/b":"pb-ratio","p/ocf":"pocf-ratio","p/fcf":"pfcf-ratio",
 "ev/ebitda":"ev-ebitda","ev/ebit":"ev-ebit","ev/sales":"ev-sales","ev/revenue":"ev-sales",
 "ev/fcf":"ev-fcf","dividend yield":"dividend-yield","roic":"roic"
};
const INCOME_KEYS=["revenue","grossProfit","operatingIncome","netIncome","eps","grossMargin","operatingMargin","netMargin","yoyGrowth"];
const CASH_KEYS=["operatingCashFlow","capex","freeCashFlow"];
const BAL_KEYS=["assets","liabilities","cash"];
function remoteGroup(key){
 if(INCOME_KEYS.includes(key))return "income-statement";
 if(CASH_KEYS.includes(key))return "cash-flow";
 if(BAL_KEYS.includes(key))return "balance-sheet";
 return null;
}
function remoteValue(row,key,group){
 const v=row.metrics||{};
 const val=x=>typeof x==="number"&&Number.isFinite(x)?x:null;
 if(group==="income-statement"){
  if(key==="revenue")return val(v.revenue);
  if(key==="grossProfit")return val(v.grossProfit);
  if(key==="operatingIncome")return val(v.operatingIncome);
  if(key==="netIncome")return val(v.netIncome);
  if(key==="eps")return val(v.epsDiluted);
  const denominator=val(v.revenue);
  if(!denominator)return null;
  if(key==="grossMargin")return val(v.grossProfit)===null?null:100*v.grossProfit/denominator;
  if(key==="operatingMargin")return val(v.operatingIncome)===null?null:100*v.operatingIncome/denominator;
  if(key==="netMargin")return val(v.netIncome)===null?null:100*v.netIncome/denominator;
 }
 if(group==="cash-flow"){
  if(key==="operatingCashFlow")return val(v.operatingCashFlow);
  if(key==="capex")return val(v.capitalExpenditure);
  if(key==="freeCashFlow")return val(v.operatingCashFlow)!==null&&val(v.capitalExpenditure)!==null?v.operatingCashFlow-v.capitalExpenditure:null;
 }
 if(group==="balance-sheet"){
  if(key==="assets")return val(v.totalAssets);
  if(key==="liabilities")return val(v.totalLiabilities);
  if(key==="cash")return val(v.cashAndCashEquivalents);
 }
 return null;
}
function remoteCurrency(key){return key==="eps"?"USD/share":["grossMargin","operatingMargin","netMargin","yoyGrowth"].includes(key)?"%":"USD million";}
function extractRemote(ticker,json,group){
 if(!Array.isArray(json.rows)||json.currency!=="USD")return;
 const keys=group==="income-statement"?INCOME_KEYS:group==="cash-flow"?CASH_KEYS:BAL_KEYS;
 const origin="https://tgmcharts.com/stocks/"+encodeURIComponent(ticker)+"/financials";
 const full=json.rows.filter(r=>r&&r.periodEnd&&r.fiscalPeriod&&r.fiscalPeriod.startsWith("Q")
      &&r.periodEnd<=new Date().toISOString().slice(0,10)
      &&(!r.filed||r.filed<=new Date().toISOString().slice(0,10)));
 const sorted=full.sort((a,b)=>a.periodEnd.localeCompare(b.periodEnd));
 if(!REMOTE[ticker])REMOTE[ticker]={};
 for(const key of keys){
  if(key==="yoyGrowth")continue;
  const points=[];
  for(const row of sorted){
   const original=remoteValue(row,key,group);
   if(original===null)continue;
   const percentage=["grossMargin","operatingMargin","netMargin"].includes(key);
   const share=key==="eps";
   const value=percentage||share?original:original/1e6;
   if(!Number.isFinite(value))continue;
   const srcKey=key==="eps"?"epsDiluted":key==="assets"?"totalAssets":key==="liabilities"?"totalLiabilities":key==="cash"?"cashAndCashEquivalents":key==="capex"?"capitalExpenditure":key;
   const provenance=row.provenance?.[srcKey];
   let source=origin;
   if(json.cik&&provenance?.accn)source="https://www.sec.gov/Archives/edgar/data/"+Number(json.cik)+"/"+provenance.accn.replace(/-/g,"")+"/";
   points.push({end:row.periodEnd,period:"FY"+String(row.fiscalYear||"").slice(-2)+" "+row.fiscalPeriod,value:Math.round(value*1e5)/1e5,
       source,kind:provenance?.derived?"derived":"reported",note:provenance?.derived||""});
  }
  if(points.length){
    REMOTE[ticker][key]={unit:remoteCurrency(key),frequency:group==="balance-sheet"?"reported instant":"quarterly",basis:"TGMCharts 제공 SEC XBRL 공시 · "+group,points:points.slice(-52)};
  }
 }
 if(group==="income-statement"){
  const rv=REMOTE[ticker].revenue?.points||[];
  const growth=[];
  for(const x of rv){const before=rv.filter(p=>{const dif=(Date.parse(x.end)-Date.parse(p.end))/864e5;return dif>345&&dif<385});if(!before.length)continue;
    const p=before.sort((a,b)=>Math.abs(Date.parse(x.end)-Date.parse(a.end)-365*864e5)-Math.abs(Date.parse(x.end)-Date.parse(b.end)-365*864e5))[0];
    if(p.value)growth.push({end:x.end,period:x.period,value:Math.round((x.value/p.value-1)*1e7)/1e5,source:x.source,kind:"derived",note:"동일 분기 전년 대비 매출 성장률"});
  }
  if(growth.length)REMOTE[ticker].yoyGrowth={unit:"%",frequency:"quarterly",basis:"TGMCharts SEC 분기 매출 YoY 계산",points:growth};
 }
}
async function requestRemote(ticker,key){
 const group=remoteGroup(key),slug=key.startsWith("ratio:")?key.slice(6):null;
 if(!group&&!slug)return;
 const identifier=ticker+"|"+(slug||group);
 if(remoteCalls.has(identifier))return remoteCalls.get(identifier);
 const promise=(async()=>{
  const url=slug?"https://tgmcharts.com/api/v1/series/"+encodeURIComponent(ticker)+"/"+slug+"?years=10":
        "https://tgmcharts.com/api/v1/statements/"+encodeURIComponent(ticker)+"/"+group+"?period=quarterly&years=8";
  try{
    const response=await fetch(url,{headers:{Accept:"application/json"}});
    if(!response.ok)throw Error(String(response.status));
    const payload=await response.json();
    if(slug){
      if(Array.isArray(payload.points)&&payload.points.length){
       if(!REMOTE[ticker])REMOTE[ticker]={};
       REMOTE[ticker][key]={unit:payload.unit==="ratio"?"multiple":payload.unit==="percent"?"%":payload.unit==="usd"?"USD million":"number",
         frequency:payload.basis||"daily",basis:"TGMCharts 제공 "+(payload.label||slug)+" (시장가격 포함, SEC 단독 공시 아님)",
         points:payload.points.filter(x=>Number.isFinite(x.value)&&x.date).map(x=>({end:x.date,
           value:payload.unit==="usd"?x.value/1e6:x.value,source:"https://tgmcharts.com/stocks/"+encodeURIComponent(ticker),kind:"reported"})).slice(-250)};
      }
    }else extractRemote(ticker,payload,group);
  }catch(error){console.warn("Historical financial API unavailable",ticker,group||slug,error)}
 })();
 remoteCalls.set(identifier,promise);
 return promise;
}

const localized={
"revenue":"연결 매출","operatingIncome":"영업이익","netIncome":"순이익","grossProfit":"매출총이익",
"eps":"희석 주당순이익","grossMargin":"매출총이익률","operatingMargin":"영업이익률",
"netMargin":"순이익률","operatingCashFlow":"영업현금흐름","capex":"설비투자","freeCashFlow":"잉여현금흐름",
"yoyGrowth":"매출 전년동기 성장률","azureRevenue":"Azure 매출"
};
const norm=s=>String(s||"").toLowerCase().replace(/\s+/g," ").trim();
const num=s=>{
 const raw=String(s||"").trim().replace(/−/g,"-");
 const m=raw.match(/^(?:약\s*)?([+-]?)\s*(NT\$|₩|€|£|¥|\$)?\s*\(?([0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?|[0-9]+(?:\.[0-9]+)?)\)?\s*(T|B|M|K|%|x)?/i);
 if(!m)return null;let n=Number(m[3].replace(/,/g,""));if(!Number.isFinite(n))return null;
 if(m[1]==="-"||raw.includes("("+m[3]))n=-n;
 const suffix=(m[4]||"").toUpperCase();if(suffix==="B")n*=1000;else if(suffix==="T")n*=1000000;else if(suffix==="K")n/=1000;
 const unit=m[2]==="₩"?"KRW million":m[2]==="€"?"EUR million":m[2]==="NT$"?"TWD million":m[2]==="£"?"GBP million":m[2]==="¥"?"JPY million":
   suffix==="%"?"%":suffix==="X"?"multiple":m[2]==="$"||/[MBT]/.test(suffix)?"USD million":"number";
 return {value:n,unit};
};
function metricText(el){
 const row=el.closest(".metric-row"),head=el.closest(".drill-head");
 if(head)return head.querySelector("span")?.textContent.trim()||"부문별 값";
 if(row){const left=row.querySelector(".mr-left");return left?.querySelector("span")?.textContent.trim()||row.querySelector("span")?.textContent.trim()||"재무지표";}
 const product=el.closest(".product-item");if(product)return product.querySelector(".product-head b")?.textContent.trim()||"제품 매출";
 const other=el.closest(".rel2-row,.guidance-compare-grid,.guidance-range-result,.commercial-cols");
 if(other)return (other.querySelector("small,span,h4")?.textContent||el.parentElement?.textContent||"기타 지표").trim().slice(0,80);
 return el.parentElement?.querySelector("span")?.textContent?.trim()||"수치";
}
function metricKey(ticker,title,el){
 const value=norm(title).replace(/\s*\([^)]*\)/g,"");
 const context=el.closest(".drill-body")?"segment":el.closest(".latest-earnings")?"latest":el.closest(".common-block")?"common":"other";
 if(context==="segment"&&ticker==="MSFT"){
   if(value==="agents and infra")return el.closest(".metric-expand")?.querySelector(".metric-row span")?.textContent.toLowerCase().includes("operating")?"agentsInfraOperatingIncome":"agentsInfraRevenue";
 }
 if(ticker==="NVDA"&&(/data center|데이터센터/i.test(value))&&el.closest(".drill-body,.latest-earnings"))return "dataCenterRevenue";
 if(ticker==="AMD"&&(/data center|데이터센터/i.test(value))&&el.closest(".drill-body,.latest-earnings"))return "dataCenterRevenue";
 if(RATIO_SLUGS[value])return "ratio:"+RATIO_SLUGS[value];
 if(labels[value])return labels[value];
 if(ticker==="MSFT"&&/\bazure\b/i.test(value))return "azureRevenue";
 if(/영업.?현금흐름/.test(value))return "operatingCashFlow";
 if(/총.?매출|연결 매출/.test(value))return "revenue";
 if(/영업이익률/.test(value))return "operatingMargin";
 if(/영업이익/.test(value))return "operatingIncome";
 if(/순이익률/.test(value))return "netMargin";
 if(/순이익/.test(value))return "netIncome";
 if(/매출총이익률/.test(value))return "grossMargin";
 if(/^gaap eps|^eps\b|희석.?주당/.test(value))return "eps";
 if(/매출/.test(value)&&!/전망|가이던스|예상|추정|목표|연환산/.test(value))return value==="매출"?"revenue":null;
 return null;
}
function periodOf(el,ticker){
 const panel=el.closest(".company-panel"),row=el.closest(".metric-row");
 const local=row?.querySelector("small")?.textContent?.trim();
 if(local)return local;
 const inDrill=el.closest(".drill-body");
 if(inDrill){const value=inDrill.querySelector(".drill-period")?.textContent||"";const m=value.match(/(?:FY\d\d\s*Q\d|20\d\d\s*Q\d)/);if(m)return m[0];}
 const earning=el.closest(".latest-earnings");
 if(earning){const h=earning.querySelector("h3")?.textContent||"";const m=h.match(/(?:FY\d\d\s*Q\d|20\d\d\s*Q\d)/);if(m)return m[0];}
 return PERIODS[ticker]?.period||"시점 미확인";
}
function sourceOf(el,ticker){const card=el.closest(".card,.metric-expand");return card?.querySelector(".src a[href^='http'],a.drill-source[href^='http']")?.href||PERIODS[ticker]?.url||null;}
function isForecast(el,title){const r=el.closest(".metric-row");return Boolean(r?.classList.contains("guidance")||r?.classList.contains("assumption")||el.closest(".guidance-block,.assumption-warning")||/가이던스|전망|예상|추정|목표|implied|capture|assum|forecast|guidance/i.test(title))}
function unitFor(key,parsed){if(key==="eps")return "USD/share";if(["grossMargin","operatingMargin","netMargin","yoyGrowth"].includes(key))return "%";if(parsed?.unit==="multiple")return "multiple";return parsed?.unit||"USD million";}
function pointFallback(el,ticker,title,key,parsed){
 if(!parsed)return[];
 const period=periodOf(el,ticker),status=isForecast(el,title)?"guidance":el.closest(".metric-row")?.classList.contains("derived")?"derived":"snapshot";
 const end=/^20\d\d Q\d$/.test(period)?period.slice(0,4)+"-"+["03-31","06-30","09-30","12-31"][Number(period.slice(-1))-1]:null;
 return [{end:end||"현재 표시",period:period,value:parsed.value,source:sourceOf(el,ticker),kind:status,note:status==="snapshot"?"현재 화면의 값 1건. 과거 공시 시계열로 검증된 값은 아님.":"과거 실적 시계열이 아님."}];
}
function viewData(el){
 const panel=el.closest(".company-panel");if(!panel)return null;const ticker=panel.querySelector("h2 span")?.textContent.trim().toUpperCase();if(!ticker)return null;
 const title=metricText(el),key=metricKey(ticker,title,el),parsed=num(el.textContent);
 if(!parsed||!/[-+]?\d/.test(el.textContent))return null;
 const forecast=isForecast(el,title);
 let local=key&&!forecast?DB.companies?.[ticker]?.[key]:null;
 let remote=key&&!forecast?REMOTE[ticker]?.[key]:null;
 // Merge individually dated quarters; latest directly sourced IR values take
 // precedence over an older SEC-mirror snapshot of the same date.
 let series=local||remote;
 if(local?.points?.length&&remote?.points?.length&&local.unit===remote.unit){
   const joined=new Map(remote.points.map(p=>[p.end,p]));
   for(const p of local.points)joined.set(p.end,p);
   series={unit:local.unit,frequency:local.frequency||remote.frequency,
           basis:remote.basis+" + "+local.basis,
           points:[...joined.values()].sort((a,b)=>String(a.end).localeCompare(String(b.end)))};
 }else if(remote?.points?.length>local?.points?.length)series=remote;
 let points=Array.isArray(series?.points)?series.points.filter(p=>typeof p.value==="number"&&Number.isFinite(p.value)&&p.end):[];
 if(series?.unit==="USD million"&&parsed.unit==="%"&&!["yoyGrowth","grossMargin","operatingMargin","netMargin"].includes(key))points=[];
 if(series?.unit==="USD million"&&parsed.unit==="multiple")points=[];
 if(series?.unit&&parsed.unit&&/^(KRW|EUR|TWD|GBP|JPY) million$/.test(parsed.unit)&&series.unit!==parsed.unit)points=[];
 if(key==="eps"&&parsed.unit==="USD million")points=[];
 if(points.length===0)points=pointFallback(el,ticker,title,key,parsed);
 return {ticker,title,key,parsed,points,series,forecast,fallback:!series||!Array.isArray(series.points)||!series.points.length};
}
function style(){
 const s=document.createElement("style");s.id="financial-timeseries-style";
 s.textContent=[
 ".ts-clickable{cursor:zoom-in!important;text-decoration:underline dotted #68d5c5;text-underline-offset:4px;touch-action:manipulation}",
 ".ts-clickable:hover,.ts-clickable:focus-visible{color:#8debc8!important;outline:1px dashed #4ccfaf;outline-offset:2px;border-radius:3px}",
 "#financial-ts-overlay{display:none;position:fixed;inset:0;background:#06111ded;z-index:110000;align-items:center;justify-content:center;padding:16px}",
 "#financial-ts-overlay.ts-open{display:flex}",
 "#financial-ts-modal{width:min(920px,100%);max-height:91vh;overflow:auto;background:#0d2235;color:#effbff;border:1px solid #3b738b;border-radius:14px;box-shadow:0 24px 70px #000c}",
 ".ts-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:16px 19px 12px;border-bottom:1px solid #305067}",
 ".ts-top h2{font-size:20px!important;line-height:1.4;margin:0!important;color:#f2fbff}",
 ".ts-subtitle{font-size:12px;color:#a8c6d4;margin-top:6px}",
 ".ts-close{background:#173d52;border:1px solid #5a859b;border-radius:7px;color:white;font-size:20px;cursor:pointer;padding:3px 11px}",
 ".ts-content{padding:16px 21px}",
 ".ts-chart-box{overflow:hidden;position:relative;border:1px solid #28485b;border-radius:10px;background:#091a28;padding:10px 4px}",
 ".ts-chart-box svg{width:100%;height:auto;display:block}",
 ".ts-chart-box line{stroke:#294659;stroke-width:1}",
 ".ts-chart-box text{fill:#9db6c8;font-size:12px;font-family:inherit}",
 ".ts-chart-box circle{fill:#72d8c4;stroke:#0b2936;stroke-width:2}",
 ".ts-chart-box .ts-line{stroke:#61b9e2;fill:none;stroke-width:2.3;stroke-linejoin:round;stroke-linecap:round}",
 ".ts-chart-box .ts-point:focus{outline:3px solid #e4cb7a}",
 ".ts-points{border-collapse:collapse;width:100%;font-size:12px;margin-top:12px}",
 ".ts-points td,.ts-points th{padding:8px 9px;text-align:left;border-bottom:1px solid #28465a}",
 ".ts-points th{color:#95c8da;font-weight:650}",
 ".ts-points tr:hover{background:#15364c}",
 ".ts-source a{color:#9fdcfa;text-decoration:underline}",
 ".ts-note{font-size:12px;line-height:1.7;color:#c0d3e2;margin:12px 0}",
 ".ts-warning{border-left:3px solid #ebb566;padding:8px 10px;background:#382c27;color:#efd4a9;font-size:12px;line-height:1.6;margin-top:10px}",
 ".ts-actions{display:flex;gap:10px;justify-content:flex-end;align-items:center;flex-wrap:wrap;padding:11px 20px;border-top:1px solid #315069;background:#112d3e}",
 ".ts-actions button{background:#20485d;border:1px solid #54849a;border-radius:6px;color:#e6f8ff;cursor:pointer;padding:8px 12px}",
 ".ts-legend{font-size:11px;color:#a5bacb;margin-top:7px}",
 "@media(max-width:650px){.ts-content{padding:12px}.ts-top{padding:12px}.ts-points{font-size:11px}.ts-points td,.ts-points th{padding:6px 4px}}"
 ].join("\n");document.head.appendChild(s)
}
function overlay(){
 let o=document.getElementById("financial-ts-overlay");if(o)return o;
 o=document.createElement("div");o.id="financial-ts-overlay";
 const m=document.createElement("section");m.id="financial-ts-modal";m.setAttribute("role","dialog");m.setAttribute("aria-modal","true");m.setAttribute("aria-label","재무 시계열 그래프");
 m.innerHTML='<div class="ts-top"><div><h2 id="ts-title"></h2><div class="ts-subtitle" id="ts-subtitle"></div></div><button class="ts-close" type="button" aria-label="닫기">×</button></div><div class="ts-content" id="ts-content"></div><div class="ts-actions"><span class="ts-legend">공시 기반 데이터 포인트만 표시 · 공백 분기 임의 연결 안 함</span><button type="button" id="ts-refresh">자료 새로고침</button><button type="button" id="ts-export">CSV 내보내기</button></div>';
 o.append(m);o.addEventListener("click",e=>{if(e.target===o)close()});m.querySelector(".ts-close").addEventListener("click",close);
 m.querySelector("#ts-refresh").addEventListener("click",async()=>{await load(true);if(active)render()});
 m.querySelector("#ts-export").addEventListener("click",exportCsv);
 document.body.appendChild(o);document.addEventListener("keydown",e=>{if(e.key==="Escape")close()});return o;
}
function close(){document.getElementById("financial-ts-overlay")?.classList.remove("ts-open")}
function fvalue(v,unit){
 if(!Number.isFinite(v))return "-";
 if(unit==="USD/share")return "$"+v.toFixed(2);
 if(unit==="%")return v.toFixed(2)+"%";
 if(unit==="multiple")return v.toFixed(2)+"x";
 const symbols={"USD million":"$","KRW million":"₩","EUR million":"€","TWD million":"NT$","GBP million":"£","JPY million":"¥"};
 if(symbols[unit]){
  const n=Math.abs(v),abs=n>=1e6?1e6:n>=1000?1000:1,suf=n>=1e6?"T":n>=1000?"B":"M";
  return (v<0?"−":"")+symbols[unit]+(n/abs).toLocaleString("en-US",{maximumFractionDigits:3})+suf;
 }
 return v.toLocaleString("en-US",{maximumFractionDigits:3});
}
function svgChart(points,unit){
 const W=820,H=285,left=72,right=19,top=20,bottom=45,usableW=W-left-right,usableH=H-top-bottom;
 if(!points.length)return document.createTextNode("표시할 데이터가 없습니다.");
 const dates=points.map((p,i)=>Date.parse(p.end)||null);
 const validDates=dates.every(d=>d!==null),first=validDates?Math.min(...dates):0,last=validDates?Math.max(...dates):points.length-1;
 const min=Math.min(...points.map(p=>p.value)),max=Math.max(...points.map(p=>p.value));let padding=Math.max((max-min)*.12,Math.max(Math.abs(max),Math.abs(min),1)*.035);const low=min-padding,high=max+padding;
 const X=i=>left+(validDates&&last>first?(dates[i]-first)/(last-first):points.length>1?i/(points.length-1):.5)*usableW;
 const Y=v=>top+(high-v)/(high-low)*usableH;
 const NS="http://www.w3.org/2000/svg";const svg=document.createElementNS(NS,"svg");svg.setAttribute("viewBox","0 0 "+W+" "+H);svg.setAttribute("role","img");svg.setAttribute("aria-label","공시 확인된 시계열 데이터 "+points.length+"개 포인트");
 function shape(tag,attrs,text){let s=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))s.setAttribute(k,String(v));if(text!==undefined)s.textContent=text;svg.append(s);return s}
 for(let j=0;j<=4;j++){const y=top+j*usableH/4;shape("line",{x1:left,y1:y,x2:W-right,y2:y});shape("text",{x:7,y:y+4},fvalue(high-j*(high-low)/4,unit))}
 for(let i=0;i<points.length-1;i++){
  const a=points[i],b=points[i+1],gap=Date.parse(b.end)-Date.parse(a.end);
  if(validDates&&(gap<35*864e5||gap>125*864e5))continue;
  const line="M "+X(i)+" "+Y(a.value)+" L "+X(i+1)+" "+Y(b.value);
  shape("path",{d:line,class:"ts-line"});
 }
 const ticks=points.length<6?points.map((_,i)=>i):[0,Math.floor((points.length-1)/4),Math.floor((points.length-1)/2),Math.floor((points.length-1)*.75),points.length-1];
 for(const i of new Set(ticks)){const x=X(i),txt=points[i].period||points[i].end;shape("text",{x,y:H-13,"text-anchor":"middle"},txt.length>15?txt.slice(0,10):txt)}
 points.forEach((p,i)=>{const circle=shape("circle",{cx:X(i),cy:Y(p.value),r:5.2,class:"ts-point",tabindex:0});const tooltip=document.createElementNS(NS,"title");tooltip.textContent=(p.period||p.end)+" · "+fvalue(p.value,unit)+" · "+(p.kind==="derived"?"계산":p.kind==="guidance"?"전망":"공시");circle.appendChild(tooltip)});
 return svg;
}
function exportCsv(){if(!active)return;const d=viewData(active);if(!d)return;const unit=d.series?.unit||unitFor(d.key,d.parsed);const lines=[["period","date","value","unit","kind","source"],...d.points.map(p=>[p.period||"",p.end,p.value,unit,p.kind||"",p.source||""])];const csv=lines.map(r=>r.map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(",")).join("\n");const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=(d.ticker+"-"+(d.key||"metric")+"-timeseries.csv").replace(/[^a-z0-9._-]/gi,"_");a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)}
function render(){
 if(!active||!document.contains(active))return;
 const d=viewData(active),o=overlay();if(!d)return;
 const existing=d.points.filter(p=>Number.isFinite(p.value)).sort((a,b)=>String(a.end).localeCompare(String(b.end)));
 const unit=d.series?.unit||unitFor(d.key,d.parsed);
 o.querySelector("#ts-title").textContent=d.ticker+" · "+d.title;
 o.querySelector("#ts-subtitle").textContent=(d.series?.basis||"화면 표시값")+(d.series?.frequency?" · "+d.series.frequency:"")+" · "+existing.length+"개 데이터 포인트";
 if(d.key&&remoteGroup(d.key)&&!REMOTE[d.ticker]?.[d.key]&&existing.length<5){o.querySelector("#ts-subtitle").textContent+=" · 추가 공시 이력 조회 중 또는 미제공";}
 const content=o.querySelector("#ts-content");content.replaceChildren();
 const chartBox=document.createElement("div");chartBox.className="ts-chart-box";chartBox.appendChild(svgChart(existing,unit));content.appendChild(chartBox);
 const legend=document.createElement("div");legend.className="ts-legend";legend.textContent="단위: "+unit+" · 점에 마우스를 올리면 값 확인 · 공백 분기는 연결하지 않음";content.appendChild(legend);
 const table=document.createElement("table");table.className="ts-points";const head=document.createElement("thead");head.innerHTML="<tr><th>기간(종료일)</th><th>값</th><th>구분</th><th>출처</th></tr>";table.append(head);const body=document.createElement("tbody");
 existing.slice().reverse().forEach(p=>{let tr=document.createElement("tr");const cols=[p.period||p.end,fvalue(p.value,unit),p.kind==="derived"?"Derived":p.kind==="guidance"?"Guidance":p.kind==="snapshot"?"화면 스냅샷":"Reported"];cols.forEach(txt=>{let td=document.createElement("td");td.textContent=txt;tr.appendChild(td)});const src=document.createElement("td");if(p.source&&/^https:\/\//.test(p.source)){let a=document.createElement("a");a.href=p.source;a.target="_blank";a.rel="noopener noreferrer";a.textContent="원문 ↗";src.className="ts-source";src.appendChild(a)}else src.textContent="미확인";tr.append(src);body.append(tr)});table.append(body);content.appendChild(table);
 if(!d.series||existing.length<2){const note=document.createElement("div");note.className="ts-warning";note.textContent=existing.length===1?"추가 과거 자료를 확보하지 못했습니다. 표시된 값 1개로 과거 추세를 추정할 수 없습니다.":"해당 항목의 신뢰 가능한 과거 시계열이 없습니다.";content.append(note)}
 if(d.forecast){const note=document.createElement("div");note.className="ts-warning";note.textContent="이 값은 가이던스 또는 시나리오 가정입니다. 실현된 분기 실적과 혼합하지 않았습니다.";content.append(note)}
 if(d.parsed?.unit==="multiple"&&d.series?.unit==="USD million"){const note=document.createElement("div");note.className="ts-warning";note.textContent="화면 값은 배수(x)인데 공시 시계열은 금액입니다. 기존 숫자의 단위 오류 가능성이 있어 직접 검증이 필요합니다.";content.append(note)}
 if(/\s\/\s/.test(active?.textContent||"")){const note=document.createElement("div");note.className="ts-warning";note.textContent="한 셀에 여러 수치가 함께 표시돼 있습니다. 차트는 첫 번째 값을 대상으로 하며, GAAP/Non-GAAP처럼 정의가 다른 수치는 별도로 검증해야 합니다.";content.append(note)}
 if(d.series?.basis){const note=document.createElement("div");note.className="ts-note";note.textContent="회계 기준: "+d.series.basis+". 동일 지표라도 회계기준·사업부 분류 변경 시 비교에 유의하세요.";content.append(note)}
 if((d.series?.basis||"").includes("TGMCharts")){const note=document.createElement("div");note.className="ts-note";const link=document.createElement("a");link.href="https://tgmcharts.com/";link.target="_blank";link.rel="noopener noreferrer";link.textContent="Data by TGMCharts (tgmcharts.com)";note.textContent="기초 자료: SEC EDGAR XBRL · ";note.appendChild(link);content.append(note)}
}
function open(el){active=el;const o=overlay();o.classList.add("ts-open");render();o.querySelector(".ts-close").focus();load(false).then(()=>{if(o.classList.contains("ts-open"))render()});const data=viewData(el);if(data?.key&&!data.forecast){requestRemote(data.ticker,data.key).then(()=>{if(active===el&&o.classList.contains("ts-open"))render()})}}
async function load(force){
 if(loading&&!force)return loading;
 loading=(async()=>{try{const r=await fetch("./timeseries.json?v="+(force?Date.now():Math.floor(Date.now()/3600000)),{cache:"no-store"});if(!r.ok)throw Error("HTTP "+r.status);const json=await r.json();if(!json.companies||typeof json.companies!=="object")throw Error("Invalid timeseries");DB=json;loaded=true}catch(e){console.warn("Financial time series unavailable:",e)}})();return loading;
}
function eligible(el){
 if(!el?.closest?.(".company-panel"))return false;
 const row=el.closest(".metric-row");if(row&&row.querySelector(".b-assumption")&&!num(el.textContent))return false;
 const raw=el.textContent.trim();if(el.closest("h2,h3,h4,.badge,.news-entry,.src,summary .drill-caret"))return false;if(!money.test(raw))return false;
 return Boolean(num(raw));
}
function init(root){
 const scope=root||document;
 scope.querySelectorAll(query).forEach(el=>{if(eligible(el)){el.classList.add("ts-clickable");el.setAttribute("tabindex","0");el.setAttribute("role","button");el.setAttribute("aria-label","시계열 그래프 보기: "+metricText(el));}});
}
function main(){
 style();init(document);
 document.addEventListener("click",e=>{
   if(e.target.closest("#financial-ts-overlay"))return;
   const value=e.target.closest(query);if(!eligible(value))return;
   e.preventDefault();e.stopPropagation();open(value);
 },true);
 document.addEventListener("keydown",e=>{if(e.key!=="Enter"&&e.key!==" ")return;const value=e.target.closest(query);if(!eligible(value))return;e.preventDefault();e.stopPropagation();open(value)},true);
 document.addEventListener("toggle",e=>{if(e.target.matches(".metric-expand"))init(e.target)},true);
 const watcher=new MutationObserver(records=>{for(const r of records){if(r.addedNodes.length){const node=r.target.closest?.(".company-panel");if(node)init(node)}}});
 watcher.observe(document.body,{childList:true,subtree:true});
 load(false);
}
window.initFinancialTimeSeries=init;
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",main);else main();
})();
