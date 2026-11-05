
(function(){
"use strict";
const D=Object.assign({"MSFT":{"p":"FY27 Q1","url":"https://www.microsoft.com/en-us/Investor/earnings/FY-2027-Q1/press-release-webcast","r":[92279,[["Agents and Infra",76795],["Devices and Consumer",15484]]],"o":[45915,[["Agents and Infra",40558],["Devices and Consumer",5357]]],"note":"FY27 사업부 개편 기준. Azure는 Agents and Infra에 포함되므로 중복 합산하지 않습니다."},"AMZN":{"p":"2026 Q3","url":"https://ir.aboutamazon.com/news-release/news-release-details/2026/Amazon-com-Announces-Third-Quarter-Results/","r":[201944,[["North America",112852],["International",43108],["AWS",45984]]],"o":[28076,[["North America",8723],["International",1580],["AWS",17773]]],"note":"금액 단위 USD million. 연결 실적과 합계가 일치합니다."},"GOOGL":{"p":"2026 Q3","url":"https://www.sec.gov/Archives/edgar/data/1652044/000165204426000080/googexhibit991q32026.htm","r":[127577,[["Google Services",96302],["Google Cloud",30709],["Other Bets",372],["Hedging adjustment",194]]],"o":[40576,[["Google Services",39157],["Google Cloud",11121],["Other Bets",-2047],["Alphabet-level activities",-7655]]],"note":"Google Services에는 Search·YouTube·구독 포함. 연결 영업이익에 본사 활동 비용 반영."},"META":{"p":"2026 Q3","url":"https://investor.atmeta.com/investor-news/press-release-details/2026/Meta-Reports-Third-Quarter-2026-Results/","r":[64601,[["Family of Apps",64158],["Reality Labs",443]]],"o":[12988,[["Family of Apps",17117],["Reality Labs",-4129]]],"note":"FoA에는 광고 매출 $63,061M 포함. Q3 법적 합의 비용 $9.89B가 영업비용에 반영됨."},"AMD":{"p":"2026 Q3","url":"https://newsroom.amd.com/news/amd-reports-third-quarter-2026-earnings/","r":[13377,[["Data Center",8546],["Client",2949],["Gaming",773],["Embedded",1109]]],"o":[2832,[["Data Center",2882],["Client and Gaming",573],["Embedded",453],["All other",-1076]]],"note":"Client+Gaming은 하나의 보고 부문. Embedded 매출 $1,109M은 공시 매출 총계에서 나머지 부문을 차감해 산출한 Derived 값입니다."},"INTC":{"p":"2026 Q3","url":"https://www.intc.com/news-events/press-releases/detail/1786/intel-reports-third-quarter-2026-financial-results","r":[16513,[["CCPG",8097],["DCAI",7318],["Intel Foundry",6697],["All Other",692],["Intersegment eliminations",-6291]],true],"o":[2522,[["CCPG",2285],["DCAI",3039],["Intel Foundry",-1853],["All Other",179],["Corporate unallocated",-1058],["Intersegment eliminations",-70]]],"note":"Intel Foundry는 내부거래를 포함합니다. 부문 매출을 연결매출로 나눈 비중은 이중계산이므로 표시하지 않습니다."}},window.AI_SEGMENTS_EXTRA||{});
const fmt=n=>new Intl.NumberFormat("en-US",{maximumFractionDigits:2}).format(n);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

const PRODUCT=window.AI_PRODUCT_TAXONOMY||{};
function productTree(ticker,group,segmentRevenue){
  const entry=PRODUCT[ticker];
  const match=entry?.groups?.find(a=>a[0]===group)||(ticker==="NVDA"&&group.startsWith("Non-Data Center")?entry.groups.find(a=>a[0].startsWith("Edge Computing")):null);
  if(!match)return "";
  return '<div class="product-tree"><div class="product-tree-title">주요 제품·서비스 (제품별 매출 미공시는 N/D)</div>'+match[1].map(([name,description,amount])=>{
    const known=typeof amount==="number";
    const pct=known&&segmentRevenue>0?" · "+(amount/segmentRevenue*100).toFixed(1)+"% of segment":"";
    return '<div class="product-item"><div class="product-head"><b>'+esc(name)+'</b><span class="'+(known?"product-amount":"product-unknown")+'">'+(known?"$"+fmt(amount)+"M"+pct:"매출 N/D")+'</span></div><p>'+esc(description)+'</p></div>';
  }).join("")+'</div>';
}
function allProductTrees(ticker){
  const entry=PRODUCT[ticker];if(!entry)return "";
  return entry.groups.map(([name])=>'<div class="product-group"><h4>'+esc(name)+'</h4>'+productTree(ticker,name,null)+'</div>').join("")+'<div class="drill-note">제품·서비스 목록은 공시 사업 설명 및 포트폴리오 기준입니다. 금액이 없는 경우 비중이나 영업이익을 추정하지 않았습니다.</div>';
}

function pctBreak(items,heading){
 return '<h4 class="drill-period">'+esc(heading)+'</h4>'+items.map(([name,p])=>'<div class="drill-entry"><div class="drill-head"><span>'+esc(name)+'</span><strong>'+p+'%</strong></div><div class="drill-bar"><span style="width:'+Math.max(0,Math.min(100,p))+'%"></span></div></div>').join('');
}
function segmentBreak(ds,kind,ticker){
 const d=ds[kind==="revenue"?"r":"o"];
 const unit=ds.unit||"USD million",suffix=unit==="KRW billion"?"B":"M";
 if(!d){
   if(kind==="revenue"&&ds.pct)return pctBreak(ds.pct,ds.pctLabel||"매출 비중")+(ds.extraPct?pctBreak(ds.extraPct,ds.extraPctLabel||"추가 비중"):"")+allProductTrees(ticker)+'<p class="drill-note">'+esc(ds.note)+'</p><a class="drill-source" target="_blank" rel="noopener noreferrer" href="'+esc(ds.url)+'">공시 원문 ↗</a>';
   return '<p class="drill-note">부문별 금액은 공식 공시에서 분리 확인되지 않았습니다. N/D</p>';
 }
 const [total,parts,noShare]=d;
 const lines=parts.map(([name,n])=>{
   const pct=kind==="revenue"&&!noShare&&n>=0?(n/total*100):null;
   const r=ds.r?.[1].find(x=>x[0]===name)?.[1];
   const m=kind==="operating"&&r>0&&(ds.oLabel? !/EBITDA/i.test(ds.oLabel):true)?(n/r*100):null;
   return '<div class="drill-entry"><div class="drill-head"><span>'+esc(name)+'</span><strong>'+(n<0?'−':'')+fmt(Math.abs(n))+suffix+'</strong>'+(pct!==null?'<em>'+pct.toFixed(1)+'%</em>':'')+'</div>'+(pct!==null?'<div class="drill-bar"><span style="width:'+Math.min(100,pct)+'%"></span></div>':'')+(m!==null?'<div class="drill-math">영업이익률 '+m.toFixed(1)+'%</div>':'')+(kind==='revenue'&&!(ticker==='NVDA'&&name==='Data Center')?productTree(ticker,name,n):'')+'</div>';
 }).join('');
 const sum=parts.reduce((x,a)=>x+a[1],0);
 const discrepancy=total-sum;
 const basis=kind==="revenue"?"매출":(ds.oLabel||"사업부 영업이익");
 const featured=kind==="revenue"&&ticker==="NVDA"?'<div class="drill-period" style="color:#78ead2;font-weight:800">NVIDIA DATA CENTER · GPU 세대와 핵심 AI 시스템</div>'+productTree(ticker,"Data Center",89000)+'<p class="drill-note">아래 부문별 금액은 제품별 매출과 다릅니다. GPU 개별 매출은 공시하지 않으며 Blackwell·Rubin 칩과 NVL72 시스템은 중첩되는 플랫폼입니다.</p>':"";
 return '<div class="drill-period">'+esc(ds.p)+' · '+esc(unit)+' · '+esc(basis)+'</div>'+featured+lines+'<div class="drill-total"><span>표시 기준 합계</span><strong>'+fmt(total)+suffix+'</strong></div>'+(Math.abs(discrepancy)>0.5?'<div class="drill-warning">공시 합계와 잔차 '+fmt(discrepancy)+suffix+'</div>':'')+'<p class="drill-note">'+esc(ds.note||'')+'</p>'+(kind==="revenue"&&ds.pct?pctBreak(ds.pct,ds.pctLabel||"별도 분류별 매출 비중"):"")+(kind==="revenue"&&ds.extraPct?pctBreak(ds.extraPct,ds.extraPctLabel||"추가 비중"):"")+(kind==='revenue'&&PRODUCT[ticker]&&!PRODUCT[ticker].groups.some(g=>parts.some(p=>p[0]===g[0]))?allProductTrees(ticker):'')+'<a class="drill-source" href="'+esc(ds.url)+'" target="_blank" rel="noopener noreferrer">기업 IR / SEC 원문 ↗</a>';
}
function kindOf(s){
 s=(s||'').trim().toLowerCase();
 if(/^(revenue|매출|매출 \(gaap\)|연결 매출|매출\(usd\)|매출 \(usd\))$/.test(s))return "revenue";
 if(/^(operating income|영업이익|영업이익 \(gaap\)|gaap 영업이익)$/.test(s)||s.includes("segment operating")||s.includes("adjusted ebitda")||s.includes("보고부문 영업이익")||s.includes("지역부문 영업이익"))return "operating";
 if(s.includes("operating margin")||s.includes("영업이익률"))return "opmargin";
 if(s.includes("gross margin")||s.includes("매출총이익률"))return "grossmargin";
 if(s.includes("net margin")||s.includes("순이익률"))return "netmargin";
 return null;
}
function marginBreak(ds,kind){
 const explicit=kind==="grossmargin"?ds.gm:ds.om;
 if(explicit)return '<div class="drill-period">'+esc(ds.p)+' · 회사 보고 사업부별 '+(kind==="grossmargin"?"매출총이익률":"영업이익률")+'</div>'+explicit.map(([name,p])=>'<div class="drill-entry"><div class="drill-head"><span>'+esc(name)+'</span><strong>'+p+'%</strong></div></div>').join('')+'<p class="drill-note">회사 공시 마진은 반올림되어 있으므로 이익 금액을 역산해서 보고 수치로 사용하지 않습니다.</p><a class="drill-source" href="'+esc(ds.url)+'" target="_blank" rel="noopener noreferrer">공시 원문 ↗</a>';
 if(kind==="opmargin"&&ds.o&&ds.r&&!/EBITDA/i.test(ds.oLabel||"")){
   const list=ds.o[1].map(([name,op])=>{let rev=ds.r[1].find(x=>x[0]===name)?.[1];return rev>0?'<div class="drill-entry"><div class="drill-head"><span>'+esc(name)+'</span><strong>'+(op/rev*100).toFixed(1)+'%</strong></div><div class="drill-math">'+fmt(op)+' / '+fmt(rev)+'</div></div>':''}).join('');
   return list+'<p class="drill-note">동일 기간에 공시된 부문별 이익을 부문별 매출로 나눈 Derived 수치입니다.</p>';
 }
 return '<p class="drill-note">동일 분기의 부문별 '+(kind==="grossmargin"?"매출총이익률":"영업이익률")+'을 검증할 수 있는 공시가 없어 N/D로 표시합니다. 연결 손익을 매출 비중대로 임의 배분하지 않습니다.</p>';
}
function normalizePeriod(text){
 const s=String(text||"").toUpperCase().replace(/FISCAL YEAR|FISCAL/g,"FY").replace(/FY202(\d)/g,"FY2$1");
 const match=s.match(/\b(FY)?\s*(?:20)?(2[4-9])\s*Q([1-4])\b/);
 return match?((match[1]?"FY":"CY")+match[2]+"Q"+match[3]):"";
}
function drill(ds,kind,period,old,ticker){
 if(!ds)return '<p class="drill-note">이 기업의 부문별 실적 수치는 아직 확인되지 않았습니다. 매출/영업이익 금액은 N/D로 표시합니다.</p>'+(kind==='revenue'?allProductTrees(ticker):'');
 const dsP=normalizePeriod(ds.p),rowP=normalizePeriod(period);
 const mismatch=dsP&&rowP&&dsP!==rowP;
 const periodNotice=mismatch?'<div class="drill-warning">선택한 지표는 '+esc(period)+' 기준, 아래 상세 구성은 '+esc(ds.p)+' 기준입니다. 서로 다른 분기의 금액과 비중은 혼합하지 마세요.</div>':'';
 let body;
 if(kind==="revenue"||kind==="operating")body=segmentBreak(ds,kind,ticker);
 else if(kind==="grossmargin"||kind==="opmargin")body=marginBreak(ds,kind);
 else body='<p class="drill-note">연결 순이익률은 법인세·금융손익·공통비용 영향을 받으므로, 사업부별 순이익이 미공시인 경우 임의 배분하지 않습니다.</p>';
 // No separate segment card. Click the original metric and show its breakdown below.
 return periodNotice+body;
}
function apply(root){
 let done=0;
 for(const panel of root.querySelectorAll(".company-panel")){
  const ticker=panel.querySelector("h2 span")?.textContent.trim().toUpperCase(),ds=D[ticker],extra=window.AI_SEGMENTS_EXTRA?.[ticker];
  for(const card of panel.querySelectorAll(".latest-earnings,.common-block")){
   const old=card.classList.contains("common-block");
   for(const row of [...card.querySelectorAll(".metric-row")]){
    if(row.closest("details.metric-expand"))continue;
    const label=row.querySelector(".mr-left>div>span")?.textContent||"",kind=kindOf(label);if(!kind)continue;
    const period=row.querySelector(".mr-left small")?.textContent||"";
    const details=document.createElement("details");details.className="metric-expand";
    const summary=document.createElement("summary");summary.setAttribute("aria-label",label+" 세부 구성 보기");
    row.before(details);details.append(summary);summary.append(row);
    const car=document.createElement("span");car.className="drill-caret";car.textContent="부문별 상세 보기 ▾";summary.append(car);
    const body=document.createElement("div");body.className="drill-body";body.innerHTML=drill(ds,kind,period,old,ticker);details.append(body);done++;
   }
  }
 }
 return done;
}
window.initFinanceDrilldowns=apply;
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>apply(document));else apply(document);
})();