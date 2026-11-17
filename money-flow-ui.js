/* AI Industry Map V6.2 · 47-company contextual money-flow network.
 * Conceptual procurement/spending adjacency, not confirmed bilateral amounts.
 * Existing eight quantified values remain marked hypothetical assumptions.
 */
(function(){
"use strict";
let model=null, pending=null;
const QUANT=[
 ["MSFT","NVDA","$41B × 66.7% × 65% ≈ $17.8B"],
 ["META","NVDA","$137.5B × 75% × 55% × 70% ≈ $39.7B"],
 ["AMZN","NVDA","$169B × 70% × 45% × 80% ≈ $42.6B"],
 ["GOOGL","AVGO","$200B × 75% × 55% × 18% ≈ $14.9B"],
 ["NVDA","MU","$89B × 10% × 20% ≈ $1.78B"],
 ["NVDA","ANET","$100B × 12% × 35% = $4.2B"],
 ["NVDA","VRT","$100B × 15% × 18% = $2.7B"],
 ["NVDA","ETN","$100B × 10% × 25% = $2.5B"]
];
const quant=new Map(QUANT.map(([a,b,value])=>[a+"|"+b,value]));
function node(tag,cls,text){
 const n=document.createElement(tag);if(cls)n.className=cls;
 if(text!==undefined)n.textContent=String(text);
 return n;
}
function titleOf(ticker){
 const index=[...document.querySelectorAll(".company-panels > .company-panel")].find(p=>p.querySelector("h2 span")?.textContent.trim().toUpperCase()===ticker);
 if(index){const a=index.querySelector("h2 a");if(a)return a.textContent.replace(ticker,"").replace("↗","").trim();}
 return ticker;
}
function edgeCard(link,ticker,side){
 const partner=side==="out"?link.to:link.from;
 const article=node("article","flow-v62-card");
 const first=node("div","flow-v62-tops");
 const anchor=node("a","flow-v62-route",side==="out"?ticker+" → "+partner:partner+" → "+ticker);
 anchor.href="./company.html?ticker="+encodeURIComponent(partner);
 anchor.title=partner+" 기업 상세 분석으로 이동";
 first.append(anchor);
 const scenario=quant.get(link.from+"|"+link.to);
 const flag=node("span",scenario?"flow-v62-tag scenario":"flow-v62-tag","산업구조 가정"+(scenario?" · 정량 시나리오":""));
 first.append(flag);article.append(first);
 article.append(node("p","flow-v62-detail",link.detail));
 if(scenario){
  const calc=node("div","flow-v62-scenario",scenario);
  const mark=node("small",null,"기존 가정 기반 배분 계산 · 실제 거래액/확정 매출 아님");
  calc.append(mark);article.append(calc);
 }
 const footer=node("div","flow-v62-foot",side==="out"?"지출·조달 방향 → 공급업체/인프라":"수요·매출 노출 방향 ← 고객/수요처");
 article.append(footer);
 return article;
}
function makeGroup(ticker,links,type){
 const incoming=type==="in",heading=node("details","flow-v62-group");
 heading.open=links.length<=7;
 const summary=node("summary",null,(incoming?"들어오는 잠재 수요 · 고객/수요처":"나가는 잠재 지출 · 공급업체/설비")+" ("+links.length+"개)");
 heading.append(summary);
 const list=node("div","flow-v62-list");
 links.forEach(link=>list.append(edgeCard(link,ticker,incoming?"in":"out")));
 heading.append(list);return heading;
}
function renderPanel(panel){
 if(!model||panel.querySelector(".flow-v62"))return;
 const ticker=panel.querySelector("h2 span")?.textContent?.trim()?.toUpperCase();
 if(!ticker||!model.companies.includes(ticker))return;
 const inbound=model.links.filter(x=>x.to===ticker),outbound=model.links.filter(x=>x.from===ticker);
 const root=node("section","flow-v62");root.dataset.moneyTicker=ticker;
 const header=node("div","flow-v62-head");
 header.append(node("div","flow-v62-eyebrow","QUANTITATIVE MONEY-FLOW EDGE · "+ticker));
 header.append(node("h3",null,ticker+" 자금흐름 관계"));
 header.append(node("p","flow-v62-explain","아래 화살표는 실제 대금 지급이 검증된 계약 목록이 아니라 AI 가치사슬에서 나타날 수 있는 구매·투자·매출노출 방향을 나타냅니다. 상대 기업명 클릭 시 상세 화면으로 이동합니다."));
 root.append(header);
 root.append(makeGroup(ticker,inbound,"in"));
 root.append(makeGroup(ticker,outbound,"out"));
 root.append(node("p","flow-v62-warning","주의: 정량 시나리오의 배분율은 가정값입니다. 공개 CapEx, 예상 수주, 실제 현금지출, 매출 인식 시점은 서로 다르며 중복 합산하면 안 됩니다. 직접 계약 여부·금액은 확인되지 않았습니다."));
 panel.append(root);
}
function init(root){
 if(!model)return;
 const scope=root||document;
 scope.querySelectorAll(".company-panel").forEach(renderPanel);
}
function connectOriginalControls(){
 const old=document.querySelector(".rightbar > .edge-panels");
 if(old){
  old.hidden=true;old.style.display="none";
  const heading=old.previousElementSibling;
  if(heading?.classList.contains("right-section-title")){heading.hidden=true;heading.style.display="none";}
  const divider=heading?.previousElementSibling;
  if(divider?.classList.contains("divider")){divider.hidden=true;divider.style.display="none";}
 }
 const mainTitle=[...document.querySelectorAll(".section-title")].find(e=>/Quantitative money-flow edges/i.test(e.textContent));
 if(mainTitle)mainTitle.textContent="Money-flow 시나리오 8개 · 기업 선택 시 해당 기업 관계 보기";
 document.querySelectorAll(".edge-grid label.edge-chip").forEach((chip,index)=>{
  if(chip.dataset.flowV62Connected)return;
  chip.dataset.flowV62Connected="1";
  chip.addEventListener("click",()=>{
   const record=QUANT[index];
   if(!record)return;
   const ticker=record[0];
   const panel=[...document.querySelectorAll(".company-panels > .company-panel")].find(p=>p.querySelector("h2 span")?.textContent.trim().toUpperCase()===ticker);
   const cls=panel?.className.match(/\bcp-(\d+)\b/);
   const input=cls&&document.getElementById("company-"+cls[1]);
   if(input){input.checked=true;input.dispatchEvent(new Event("change",{bubbles:true}));}
   if(panel){
    const cards=[...panel.querySelectorAll(".flow-v62-card")];
    const matched=cards.find(card=>card.querySelector(".flow-v62-route")?.textContent.trim()===record[0]+" → "+record[1]);
    if(matched){
     const group=matched.closest("details");if(group)group.open=true;
     matched.classList.add("flow-v62-emphasis");
     setTimeout(()=>matched.classList.remove("flow-v62-emphasis"),1300);
    }
   }
  });
 });
}
function css(){
 if(document.getElementById("money-flow-v62-styles"))return;
 const style=node("style");style.id="money-flow-v62-styles";
 style.textContent=[
 ".flow-v62{margin:18px 0 20px;padding:14px;border:1px solid #376677;border-radius:12px;background:#0b2132;color:#e0f1fa}",
 ".flow-v62-eyebrow{font-size:10px;letter-spacing:.07em;color:#7fe6d2;font-weight:800}",
 ".flow-v62-head h3{font-size:17px!important;color:#e6fdff;margin:6px 0!important}",
 ".flow-v62-explain{font-size:11px;line-height:1.65;color:#a8c8da;margin:5px 0 13px}",
 ".flow-v62-group{margin-top:9px;border:1px solid #31546b;border-radius:9px;overflow:hidden}",
 ".flow-v62-group>summary{padding:11px 12px;color:#eaf7ff;font-size:13px;font-weight:750;cursor:pointer;background:#15344b}",
 ".flow-v62-list{padding:10px;display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:9px}",
 ".flow-v62-card{background:#0d2b40;border:1px solid #2b4e62;border-radius:8px;padding:11px;min-width:0}",
 ".flow-v62-tops{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:7px}",
 ".flow-v62-route{color:#97e9f7!important;font-size:13px;font-weight:800;text-decoration:none}",
 ".flow-v62-route:hover{text-decoration:underline}",
 ".flow-v62-tag{background:#223f4c;color:#adcad4;padding:3px 6px;border-radius:4px;font-size:10px}",
 ".flow-v62-tag.scenario{background:#4e3a26;color:#f6c783}",
 ".flow-v62-detail{font-size:12px;line-height:1.5;color:#d3e4ea;margin:8px 0}",
 ".flow-v62-foot{font-size:10px;color:#90a9b9;border-top:1px solid #355368;padding-top:8px}",
 ".flow-v62-scenario{padding:8px;border:1px dashed #9b7c49;border-radius:5px;color:#ffd391;font-size:12px;font-weight:750;margin:8px 0}",
 ".flow-v62-scenario small{display:block;font-size:10px;font-weight:400;line-height:1.5;color:#d4b9a0;margin-top:5px}",
 ".flow-v62-warning{font-size:11px;line-height:1.7;margin:11px 0 0;color:#c4b9ad}",
 ".flow-v62-card.flow-v62-emphasis{outline:2px solid #ffc87a}",
 ".source-panel .flow-v62{padding:17px;margin:22px 0}",
 ".source-panel .flow-v62-detail{font-size:14px}",
 ".source-panel .flow-v62-explain,.source-panel .flow-v62-warning{font-size:13px}",
 "@media(max-width:700px){.flow-v62-list{grid-template-columns:1fr}.flow-v62{padding:10px}}"
 ].join("\n");
 document.head.append(style);
}
async function start(){
 if(pending)return pending;
 pending=(async()=>{
  try{
   const r=await fetch("./money-flow-links.json?v=62",{cache:"no-store"});
   if(!r.ok)throw new Error("HTTP "+r.status);
   const d=await r.json();
   if(!Array.isArray(d.companies)||d.companies.length!==47||!Array.isArray(d.links))throw new Error("Invalid money-flow dataset");
   if(d.links.some(link=>!d.companies.includes(link.from)||!d.companies.includes(link.to)||!link.detail||link.monetary_value!==null))throw new Error("Invalid money-flow directed relationship");
   model=d;css();connectOriginalControls();init(document);
  }catch(e){console.warn("Company-specific money-flow unavailable",e);}
 })();
 return pending;
}
window.initIndustryMoneyFlow=(root)=>{if(model)init(root);else start().then(()=>init(root))};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();