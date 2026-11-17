/* AI Industry Map V6.3 · verified-only bilateral money-flow disclosures.
   Only signed documented business contracts, booked bilateral commercial revenue,
   and completed share investments. No estimates, forecasts, inferred links or formulae. */
(function(){
"use strict";
let data=null,pending=null;
const KINDS={
 signed_commitment:"체결된 구매·사용 약정",
 confirmed_contract:"확인된 공급·서비스 계약",
 recognized_revenue:"기업이 인식한 관련 매출",
 completed_investment:"집행 완료된 지분투자"
};
function el(tag,cls,content){
 const x=document.createElement(tag);if(cls)x.className=cls;if(content!==undefined)x.textContent=String(content);return x;
}
function createRecord(r,ticker,side){
 const box=el("article","flow-v63-record");
 const head=el("div","flow-v63-top");
 const other=side==="out"?r.to:r.from;
 const direction=el("a","flow-v63-pair",r.from+" → "+r.to);
 direction.href="./company.html?ticker="+encodeURIComponent(other);
 direction.title=other+" 상세 분석 페이지";
 head.append(direction);
 head.append(el("span","flow-v63-type",KINDS[r.type]));
 box.append(head);
 box.append(el("h4","flow-v63-name",r.label));
 if(r.amount){
  const block=el("div","flow-v63-value");
  block.append(el("strong",null,r.amount.display));
  block.append(el("span",null,r.type==="recognized_revenue"?"매출 인식액 · 해당 회계연도":
      r.type==="completed_investment"?"실제 지분 투자 거래":
      r.amount.unit==="GW"?"계약상 설비 용량 · 구매대금 비공개":"장기 계약 약정·상한 · 실제 지급액 아님"));
  box.append(block);
 }else{
  box.append(el("div","flow-v63-undisclosed","거래 금액 비공개"));
 }
 box.append(el("p","flow-v63-detail",r.detail));
 const source=el("div","flow-v63-source");
 const date=r.signed||"날짜 미확인";
 source.append(el("span",null,"확인 기준 "+date+" · "));
 (r.sources||[]).forEach((s,i)=>{
  if(i)source.append(document.createTextNode(" · "));
  const a=el("a",null,"공시·IR 원문 "+(i+1)+" ↗");
  a.href=s.url;a.title=s.label;a.target="_blank";a.rel="noopener noreferrer";source.append(a);
 });
 box.append(source);
 return box;
}
function section(ticker,kind,rows){
 const detail=el("details","flow-v63-group");
 detail.open=true;
 detail.append(el("summary",null,(kind==="in"?"확인된 유입 · 고객/투자자":"확인된 유출 · 서비스 구매/투자")+" ("+rows.length+"건)"));
 if(!rows.length){
  detail.append(el("p","flow-v63-empty","현재 공개된 공식 계약·공시 중 검증된 해당 방향의 거래가 없습니다. 거래가 존재하지 않는다는 의미는 아닙니다."));
 }else{
  const list=el("div","flow-v63-list");
  for(const row of rows)list.append(createRecord(row,ticker,kind));
  detail.append(list);
 }
 return detail;
}
function panelTicker(panel){return panel.querySelector("h2 span")?.textContent?.trim()?.toUpperCase()}
function draw(root){
 if(!data)return;
 (root||document).querySelectorAll(".company-panel").forEach(panel=>{
  const ticker=panelTicker(panel);
  if(!ticker||!data.companies.includes(ticker)||panel.querySelector(".flow-v63"))return;
  // Discard any old speculative widget on dynamic detail-page upgrades.
  panel.querySelectorAll(".flow-v62").forEach(x=>x.remove());
  const main=el("section","flow-v63");
  main.dataset.moneyTicker=ticker;
  main.append(el("div","flow-v63-eyebrow","VERIFIED MONEY-FLOW · 공시 확인 자료만"));
  main.append(el("h3",null,ticker+" · 실제 확인된 계약·자금흐름"));
  main.append(el("p","flow-v63-explain","공식 계약서·SEC 공시·기업 IR에서 거래 당사자와 계약 내용이 확인된 항목만 표시합니다. 금액 비공개는 추정하지 않습니다."));
  main.append(section(ticker,"in",data.links.filter(x=>x.to===ticker)));
  main.append(section(ticker,"out",data.links.filter(x=>x.from===ticker)));
  main.append(el("p","flow-v63-caveat","계약상 약정액·최대 한도는 현금 지급액 또는 매출 인식액과 다릅니다. 지분투자, 서비스 계약, 회사별 매출 인식 금액도 서로 합산하지 않습니다. 공시 당시 상태이며 이후 변경은 별도 재검증이 필요합니다."));
  panel.append(main);
 });
}
function css(){
 if(document.getElementById("flow-v63-style"))return;
 const s=el("style");s.id="flow-v63-style";
 s.textContent=[
 ".flow-v63{margin:16px 0 22px;padding:15px;border:1px solid #3e7181;border-radius:11px;background:#091e2d;color:#e6f5ff}",
 ".flow-v63-eyebrow{color:#76e7d1;font-weight:800;font-size:10px;letter-spacing:1px}",
 ".flow-v63 h3{font-size:17px!important;margin:7px 0 9px!important;color:#eafaff}",
 ".flow-v63-explain,.flow-v63-caveat{font-size:11px;line-height:1.7;color:#b4ccd7;margin:9px 0 12px}",
 ".flow-v63-group{border:1px solid #33546a;border-radius:8px;margin:10px 0;overflow:hidden}",
 ".flow-v63-group summary{font-size:12px;font-weight:800;cursor:pointer;background:#12364b;padding:10px 13px}",
 ".flow-v63-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(215px,1fr));gap:9px;padding:9px}",
 ".flow-v63-record{padding:12px;background:#102e42;border:1px solid #33576e;border-radius:8px;min-width:0}",
 ".flow-v63-top{display:flex;gap:7px;align-items:center;flex-wrap:wrap;justify-content:space-between}",
 ".flow-v63-pair{color:#a2e8f4!important;font-size:12px;font-weight:850;text-decoration:none}",
 ".flow-v63-pair:hover{text-decoration:underline}",
 ".flow-v63-type{border-radius:4px;background:#25475b;color:#b9e6f3;padding:4px 6px;font-size:10px}",
 ".flow-v63-name{font-size:13px!important;color:#ecf8ff!important;margin:9px 0!important}",
 ".flow-v63-value{padding:8px;background:#163d49;border-left:3px solid #6bdfc6;border-radius:5px}",
 ".flow-v63-value strong{font-size:15px;display:block;color:#d1fff3}",
 ".flow-v63-value span{display:block;font-size:10px;margin-top:6px;color:#a6cbd0}",
 ".flow-v63-undisclosed{font-size:12px;font-weight:750;color:#d3d7da}",
 ".flow-v63-detail{font-size:11px;color:#d0e1ed;line-height:1.7;margin:9px 0}",
 ".flow-v63-source{font-size:10px;line-height:1.7;color:#91a9bd;border-top:1px solid #35566b;padding-top:8px}",
 ".flow-v63-source a{font-size:10px;color:#8ce4eb!important;text-decoration:underline}",
 ".flow-v63-empty{color:#aabed1;line-height:1.7;padding:15px;font-size:12px}",
 ".source-panel .flow-v63{padding:17px}.source-panel .flow-v63-detail,.source-panel .flow-v63-explain{font-size:13px}",
 "@media(max-width:680px){.flow-v63-list{grid-template-columns:1fr}.flow-v63{padding:10px}}"
 ].join("\n");
 document.head.append(s);
}
async function fetchData(){
 if(pending)return pending;
 pending=(async()=>{
  try{
   const res=await fetch("./money-flow-links.json?v=63",{cache:"no-store"});
   if(!res.ok)throw Error("HTTP "+res.status);
   const payload=await res.json();
   const known=new Set(payload.companies||[]);
   const allowed=new Set(Object.keys(KINDS));
   if(known.size!==47||!Array.isArray(payload.links)||payload.links.some(x=>
     !known.has(x.from)||!known.has(x.to)||!allowed.has(x.type)||
     !Array.isArray(x.sources)||!x.sources.length||!x.sources.every(s=>/^https:\/\//.test(s.url))||
     (x.amount&&!x.amount.display)))throw Error("Unverified money-flow data");
   data=payload;css();draw(document);
  }catch(err){console.warn("Verified money-flow disclosure not loaded",err);}
 })();
 return pending;
}
window.initIndustryMoneyFlow=(root)=>data?draw(root):fetchData().then(()=>draw(root));
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",fetchData);else fetchData();
})();