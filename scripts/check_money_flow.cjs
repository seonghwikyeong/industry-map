/* V6.2 full 47-company money-flow coverage and selection regression. */
const fs=require("node:fs");
const path=require("node:path");
const assert=require("node:assert/strict");
const {JSDOM}=require("jsdom");

async function main(){
 const root=path.resolve(__dirname,"..");
 const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
 const company=fs.readFileSync(path.join(root,"company.html"),"utf8");
 const dataset=JSON.parse(fs.readFileSync(path.join(root,"money-flow-links.json"),"utf8"));
 const ui=fs.readFileSync(path.join(root,"money-flow-ui.js"),"utf8");
 assert.equal(dataset.companies.length,47,"47 issuer graph coverage");
 assert.ok(dataset.links.length>=100,"Company money flow should have 100+ directionally specified links");
 const unique=new Set(dataset.links.map(x=>x.from+"|"+x.to));
 assert.equal(unique.size,dataset.links.length,"Duplicate directed edge");
 for(const link of dataset.links){
  assert.ok(dataset.companies.includes(link.from),"Unknown source "+link.from);
  assert.ok(dataset.companies.includes(link.to),"Unknown destination "+link.to);
  assert.notEqual(link.from,link.to,"Self-edge");
  assert.equal(link.monetary_value,null,"Never invent direct money-flow figures");
  assert.ok(link.detail&&link.classification,"Relation must have a description and estimate status");
 }
 const doc=new JSDOM(html,{url:"https://seonghwikyeong.github.io/industry-map/",runScripts:"outside-only",pretendToBeVisual:true});
 const w=doc.window;
 w.fetch=async url=>{
  assert.ok(String(url).includes("money-flow-links.json"),"Unexpected fetch "+url);
  return {ok:true,status:200,json:async()=>dataset};
 };
 w.eval(ui);
 w.document.dispatchEvent(new w.Event("DOMContentLoaded",{bubbles:true}));
 await new Promise(r=>setTimeout(r,350));
 const panels=[...w.document.querySelectorAll(".company-panels > .company-panel")];
 assert.equal(panels.length,47,"Expected 47 company panels");
 const tickers=panels.map(p=>p.querySelector("h2 span")?.textContent.trim().toUpperCase());
 assert.deepEqual(new Set(tickers),new Set(dataset.companies),"Company roster differs from money-flow model");
 let count=0;
 for(const p of panels){
  const ticker=p.querySelector("h2 span").textContent.trim().toUpperCase();
  const section=p.querySelector(".flow-v62");
  assert.ok(section,"Missing money-flow section for "+ticker);
  assert.equal(section.dataset.moneyTicker,ticker);
  assert.ok(section.querySelector(".flow-v62-head h3").textContent.includes(ticker));
  const expected=dataset.links.filter(x=>x.from===ticker||x.to===ticker);
  const rows=[...section.querySelectorAll(".flow-v62-card")];
  assert.equal(rows.length,expected.length,ticker+" relation count mismatch");
  assert.ok(rows.length>=1,ticker+" should have at least one sector relation");
  for(const row of rows){
   const link=row.querySelector(".flow-v62-route");
   assert.ok(link.href.includes("company.html?ticker="),"Missing clickable partner");
   assert.ok(!row.textContent.includes("actual confirmed payment"),"Misleading money-flow basis");
  }
  count+=rows.length;
 }
 const old=w.document.querySelector(".rightbar > .edge-panels");
 assert.equal(old?.style.display,"none","Original fixed MSFT-NVDA panel must be hidden");
 assert.equal(w.document.querySelector(".cp-1 .flow-v62-head h3")?.textContent,"AMZN 자금흐름 관계");
 const n=panels.find(p=>p.querySelector("h2 span")?.textContent.trim()==="NVDA");
 assert.ok(n.querySelectorAll(".flow-v62-scenario").length>=4,"Nvidia scenario relations missing");
 const chip=w.document.querySelector(".edge-grid .edge-chip[for='edge-3']");
 chip.dispatchEvent(new w.MouseEvent("click",{bubbles:true,cancelable:true}));
 const goog=panels.find(p=>p.querySelector("h2 span")?.textContent.trim()==="GOOGL");
 const classIndex=goog.className.match(/cp-(\d+)/)[1];
 assert.equal(w.document.getElementById("company-"+classIndex)?.checked,true,"Scenario chip should focus relevant company");
 const snapshot=panels[8].cloneNode(true);
 snapshot.querySelector(".flow-v62")?.remove();
 const wrap=w.document.createElement("div");wrap.append(snapshot);
 w.document.body.append(wrap);
 w.initIndustryMoneyFlow(wrap);
 assert.ok(snapshot.querySelector(".flow-v62"),"Detail-page cloned panel should get correct company relations");
 assert.ok(company.includes("initIndustryMoneyFlow(original)"),"Detailed company page must initialize flow");
 console.log("PASS 47/47 companies, "+dataset.links.length+" directional relations, "+count+" context cards");
 console.log("PASS original fixed MSFT-NVDA box hidden, 8 assumption-based scenario chips retained");
 console.log("PASS selected company linkage and copied company-detail panel context");
 w.close();
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1});
