import * as pdfjs from "./vendor/pdfjs/build/pdf.mjs";
pdfjs.GlobalWorkerOptions.workerSrc=new URL("./vendor/pdfjs/build/pdf.worker.mjs",import.meta.url).href;
const $=s=>document.querySelector(s);
const main=$("#app"), preview=$("#preview"), dialog=$("#settings");
const types={axiom:"公理",convention:"規約",definition:"定義",lemma:"補題",proposition:"命題",theorem:"定理",corollary:"系",construction:"構成",background:"背景原理",exercise:"演習"};
const root=new URL("./",location.href);
const url=(key,val)=>{const u=new URL(root);u.searchParams.set(key,val);return u.href};
const node=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e};
const anchor=(txt,href,cls)=>{const a=node("a",cls,txt);a.href=href;return a};
const clamp=(x,min,max)=>Math.max(min,Math.min(max,x));
let data, entries, notes, state=null, ticket=0, job=null, task=null, closeTimer=0, active=null, pinned=false;
const isTouch=()=>matchMedia("(hover: none)").matches;
const defaults={width:580,padding:28};
let prefs={...defaults};
try{const saved=JSON.parse(localStorage.getItem("genron-preview-v1")||"{}");for(const k of ["width","padding"]){if(Number.isFinite(saved[k]))prefs[k]=clamp(saved[k],k==="width"?300:12,k==="width"?760:40)}}catch{}
function applySettings(){
 document.documentElement.style.setProperty("--preview-width",prefs.width+"px");document.documentElement.style.setProperty("--preview-padding",prefs.padding+"px");
 for(const k of ["width","padding"]){$("#"+k).value=prefs[k];$("#"+k+"-value").textContent=prefs[k]+" px"}
 try{localStorage.setItem("genron-preview-v1",JSON.stringify(prefs))}catch{}
 if(active&&!preview.hidden)positionPreview(active);
}
applySettings();
for(const k of ["width","padding"])$("#"+k).addEventListener("input",e=>{prefs[k]=Number(e.target.value);applySettings()});
$("#reset").onclick=()=>{prefs={...defaults};applySettings()};
$("#settings-open").onclick=()=>{
 hidePreview();const sample=$("#settings-sample");sample.replaceChildren();const e=entries?.get("K-000060")??data?.entries[0];
 if(e){const box=node("div","sample");fillPreview(box,e,false);sample.append(box)}dialog.showModal()
};
function renderParts(target,parts,raw){
 if(!Array.isArray(parts)){target.textContent=raw;return}
 for(const p of parts){
  if(p.tex&&globalThis.katex){
   const span=node("span","math");
   try{katex.render(p.tex,span,{throwOnError:true,trust:false,strict:"ignore",output:"htmlAndMathml"});target.append(span)}
   catch{target.append(document.createTextNode(p.raw??p.tex))}
  }else target.append(document.createTextNode(p.text??p.raw??""))
 }
}
function fillPreview(box,e,withClose=true){
 box.replaceChildren();
 if(withClose){const close=node("button","close-preview","×");close.setAttribute("aria-label","プレビューを閉じる");close.onclick=hidePreview;box.append(close)}
 box.append(node("div","meta","N-"+e.position[0]+" "+(notes.get(e.position[0])?.title??"")+"　｜　"+e.id));
 box.append(node("h3","",(types[e.kind]??e.kind)+"（"+e.title+"）"));
 if(e.assumptions.length){const p=node("p");p.append("仮定：");const s=node("span");renderParts(s,e.preview?.assumptions,e.assumptions.join("；"));p.append(s);box.append(p)}
 const p=node("p");renderParts(p,e.preview?.statement,e.statement);box.append(p);
 const foot=node("div","foot");foot.append(anchor("参照元のノートを開く ↗",url("id",e.id)));box.append(foot)
}
function positionPreview(el){
 if(!el?.isConnected)return hidePreview();
 const r=el.getBoundingClientRect(),gap=10,margin=12;
 preview.style.left="0px";preview.style.top="0px";
 const w=preview.offsetWidth,h=preview.offsetHeight;
 const below=innerHeight-r.bottom-margin-gap,above=r.top-margin-gap;
 let top=below>=h||below>=above?r.bottom+gap:r.top-h-gap;
 preview.style.left=clamp(r.left,margin,Math.max(margin,innerWidth-w-margin))+"px";
 preview.style.top=clamp(top,margin,Math.max(margin,innerHeight-h-margin))+"px"
}
function hidePreview(){clearTimeout(closeTimer);preview.hidden=true;active=null;pinned=false}
function deferClose(){clearTimeout(closeTimer);if(!pinned)closeTimer=setTimeout(()=>{if(!preview.matches(":hover")&&!preview.contains(document.activeElement)&&!active?.matches(":hover")&&!active?.matches(":focus-visible"))hidePreview()},240)}
function showPreview(el,e,pin=false){clearTimeout(closeTimer);if(active!==el||preview.hidden){fillPreview(preview,e);active=el}pinned=pin;preview.hidden=false;positionPreview(el)}
preview.addEventListener("pointerenter",()=>clearTimeout(closeTimer));preview.addEventListener("pointerleave",deferClose);
preview.addEventListener("focusout",deferClose);
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!preview.hidden){const a=active;hidePreview();if(a?.isConnected){a.focus({preventScroll:true});hidePreview()}}});
document.addEventListener("pointerdown",e=>{if(!preview.hidden&&!preview.contains(e.target)&&!active?.contains(e.target))hidePreview()});
addEventListener("resize",()=>{if(active)positionPreview(active)});
addEventListener("scroll",()=>{if(active)positionPreview(active)},{passive:true,capture:true});
function bindPreview(a,e){a.addEventListener("pointerenter",ev=>{if(ev.pointerType!=="touch")showPreview(a,e)});a.addEventListener("pointerleave",deferClose);a.addEventListener("focus",()=>{if(a.matches(":focus-visible"))showPreview(a,e)});a.addEventListener("blur",deferClose);a.addEventListener("click",ev=>{if(!ev.ctrlKey&&!ev.metaKey&&!ev.shiftKey&&isTouch()&&(!pinned||active!==a)){ev.preventDefault();showPreview(a,e,true)}})}
function button(txt,fn){const b=node("button","",txt);b.type="button";b.onclick=fn;return b}
function routeInfo(){const p=new URL(location.href).searchParams;const id=p.get("id");if(id){const e=entries.get(id);if(!e)throw Error("未登録の知識ID："+id);return {n:e.position[0],id,page:null}}const n=p.get("note");if(n==="statements")return {n,page:parseInt(p.get("page"),10)||1};if(n&&notes.has(Number(n)))return {n:Number(n),page:parseInt(p.get("page"),10)||1};if(n)throw Error("未掲載ノート："+n);return null}
function showHome(){
 const h=node("h1","","数学原論");const intro=node("p","muted",notes.size+"篇のノート・"+entries.size+"項目の知識を検索");
 const search=node("input","search");search.type="search";search.placeholder="ノート名・定義・命題・知識IDを検索";search.setAttribute("aria-label","検索");search.value=new URL(location.href).searchParams.get("q")??"";
 const filters=node("div","filters"), count=node("span","meta result-count"), list=node("div","results");
 let mode="all";const buttons=[["all","すべて"],["note","ノート"],["entry","定義・命題"]].map(([v,t])=>{const b=button(t,()=>{mode=v;update()});filters.append(b);return [v,b]});filters.append(count);
 const normalize=s=>String(s).normalize("NFKC").toLocaleLowerCase().replace(/\s+/g," ");
 function update(){
  const q=normalize(search.value.trim()), terms=q?q.split(" "):[];
  const match=s=>terms.every(t=>normalize(s).includes(t));
  buttons.forEach(([v,b])=>b.setAttribute("aria-pressed",String(v===mode)));
  const u=new URL(root);if(search.value)u.searchParams.set("q",search.value);history.replaceState(history.state,"",u);
  list.replaceChildren();let total=0;
  if(mode!=="entry")for(const n of notes.values()){if(!match(["N-"+n.number,n.title,n.area,...n.goals].join(" ")))continue;const d=node("article","result");d.append(node("span","meta","N-"+n.number+"　ノート"),anchor(n.title,url("note",n.number)),node("span","summary",n.goals.join("；")));list.append(d);total++}
  if(mode!=="note"&&(terms.length||mode==="entry"))for(const e of entries.values()){if(!match([e.id,e.title,e.statement,...e.assumptions,notes.get(e.position[0])?.title,"N-"+e.position[0]].join(" ")))continue;const d=node("article","result");const a=anchor((types[e.kind]??e.kind)+"（"+e.title+"）",url("id",e.id));bindPreview(a,e);d.append(node("span","meta",e.id+"　N-"+e.position[0]),a,node("span","summary",e.statement));list.append(d);total++}
  count.textContent=total+"件";if(!total)list.append(node("p","empty","一致する項目がありません。"));
 }
 search.addEventListener("input",update);main.replaceChildren(h,intro,search,filters,list);update()
}
async function destination(doc,d){
 if(typeof d==="string")d=await doc.getDestination(d);
 if(!Array.isArray(d))return null;
 const index=Number.isInteger(d[0])?d[0]:await doc.getPageIndex(d[0]);return {page:index+1,y:d[1]?.name==="XYZ"?d[3]:d[1]?.name==="FitH"?d[2]:null}
}
function readRef(a){
 const raw=a.url??a.unsafeUrl;
 if(!raw)return null;
 try{const u=new URL(raw);const id=u.searchParams.get("id");if(u.origin===data.referenceOrigin&&u.pathname===data.referencePath&&entries.has(id))return entries.get(id)}catch{}
 return null
}
async function loadReader(info,token,scroll){
 const docName=info.n==="statements"?"定義・命題一覧":"N-"+info.n+"　"+notes.get(info.n).title;
 const file=info.n==="statements"?"pdf/statements.pdf":"pdf/N-"+info.n+".pdf";
 const heading=node("h1","reader-title",docName),side=node("aside","sidebar"),content=node("section"),layout=node("div","reader");
 side.append(node("h2","","ノート・知識索引"));
 const nav=anchor("← 検索・総目次",root.href);side.append(nav);
 if(info.n==="statements"){for(const n of notes.values())side.append(anchor("N-"+n.number+"　"+n.title,url("note",n.number)))}else for(const e of entries.values())if(e.position[0]===info.n){const a=anchor(e.id+"　"+e.title,url("id",e.id),e.id===info.id?"active":"");bindPreview(a,e);side.append(a)}
 const controls=node("div","toolbar"),shell=node("div","pdf-shell"),status=node("p","loading","PDFを読み込んでいます。");
 controls.setAttribute("aria-label","ページ操作");
 shell.append(status);const previous=button("← 前頁",()=>turn(-1)),next=button("次頁 →",()=>turn(1));const pnum=node("input");pnum.type="number";pnum.min=1;pnum.setAttribute("aria-label","ページ番号");const pageCount=node("span","meta","/ …");
 const z=node("select");z.setAttribute("aria-label","表示倍率");for(const [v,t] of [["fit","幅に合わせる"],["0.9","90%"],["1.1","110%"],["1.4","140%"],["1.8","180%"]]){const o=node("option","",t);o.value=v;z.append(o)}
 const download=anchor("PDFを開く ↗",new URL(file,root).href);download.target="_blank";download.rel="noopener";
 const bottom=node("div","page-footer"),prevBottom=button("← 前のページ",()=>turn(-1)),nextBottom=button("次のページ →",()=>turn(1)),bottomCount=node("span","meta");
 bottom.setAttribute("aria-label","ページ末尾の操作");bottomCount.setAttribute("aria-live","polite");
 bottom.append(prevBottom,bottomCount,nextBottom);
 const published=[...notes.keys()].sort((a,b)=>a-b);
 const noteNav=node("div","note-nav");
 if(info.n!=="statements"){
  const idx=published.indexOf(info.n);
  if(idx>0)noteNav.append(anchor("← 前のノート：N-"+published[idx-1],url("note",published[idx-1])));
  if(idx+1<published.length)noteNav.append(anchor("次のノート：N-"+published[idx+1]+" →",url("note",published[idx+1])));
 }
 if(info.id){
  const items=[...entries.values()].filter(e=>e.position[0]===info.n).sort((a,b)=>{for(let i=0;i<4;i++){if(a.position[i]!==b.position[i])return a.position[i]-b.position[i]}return 0});
  const idx=items.findIndex(e=>e.id===info.id);
  const itemNav=node("div","item-nav");
  if(idx>0)itemNav.append(anchor("← 前の知識項目",url("id",items[idx-1].id)));
  if(idx>=0&&idx+1<items.length)itemNav.append(anchor("次の知識項目 →",url("id",items[idx+1].id)));
  side.insertBefore(itemNav,side.children[2]??null);
 }
 for(const b of [previous,next,prevBottom,nextBottom])b.disabled=true;
 for(const bar of [controls,bottom])bar.addEventListener("pointerenter",hidePreview);
 controls.append(previous,pnum,pageCount,next,z,download);content.append(heading,controls,shell,bottom,noteNav);layout.append(side,content);main.replaceChildren(layout);
 try{job=pdfjs.getDocument({url:new URL(file,root).href,isEvalSupported:false,cMapUrl:new URL("./vendor/pdfjs/cmaps/",root).href,cMapPacked:true,standardFontDataUrl:new URL("./vendor/pdfjs/standard_fonts/",root).href});
 const doc=await job.promise;if(token!==ticket){await doc.destroy();return}
 const dest=info.id?await destination(doc,info.id):null;if(info.id&&!dest)throw Error("PDF内の参照先が見つかりません："+info.id);
 state={doc,n:info.n,page:clamp(dest?.page??info.page??1,1,doc.numPages),zoom:"fit",target:dest,id:info.id};
 pageCount.textContent="/ "+doc.numPages;pnum.max=doc.numPages;
 let displayVersion=0;
 function syncControls(busy=false){
  const p=state.page;pnum.value=p;previous.disabled=prevBottom.disabled=busy||p<=1;next.disabled=nextBottom.disabled=busy||p>=doc.numPages;
  bottomCount.textContent=p+" / "+doc.numPages+" 頁";pnum.disabled=busy;z.disabled=busy;
  shell.setAttribute("aria-busy",String(busy));
 }
 async function display(target=null,restore=null,goTop=false){
  const s=state;if(!s||token!==ticket)return;const version=++displayVersion,pageNumber=s.page;
  const current=()=>token===ticket&&s===state&&version===displayVersion;
  hidePreview();syncControls(true);if(task){try{task.cancel()}catch{}}
  const page=await doc.getPage(pageNumber);if(!current())return;
  const base=page.getViewport({scale:1});const scale=s.zoom==="fit"?clamp((shell.clientWidth-34)/base.width,.65,2):Number(s.zoom);
  const view=page.getViewport({scale});const wrap=node("div","page");wrap.style.width=view.width+"px";wrap.style.height=view.height+"px";wrap.style.setProperty("--scale-factor",String(scale));
  const canvas=node("canvas");const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.ceil(view.width*dpr);canvas.height=Math.ceil(view.height*dpr);canvas.style.width=view.width+"px";canvas.style.height=view.height+"px";wrap.append(canvas);shell.replaceChildren(wrap);
  wrap.dataset.page=String(pageNumber);
  const localTask=page.render({canvasContext:canvas.getContext("2d"),viewport:view,transform:dpr===1?null:[dpr,0,0,dpr,0,0]});task=localTask;
  try{await localTask.promise}catch(e){if(e.name==="RenderingCancelledException")return;throw e}
  if(!current()||task!==localTask)return;
  const textLayer=node("div","textLayer");wrap.append(textLayer);
  if(pdfjs.TextLayer)try{await new pdfjs.TextLayer({textContentSource:page.streamTextContent(),container:textLayer,viewport:view}).render()}catch{}
  if(!current())return;
  const pageAnnotations=await page.getAnnotations({intent:"display"});if(!current())return;
  const annotations=node("div","annotations");wrap.append(annotations);
  for(const a of pageAnnotations){
   if(a.subtype!=="Link"||!a.rect)continue;const e=readRef(a);let href=null;
   if(e)href=url("id",e.id);else if(a.dest)href="#pdf-destination";else{try{const u=new URL(a.url);if(u.protocol==="https:"||u.protocol==="http:")href=u.href}catch{}}
   if(!href)continue;
   const box=anchor("",href,"annotation");const [x1,y1,x2,y2]=view.convertToViewportRectangle(a.rect);
   Object.assign(box.style,{left:Math.min(x1,x2)+"px",top:Math.min(y1,y2)+"px",width:Math.abs(x1-x2)+"px",height:Math.abs(y1-y2)+"px"});
   box.setAttribute("aria-label",e?(types[e.kind]??"参照")+"："+e.title+" "+e.id:"PDF内リンク");
   if(e)bindPreview(box,e);
   else if(a.dest)box.addEventListener("click",async ev=>{ev.preventDefault();const d=await destination(doc,a.dest);if(d){s.page=d.page;setPageUrl();await display(d)}});
   else{box.target="_blank";box.rel="noopener"}
   annotations.append(box)
  }
  syncControls(false);
  if(restore!==null)window.scrollTo(0,restore);
  else if(goTop)shell.scrollIntoView({block:"start",behavior:"instant"});
  else if(target&&Number.isFinite(target.y)){const y=clamp(view.convertToViewportPoint(0,target.y)[1],0,view.height);const mark=node("div","target");mark.style.top=y+"px";wrap.append(mark);mark.scrollIntoView({block:"center"});}
 }
 function setPageUrl(){const u=new URL(url("note",state.n));u.searchParams.set("page",state.page);history.replaceState(null,"",u);state.target=null}
 function go(page){
  if(!state||token!==ticket||shell.getAttribute("aria-busy")==="true")return;
  const p=clamp(page,1,doc.numPages);if(p===state.page){syncControls();return}
  state.page=p;setPageUrl();display(null,null,true).catch(showError);
 }
 function turn(delta){if(state&&token===ticket)go(state.page+delta)}
 pnum.onchange=()=>go(parseInt(pnum.value,10)||1);
 pnum.onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();go(parseInt(pnum.value,10)||1)}};
 z.onchange=()=>{state.zoom=z.value;display(state.target).catch(showError)};
 await display(dest,scroll)
 }catch(e){if(token===ticket){shell.replaceChildren(node("p","error","PDFを表示できませんでした："+e.message),download.cloneNode(true))}}
}
function showError(e){main.replaceChildren(node("p","error",String(e.message??e)),anchor("検索・総目次へ戻る",root.href))}
async function render(restore=null){
 const t=++ticket;hidePreview();if(task){try{task.cancel()}catch{}}task=null;
 if(job){try{await job.destroy()}catch{}job=null}state=null;if(t!==ticket)return;
 try{const info=routeInfo();if(info)await loadReader(info,t,restore);else{showHome();if(restore!==null)window.scrollTo(0,restore)}}catch(e){showError(e)}
}
document.addEventListener("click",ev=>{
 if(ev.defaultPrevented||ev.button!==0||ev.ctrlKey||ev.metaKey||ev.shiftKey||ev.altKey)return;
 const a=ev.target.closest("a[href]");if(!a||a.target==="_blank"||a.getAttribute("href").startsWith("#"))return;
 const u=new URL(a.href);if(u.origin!==root.origin||u.pathname!==root.pathname)return;
 ev.preventDefault();history.replaceState({scrollY:scrollY},"",location.href);history.pushState(null,"",u);window.scrollTo(0,0);render()
});
window.addEventListener("popstate",ev=>{render(ev.state?.scrollY??null)});
try{const res=await fetch(new URL("data.json",root));if(!res.ok)throw Error("検索データの取得に失敗しました");data=await res.json();entries=new Map(data.entries.map(e=>[e.id,e]));notes=new Map(data.notes.map(n=>[n.number,n]));await render()}catch(e){showError(e)}
