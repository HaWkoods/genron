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
let data, entries, notes, state=null, ticket=0, job=null, disposeReader=null, closeTimer=0, active=null, pinned=false;
const isTouch=()=>matchMedia("(hover: none)").matches;
const defaults={width:580,padding:28};
let readingMode="continuous";try{if(localStorage.getItem("genron-reading-mode")==="single")readingMode="single"}catch{}
let prefs={...defaults};
try{const saved=JSON.parse(localStorage.getItem("genron-preview-v1")||"{}");for(const k of ["width","padding"]){if(Number.isFinite(saved[k]))prefs[k]=clamp(saved[k],k==="width"?300:12,k==="width"?760:40)}}catch{}
function applySettings(){
 document.documentElement.style.setProperty("--preview-width",prefs.width+"px");document.documentElement.style.setProperty("--preview-padding",prefs.padding+"px");
 for(const k of ["width","padding"]){$("#"+k).value=prefs[k];$("#"+k+"-value").textContent=prefs[k]+" px"}
 try{localStorage.setItem("genron-preview-v1",JSON.stringify(prefs))}catch{}
 if(active&&!preview.hidden)positionPreview(active);
 fitMath($("#settings-sample .sample"));
}
applySettings();
for(const k of ["width","padding"])$("#"+k).addEventListener("input",e=>{prefs[k]=Number(e.target.value);applySettings()});
$("#reset").onclick=()=>{prefs={...defaults};applySettings()};
$("#settings-open").onclick=()=>{
 hidePreview();const sample=$("#settings-sample");sample.replaceChildren();const e=entries?.get("K-000060")??data?.entries[0];
 if(e){const box=node("div","sample");fillPreview(box,e,false);sample.append(box)}dialog.showModal();fitMath(sample.querySelector(".sample"))
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
// Keep ordinary inline math at its normal size; only shrink indivisible formulas
// that would exceed the full available paragraph width. No horizontal scrolling.
function fitMath(box){
 if(!box||!box.isConnected||!box.clientWidth)return;
 for(const span of box.querySelectorAll(".math")){
  span.style.fontSize="";
  const paragraph=span.closest("p")??box;
  const available=paragraph.clientWidth;
  const natural=span.getBoundingClientRect().width;
  if(available>0&&natural>available-2){
   const base=parseFloat(getComputedStyle(span).fontSize);
   span.style.fontSize=base*(available-2)/natural+"px";
  }
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
 if(r.bottom<0||r.top>innerHeight)return hidePreview();
 preview.style.left="0px";preview.style.top="0px";
 fitMath(preview);
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
addEventListener("resize",()=>{if(active)positionPreview(active);fitMath($("#settings-sample .sample"))});
document.fonts?.ready.then(()=>{if(active)positionPreview(active);fitMath($("#settings-sample .sample"))});
addEventListener("scroll",()=>{if(active)positionPreview(active)},{passive:true,capture:true});
function bindPreview(a,e){a.addEventListener("pointerenter",ev=>{if(ev.pointerType!=="touch")showPreview(a,e)});a.addEventListener("pointerleave",deferClose);a.addEventListener("focus",()=>{if(a.matches(":focus-visible"))showPreview(a,e)});a.addEventListener("blur",deferClose);a.addEventListener("click",ev=>{if(!ev.ctrlKey&&!ev.metaKey&&!ev.shiftKey&&isTouch()&&(!pinned||active!==a)){ev.preventDefault();showPreview(a,e,true)}})}
function button(txt,fn){const b=node("button","",txt);b.type="button";b.onclick=fn;return b}
function routeInfo(){const p=new URL(location.href).searchParams;const id=p.get("id");if(id){const e=entries.get(id);if(!e)throw Error("未登録の知識ID："+id);return {n:e.position[0],id,page:null}}const n=p.get("note");if(n==="statements"||n==="notation")return {n,page:parseInt(p.get("page"),10)||1};const alias=data.aliases?.[n];if(alias){if(p.has("page"))return {n:Number(n),page:parseInt(p.get("page"),10)||1,archive:alias};return {n:alias.number,id:alias.first,page:null}}if(n&&notes.has(Number(n)))return {n:Number(n),page:parseInt(p.get("page"),10)||1};if(n)throw Error("未掲載ノート："+n);return null}

function showMap(){
 const plan=data.plan??[], by=new Map(plan.map(n=>[n.number,n])), parts=data.parts??[], ts=data.treatises??[];
 const successors=new Map(plan.map(n=>[n.number,[]]));
 for(const n of plan)for(const p of n.depends_on??[])successors.get(p)?.push(n.number);
 const walk=(id,up,one=false)=>{const seen=new Set([id]),q=[id];for(let i=0;i<q.length;i++){if(one&&i>0)break;for(const v of (up?by.get(q[i])?.depends_on:successors.get(q[i]))??[])if(!seen.has(v)){seen.add(v);q.push(v)}}return seen};
 const depth=new Map();function rank(id,vis=new Set()){if(depth.has(id))return depth.get(id);if(vis.has(id))throw Error("依存関係に循環があります");vis.add(id);let d=0;for(const p of by.get(id)?.depends_on??[])if(by.has(p))d=Math.max(d,rank(p,vis)+1);vis.delete(id);depth.set(id,d);return d}
 for(const n of plan)rank(n.number);
 const pos=new Map(),regions=[];let x=40;const dy=105;
 for(const p of [...parts,{id:"other",title:"その他"}]){
  let start=x;
  const groups=p.id==="other"?[{id:"other",title:"その他"}]:ts.filter(t=>t.part===p.id);
  for(const t of groups){
   const members=plan.filter(n=>t.id==="other"?!ts.some(s=>s.id===n.treatise&&parts.some(p=>p.id===s.part)):n.treatise===t.id);
   if(!members.length)continue;
   const rows=new Map();for(const n of members){let d=depth.get(n.number);if(!rows.has(d))rows.set(d,[]);rows.get(d).push(n)}
   const cols=Math.max(...[...rows.values()].map(a=>a.length)),w=cols*184+24;
   for(const [d,arr] of rows)arr.sort((a,b)=>a.number-b.number).forEach((n,i)=>pos.set(n.number,{x:x+12+i*184,y:100+d*dy}));
   regions.push({x,w,title:t.title,part:false});x+=w+12;
  }
  if(x>start){regions.push({x:start-8,w:x-start+4,title:p.title,part:true});x+=32}
 }
 const W=Math.max(x,300),H=200+Math.max(0,...depth.values())*dy;
 const head=node("h1","","数学構造地図"),desc=node("p","muted","矢印は前提から後続へ。予定を含む全ノートの論理的関係を表示します。");
 const tools=node("div","map-tools"), search=node("input");search.type="search";search.placeholder="ノート名・番号";search.setAttribute("aria-label","ノート検索");
 const results=node("select");results.setAttribute("aria-label","検索結果");
 function selectControl(label,opts){const s=node("select");s.setAttribute("aria-label",label);for(const [v,t] of opts){let o=node("option","",t);o.value=v;s.append(o)}tools.append(s);return s}
 tools.append(search,results);
 const direction=selectControl("依存方向",[["down","後続"],["up","前提"],["both","両方向"],["path","学習経路"]]);
 const scope=selectControl("関係の深さ",[["all","推移的関係"],["one","直接関係"]]);
 const layout=selectControl("表示範囲",[["all","全体地図"],["local","局所地図"]]);
 const wrap=node("div","map-wrap"), stage=node("div","map-stage"), panel=node("aside","map-panel"), canvas=node("canvas"), mini=node("canvas","map-mini");canvas.tabIndex=0;canvas.setAttribute("aria-label","ノート依存関係グラフ");mini.setAttribute("aria-label","ミニマップ");stage.append(canvas,mini);wrap.append(stage,panel);
 let selected=null,scale=1,tx=0,ty=0,visible=new Set(by.keys()),active=new Set(by.keys()),drag=null,frame=0;
 const ctx=canvas.getContext("2d"),mc=mini.getContext("2d");
 const dark=()=>matchMedia("(prefers-color-scheme: dark)").matches;
 function bounds(ids){const a=[...ids].map(i=>pos.get(i)).filter(Boolean);if(!a.length)return [0,0,W,H];let l=Math.min(...a.map(p=>p.x))-30,t=Math.min(...a.map(p=>p.y))-60,r=Math.max(...a.map(p=>p.x))+200,b=Math.max(...a.map(p=>p.y))+80;return [l,t,r-l,b-t]}
 function fit(local=false){const [l,t,w,h]=local?bounds(visible):[0,0,W,H];scale=Math.min(canvas.clientWidth/w,canvas.clientHeight/h,1.4);tx=(canvas.clientWidth-w*scale)/2-l*scale;ty=(canvas.clientHeight-h*scale)/2-t*scale;draw()}
 function zoom(f,cx=canvas.clientWidth/2,cy=canvas.clientHeight/2){const s=clamp(scale*f,.015,3);tx=cx-(cx-tx)*s/scale;ty=cy-(cy-ty)*s/scale;scale=s;draw()}
 function draw(){if(frame)return;frame=requestAnimationFrame(()=>{frame=0;paint()})}
 function prep(c,g){const d=Math.min(devicePixelRatio||1,2),w=c.clientWidth,h=c.clientHeight;if(c.width!==Math.round(w*d)||c.height!==Math.round(h*d)){c.width=Math.round(w*d);c.height=Math.round(h*d)}g.setTransform(d,0,0,d,0,0);g.clearRect(0,0,w,h)}
 function paint(){
  prep(canvas,ctx);const fg=dark()?"#e2e8f0":"#23364c";ctx.save();ctx.translate(tx,ty);ctx.scale(scale,scale);
  for(const r of regions.filter(r=>r.part)){ctx.fillStyle=dark()?"#253247":"#e8eef5";ctx.fillRect(r.x,10,r.w,H-20);ctx.fillStyle=fg;ctx.font="bold 24px sans-serif";ctx.fillText(r.title,r.x+10,36)}
  for(const r of regions.filter(r=>!r.part)){ctx.strokeStyle="#9baabd";ctx.lineWidth=1/scale;ctx.strokeRect(r.x,46,r.w,H-65);if(scale>.13){ctx.fillStyle=fg;ctx.font="17px sans-serif";ctx.fillText(r.title,r.x+8,70,r.w-16)}}
  for(const n of plan){if(!visible.has(n.number))continue;const b=pos.get(n.number);for(const id of n.depends_on??[]){if(!visible.has(id)||!pos.has(id))continue;const a=pos.get(id),on=active.has(id)&&active.has(n.number);ctx.globalAlpha=on?.65:.07;ctx.strokeStyle=on?"#4778a5":"#8793a1";ctx.fillStyle=ctx.strokeStyle;ctx.lineWidth=on?1.3/scale:.7/scale;ctx.beginPath();ctx.moveTo(a.x+82,a.y+38);ctx.bezierCurveTo(a.x+82,(a.y+b.y)/2,b.x+82,(a.y+b.y)/2,b.x+82,b.y);ctx.stroke();if(scale>.13){ctx.beginPath();ctx.moveTo(b.x+82,b.y);ctx.lineTo(b.x+77,b.y-9);ctx.lineTo(b.x+87,b.y-9);ctx.fill()}}}
  for(const n of plan){if(!visible.has(n.number))continue;const p=pos.get(n.number);ctx.globalAlpha=active.has(n.number)?1:.15;ctx.fillStyle=n.number===selected?"#245b91":dark()?"#435b75":"#a7bdd3";if(scale<.18){ctx.fillRect(p.x,p.y,164,38)}else{ctx.fillRect(p.x,p.y,164,38);ctx.fillStyle=n.number===selected||dark()?"#fff":"#152b42";ctx.font="12px sans-serif";ctx.fillText("N-"+n.number,p.x+6,p.y+13);if(scale>.34){ctx.font="14px sans-serif";ctx.fillText(n.title,p.x+6,p.y+30,152)}}}
  ctx.restore();prep(mini,mc);const m=Math.min(mini.clientWidth/W,mini.clientHeight/H),ox=(mini.clientWidth-W*m)/2,oy=(mini.clientHeight-H*m)/2;mc.fillStyle=dark()?"#182334":"#fff";mc.fillRect(0,0,mini.clientWidth,mini.clientHeight);for(const [id,p] of pos){mc.globalAlpha=active.has(id)?1:.2;mc.fillStyle=id===selected?"#245b91":"#879eb5";mc.fillRect(ox+p.x*m,oy+p.y*m,Math.max(2,164*m),Math.max(2,38*m))}mc.globalAlpha=1;mc.strokeStyle="#d26b34";mc.lineWidth=1.5;mc.strokeRect(ox-tx/scale*m,oy-ty/scale*m,canvas.clientWidth/scale*m,canvas.clientHeight/scale*m);
 }
 function refresh(refit=false){active=selected===null?new Set(by.keys()):direction.value==="both"?new Set([...walk(selected,true,scope.value==="one"),...walk(selected,false,scope.value==="one")]):walk(selected,direction.value!=="down",direction.value!=="path"&&scope.value==="one");visible=layout.value==="local"?active:new Set(by.keys());scope.disabled=direction.value==="path";panel.replaceChildren();if(selected===null){panel.append(node("h2","","ノートを選択"),node("p","muted","検索または地図上のノートを選択してください。"))}else{const n=by.get(selected);panel.append(node("h2","","N-"+selected+" "+n.title),node("p","",(n.goals??[]).join("；")));if(notes.has(selected))panel.append(anchor("ノートを読む",url("note",selected)));else panel.append(node("p","muted","本文は未掲載です。"));const items=[...entries.values()].filter(e=>e.position[0]===selected);if(items.length){panel.append(node("h3","","定義・命題"));for(const e of items){const a=anchor(e.title,url("id",e.id));bindPreview(a,e);panel.append(a)}}if(direction.value==="path"){panel.append(node("h3","","学習順序（前提を先に）"));for(const id of [...active].sort((a,b)=>depth.get(a)-depth.get(b)||a-b)){const n=by.get(id);panel.append(button("N-"+id+" "+n.title,()=>choose(id)))}}}
 if(refit)fit(layout.value==="local");else draw()}
 function choose(id){selected=id;results.value=String(id);refresh(layout.value==="local");if(layout.value!=="local"){const p=pos.get(id);scale=Math.max(scale,.65);tx=canvas.clientWidth/2-(p.x+82)*scale;ty=canvas.clientHeight/2-(p.y+19)*scale;draw()}}
 function searchUpdate(){const q=search.value.normalize("NFKC").toLowerCase().trim();results.replaceChildren();const placeholder=node("option","","ノートを選択");placeholder.value="";results.append(placeholder);for(const n of plan){if(!q||(/^\d+$/.test(q)?n.number===Number(q):("N-"+n.number+" "+n.title).toLowerCase().includes(q))){const o=node("option","","N-"+n.number+" "+n.title);o.value=n.number;results.append(o)}}if(selected!==null)results.value=String(selected)}
 search.oninput=searchUpdate;search.onkeydown=e=>{if(e.key==="Enter"&&results.options.length>1)choose(Number(results.options[1].value))};results.onchange=()=>{if(results.value)choose(Number(results.value))};
 direction.onchange=scope.onchange=()=>refresh(layout.value==="local");layout.onchange=()=>refresh(true);
 tools.append(button("＋",()=>zoom(1.4)),button("−",()=>zoom(1/1.4)),button("全体に戻す",()=>{selected=null;layout.value="all";search.value="";searchUpdate();refresh(true)}));
 canvas.addEventListener("wheel",e=>{e.preventDefault();const r=canvas.getBoundingClientRect();zoom(Math.exp(-e.deltaY*.0015),e.clientX-r.left,e.clientY-r.top)},{passive:false});
 canvas.onpointerdown=e=>{canvas.setPointerCapture(e.pointerId);drag={x:e.clientX,y:e.clientY,tx,ty}};
 canvas.onpointermove=e=>{if(drag){tx=drag.tx+e.clientX-drag.x;ty=drag.ty+e.clientY-drag.y;draw()}};
 canvas.onpointercancel=()=>drag=null;
 canvas.onpointerup=e=>{if(!drag)return;const click=Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<5;drag=null;if(click){const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left-tx)/scale,y=(e.clientY-r.top-ty)/scale;for(const [id,p] of pos)if(visible.has(id)&&x>=p.x&&x<=p.x+164&&y>=p.y&&y<=p.y+38){choose(id);break}}};
 mini.onclick=e=>{const r=mini.getBoundingClientRect(),m=Math.min(r.width/W,r.height/H);tx=canvas.clientWidth/2-(e.clientX-r.left-(r.width-W*m)/2)/m*scale;ty=canvas.clientHeight/2-(e.clientY-r.top-(r.height-H*m)/2)/m*scale;draw()};
 main.replaceChildren(head,desc,tools,wrap);searchUpdate();refresh(true);const obs=new ResizeObserver(draw);obs.observe(stage);disposeReader=()=>{obs.disconnect();cancelAnimationFrame(frame)};
}

function showHome(){
 const plan=data.plan??data.notes.map(n=>({...n,status:"verified"})),byNumber=new Map(plan.map(n=>[n.number,n]));
 const parts=data.parts??[],treatises=data.treatises??[],byTreatise=new Map(treatises.map(t=>[t.id,t])),byPart=new Map(parts.map(p=>[p.id,p]));
 const h=node("h1","","数学原論");const intro=node("p","muted",parts.length+"部・"+treatises.length+"篇・"+"数学の諸構造");
 const search=node("input","search");search.type="search";search.placeholder="部・篇・ノート名・定義・命題・IDを検索";search.setAttribute("aria-label","検索");search.value=new URL(location.href).searchParams.get("q")??"";
 const filters=node("div","filters"),count=node("span","meta result-count"),list=node("div","results");
 const allowed=["all","note","verified","planned","entry"];let mode=new URL(location.href).searchParams.get("filter")??"all";if(!allowed.includes(mode))mode="all";
 const buttons=[["all","すべて"],["note","ノート"],["verified","公開済み"],["planned","制作予定"],["entry","定義・命題"]].map(([v,t])=>{const b=button(t,()=>{mode=v;update()});filters.append(b);return [v,b]});filters.append(count);
 const normalize=s=>String(s).normalize("NFKC").toLocaleLowerCase().replace(/\s+/g," ");
 const ready=n=>n.status==="planned"&&n.depends_on.every(d=>notes.has(d));
 const status=n=>notes.has(n.number)?"公開済み":ready(n)?"着手可能":n.status==="draft"?"草稿":n.status==="review"?"再検証中":"制作予定";
 const partOf=n=>byPart.get(byTreatise.get(n.treatise)?.part);
 const qurl=q=>url("q",q);
 function noteCard(n,context=true){
  const t=byTreatise.get(n.treatise),p=partOf(n),d=node("article","result note-result");
  d.dataset.note=String(n.number);d.dataset.status=n.status;
  const meta=node("div","result-head"),label=node("span","meta","N-"+n.number+(context&&t?"　"+t.id+" "+t.title:""));
  meta.append(label,node("span","status"+(notes.has(n.number)?" published":ready(n)?" ready":""),status(n)));
  d.append(meta);
  if(notes.has(n.number))d.append(anchor(n.title,url("note",n.number)));else d.append(node("strong","planned-title",n.title));
  d.append(node("span","summary",n.goals.join("；")));
  const pre=node("div","preconditions");if(Number.isInteger(n.depth))pre.append("依存層 "+n.depth+"　");
  pre.append("直接前提：");if(!n.depends_on.length)pre.append("なし");else n.depends_on.forEach((id,i)=>{if(i)pre.append("・");const target=byNumber.get(id);pre.append(anchor("N-"+id,notes.has(id)?url("note",id):qurl("N-"+id),"dep-link"));if(target)pre.lastChild.title=target.title});
  d.append(pre);return d
 }
 function update(){
  const q=normalize(search.value.trim()),terms=q?q.split(" "):[];
  const match=s=>terms.every(t=>normalize(s).includes(t));
  const exactNote=q.match(/^n-(\d+)$/);
  const exactPart=q.match(/^p-\d{2,}$/),exactTreatise=q.match(/^t-\d{2,}$/);
  buttons.forEach(([v,b])=>b.setAttribute("aria-pressed",String(v===mode)));
  const u=new URL(root);if(search.value)u.searchParams.set("q",search.value);if(mode!=="all")u.searchParams.set("filter",mode);history.replaceState(history.state,"",u);
  list.replaceChildren();let total=0;
  const found=mode==="entry"?[]:plan.filter(n=>{
   if(mode==="verified"&&!notes.has(n.number)||mode==="planned"&&notes.has(n.number))return false;
   const t=byTreatise.get(n.treatise),p=partOf(n);
   if(exactNote)return n.number===(data.aliases?.[exactNote[1]]?.number??Number(exactNote[1]));
   if(exactTreatise)return normalize(t?.id??"")===q;
   if(exactPart)return normalize(p?.id??"")===q;
   return match(["N-"+n.number,n.title,n.area,...n.goals,t?.id,t?.title,p?.id,p?.title].join(" "))
  });
  if(!q&&mode!=="entry"&&parts.length){
   for(const p of parts){
    const ts=treatises.filter(t=>t.part===p.id),ns=found.filter(n=>ts.some(t=>t.id===n.treatise));if(!ns.length)continue;
    const pd=node("details","part-group"),ps=node("summary","part-summary");ps.append(node("span","group-id",p.id),node("strong","",p.title));pd.append(ps);pd.open=ns.some(n=>notes.has(n.number));
    for(const t of ts){
     const items=ns.filter(n=>n.treatise===t.id);if(!items.length)continue;
     const td=node("details","treatise-group"),tsum=node("summary","treatise-summary");tsum.append(node("span","group-id",t.id),node("strong","",t.title));td.append(tsum);
     td.open=items.some(n=>notes.has(n.number));td.append(node("p","treatise-goals",t.goals.join("；")));
     for(const n of items)td.append(noteCard(n,false));pd.append(td)
    }list.append(pd)
   }
   total+=found.length
  }else{for(const n of found){list.append(noteCard(n));total++}}
  if((mode==="all"&&terms.length)||mode==="entry")for(const e of entries.values()){
   const n=byNumber.get(e.position[0]),t=byTreatise.get(n?.treatise),p=n&&partOf(n);
   if(!match([e.id,e.title,e.statement,...e.assumptions,n?.title,"N-"+e.position[0],t?.title,t?.id,p?.title,p?.id].join(" ")))continue;
   if(exactNote&&(data.aliases?.[exactNote[1]]?!data.aliases[exactNote[1]].ids.includes(e.id):e.position[0]!==Number(exactNote[1])))continue;
   if(exactTreatise&&normalize(t?.id??"")!==q)continue;
   if(exactPart&&normalize(p?.id??"")!==q)continue;
   const d=node("article","result knowledge-result"),a=anchor((types[e.kind]??e.kind)+"（"+e.title+"）",url("id",e.id));bindPreview(a,e);d.append(node("span","meta",e.id+"　N-"+e.position[0]),a,node("span","summary",e.statement));list.append(d);total++
  }
  count.textContent=total+"件";if(!total)list.append(node("p","empty","一致する項目がありません。"));
 }
 const readyBox=node("section","ready-box");readyBox.append(node("h2","","現在着手可能なノート"));
 const candidates=plan.filter(ready).sort((a,b)=>(a.depth??0)-(b.depth??0)||a.number-b.number);
 const readyLinks=node("div","ready-links");for(const n of candidates)readyLinks.append(anchor("N-"+n.number+" "+n.title,qurl("N-"+n.number)));if(!candidates.length)readyLinks.append(node("span","muted","なし"));readyBox.append(readyLinks);
 search.addEventListener("input",update);main.replaceChildren(h,intro,search,filters,readyBox,list);update()
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
 const docName=info.n==="notation"?"記号・記法一覧":info.n==="statements"?"定義・命題一覧":"N-"+info.n+"　"+(info.archive?.title??notes.get(info.n)?.title);
 const file=info.n==="notation"?"pdf/notation.pdf":info.n==="statements"?"pdf/statements.pdf":"pdf/N-"+info.n+".pdf";
 const heading=node("h1","reader-title",docName),side=node("aside","sidebar"),content=node("section"),layout=node("div","reader");
 side.append(node("h2","","ノート・知識索引"),anchor("← 検索・総目次",root.href));
 if(info.n==="notation"){side.append(anchor("定義・命題一覧",url("note","statements")))}else if(info.n==="statements"){for(const n of notes.values())side.append(anchor("N-"+n.number+"　"+n.title,url("note",n.number)))}else{
  const items=[...entries.values()].filter(e=>(info.archive?info.archive.ids.includes(e.id):e.position[0]===info.n)).sort((a,b)=>{for(let i=0;i<4;i++){if(a.position[i]!==b.position[i])return a.position[i]-b.position[i]}return 0});
  if(info.id){const idx=items.findIndex(e=>e.id===info.id),nav=node("div","item-nav");if(idx>0)nav.append(anchor("← 前の知識項目",url("id",items[idx-1].id)));if(idx>=0&&idx+1<items.length)nav.append(anchor("次の知識項目 →",url("id",items[idx+1].id)));side.append(nav)}
  for(const e of items){const a=anchor(e.id+"　"+e.title,url("id",e.id),e.id===info.id?"active":"");bindPreview(a,e);side.append(a)}
 }
 const controls=node("div","toolbar"),shell=node("div","pdf-shell "+readingMode),status=node("p","loading","PDFを読み込んでいます。");
 controls.setAttribute("aria-label","ページ操作");shell.append(status);shell.setAttribute("aria-busy","true");
 let jump=()=>{};
 const previous=button("← 前頁",()=>jump(-1,true)),next=button("次頁 →",()=>jump(1,true)),pnum=node("input");pnum.type="number";pnum.min=1;pnum.setAttribute("aria-label","ページ番号");
 const pageCount=node("span","meta","/ …"),z=node("select");z.setAttribute("aria-label","表示倍率");
 for(const [v,t] of [["fit","幅に合わせる"],["0.9","90%"],["1.1","110%"],["1.4","140%"],["1.8","180%"]]){const o=node("option","",t);o.value=v;z.append(o)}
 const mode=node("select");mode.setAttribute("aria-label","表示方式");for(const [v,t] of [["continuous","連続スクロール"],["single","1ページずつ"]]){const o=node("option","",t);o.value=v;mode.append(o)}mode.value=readingMode;
 const download=anchor("PDFを開く ↗",new URL(file,root).href);download.target="_blank";download.rel="noopener";
 const footer=node("div","page-footer"),prevBottom=button("← 前のページ",()=>jump(-1,true)),nextBottom=button("次のページ →",()=>jump(1,true)),footerCount=node("span","meta");footer.append(prevBottom,footerCount,nextBottom);footer.hidden=readingMode!=="single";
 const noteNav=node("div","note-nav"),published=[...notes.keys()].sort((a,b)=>a-b);
 if(info.archive){noteNav.append(anchor("統合後のノートを開く",url("id",info.archive.first)))}else if(typeof info.n==="number"){const idx=published.indexOf(info.n);if(idx>0)noteNav.append(anchor("← 前のノート：N-"+published[idx-1],url("note",published[idx-1])));if(idx+1<published.length)noteNav.append(anchor("次のノート：N-"+published[idx+1]+" →",url("note",published[idx+1])))}
 for(const b of [previous,next,pnum,z,mode,prevBottom,nextBottom])b.disabled=true;
 controls.addEventListener("pointerenter",hidePreview);
 controls.append(previous,pnum,pageCount,next,mode,z,download);content.append(heading,controls,shell,footer,noteNav);layout.append(side,content);main.replaceChildren(layout);
 const loading=pdfjs.getDocument({url:new URL(file,root).href,isEvalSupported:false,cMapUrl:new URL("./vendor/pdfjs/cmaps/",root).href,cMapPacked:true,standardFontDataUrl:new URL("./vendor/pdfjs/standard_fonts/",root).href});job=loading;
 try{
  const doc=await loading.promise;if(token!==ticket)return;
  const dest=info.id?await destination(doc,info.id):null;if(token!==ticket)return;if(info.id&&!dest)throw Error("PDF内の参照先が見つかりません："+info.id);
  const first=clamp(dest?.page??info.page??1,1,doc.numPages);
  const s={doc,n:info.n,page:first,zoom:"fit",id:info.id,mode:readingMode};state=s;
  const pages=[];let generation=0,frame=0,rendering=false,disposed=false,ready=false,resizeTimer=0,lastWidth=0;
  const current=()=>!disposed&&token===ticket&&state===s;
  const topOffset=()=>Math.max(0,controls.getBoundingClientRect().height)+16;
  function setPageUrl(){const u=new URL(url("note",s.n));u.searchParams.set("page",s.page);history.replaceState(history.state,"",u);s.id=null}
  function sync(p,updateUrl=true){
   if(!current())return;const old=s.page;s.page=p;
   if(document.activeElement!==pnum)pnum.value=String(p);
   previous.disabled=prevBottom.disabled=p<=1;next.disabled=nextBottom.disabled=p>=doc.numPages;footerCount.textContent=p+" / "+doc.numPages+" 頁";
   if(updateUrl&&old!==p)setPageUrl()
  }
  function showPages(){
   shell.classList.toggle("continuous",s.mode==="continuous");shell.classList.toggle("single",s.mode==="single");footer.hidden=s.mode!=="single";
   for(const item of pages)item.wrap.hidden=s.mode==="single"&&item.number!==s.page;
  }
  function scrollToPage(n,y=null){
   if(!current())return;const item=pages[n-1];if(!item)return;
   showPages();
   let top=item.wrap.getBoundingClientRect().top+scrollY-topOffset();
   if(Number.isFinite(y)){
    const offset=clamp(item.view.convertToViewportPoint(0,y)[1],0,item.view.height);
    for(const old of shell.querySelectorAll(".target"))old.remove();
    const mark=node("div","target");mark.style.top=offset+"px";item.wrap.append(mark);
    top+=offset-Math.max(30,(innerHeight-topOffset())*.24)
   }
   window.scrollTo({top:Math.max(0,top),behavior:"instant"});schedule()
  }
  function clear(item){
   item.task?.cancel();item.task=null;
   for(const child of [...item.wrap.children])if(!child.classList.contains("target"))child.remove();
   item.rendered=false;item.failed=false;item.wrap.removeAttribute("data-rendered");
  }
  function sizePages(){
   lastWidth=shell.clientWidth;generation++;
   for(const item of pages){
    clear(item);const base=item.page.getViewport({scale:1});
    const scale=s.zoom==="fit"?clamp((shell.clientWidth-34)/base.width,.3,2):Number(s.zoom);
    item.view=item.page.getViewport({scale});item.wrap.style.width=item.view.width+"px";item.wrap.style.height=item.view.height+"px";item.wrap.style.setProperty("--scale-factor",String(scale));
   }
  }
  function visiblePage(){
   if(s.mode==="single")return s.page;
   const line=topOffset()+24;
   if(scrollY>0&&innerHeight+scrollY>=document.documentElement.scrollHeight-3)return pages.length;
   let p=1;
   for(const item of pages){if(item.wrap.getBoundingClientRect().top<=line)p=item.number;else break}
   return p
  }
  function schedule(){if(!ready||!current()||frame)return;frame=requestAnimationFrame(()=>{frame=0;if(!current())return;sync(visiblePage());void renderNearby()})}
  async function renderPage(item,g){
   const valid=()=>current()&&g===generation;
   const {page,view,wrap}=item;
   const canvas=node("canvas"),dpr=Math.min(devicePixelRatio||1,2);
   canvas.width=Math.ceil(view.width*dpr);canvas.height=Math.ceil(view.height*dpr);canvas.style.width=view.width+"px";canvas.style.height=view.height+"px";
   wrap.prepend(canvas);
   const task=page.render({canvasContext:canvas.getContext("2d"),viewport:view,transform:dpr===1?null:[dpr,0,0,dpr,0,0]});item.task=task;
   try{await task.promise}catch(e){if(e.name==="RenderingCancelledException"||!valid())return;throw e}
   if(!valid())return;item.task=null;
   const textLayer=node("div","textLayer");wrap.append(textLayer);
   if(pdfjs.TextLayer)try{await new pdfjs.TextLayer({textContentSource:page.streamTextContent(),container:textLayer,viewport:view}).render()}catch{}
   if(!valid())return;
   const list=await page.getAnnotations({intent:"display"});if(!valid())return;
   const annotations=node("div","annotations");
   for(const a of list){
    if(a.subtype!=="Link"||!a.rect)continue;const e=readRef(a);let href=null;
    if(e)href=url("id",e.id);else if(a.dest)href="#pdf-destination";else{try{const u=new URL(a.url);if(u.protocol==="https:"||u.protocol==="http:")href=u.href}catch{}}
    if(!href)continue;
    const box=anchor("",href,"annotation");const [x1,y1,x2,y2]=view.convertToViewportRectangle(a.rect);
    Object.assign(box.style,{left:Math.min(x1,x2)+"px",top:Math.min(y1,y2)+"px",width:Math.abs(x1-x2)+"px",height:Math.abs(y1-y2)+"px"});
    box.setAttribute("aria-label",e?(types[e.kind]??"参照")+"："+e.title+" "+e.id:"PDF内リンク");
    if(e)bindPreview(box,e);
    else if(a.dest)box.addEventListener("click",async ev=>{ev.preventDefault();try{const d=await destination(doc,a.dest);if(d&&current()){hidePreview();sync(d.page);scrollToPage(d.page,d.y)}}catch(err){console.error(err)}});
    else{box.target="_blank";box.rel="noopener"}annotations.append(box)
   }
   wrap.append(annotations);item.rendered=true;wrap.dataset.rendered="true";
  }
  async function renderNearby(){
   if(rendering||!current())return;rendering=true;
   try{
    while(current()){
     const items=pages.map(item=>{if(item.wrap.hidden)return {item,distance:Infinity};const r=item.wrap.getBoundingClientRect();return {item,distance:r.bottom<0?-r.bottom:r.top>innerHeight?r.top-innerHeight:0}});
     for(const {item,distance} of items)if(distance>innerHeight*3&&item.rendered)clear(item);
     const next=items.filter(x=>x.distance<=innerHeight*1.25&&!x.item.rendered&&!x.item.failed).sort((a,b)=>a.distance-b.distance||Math.abs(a.item.number-s.page)-Math.abs(b.item.number-s.page))[0];
     if(!next)break;
     const g=generation;try{await renderPage(next.item,g)}catch(err){if(current()&&g===generation){clear(next.item);next.item.failed=true;next.item.wrap.append(node("p","error","ページの描画に失敗しました。PDFを直接開いてください。"));console.error(err)}}
    }
   }finally{rendering=false}
  }
  function reflow(){
   if(!current()||!ready)return;hidePreview();const p=s.page,item=pages[p-1];const oldY=clamp((topOffset()-item.wrap.getBoundingClientRect().top)/item.view.height,0,1);
   sizePages();const newTop=item.wrap.getBoundingClientRect().top+scrollY+oldY*item.view.height-topOffset();window.scrollTo({top:Math.max(0,newTop),behavior:"instant"});schedule()
  }
  const resize=()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(current()&&s.zoom==="fit"&&shell.clientWidth!==lastWidth)reflow();else schedule()},100)};
  const dispose=()=>{disposed=true;cancelAnimationFrame(frame);clearTimeout(resizeTimer);removeEventListener("scroll",schedule);removeEventListener("resize",resize);for(const item of pages)item.task?.cancel()};
  disposeReader=dispose;
  // Create stable page boxes before jumping; render only visible and nearby pages.
  for(let n=1;n<=doc.numPages;n++){
   const page=await doc.getPage(n);if(!current())return;
   const wrap=node("div","page");wrap.dataset.page=String(n);wrap.setAttribute("aria-label",n+" ページ");pages.push({number:n,page,wrap,view:null,task:null,rendered:false,failed:false});
  }
  shell.replaceChildren(...pages.map(p=>p.wrap));showPages();sizePages();
  pageCount.textContent="/ "+doc.numPages;pnum.max=doc.numPages;pnum.disabled=false;z.disabled=false;mode.disabled=false;shell.setAttribute("aria-busy","false");
  sync(first,false);pnum.value=String(first);
  jump=(value,relative=false)=>{if(!current())return;hidePreview();const n=clamp(relative?s.page+value:value,1,doc.numPages);sync(n);pnum.value=String(n);scrollToPage(n)};
  pnum.onchange=()=>jump(parseInt(pnum.value,10)||1);pnum.onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();jump(parseInt(pnum.value,10)||1);pnum.blur()}};
  z.onchange=()=>{s.zoom=z.value;reflow()};
  mode.onchange=()=>{
   if(!current()||!ready)return;hidePreview();
   const item=pages[s.page-1],offset=clamp((topOffset()-item.wrap.getBoundingClientRect().top)/item.view.height,0,1);
   s.mode=readingMode=mode.value==="single"?"single":"continuous";try{localStorage.setItem("genron-reading-mode",readingMode)}catch{}
   showPages();const top=item.wrap.getBoundingClientRect().top+scrollY+offset*item.view.height-topOffset();window.scrollTo({top:Math.max(0,top),behavior:"instant"});schedule();
  };
  ready=true;addEventListener("scroll",schedule,{passive:true});addEventListener("resize",resize);
  if(scroll!==null)window.scrollTo(0,scroll);else if(dest||first!==1)scrollToPage(first,dest?.y);else window.scrollTo(0,0);
  schedule();
 }catch(e){if(token===ticket){disposeReader?.();disposeReader=null;shell.replaceChildren(node("p","error","PDFを表示できませんでした："+e.message),download.cloneNode(true))}}
}
function showError(e){main.replaceChildren(node("p","error",String(e.message??e)),anchor("検索・総目次へ戻る",root.href))}
async function render(restore=null){
 const t=++ticket;hidePreview();disposeReader?.();disposeReader=null;
 const oldJob=job;job=null;state=null;if(oldJob){try{await oldJob.destroy()}catch{}}if(t!==ticket)return;
 try{if(new URL(location.href).searchParams.get('view')==='map'){showMap();return}const info=routeInfo();if(info)await loadReader(info,t,restore);else{showHome();if(restore!==null)window.scrollTo(0,restore)}}catch(e){showError(e)}
}
document.addEventListener("click",ev=>{
 if(ev.defaultPrevented||ev.button!==0||ev.ctrlKey||ev.metaKey||ev.shiftKey||ev.altKey)return;
 const a=ev.target.closest("a[href]");if(!a||a.target==="_blank"||a.getAttribute("href").startsWith("#"))return;
 const u=new URL(a.href);if(u.origin!==root.origin||u.pathname!==root.pathname)return;
 ev.preventDefault();history.replaceState({scrollY:scrollY},"",location.href);history.pushState(null,"",u);window.scrollTo(0,0);render()
});
history.scrollRestoration="manual";
window.addEventListener("popstate",ev=>{render(ev.state?.scrollY??null)});
try{const res=await fetch(new URL("data.json",root));if(!res.ok)throw Error("検索データの取得に失敗しました");data=await res.json();entries=new Map(data.entries.map(e=>[e.id,e]));notes=new Map(data.notes.map(n=>[n.number,n]));await render()}catch(e){showError(e)}
