/* Regression smoke test for financial time-series click interactions. */
const fs=require("node:fs");
const assert=require("node:assert/strict");
const {JSDOM}=require("jsdom");
const path=require("node:path");

async function main(){
 const repo=path.resolve(__dirname,"..");
 const html=fs.readFileSync(path.join(repo,"index.html"),"utf8");
 const history=JSON.parse(fs.readFileSync(path.join(repo,"timeseries.json"),"utf8"));
 const js=fs.readFileSync(path.join(repo,"timeseries-ui.js"),"utf8");
 const period=fs.readFileSync(path.join(repo,"earnings-periods.js"),"utf8");
 const dom=new JSDOM(html,{url:"https://seonghwikyeong.github.io/industry-map/",runScripts:"outside-only",pretendToBeVisual:true});
 const w=dom.window;
 w.fetch=async url=>({ok:true,status:200,json:async()=>String(url).includes("timeseries.json")?history:{symbol:"MSFT",currency:"USD",rows:[]}});
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
 for(const p of panels){const ticker=p.querySelector("h2 span")?.textContent.trim();assert.ok(ticker,"ticker");const clickable=p.querySelector(".ts-clickable");assert.ok(clickable,"no clickable metric for "+ticker)}
 console.log("PASS all 47 company panels have clickable numeric values");
 w.close();
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1});
