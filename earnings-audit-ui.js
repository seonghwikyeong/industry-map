/* AI Industry Map V4.2 · fiscal/calendar period audit */
(function(){
"use strict";
const E=window.AI_EARNINGS_PERIODS||{};
const P=window.AI_SEGMENTS_EXTRA||{};
const C={MSFT:"FY26 Q4",AMZN:"2026 Q2",GOOGL:"2026 Q2",META:"2026 Q2",ORCL:"FY26 Q4",NVDA:"FY27 Q2",AMD:"2026 Q2",AVGO:"FY26 Q2",MRVL:"FY27 Q2",MU:"FY26 Q4",SKH:"2026 Q2",SAMSUNG:"2026 Q2",TSM:"2026 Q2",INTC:"2026 Q2",ASML:"2026 Q2",AMAT:"FY26 Q3",LRCX:null,KLAC:"FY26 Q4",ASE:"2026 Q2",AMKR:"2026 Q2",CSCO:"FY26 Q4",COHR:"FY26 Q4",LITE:"FY26 Q4",DELL:"FY27 Q2",HPE:"FY26 Q3",QUANTA:"2026 Q2",WISTRON:"2026 Q2",FOXCONN:"2026 Q2",VRT:"2026 Q2",ETN:"2026 Q2",GEV:"2026 Q2",CARR:"2026 Q2",TT:"2026 Q2",PWR:"2026 Q2",CEG:"2026 Q2",VST:"2026 Q2",NEE:"2026 Q2",WMB:"2026 Q2",CRWV:"2026 Q2",IREN:"FY26 Q4",NBIS:"2026 Q2"};
const fmt=s=>s?s.replace(/-/g,". "):null;
function normalize(s){return String(s||"").replace(/\s+/g,"").toUpperCase()}
function strip(s){return String(s||"").trim()}
function panelTicker(panel){return panel.querySelector("h2 span")?.textContent.trim().toUpperCase()}
function build(panel){
 const ticker=panelTicker(panel),x=E[ticker];if(!ticker||!x||panel.querySelector(".earnings-date-audit"))return;
 const latest=panel.querySelector(".latest-earnings"),common=panel.querySelector(".common-block");
 const actual=x.period;
 const snap=common?.querySelector(".metric-row small")?.textContent.trim()||C[ticker]||null;
 const hasLatest=Boolean(latest);
 const definedSource=Boolean(x.verified&&x.release&&x.url);
 const now=new Date();
 const released=x.release?Date.parse(x.release+"T23:59:59+09:00"):null;
 const future=x.release&&released>now.getTime();
 const block=document.createElement("section");
 block.className="earnings-date-audit";
 block.setAttribute("aria-label","실적 회계기간 및 검증 상태");
 const heading=document.createElement("div");heading.className="earnings-audit-title";heading.textContent="실적 기간·발표일 확인";block.append(heading);
 const headline=document.createElement("div");headline.className="earnings-audit-main";
 if(!actual){
   headline.textContent="최신 발표 실적 확인 전 · 아래 재무 수치는 기존 스냅샷 또는 N/D";
   block.classList.add("earnings-audit-unverified");
 }else if(future){
   headline.textContent="발표 예정 또는 미래 발표일 · 실제 발표 확인 전";
   block.classList.add("earnings-audit-future");
   if(latest){latest.classList.add("earnings-future-blocked");latest.querySelectorAll(".metric-row").forEach(row=>row.classList.add("earnings-future-value"));}
 }else{
   headline.textContent="표시 기준: "+actual+" "+(definedSource?"· 공식 발표 확인":"· 분기/발표일 추가 검증 필요");
   block.classList.add(definedSource?"earnings-audit-verified":"earnings-audit-unverified");
 }
 block.append(headline);
 const details=document.createElement("div");details.className="earnings-audit-details";
 const explanations=[];
 if(actual?.startsWith("FY"))explanations.push("FY = 회사 자체 회계연도 (달력상 "+actual.replace(/^FY(\d\d).*/,"20$1")+"년의 실적이라는 뜻이 아님)");
 else if(actual)explanations.push("달력상 분기");
 if(x.start&&x.end)explanations.push("대상 기간 "+fmt(x.start)+" ~ "+fmt(x.end));
 else if(x.end)explanations.push("분기 종료 "+fmt(x.end));
 if(x.release)explanations.push((definedSource?"공식 발표 ":"사이트 기재 발표일 · 미검증 ")+fmt(x.release));
 if(snap&&actual&&normalize(snap)!==normalize(actual))explanations.push("공통 FA 기존 스냅샷 "+snap+" (최신 실적과 분리)");
 else if(snap&&!actual)explanations.push("기존 스냅샷 "+snap);
 if(!definedSource)explanations.push("표시된 수치의 실적 발표일·출처 일치 추가 확인 필요");
 details.textContent=explanations.join("  |  ");block.append(details);
 if(definedSource){const link=document.createElement("a");link.textContent="공식 실적 발표 원문 ↗";link.href=x.url;link.target="_blank";link.rel="noopener noreferrer";block.append(link)}
 const h2=panel.querySelector("h2");if(h2)h2.after(block);
 if(snap&&actual&&normalize(snap)!==normalize(actual)&&common){
   const banner=document.createElement("div");banner.className="earnings-audit-old";banner.textContent="과거 재무 스냅샷 · "+snap+" · 최신 "+actual+"과 혼합 계산 금지";const title=common.querySelector("h3");if(title)title.after(banner);
 }
 if(latest&&actual&&!definedSource&&!future){const note=document.createElement("div");note.className="earnings-audit-old";note.textContent="발표일 및 해당 분기 공시 원문과 수치의 대응관계 추가 확인 필요";latest.querySelector("h3")?.after(note);}
}
function init(root){for(const p of (root||document).querySelectorAll(".company-panel"))build(p)}
const style=document.createElement("style");style.textContent=[
".earnings-date-audit{margin:10px 0 14px;padding:11px 13px;border-radius:9px;border:1px solid #325673;background:#0b2435;font-size:12px;line-height:1.7;color:#d3e8f5}",
".earnings-audit-title{font-size:11px;font-weight:750;color:#99c6d7;margin-bottom:3px;letter-spacing:.03em}",
".earnings-audit-main{font-size:13px;font-weight:800;color:#dcfff0}",
".earnings-audit-unverified .earnings-audit-main{color:#ffcf91}",
".earnings-audit-future .earnings-audit-main{color:#ffab9a}",
".earnings-audit-details{margin:5px 0;font-size:11px;color:#a8c6d6;line-height:1.65}",
".earnings-date-audit a{color:#93ddf1;font-size:12px}",
".earnings-audit-old{margin:7px 0 12px;padding:6px 9px;border-left:3px solid #d0aa69;background:#392c23;color:#f1d7b1;font-size:11px;line-height:1.6}",
".earnings-future-blocked .earnings-future-value{display:none!important}",
".source-panel .earnings-date-audit{font-size:15px;padding:15px 17px}",
".source-panel .earnings-audit-main{font-size:16px}",
".source-panel .earnings-audit-details,.source-panel .earnings-date-audit a,.source-panel .earnings-audit-old{font-size:13px}"
].join("\n");document.head.appendChild(style);
window.initEarningsPeriodAudit=init;
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>init(document));else init(document);
})();
