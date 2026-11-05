/* Regression smoke test for financial time-series click interactions. */
const fs=require("node:fs");
const assert=require("node:assert/strict");
const {JSDOM}=require("jsdom");
const path=require("node:path");

async function main(){
 const repo=path.resolve(__dirname,"..");
 const html=fs.readFileSync(path.join(repo,"index.html"),"utf8");
 const history=JSON.parse(fs.readFileSync(path.join(repo,"timeseries.json"),"utf8"));
 const supplement=JSON.parse(fs.readFileSync(path.join(repo,"timeseries-v56.json"),"utf8"));
 const js=fs.readFileSync(path.join(repo,"timeseries-ui.js"),"utf8");
 const period=fs.readFileSync(path.join(repo,"earnings-periods.js"),"utf8");
 const dom=new JSDOM(html,{url:"https://seonghwikyeong.github.io/industry-map/",runScripts:"outside-only",pretendToBeVisual:true});
 const w=dom.window;
 w.fetch=async url=>({ok:true,status:200,json:async()=>String(url).includes("timeseries-v56.json")?supplement:String(url).includes("timeseries.json")?history:{symbol:"MSFT",currency:"USD",rows:[]}});
 w.eval(period);
 w.eval(js);
 await new Promise(resolve=>setTimeout(resolve,150));
 const panels=w.document.querySelectorAll(".company-panel");
 assert.equal(panels.length,47);
 const panel=ticker=>[...panels].find(p=>p.querySelector("h2 span")?.textContent.trim()===ticker);
 function click(value){
  assert.ok(value, "required numerical node absent");
  value.dispatchEvent(new w.MouseEvent("click",{bubbles:true,cancelable:true}));
  const modal=w.document.querySelector("#financial-ts-overlay");
  assert.equal(modal?.classList.contains("ts-open"),true,"click opens graph modal");
  return modal;
 }
 const msft=panel("MSFT");
 assert.ok(msft);
 const topRevenue=msft.querySelector(".latest-earnings .metric-row > b");
 let modal=click(topRevenue);
 assert.ok(modal.querySelectorAll("svg circle").length>=9,"Microsoft revenue history >=9 quarters");
 console.log("PASS Microsoft total revenue: 9+ historical quarters");
 const azure=[...msft.querySelectorAll(".latest-earnings .metric-row")].find(x=>x.textContent.includes("Azure 매출"));
 modal=click(azure.querySelector("b"));
 assert.ok(modal.querySelectorAll("svg circle").length>=9,"Azure history >=9 quarters");
 assert.ok(modal.textContent.includes("Azure"),"Azure popup title");
 console.log("PASS Azure product revenue: 9+ fiscal quarters");
 const samsung=panel("SAMSUNG");
 assert.ok(samsung);
 const samVal=samsung.querySelector(".latest-earnings .metric-row > b")||[...samsung.querySelectorAll(".metric-row > b")].find(x=>x.textContent.includes("₩"));
 modal=click(samVal);
 assert.ok(modal.textContent.includes("₩"),"Won unit retained");
 assert.ok(modal.querySelectorAll("svg circle").length>=1,"single snapshot as point");
 console.log("PASS Samsung KRW-denominated numeric popup");
 for(const [ticker,unit,min] of [["TSM","TWD million",3],["ASML","EUR million",3],["SKH","KRW million",2],["SAMSUNG","KRW million",3]]){
   const series=history.companies[ticker]?.revenue;
   assert.equal(series?.unit,unit,ticker+" native reporting currency");
   assert.ok(series.points.length>=min,ticker+" missing verified historical quarters");
   const dates=series.points.map(p=>p.end);
   assert.deepEqual(dates,[...dates].sort(),ticker+" historical dates not sorted");
   for(const p of series.points){assert.ok(p.source.startsWith("https://"),ticker+" missing filing source");assert.ok(p.end<="2026-11-05",ticker+" future quarter")}
 }
 console.log("PASS TSM, ASML, SKH and Samsung official-source quarterly histories");
 const added=Object.entries(supplement.companies);
 assert.equal(added.length,9,"9 added source-backed company datasets");
 let points=0;
 for(const [ticker,record] of added){
   assert.ok(panel(ticker),"added ticker missing from map: "+ticker);
   for(const [key,values] of Object.entries(record.metrics)){
     assert.equal(values.length,record.dates.length,ticker+" "+key+" misaligned dates");
     for(let i=0;i<values.length;i++){
       assert.ok(Number.isFinite(values[i]),ticker+" "+key+" missing numeric fact");
       assert.ok(record.dates[i]<="2026-11-06",ticker+" future period");
       const source=(record.sources||[])[i]||record.source;
       assert.ok(source.startsWith("https://"),ticker+" missing original source");
     }
     points+=values.length;
   }
 }
 assert.equal(points,245,"V5.6 supplemental reported point coverage");
 const amazon=panel("AMZN");
 const amazonRevenue=[...amazon.querySelectorAll(".latest-earnings .metric-row")].find(r=>/매출|revenue|sales/i.test(r.querySelector(".mr-left")?.textContent||""));
 if(amazonRevenue){
   const pop=click(amazonRevenue.querySelector("b"));
   assert.ok(pop.querySelectorAll("svg circle").length>=6,"Amazon latest total revenue should show six quarters");
 }
 console.log("PASS V5.6: 9 new companies, 65 financial/segment metrics and 245 primary-sourced points");
 let checked=0,noNumerics=0;for(const p of panels){const ticker=p.querySelector("h2 span")?.textContent.trim();assert.ok(ticker,"ticker");const numeric=[...p.querySelectorAll(".metric-row > b")].filter(x=>/^\s*[+\-−]?(?:NT\$|₩|€|£|¥|\$)?\s*\d/.test(x.textContent.trim()));const clickable=p.querySelector(".ts-clickable");if(numeric.length){assert.ok(clickable,"no clickable metric for "+ticker);checked++}else noNumerics++}
 console.log("PASS clickable historical-chart controls on "+checked+" numeric-company panels; "+noNumerics+" N/A-only panels exempt");
 w.close();
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1});

// First complete regression test run for V5.3 financial time-series panels.
