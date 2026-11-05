/* AI Industry Map · Financial drilldowns · v3.2 */
(function(){
"use strict";
const D={"MSFT":{"p":"FY27 Q1","url":"https://www.microsoft.com/en-us/Investor/earnings/FY-2027-Q1/press-release-webcast","r":[92279,[["Agents and Infra",76795],["Devices and Consumer",15484]]],"o":[45915,[["Agents and Infra",40558],["Devices and Consumer",5357]]],"note":"FY27 사업부 개편 기준. Azure는 Agents and Infra에 포함되므로 중복 합산하지 않습니다."},"AMZN":{"p":"2026 Q3","url":"https://ir.aboutamazon.com/news-release/news-release-details/2026/Amazon-com-Announces-Third-Quarter-Results/","r":[201944,[["North America",112852],["International",43108],["AWS",45984]]],"o":[28076,[["North America",8723],["International",1580],["AWS",17773]]],"note":"금액 단위 USD million. 연결 실적과 합계가 일치합니다."},"GOOGL":{"p":"2026 Q3","url":"https://www.sec.gov/Archives/edgar/data/1652044/000165204426000080/googexhibit991q32026.htm","r":[127577,[["Google Services",96302],["Google Cloud",30709],["Other Bets",372],["Hedging adjustment",194]]],"o":[40576,[["Google Services",39157],["Google Cloud",11121],["Other Bets",-2047],["Alphabet-level activities",-7655]]],"note":"Google Services에는 Search·YouTube·구독 포함. 연결 영업이익에 본사 활동 비용 반영."},"META":{"p":"2026 Q3","url":"https://investor.atmeta.com/investor-news/press-release-details/2026/Meta-Reports-Third-Quarter-2026-Results/","r":[64601,[["Family of Apps",64158],["Reality Labs",443]]],"o":[12988,[["Family of Apps",17117],["Reality Labs",-4129]]],"note":"FoA에는 광고 매출 $63,061M 포함. Q3 법적 합의 비용 $9.89B가 영업비용에 반영됨."},"AMD":{"p":"2026 Q3","url":"https://newsroom.amd.com/news/amd-reports-third-quarter-2026-earnings/","r":[13377,[["Data Center",8546],["Client",2949],["Gaming",773],["Embedded",1109]]],"o":[2832,[["Data Center",2882],["Client and Gaming",573],["Embedded",453],["All other",-1076]]],"note":"Client+Gaming은 하나의 보고 부문. Embedded 매출 $1,109M은 공시 매출 총계에서 나머지 부문을 차감해 산출한 Derived 값입니다."},"INTC":{"p":"2026 Q3","url":"https://www.intc.com/news-events/press-releases/detail/1786/intel-reports-third-quarter-2026-financial-results","r":[16513,[["CCPG",8097],["DCAI",7318],["Intel Foundry",6697],["All Other",692],["Intersegment eliminations",-6291]],true],"o":[2522,[["CCPG",2285],["DCAI",3039],["Intel Foundry",-1853],["All Other",179],["Corporate unallocated",-1058],["Intersegment eliminations",-70]]],"note":"Intel Foundry는 내부거래를 포함합니다. 부문 매출을 연결매출로 나눈 비중은 이중계산이므로 표시하지 않습니다."}};
const fmt=n=>new Intl.NumberFormat("en-US",{maximumFractionDigits:0}).format(n);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function rowBlock(dataset,kind){
 const [total,parts,noShare]=dataset[kind==="revenue"?"r":"o"];
 let rows=parts.map(([label,amount])=>{
 const pct=kind==="revenue"&&!noShare&&amount>=0?amount/total*100:null;
 const revenue=dataset.r[1].find(x=>x[0]===label);
 const margin=kind==="operating"&&revenue&&revenue[1]>0?(amount/revenue[1]*100).toFixed(1):null;
 return '<div class="drill-entry"><div class="drill-head"><span>'+esc(label)+'</span><strong>'+(amount<0?"−":"")+fmt(Math.abs(amount))+'M</strong>'+(pct!==null?'<em>'+pct.toFixed(1)+'%</em>':'')+'</div>'+(pct!==null?'<div class="drill-bar"><span style="width:'+Math.min(100,pct).toFixed(2)+'%"></span></div>':'')+(margin!==null?'<div class="drill-math">부문 영업이익률 '+margin+'%</div>':'')+'</div>'
 }).join('');
 const diff=total-parts.reduce((a,x)=>a+x[1],0);
 return '<div class="drill-period">'+esc(dataset.p)+' · USD million · GAAP</div>'+rows+'<div class="drill-total"><span>연결 합계</span><strong>'+fmt(total)+'M</strong></div>'+(Math.abs(diff)>.5?'<div class="drill-warning">표시된 부문과 연결 총계 차이 '+fmt(diff)+'M — 조정/미공개 포함</div>':'')+'<p class="drill-note">'+esc(dataset.note)+'</p><a class="drill-source" href="'+esc(dataset.url)+'" target="_blank" rel="noopener noreferrer">공식 IR 원문 ↗</a>';
}
function getKind(label){
 const text=label.trim().toLowerCase();
 if(/^(revenue|매출|매출 \(gaap\)|연결 매출|매출\(usd\))$/.test(text))return "revenue";
 if(/^(영업이익|영업이익 \(gaap\)|gaap 영업이익|operating income)$/.test(text))return "operating";
 if(/(operating margin|영업이익률)/.test(text))return "opmargin";
 if(/(gross margin|매출총이익률)/.test(text))return "grossmargin";
 if(/(net margin|순이익률)/.test(text))return "netmargin";
 return null;
}
function explanation(kind,ds,period,isOld){
 if(isOld)return '<div class="drill-period">'+esc(period)+'</div><p class="drill-note">이 수치는 과거 재무 스냅샷입니다. 최신 분기별 부문 데이터를 과거 분기에 적용하면 안 되므로 분해하지 않았습니다. 상단의 최신 실적에서 해당 지표를 펼쳐 보세요.</p>';
 if(!ds)return '<p class="drill-note">이 기업의 동일 분기·동일 회계 기준 부문별 수치는 아직 공시 원문과 대조하지 못했습니다. 추정 비중을 표시하지 않습니다. <b>N/D</b></p>';
 if(kind==="revenue"||kind==="operating")return rowBlock(ds,kind);
 if(kind==="opmargin"){
  const list=ds.o[1].map(([name,value])=>{const rev=ds.r[1].find(x=>x[0]===name);return rev&&rev[1]>0?'<div class="drill-entry"><div class="drill-head"><span>'+esc(name)+'</span><strong>'+(100*value/rev[1]).toFixed(1)+'%</strong></div><div class="drill-math">영업이익 '+fmt(value)+'M ÷ 매출 '+fmt(rev[1])+'M</div></div>':''}).join('');
  return '<div class="drill-period">'+esc(ds.p)+' · GAAP</div>'+list+'<div class="drill-total"><span>연결 영업이익률</span><strong>'+(ds.o[0]/ds.r[0]*100).toFixed(1)+'%</strong></div><p class="drill-note">부문별 마진은 해당 부문의 매출과 영업이익이 함께 공시된 경우에만 계산합니다.</p><a class="drill-source" href="'+esc(ds.url)+'" target="_blank" rel="noopener noreferrer">공식 IR ↗</a>';
 }
 return '<p class="drill-note">매출총이익률·순이익률은 연결 손익계산서 기준입니다. 동일 기간의 부문별 총이익/순이익이 공개되지 않으면 부문 매출비중으로 임의 배분할 수 없습니다.</p>'+(ds?'<a class="drill-source" href="'+esc(ds.url)+'" target="_blank" rel="noopener noreferrer">공식 IR ↗</a>':'');
}
function install(root){
 let done=0;
 for(const panel of root.querySelectorAll('.company-panel')){
  const ticker=panel.querySelector('h2 span')?.textContent.trim().toUpperCase();
  const ds=D[ticker];
  for(const card of panel.querySelectorAll('.latest-earnings,.common-block')){
   const historical=card.classList.contains('common-block');
   for(const row of [...card.querySelectorAll('.metric-row')]){
    if(row.closest('details.metric-expand'))continue;
    const label=row.querySelector('.mr-left>div>span')?.textContent||'';
    const kind=getKind(label);
    if(!kind)continue;
    const period=row.querySelector('.mr-left small')?.textContent||'';
    const details=document.createElement('details');details.className='metric-expand';
    const summary=document.createElement('summary');summary.setAttribute('aria-label',label+' 상세 분석 펼치기');
    row.parentNode.insertBefore(details,row);
    details.append(summary);
    summary.append(row);
    const caret=document.createElement('span');caret.className='drill-caret';caret.textContent='부문별 상세 보기 ▾';summary.append(caret);
    const body=document.createElement('div');body.className='drill-body';body.innerHTML=explanation(kind,ds,period,historical);
    details.append(body);done++;
   }
  }
 }
 return done;
}
window.initFinanceDrilldowns=install;
if(document.readyState==="loading")document.addEventListener('DOMContentLoaded',()=>install(document));
else install(document);
})();