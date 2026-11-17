/* V6.3 verified-only money-flow regressions. */
const fs=require("node:fs");
const path=require("node:path");
const assert=require("node:assert/strict");
const {JSDOM}=require("jsdom");

async function main(){
 const root=path.resolve(__dirname,"..");
 const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
 const companyPage=fs.readFileSync(path.join(root,"company.html"),"utf8");
 const source=fs.readFileSync(path.join(root,"money-flow-ui.js"),"utf8");
 const d=JSON.parse(fs.readFileSync(path.join(root,"money-flow-links.json"),"utf8"));
 assert.equal(d.companies.length,47);
 assert.ok(d.links.length>0 && d.links.length<131,"Speculative 131-edge graph must be fully reset");
 assert.ok(!html.includes('<div class="edge-grid">'),"All eight hypothetical calculation cards must be deleted");
 assert.ok(!html.includes('<div class="edge-panels">'),"Legacy MSFT-NVDA right sidebar must be deleted");
 assert.ok(!html.includes("MSFT → NVDA</h2>"),"No static MSFT/NVDA money flow");
 assert.ok(!html.includes("$41B × 66.7%"),"No made-up formulas in public HTML");
 assert.ok(!source.includes("const QUANT="),"Scenario data must not exist");
 assert.ok(companyPage.includes("initIndustryMoneyFlow(original)"),"Deep detail page must initialize model");
 const known=new Set(d.companies);
 const acceptable=new Set(["signed_commitment","confirmed_contract","recognized_revenue","completed_investment"]);
 let withAmount=0,unknownAmount=0;
 for(const entry of d.links){
  assert.ok(known.has(entry.from)&&known.has(entry.to),"Endpoints must be in 47-firm roster");
  assert.ok(acceptable.has(entry.type),"Only documented commercial or completed equity transfers");
  assert.ok(entry.sources.length>0 && entry.sources.every(s=>s.url.startsWith("https://")),"Primary citation required");
  assert.ok(entry.detail,"Precise disclosure note required");
  if(entry.amount){assert.ok(entry.amount.display);withAmount++}
  else unknownAmount++;
 }
 const dom=new JSDOM(html,{url:"https://seonghwikyeong.github.io/industry-map/",runScripts:"outside-only",pretendToBeVisual:true});
 const w=dom.window;
 w.fetch=async url=>{
  assert.ok(String(url).includes("money-flow-links.json"),"Unexpected URL "+url);
  return {ok:true,json:async()=>d};
 };
 w.eval(source);
 w.document.dispatchEvent(new w.Event("DOMContentLoaded",{bubbles:true}));
 await new Promise(resolve=>setTimeout(resolve,250));
 const panels=[...w.document.querySelectorAll(".company-panels > .company-panel")];
 assert.equal(panels.length,47);
 let total=0,empty=0;
 for(const panel of panels){
  const ticker=panel.querySelector("h2 span").textContent.trim();
  const widget=panel.querySelector(".flow-v63");
  assert.ok(widget,"Missing money-flow panel for "+ticker);
  assert.equal(widget.dataset.moneyTicker,ticker);
  const relevant=d.links.filter(x=>x.from===ticker||x.to===ticker);
  const items=[...widget.querySelectorAll(".flow-v63-record")];
  assert.equal(items.length,relevant.length,"Only documented records should render for "+ticker);
  if(!items.length){
   assert.equal(widget.querySelectorAll(".flow-v63-empty").length,2,"Explicit no-confirmed-data state "+ticker);
   empty++;
  }
  for(const card of items){
   const link=card.querySelector(".flow-v63-pair");
   assert.ok(link?.href.includes("/company.html?ticker="),"Partner detail URL required");
   assert.ok(card.querySelector(".flow-v63-source a[href^='https://']"),"Every card needs source");
   assert.ok(card.textContent.includes("→"),"Source to destination orientation");
  }
  total+=items.length;
 }
 assert.equal(total,d.links.length*2,"Each verified contract must show once on both counterparties");
 assert.ok(empty>0,"Unverified companies should remain explicitly empty, not inferred");
 const openai=panels.find(x=>x.querySelector("h2 span").textContent.trim()==="OPENAI");
 assert.ok(openai.querySelectorAll(".flow-v63-record").length>2);
 const amd=panels.find(x=>x.querySelector("h2 span").textContent.trim()==="AMD");
 assert.ok(amd.textContent.includes("1GW 구매 확약"),"AMD binding GPU purchase needs explicit capacity");
 const sample=panels[0].cloneNode(true);
 sample.querySelector(".flow-v63")?.remove();
 const wrap=w.document.createElement("div");wrap.append(sample);w.document.body.append(wrap);
 w.initIndustryMoneyFlow(wrap);
 assert.equal(sample.querySelectorAll(".flow-v63-record").length,d.links.filter(x=>["MSFT"].includes(x.from)||["MSFT"].includes(x.to)).length,"Deep company page preserves counterparties");
 console.log("PASS verified-only money flow: "+d.links.length+" source-verified records, "+withAmount+" disclosed amount/capacity, "+unknownAmount+" undisclosed, "+empty+" companies no verified bilateral data");
 console.log("PASS all 47 panels show only counterparty-specific disclosures with original sources; no invented formulas, no static scenario cards");
 w.close();
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1});
