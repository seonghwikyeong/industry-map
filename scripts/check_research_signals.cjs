/* V6.4: all company panels include sourced article numeric leads; NVIDIA call facts typed. */
const fs=require("fs");
const path=require("path");
const assert=require("node:assert/strict");
const {JSDOM}=require("jsdom");
async function main(){
 const root=path.resolve(__dirname,"..");
 const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
 const detail=fs.readFileSync(path.join(root,"company.html"),"utf8");
 const news=JSON.parse(fs.readFileSync(path.join(root,"news.json"),"utf8"));
 const latest=JSON.parse(fs.readFileSync(path.join(root,"latest-financials-20261118.json"),"utf8"));
 const src=fs.readFileSync(path.join(root,"research-signals-ui.js"),"utf8");
 assert.equal(Object.keys(news.companies).length,47);
 assert.ok(latest.companies.NVDA.callHighlights.length>=8);
 assert.ok(detail.includes("initResearchSignals(original)"));
 const dom=new JSDOM(html,{url:"https://seonghwikyeong.github.io/industry-map/",runScripts:"outside-only",pretendToBeVisual:true});
 const w=dom.window;
 w.fetch=async url=>({ok:true,json:async()=>String(url).includes("latest-financials")?latest:news});
 w.eval(src);w.document.dispatchEvent(new w.Event("DOMContentLoaded",{bubbles:true}));
 await new Promise(resolve=>setTimeout(resolve,270));
 const panels=[...w.document.querySelectorAll(".company-panel")];assert.equal(panels.length,47);
 let numericArticles=0,callCount=0,withArticles=0;
 for(const panel of panels){
  const ticker=panel.querySelector("h2 span")?.textContent.trim();
  const block=panel.querySelector(".rs64");
  assert.ok(block,"Missing quantitative press/call signals for "+ticker);
  assert.equal(block.dataset.researchTicker,ticker);
  const articles=block.querySelectorAll(".rs64-article");
  const calls=block.querySelectorAll(".rs64-call");
  if(articles.length)withArticles++;
  numericArticles+=articles.length;callCount+=calls.length;
  for(const a of articles){assert.ok(a.querySelector("a[href^='https://news.google.com/']"),"News provenance");assert.ok(a.textContent.includes("원문 검증 전"),"News headline must remain unverified");}
  for(const call of calls){assert.ok(call.querySelector("a[href^='https://']"),"Call source");}
 }
 assert.ok(callCount>=8);
 const nvidia=panels.find(p=>p.querySelector("h2 span").textContent.trim()==="NVDA");
 assert.ok(nvidia.querySelector(".rs64").textContent.includes("Rubin"));
 const imported=panels[0].cloneNode(true);imported.querySelector(".rs64")?.remove();
 const slot=w.document.createElement("div");slot.append(imported);w.document.body.append(slot);
 w.initResearchSignals(slot);
 assert.ok(imported.querySelector(".rs64"),"Company page can attach research insights to imported panel");
 console.log("PASS V6.4 47-company press evidence panels: "+numericArticles+" attributed numeric headlines / "+withArticles+" issuers, "+callCount+" documented call/CFO facts");
 console.log("PASS Nvidia Rubin and commitments remain source-labeled; all article figures marked unverified");
 w.close();
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1});
