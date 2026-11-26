/* AI Industry Map V6.6: source-attributed quantitative press and call signals.
   A media headline is a lead to inspect, NOT a verified company metric.
   Company IR/CFO/call figures remain separated from market-wide estimates and future commitments.
*/
(function(){
"use strict";
let loaded=false,loading=null,articleFeed={companies:{}},financials={companies:{}};
const numberPattern=/((?:US\$|NT\$|\$|€|₩|£)\s*\d+(?:[,.]\d+)?\s*(?:billion|million|trillion|bn|B|M|T)?|\d+(?:\.\d+)?\s*(?:percent|billion|million|trillion|gigawatts|megawatts|GW|MW|조원|억원|%))/i;
const material=/\b(revenue|sales|earnings|order|contract|purchase|cloud|data center|guidance|investment|invest|spend|capital|capacity|shipment|memory|wafer|chip|hbm|ai|gpu|forecast|backlog|operating profit|cash flow|매출|영업이익|계약|수주|투자|납품)\b/i;
function n(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=String(text);return el}
function textLink(label,url){const a=n("a",null,label);a.href=url;a.target="_blank";a.rel="noopener noreferrer";return a}
function safeUrl(url){try{let u=new URL(url);return u.protocol==="https:"?u.href:null}catch{return null}}
function panelTicker(p){return p.querySelector("h2 span")?.textContent?.trim()?.toUpperCase()}
function highlight(ticker,call){
 const row=n("article","rs64-call");
 const top=n("div","rs64-calltop");
 top.append(n("strong",null,call.label),n("span","rs64-value",call.value));row.append(top);
 const type=call.type||"call_reported";
 let status="어닝콜에서 언급된 수치";
 if(type==="management_forecast")status="미래 전망 · 미실현";
 else if(type==="industry_statistic")status="업계 전체 수치 · 해당 기업 자체 매출 아님";
 else if(type==="max_guarantee")status="조건부 최대 보증노출 · 실제 지출 아님";
 else if(type==="group_commitment")status="전체 계약 약정 · 개별 거래처별 배분 금지";
 else if(type==="cfo_reported")status="CFO 자료상 실제 매출";
 else if(type==="call_reported_approx")status="어닝콜 발표 · 반올림";
 row.append(n("div","rs64-kind",status));
 row.append(n("p","rs64-note",call.notes||""));
 if(safeUrl(call.source))row.append(textLink("발언·공식 자료 보기 ↗",call.source));
 return row;
}
function mediaSignal(article){
 const found=(article.title||"").match(numberPattern);
 if(!found||!material.test(article.title||""))return null;
 if(!safeUrl(article.url))return null;
 return {...article,extracted:found[0].trim()};
}
function build(root){
 if(!loaded)return;
 const now=Date.now();
 (root||document).querySelectorAll(".company-panel").forEach(panel=>{
  const ticker=panelTicker(panel);
  if(!ticker||panel.querySelector(".rs64"))return;
  const latest=financials.companies[ticker]||null;
  const call=latest?.callHighlights||[];
  const articles=(articleFeed.companies[ticker]||[])
    .filter(x=>Date.parse(x.published_at)>=now-8*86400000 && Date.parse(x.published_at)<=now+3600000)
    .map(mediaSignal).filter(Boolean).sort((a,b)=>b.published_at.localeCompare(a.published_at)).slice(0,8);
  const section=n("section","rs64");section.dataset.researchTicker=ticker;
  section.append(n("div","rs64-eyebrow","SOURCED NUMBERS · EARNINGS CALL + PRESS"));
  section.append(n("h3",null,ticker+" · 기사·어닝콜 공개 수치"));
  section.append(n("p","rs64-intro","공시된 연결·부문 매출은 위 실적/시계열을 참고하세요. 아래는 공식 어닝콜 발언과 최근 기사 제목에 등장한 숫자를 별도로 기록합니다. 매체의 제목은 원문 검증 전 잠정 정보이며 재무 실적이나 확정 거래액으로 자동 합산하지 않습니다."));
  if(call.length){
   const detail=n("details","rs64-group");detail.open=true;
   detail.append(n("summary",null,"확인된 어닝콜·CFO 정량 발언 ("+call.length+"건)"));
   const grid=n("div","rs64-grid");call.forEach(p=>grid.append(highlight(ticker,p)));detail.append(grid);section.append(detail);
  }
  // Confirmed product deployments are different from confirmed bilateral payments.
  const deployments=financials.companies.NVDA?.officialDeployments||[];
  const related=deployments.filter(x=>ticker==="NVDA"||x.ticker===ticker);
  if(related.length){
   const details=n("details","rs64-group");details.open=true;
   details.append(n("summary",null,"공식 발표 제품 공급·가동 현황 ("+related.length+"건, 지불액 N/D)"));
   const list=n("div","rs64-newslist");
   for(const e of related){
    const item=n("article","rs64-article");
    const heading=n("div","rs64-articletop");
    const label=ticker==="NVDA"?e.name+" · "+e.product:"NVIDIA · "+e.product;
    heading.append(n("strong",null,label));item.append(heading);
    item.append(n("div","rs64-kind",e.status+" · 직접 거래액 미공시"));
    item.append(n("p","rs64-note",e.detail));
    if(safeUrl(e.source))item.append(textLink("엔비디아 공식 실적 발표 원문 ↗",e.source));
    list.append(item);
   }
   details.append(list);section.append(details);
  }
  const news=n("details","rs64-group");news.open=articles.length>0;
  news.append(n("summary",null,"최근 기사 제목의 정량 단서 ("+articles.length+"건)"));
  const container=n("div","rs64-newslist");
  if(!articles.length)container.append(n("p","rs64-empty","최근 수집된 기사 제목에서 분리 가능한 정량 수치를 찾지 못했어. 다른 공식 공시·어닝콜 수치가 없다는 의미는 아니야."));
  articles.forEach(x=>{
   const item=n("article","rs64-article");
   const top=n("div","rs64-articletop");
   top.append(n("strong","rs64-extracted",x.extracted),n("span","rs64-media",x.source||"기사"));
   item.append(top);
   item.append(textLink(x.title,x.url));
   item.append(n("div","rs64-qualifier",x.source==="기업 공식 IR"?"기업이 발표한 공식 IR 실적 수치 · 발표 원문 연결":"뉴스 제목 인용 · 원문 검증 전 · 실제 매출·거래액과 혼합 금지"));
   const dt=new Date(x.published_at);
   item.append(n("div","rs64-date",isFinite(dt.getTime())?dt.toLocaleString("ko-KR",{timeZone:"Asia/Seoul"}):"날짜 미상"));
   container.append(item);
  });
  news.append(container);section.append(news);
  section.append(n("p","rs64-footer","출처 범례: 공식 IR·CFO·컨퍼런스콜 / 기사 제목. 전망·시장 전체 수치·미래 계약 약정·확정 매출을 구분하며, 개인 투자 판단 전에 원문을 확인해야 합니다."));
  const flow=panel.querySelector(".flow-v63");
  if(flow)flow.before(section);else panel.append(section);
 });
}
function css(){
 if(document.getElementById("rs64-style"))return;
 const s=n("style");s.id="rs64-style";
 s.textContent=[
 ".rs64{margin:15px 0;padding:15px;border:1px solid #476174;border-radius:11px;background:#0c1d2e;color:#e0f3fb}",
 ".rs64-eyebrow{font-size:10px;font-weight:850;letter-spacing:.8px;color:#a2c2ff}",
 ".rs64 h3{font-size:16px!important;margin:6px 0 9px!important;color:#f1fcff}",
 ".rs64-intro,.rs64-footer{font-size:11px;color:#a9c2d4;line-height:1.65;margin:6px 0 11px}",
 ".rs64-group{margin:10px 0;border:1px solid #34516a;border-radius:8px;overflow:hidden}",
 ".rs64-group>summary{cursor:pointer;background:#17334c;color:#d4f5ff;padding:10px;font-weight:750;font-size:12px}",
 ".rs64-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(205px,1fr));gap:9px;padding:10px}",
 ".rs64-call,.rs64-article{padding:10px;background:#102c43;border:1px solid #30506a;border-radius:7px}",
 ".rs64-calltop,.rs64-articletop{display:flex;gap:8px;justify-content:space-between;align-items:center;flex-wrap:wrap}",
 ".rs64-calltop strong{font-size:12px;color:#c9e6f6}",
 ".rs64-value{font-size:15px;font-weight:850;color:#97f6dd}",
 ".rs64-kind,.rs64-qualifier{font-size:10px;color:#ffd096;margin:6px 0;line-height:1.55}",
 ".rs64-note{font-size:11px;line-height:1.7;color:#c9dce7}",
 ".rs64-call a,.rs64-article a{font-size:11px;color:#a9e7fb!important;line-height:1.6}",
 ".rs64-newslist{padding:9px;display:grid;gap:9px}",
 ".rs64-articletop strong{font-size:13px;color:#b2f4d3}",
 ".rs64-articletop span,.rs64-date{font-size:10px;color:#a0b8ce}",
 ".rs64-empty{font-size:11px;color:#a8bfce;padding:9px}",
 ".source-panel .rs64{margin:20px 0;padding:17px}",
 "@media(max-width:680px){.rs64-grid{grid-template-columns:1fr}}"
 ].join("\n");document.head.append(s);
}
async function load(){
 if(loading)return loading;
 loading=(async()=>{
  try{
   const [r1,r2]=await Promise.all([
    fetch("./latest-financials-20261126.json?v=20261126",{cache:"no-store"}),
    fetch("./news.json?v="+Math.floor(Date.now()/3600000),{cache:"no-store"})
   ]);
   if(!r1.ok||!r2.ok)throw Error("Missing financial or news data");
   financials=await r1.json();articleFeed=await r2.json();
   loaded=true;css();build(document);
  }catch(err){console.warn("Supplemental numeric media signals unavailable",err);}
 })();return loading;
}
window.initResearchSignals=(root)=>loaded?build(root):load().then(()=>build(root));
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",load);else load();
})();