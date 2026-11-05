/* AI Industry Map company news */
(function(){
"use strict";
var feed={generated_at:null,companies:{}},seenMemory={},buttons={},selectedTicker=null;
var storageKey="ai-industry-news-seen:";
function el(tag,cls,text){var v=document.createElement(tag);if(cls)v.className=cls;if(text!==undefined)v.textContent=text;return v}
function seen(t){try{return +localStorage.getItem(storageKey+t)||0}catch(e){return seenMemory[t]||0}}
function read(t){seenMemory[t]=Date.now();try{localStorage.setItem(storageKey+t,String(seenMemory[t]))}catch(e){}update()}
function articles(t){var now=Date.now();return (feed.companies[t]||[]).filter(function(x){var p=Date.parse(x.published_at);return isFinite(p)&&p>=now-7*86400000&&p<=now+3600000})}
function update(){Object.keys(buttons).forEach(function(t){var n=articles(t).filter(function(a){return Date.parse(a.published_at)>seen(t)}).length;buttons[t].forEach(function(b){b.textContent=n?"N!":"뉴스";b.classList.toggle("news-new",n>0);b.classList.toggle("news-read",n===0);b.title=n?t+" 새 뉴스 "+n+"건":t+" 최근 뉴스 보기"})})}
function button(t,kind){var b=el("button","company-news-btn "+kind,"뉴스");b.type="button";b.addEventListener("click",function(e){e.preventDefault();e.stopPropagation();open(t)});if(!buttons[t])buttons[t]=[];buttons[t].push(b);return b}
function init(root){var scope=root||document;scope.querySelectorAll("label.ng-node[for^='company-']").forEach(function(node){if(node.querySelector(".news-node"))return;var number=(node.getAttribute("for")||"").replace("company-","");var panel=scope.querySelector(".company-panel.cp-"+number);var t=panel&&panel.querySelector("h2 span")?panel.querySelector("h2 span").textContent.trim().toUpperCase():node.querySelector("b")?.textContent.trim().toUpperCase();if(t)node.appendChild(button(t,"news-node"))});scope.querySelectorAll(".company-panel").forEach(function(panel){if(panel.querySelector(".news-panel"))return;var span=panel.querySelector("h2 span"),head=panel.querySelector("h2");if(span&&head)head.after(button(span.textContent.trim().toUpperCase(),"news-panel"))});update()}
function close(){document.getElementById("industry-news-overlay")?.classList.remove("is-open")}
function overlay(){var o=document.getElementById("industry-news-overlay");if(o)return o;o=el("div");o.id="industry-news-overlay";var dialog=el("section");dialog.id="industry-news-dialog";dialog.setAttribute("role","dialog");dialog.setAttribute("aria-modal","true");dialog.setAttribute("aria-label","기업 뉴스");o.appendChild(dialog);var head=el("div","news-head");dialog.appendChild(head);var group=el("div");head.appendChild(group);group.appendChild(el("h2","news-title"));group.appendChild(el("div","news-sub"));var x=el("button","news-close","×");x.type="button";x.setAttribute("aria-label","닫기");x.addEventListener("click",close);head.appendChild(x);dialog.appendChild(el("div","news-list"));var foot=el("div","news-foot");dialog.appendChild(foot);var info=el("div");foot.appendChild(info);var link=el("a","","Google 뉴스에서 더 보기 ↗");link.className="news-search";link.target="_blank";link.rel="noopener noreferrer";info.appendChild(link);info.appendChild(el("p","news-disclaimer","기사 제목과 언론사만 제공합니다. 투자 판단 전 원문을 확인하세요."));var reload=el("button","news-refresh","목록 새로고침");reload.type="button";reload.addEventListener("click",async function(){await load(true);if(selectedTicker)render(selectedTicker)});foot.appendChild(reload);o.addEventListener("click",function(e){if(e.target===o)close()});document.body.appendChild(o);document.addEventListener("keydown",function(e){if(e.key==="Escape")close()});return o}
function render(t){var o=overlay();var arr=articles(t),last=feed.generated_at?new Date(feed.generated_at).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"}):"수집 전";o.querySelector(".news-title").textContent=t+" · 최근 뉴스";o.querySelector(".news-sub").textContent="최근 7일 "+arr.length+"건 · 마지막 수집 "+last;var link=o.querySelector(".news-search");link.href="https://news.google.com/search?q="+encodeURIComponent(({SKH:"SK hynix",SAMSUNG:"Samsung Electronics",TSM:"TSMC",ANTH:"Anthropic Claude",XAI:"xAI Grok",IREN:"IREN Limited",QUANTA:"Quanta Computer",PWR:"Quanta Services",WMB:"Williams Companies"}[t]||t)+" AI company")+"&hl=ko&gl=KR&ceid=KR:ko";var list=o.querySelector(".news-list");list.replaceChildren();if(!arr.length){list.appendChild(el("div","news-empty","최근 수집된 기사가 없습니다. 뉴스 자동수집이 아직 실행되지 않았거나 결과가 없을 수 있습니다. 아래 Google 뉴스 검색 링크를 이용하세요."));return}arr.forEach(function(a){var entry=el("article","news-entry");var title=el("a","news-link",a.title);try{var u=new URL(a.url);if(u.protocol==="https:")title.href=u.href}catch(e){}title.target="_blank";title.rel="noopener noreferrer";entry.appendChild(title);var meta=el("div","news-meta");meta.appendChild(el("span","news-cat",a.category||"기업 뉴스"));meta.appendChild(el("span","",a.source||"언론사"));var date=new Date(a.published_at);meta.appendChild(el("span","",a.date_only?a.published_at.slice(0,10):date.toLocaleString("ko-KR",{timeZone:"Asia/Seoul",month:"numeric",day:"numeric",hour:"numeric",minute:"numeric"})));entry.appendChild(meta);list.appendChild(entry)})}
function open(t){selectedTicker=t;var o=overlay();o.classList.add("is-open");render(t);read(t);o.querySelector(".news-close").focus()}
async function load(force){try{var r=await fetch("./news.json"+(force?"?v="+Date.now():""),{cache:"no-store"});if(!r.ok)throw Error(r.status);var d=await r.json();if(!d.companies)throw Error("invalid");feed=d}catch(e){console.warn("News data pending",e)}update()}
function css(){var s=el("style");s.id="news-ui-style";s.textContent=[
".company-news-btn{z-index:7;cursor:pointer;color:#c4e7f3;background:#173d51;border:1px solid #54869c;border-radius:6px;padding:5px 9px;font-weight:800;font-size:12px}",
".company-news-btn.news-new{background:#fa735b;color:#250c09;border-color:#ffc0ad;box-shadow:0 0 0 2px #fa735b3b}",
".company-news-btn:focus-visible{outline:2px solid #75e6cc;outline-offset:2px}",
".ng-node{position:absolute}",
".company-news-btn.news-node{position:absolute;top:-10px;right:-7px;padding:3px 6px;font-size:11px}",
".company-news-btn.news-node.news-read{display:none}",
".ng-node:hover .news-node.news-read{display:block}",
".company-news-btn.news-panel{margin:8px 0 7px}",
"#industry-news-overlay{display:none;position:fixed;inset:0;z-index:100000;background:#020d18cc;align-items:center;justify-content:center;padding:16px}",
"#industry-news-overlay.is-open{display:flex}",
"#industry-news-dialog{width:min(740px,100%);max-height:88vh;display:flex;flex-direction:column;background:#0c2133;color:#f0f9ff;border:1px solid #48758a;border-radius:14px;overflow:hidden;box-shadow:0 18px 55px #000a}",
".news-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:17px 19px;border-bottom:1px solid #34546c}",
".news-head h2{font-size:20px!important;margin:0!important;color:#f0f9ff}",
".news-sub{color:#97b2c8;font-size:12px;margin-top:6px}",
".news-close{cursor:pointer;color:#fff;background:#25485a;border:1px solid #5c8499;border-radius:7px;font-size:20px;padding:2px 10px}",
".news-list{overflow:auto;padding:6px 19px 16px}",
".news-entry{padding:13px 0;border-bottom:1px solid #294357}",
".news-link{color:#b4eafa!important;font-size:14px!important;font-weight:650;line-height:1.55;text-decoration:none}",
".news-link:hover{text-decoration:underline}",
".news-meta{display:flex;gap:10px;flex-wrap:wrap;font-size:11px;color:#98b5cb;margin-top:6px}",
".news-cat{color:#8de5c5;background:#1b4548;padding:2px 6px;border-radius:4px}",
".news-foot{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;background:#112c3e;border-top:1px solid #34546c;padding:12px 19px}",
".news-search{color:#a9eaff!important;font-size:13px!important}",
".news-disclaimer{font-size:11px;color:#9dafbf;margin:7px 0 0;line-height:1.5}",
".news-refresh{background:#1d485b;border:1px solid #577c8e;border-radius:6px;color:#e4f8fc;padding:8px;cursor:pointer}",
".news-empty{padding:32px 8px;color:#c0d8e9;font-size:13px;line-height:1.8}"
].join("\n");document.head.appendChild(s)}
window.initCompanyNews=init;
function start(){css();init(document);load(false)}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();
