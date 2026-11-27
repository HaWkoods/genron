const $=s=>document.querySelector(s);
const main=$("#app"), preview=$("#preview"), dialog=$("#settings");
const types={axiom:"公理",definition:"定義",proposition:"命題",example:"例",worked_example:"例題"};
const headingKind=e=>e.heading_kind??({convention:"definition",background:"axiom",definition:"definition",axiom:"axiom",example:"example",worked_example:"worked_example",exercise:"worked_example"}[e.kind]??"proposition");
const isExample=e=>["example","worked_example"].includes(headingKind(e));
const headingLabel=e=>types[headingKind(e)];
const root=new URL("./",location.href);
const url=(key,val)=>{const u=new URL(root);u.searchParams.set(key,val);return u.href};
const node=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e};
const anchor=(txt,href,cls)=>{const a=node("a",cls,txt);a.href=href;return a};
const clamp=(x,min,max)=>Math.max(min,Math.min(max,x));
let data, entries, notes, disposeReader=null, closeTimer=0, active=null, pinned=false;
const noteNumber=n=>n?.display_number??("N-"+(n?.number??""));
const noteByNumber=n=>notes.get(n)??data.plan?.find(x=>x.number===n);
const entryNumber=e=>e.display_number??[noteNumber(noteByNumber(e.position[0])),...e.position.slice(1)].join(".");
const isTouch=()=>matchMedia("(hover: none)").matches;
const defaults={width:580,padding:28};
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
  const paragraph=span.closest("td,p")??box;
  const style=getComputedStyle(paragraph);
  const available=paragraph.clientWidth-parseFloat(style.paddingLeft||0)-parseFloat(style.paddingRight||0);
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
 box.append(node("div","meta",noteNumber(noteByNumber(e.position[0]))+" "+(notes.get(e.position[0])?.title??"")));
 box.append(node("h3","",headingLabel(e)+" "+entryNumber(e)+"（"+e.title+"）"));
 if(e.assumptions.length){const p=node("p");p.append("仮定：");const s=node("span");renderParts(s,e.preview?.assumptions,e.assumptions.join("；"));p.append(s);box.append(p)}
 const p=node(headingKind(e)==="worked_example"?"div":"p");if(headingKind(e)==="worked_example")renderBookText(p,e.problem_tex??e.statement,{...e.webProof,noteNumber:e.position[0]});else renderParts(p,e.preview?.statement,e.statement);box.append(p);
 const foot=node("div","foot");foot.append(anchor("参照元のノートを開く ↗",(isExample(e)||new URL(location.href).searchParams.get("view")==="web"||isNativeCatalogue(new URL(location.href).searchParams))?webUrl("id",e.id):url("id",e.id)));box.append(foot)
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
function routeInfo(){const p=new URL(location.href).searchParams;const id=p.get("id");if(id){const e=entries.get(id);if(!e)throw Error("未登録の知識ID："+id);return {n:e.position[0],id,page:null}}const n=p.get("note");if(n==="statements"||n==="notation"||n==="examples")return {n,page:parseInt(p.get("page"),10)||1};const alias=data.aliases?.[n];if(alias)return {n:alias.number,id:alias.first,page:null};if(n&&notes.has(Number(n)))return {n:Number(n),page:parseInt(p.get("page"),10)||1};if(n)throw Error("未掲載ノート："+n);return null}

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
  for(const n of plan){if(!visible.has(n.number))continue;const p=pos.get(n.number);ctx.globalAlpha=active.has(n.number)?1:.15;ctx.fillStyle=n.number===selected?"#245b91":dark()?"#435b75":"#a7bdd3";if(scale<.18){ctx.fillRect(p.x,p.y,164,38)}else{ctx.fillRect(p.x,p.y,164,38);ctx.fillStyle=n.number===selected||dark()?"#fff":"#152b42";ctx.font="12px sans-serif";ctx.fillText(noteNumber(n),p.x+6,p.y+13);if(scale>.34){ctx.font="14px sans-serif";ctx.fillText(n.title,p.x+6,p.y+30,152)}}}
  ctx.restore();prep(mini,mc);const m=Math.min(mini.clientWidth/W,mini.clientHeight/H),ox=(mini.clientWidth-W*m)/2,oy=(mini.clientHeight-H*m)/2;mc.fillStyle=dark()?"#182334":"#fff";mc.fillRect(0,0,mini.clientWidth,mini.clientHeight);for(const [id,p] of pos){mc.globalAlpha=active.has(id)?1:.2;mc.fillStyle=id===selected?"#245b91":"#879eb5";mc.fillRect(ox+p.x*m,oy+p.y*m,Math.max(2,164*m),Math.max(2,38*m))}mc.globalAlpha=1;mc.strokeStyle="#d26b34";mc.lineWidth=1.5;mc.strokeRect(ox-tx/scale*m,oy-ty/scale*m,canvas.clientWidth/scale*m,canvas.clientHeight/scale*m);
 }
 function refresh(refit=false){active=selected===null?new Set(by.keys()):direction.value==="both"?new Set([...walk(selected,true,scope.value==="one"),...walk(selected,false,scope.value==="one")]):walk(selected,direction.value!=="down",direction.value!=="path"&&scope.value==="one");visible=layout.value==="local"?active:new Set(by.keys());scope.disabled=direction.value==="path";panel.replaceChildren();if(selected===null){panel.append(node("h2","","ノートを選択"),node("p","muted","検索または地図上のノートを選択してください。"))}else{const n=by.get(selected);panel.append(node("h2","",noteNumber(n)+" "+n.title),node("p","",(n.goals??[]).join("；")));if(notes.has(selected))panel.append(anchor("ノートを読む",url("note",selected)));else panel.append(node("p","muted","本文は未掲載です。"));const items=[...entries.values()].filter(e=>e.position[0]===selected);if(items.length){panel.append(node("h3","","定義・命題"));for(const e of items){const a=anchor(e.title,url("id",e.id));bindPreview(a,e);panel.append(a)}}if(direction.value==="path"){panel.append(node("h3","","学習順序（前提を先に）"));for(const id of [...active].sort((a,b)=>depth.get(a)-depth.get(b)||a-b)){const n=by.get(id);panel.append(button(noteNumber(n)+" "+n.title,()=>choose(id)))}}}
 if(refit)fit(layout.value==="local");else draw()}
 function choose(id){selected=id;results.value=String(id);refresh(layout.value==="local");if(layout.value!=="local"){const p=pos.get(id);scale=Math.max(scale,.65);tx=canvas.clientWidth/2-(p.x+82)*scale;ty=canvas.clientHeight/2-(p.y+19)*scale;draw()}}
 function searchUpdate(){const q=search.value.normalize("NFKC").toLowerCase().trim();results.replaceChildren();const placeholder=node("option","","ノートを選択");placeholder.value="";results.append(placeholder);const alias=data.aliases?.[q.replace(/^n-/,"")];for(const n of plan){if(!q||alias?.number===n.number||(/^\d+$/.test(q)?n.number===Number(q):("N-"+n.number+" "+noteNumber(n)+" "+n.title).toLowerCase().includes(q))){const o=node("option","",noteNumber(n)+" "+n.title);o.value=n.number;results.append(o)}}if(selected!==null)results.value=String(selected)}
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
 const allowed=["all","note","verified","planned","entry","examples"];let mode=new URL(location.href).searchParams.get("filter")??"all";if(!allowed.includes(mode))mode="all";
 const buttons=[["all","すべて"],["note","ノート"],["verified","公開済み"],["planned","制作予定"],["entry","定義・命題・公理"],["examples","例・例題"]].map(([v,t])=>{const b=button(t,()=>{mode=v;update()});filters.append(b);return [v,b]});filters.append(count);
 const normalize=s=>String(s).normalize("NFKC").toLocaleLowerCase().replace(/\s+/g," ");
 const ready=n=>n.status==="planned"&&n.depends_on.every(d=>notes.has(d));
 const status=n=>notes.has(n.number)?"公開済み":ready(n)?"着手可能":n.status==="draft"?"草稿":n.status==="review"?"再検証中":"制作予定";
 const partOf=n=>byPart.get(byTreatise.get(n.treatise)?.part);
 const qurl=q=>url("q",q);
 function noteCard(n,context=true){
  const t=byTreatise.get(n.treatise),p=partOf(n),d=node("article","result note-result");
  d.dataset.note=String(n.number);d.dataset.status=n.status;
  const meta=node("div","result-head"),label=node("span","meta",noteNumber(n)+(context&&t?"　"+t.id+" "+t.title:""));
  meta.append(label,node("span","status"+(notes.has(n.number)?" published":ready(n)?" ready":""),status(n)));
  d.append(meta);
  if(notes.has(n.number)){d.append(anchor(n.title,webUrl("note",n.number)))}else d.append(node("strong","planned-title",n.title));
  d.append(node("span","summary",n.goals.join("；")));
  const pre=node("div","preconditions");if(Number.isInteger(n.depth))pre.append("依存層 "+n.depth+"　");
  pre.append("直接前提：");if(!n.depends_on.length)pre.append("なし");else n.depends_on.forEach((id,i)=>{if(i)pre.append("・");const target=byNumber.get(id);pre.append(anchor(noteNumber(target),notes.has(id)?url("note",id):qurl("N-"+id),"dep-link"));if(target)pre.lastChild.title=target.title});
  d.append(pre);return d
 }
 function update(){
  const q=normalize(search.value.trim()),terms=q?q.split(" "):[];
  const match=s=>terms.every(t=>normalize(s).includes(t));
  const exactNote=q.match(/^n-(\d+)$/);
  const exactDisplay=plan.find(n=>normalize(noteNumber(n))===q);
  const exactPart=q.match(/^p-\d{2,}$/),exactTreatise=q.match(/^t-\d{2,}$/);
  buttons.forEach(([v,b])=>b.setAttribute("aria-pressed",String(v===mode)));
  const u=new URL(root);if(search.value)u.searchParams.set("q",search.value);if(mode!=="all")u.searchParams.set("filter",mode);history.replaceState(history.state,"",u);
  list.replaceChildren();let total=0;
  const found=mode==="entry"||mode==="examples"?[]:plan.filter(n=>{
   if(mode==="verified"&&!notes.has(n.number)||mode==="planned"&&notes.has(n.number))return false;
   const t=byTreatise.get(n.treatise),p=partOf(n);
   if(exactDisplay)return n.number===exactDisplay.number;
   if(exactNote)return n.number===(data.aliases?.[exactNote[1]]?.number??Number(exactNote[1]));
   if(exactTreatise)return normalize(t?.id??"")===q;
   if(exactPart)return normalize(p?.id??"")===q;
   return match(["N-"+n.number,noteNumber(n),n.title,n.area,...n.goals,t?.id,t?.title,p?.id,p?.title].join(" "))
  });
  if(!q&&mode!=="entry"&&mode!=="examples"&&parts.length){
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
  if((mode==="all"&&terms.length)||mode==="entry"||mode==="examples")for(const e of entries.values()){
   if(mode==="entry"&&isExample(e)||mode==="examples"&&!isExample(e))continue;
   const n=byNumber.get(e.position[0]),t=byTreatise.get(n?.treatise),p=n&&partOf(n);
   if(!match([e.id,entryNumber(e),noteNumber(n),e.title,e.statement,...e.assumptions,n?.title,"N-"+e.position[0],t?.title,t?.id,p?.title,p?.id].join(" ")))continue;
   if(exactDisplay&&e.position[0]!==exactDisplay.number)continue;
   if(exactNote&&(data.aliases?.[exactNote[1]]?!data.aliases[exactNote[1]].ids.includes(e.id):e.position[0]!==Number(exactNote[1])))continue;
   if(exactTreatise&&normalize(t?.id??"")!==q)continue;
   if(exactPart&&normalize(p?.id??"")!==q)continue;
   const d=node("article","result knowledge-result"),a=anchor(headingLabel(e)+"（"+e.title+"）",isExample(e)?webUrl("id",e.id):url("id",e.id));bindPreview(a,e);d.append(node("span","meta",entryNumber(e)),a,node("span","summary",headingKind(e)==="worked_example"?"例題：本文で問題と解答を閲覧":e.statement));list.append(d);total++
  }
  count.textContent=total+"件";if(!total)list.append(node("p","empty","一致する項目がありません。"));
 }
 const readyBox=node("section","ready-box");readyBox.append(node("h2","","現在着手可能なノート"));
 const candidates=plan.filter(ready).sort((a,b)=>(a.depth??0)-(b.depth??0)||a.number-b.number);
 const readyLinks=node("div","ready-links");for(const n of candidates)readyLinks.append(anchor(noteNumber(n)+" "+n.title,qurl("N-"+n.number)));if(!candidates.length)readyLinks.append(node("span","muted","なし"));readyBox.append(readyLinks);
 search.addEventListener("input",update);main.replaceChildren(h,intro,search,filters,readyBox,list);update()
}
function webUrl(key,val){const u=new URL(url(key,val));u.searchParams.set("view","web");return u.href}


// Link explicit prose citations, never guess a target from a mathematical term.
// A single-ID citation with a note/name prefix is linked as a whole;
// other explicit IDs (including lists of IDs) remain independently clickable.
function appendWebCitationText(target,text,metadata={}){
 // Canonical Japanese titles are the visible reference; IDs are internal.
 const refs=[];
 const mark=id=>{const e=entries.get(id);if(!e)return id;const i=refs.push(e)-1;return "\uE000"+i+"\uE001"};
 const escape=s=>s.replace(/[.*+?^$(){}|[\]\\]/g,"\\$&");
 const aliases={
  "K-000030":["集合演算の分配律"],"K-000035":["写像の指定"],
  "K-000041":["逆写像による全単射の判定"],"K-000049":["非交和の定義"],
  "K-000053":["同値類"],"K-000054":["同値関係と分割の対応"],
  "K-000104":["最小元の原理"],"K-000116":["有限集合の直積の濃度"],
  "K-000263":["左剰余類の定義"],"K-000131":["Zornの補題"]
 };
 // Old prose sometimes has a reference to several results in one parenthesis.
 text=text.replace(/商集合自体の構成とその普遍性[（(]N-2\s*[,，]\s*K-000053\s*[,，]\s*K-000055[）)]/g,()=>mark("K-000053")+"と"+mark("K-000055"));
 text=text.replace(/N-5\s*の\s*元の個数と整合する[（(]K-000111[）)]/g,()=>mark("K-000111")+"における元の個数と整合する");
 text=text.replace(/N-5\s*の\s*有限集合の直積・部分集合に関する結果/g,()=>mark("K-000116")+"及び"+mark("K-000113"));
 // Explicit numbered citations with a stable ID.
 text=text.replace(/(?:N-\d+\s*の\s*)?(?:定義|命題|定理|規約|原理|公理|補題|系|構成)\s*\d+(?:\.\d+)+\s*[（(](K-\d{6})(?:[，,、]\s*[^（）()]*)?[）)]/g,(m,id)=>entries.has(id)?mark(id):m);
 // Canonical title or a recorded legacy alias followed by an ID.
 for(const e of entries.values()){
  if(!text.includes(e.id)&&!text.includes("N-"+e.position[0]))continue;
  const names=[e.title,...(aliases[e.id]??[])].sort((a,b)=>b.length-a.length).map(escape).join("|");
  const n="N-"+e.position[0];
  const p=new RegExp("(?:\\b"+n+"\\s*の\\s*)?(?:"+names+")\\s*(?:[（(]\\s*(?:"+n+"\\s*[,，]\\s*)?"+e.id+"(?:\\s*[,，]\\s*[^（）()]*)?\\s*[）)]|"+e.id+"(?![0-9]))","g");
  text=text.replace(p,()=>mark(e.id));
  // A note-qualified title without an ID is still unambiguous.
  text=text.replace(new RegExp("\\b"+n+"\\s*の\\s*(?:"+names+")","g"),()=>mark(e.id));
 }
 // A parenthetical ID after an assertion is a citation rather than part of the title.
 text=text.replace(/[（(]\s*(?:N-\d+\s*[,，]\s*)?(K-\d{6}(?:\s*[,，]\s*K-\d{6})*)\s*[）)]/g,(m,list)=>{
  const ids=list.match(/K-\d{6}/g);return ids.every(id=>entries.has(id))?"（"+ids.map(mark).join("，")+"）":m
 });
 // Numeric-only references can be resolved only within the current note.
 if(metadata.noteNumber)text=text.replace(/(?:定義|命題|定理|規約|原理|公理|補題|系|構成)\s*(\d+)\.(\d+)(?![\d.])/g,(m,s,i)=>{
  const es=[...entries.values()].filter(e=>e.position[0]===metadata.noteNumber&&e.position.at(-2)===Number(s)&&e.position.at(-1)===Number(i));
  return es.length===1?mark(es[0].id):m
 });
 text=text.replace(/(?<![A-Za-z0-9-])K-\d{6}(?![A-Za-z0-9-])/g,id=>entries.has(id)?mark(id):id);
 let last=0;
 for(const m of text.matchAll(/\uE000(\d+)\uE001/g)){
  target.append(document.createTextNode(text.slice(last,m.index)));
  const e=refs[Number(m[1])],a=anchor(e.title,webUrl("id",e.id),"web-citation");bindPreview(a,e);target.append(a);
  last=m.index+m[0].length;
 }
 target.append(document.createTextNode(text.slice(last)));
}

function renderProof(target,proof,metadata){
 const tex=proof.tex;
 const pattern=/(\$\$[\s\S]*?\$\$|(?<!\\)\$(?:\\.|[^$])*?\$|\\\[[\s\S]*?\\\]|\\begin\{(align\*?|gather\*?|equation\*?|multline\*?)\}[\s\S]*?\\end\{\2\}|(?:定義|命題|定理|規約|原理|公理|補題|系|構成)?\\(?:ref|eqref)\{[^}]+\}|\\GenronRefText\{K-\d+\}\{[^}]+\}|\\GenronRef\{K-\d+\})/g;
 const macros=Object.fromEntries(Object.entries(metadata.macros??{}).map(([k,v])=>["\\"+k,v]));
 const plain=s=>{for(const line of s.split(/\n\s*\n/)){if(!line.length)continue;const p=node("span");p.textContent=jpPunctuation(line.replace(/\\(?:noindent|par)\b/g,"").replace(/\\item\b/g,"\n・").replace(/\\(?:begin|end)\{(?:enumerate|itemize)\}/g,"").replace(/\\(?:emph|textbf|textit)\{([^{}]*)\}/g,"$1").replace(/\n/g," "));appendWebCitationText(target,p.textContent,metadata);if(s.includes("\n\n"))target.append(node("br"))}};
 let last=0;
 for(const m of tex.matchAll(pattern)){
  plain(tex.slice(last,m.index));last=m.index+m[0].length;
  const token=m[0];const ref=token.match(/^(?:定義|命題|定理|規約|原理|公理|補題|系|構成)?\\(?:ref|eqref|GenronRef|GenronRefText)\{([^}]+)\}(?:\{([^}]+)\})?$/);
  if(ref){const id=metadata.labels?.[ref[1]]??ref[1],e=entries.get(id);if(e){const a=anchor(e.title,webUrl("id",id),"web-citation");bindPreview(a,e);target.append(a)}else target.append(document.createTextNode(token));continue}
  const display=token.startsWith("\\[")||token.startsWith("$$")||token.startsWith("\\begin");
  let formula=token;
  if(token.startsWith("\\[" )||token.startsWith("$$"))formula=token.slice(2,-2);
  else if(token.startsWith("$"))formula=token.slice(1,-1);
  else if(m[2]){const env=m[2].replace("*","");const inner=token.slice(token.indexOf("}")+1,token.lastIndexOf("\\end"));formula=env==="align"?"\\begin{aligned}"+inner+"\\end{aligned}":env==="gather"||env==="multline"?"\\begin{gathered}"+inner+"\\end{gathered}":inner}
  const span=node(display?"div":"span",display?"proof-display":"math");
  if(display){span.style.cssText="max-width:100%;overflow-x:auto;margin:0.8em 0"}
  try{katex.render(formula,span,{displayMode:display,throwOnError:true,trust:false,strict:"ignore",macros:{...macros}})}catch{span.textContent=token;span.title="未変換の原稿数式"}
  target.append(span)
 }
 plain(tex.slice(last));
}



const jpPunctuation=s=>String(s).replaceAll("、","，").replaceAll("。","．");
function renderBookText(target,tex,metadata){
 const special=/\\begin\{(tabular|enumerate|itemize|center)\}(?:\{([^{}]*)\})?([\s\S]*?)\\end\{\1\}/g;
 let last=0;
 function paragraph(text){
  if(!text.trim())return;
  // Keep math delimiters intact; the shared renderer handles display math and references.
  const p=node("div","web-paragraph");renderProof(p,{tex:text.trim()},metadata);target.append(p);
 }
 for(const m of tex.matchAll(special)){
  paragraph(tex.slice(last,m.index));last=m.index+m[0].length;
  if(m[1]==="center"){const div=node("div","web-centered");renderBookText(div,m[3],metadata);target.append(div)}
  else if(m[1]==="tabular"){
   const table=node("table","web-math-table");
   for(const row of m[3].trim().split(/\\\\/)){if(!row.trim())continue;const tr=node("tr");for(const cell of row.split(/(?<!\\)&/)){const td=node("td");renderProof(td,{tex:cell.trim()},metadata);tr.append(td)}table.append(tr)}
   target.append(table);
  }else{
   const list=node(m[1]==="enumerate"?"ol":"ul","web-math-list");
   for(const item of m[3].split(/\\item\b/)){if(!item.trim())continue;const li=node("li");renderBookText(li,item,metadata);list.append(li)}target.append(list)
  }
 }
 paragraph(tex.slice(last));
}
function appendWebProof(section,proof,metadata){
 const block=node("details","web-proof");block.append(node("summary","",jpPunctuation(proof.title)));const body=node("div","proof-body");renderBookText(body,proof.tex,metadata);block.append(body,node("div","web-qed","□"));section.append(block);
 block.addEventListener("toggle",()=>{if(block.open)fitMath(body)});
}
function renderSourceEntry(section,e){
 const metadata={...e.webProof,noteNumber:e.position[0]};
 const re=/\\begin\{proof\}(?:\[([^\]]*)\])?([\s\S]*?)\\end\{proof\}/g;
 let last=0;
 for(const m of metadata.content.matchAll(re)){renderBookText(section,metadata.content.slice(last,m.index),metadata);appendWebProof(section,{title:m[1]??"証明",tex:m[2]},metadata);last=m.index+m[0].length}
 renderBookText(section,metadata.content.slice(last),metadata);
}


function renderEntryContent(section,e){
 if(headingKind(e)==="worked_example"){
  const metadata={...e.webProof,noteNumber:e.position[0]};
  const question=node("div","worked-question");
  renderBookText(question,e.problem_tex??e.statement,metadata);section.append(question);
  const answer=node("details","web-proof worked-answer"),body=node("div","proof-body");
  answer.append(node("summary","","解答"));
  if(metadata.content){
   const answerTex=metadata.content.replace(/\\begin\{proof\}(?:\[[^\]]*\])?/g,"\n\n").replace(/\\end\{proof\}/g,"\n\n");
   renderBookText(body,answerTex,metadata);
  }else{
   const p=node("p");renderParts(p,e.preview?.statement,jpPunctuation(e.statement));body.append(p);
   for(const proof of metadata.proofs??[])renderBookText(body,proof.tex,metadata);
  }
  answer.append(body);section.append(answer);
  answer.addEventListener("toggle",()=>{if(answer.open)fitMath(body)});
  return;
 }
   if(e.webProof?.content)renderSourceEntry(section,e);
   else{
    if(e.assumptions.length){const p=node("p");p.append("仮定：");renderParts(p,e.preview?.assumptions,jpPunctuation(e.assumptions.join("；")));section.append(p)}
    const p=node("p");renderParts(p,e.preview?.statement,jpPunctuation(e.statement));section.append(p);
    for(const proof of e.webProof?.proofs??[])appendWebProof(section,proof,e.webProof);
   }
}

function showWeb(info,restore){
 const selected=notes.get(info.n);
 const treatise=data.treatises.find(t=>t.id===selected.treatise);
 const part=data.parts.find(p=>p.id===treatise?.part);
 const group=part?data.treatises.filter(t=>t.part===part.id):[];
 const plan=data.plan??data.notes;
 const members=group.length?group.flatMap(t=>plan.filter(n=>n.treatise===t.id)): [selected];
 const layout=node("div","reader web-reader"),side=node("aside","sidebar web-toc"),article=node("article","web-article");
 side.append(node("h2","","部内目次"),anchor("← 検索・総目次",root.href));
 article.append(node("p","web-running","数学原論　｜　"+(part?.id??"")),node("h1","web-part-title",part?.title??selected.title),node("p","muted","Web版試作・旧原稿から移行中"));
 const order=(a,b)=>{for(let i=0;i<Math.max(a.position.length,b.position.length);i++){const d=(a.position[i]??0)-(b.position[i]??0);if(d)return d}return 0};
 let previous=null;
 for(const n of members){
  const t=data.treatises.find(t=>t.id===n.treatise);
  if(t?.id!==previous){previous=t?.id;article.append(node("h2","web-treatise",t?t.id+"　"+t.title:""));side.append(node("h3","web-toc-group",t?t.id+"　"+t.title:""))}
  const chapter=node("section","web-chapter");chapter.id="N-"+n.number;
  side.append(anchor(noteNumber(n)+"　"+n.title,"#"+chapter.id,"web-toc-note"));
  chapter.append(node("h3","web-note-title",noteNumber(n)+"　"+n.title));
  if(!notes.has(n.number)){chapter.append(node("p","muted","制作予定 — "+(n.goals??[]).join("；")));article.append(chapter);continue}

  const items=data.entries.filter(e=>e.position[0]===n.number).sort(order);
  let lastSection="";
  for(const e of items){
   const sectionTitle=e.webProof?.sectionTitle;
   if(sectionTitle&&sectionTitle!==lastSection){chapter.append(node("h4","web-section-title",sectionTitle));lastSection=sectionTitle}
   const section=node("section","web-entry");section.id=e.id;
   const number=entryNumber(e);
   const heading=node("h4","web-statement-title",headingLabel(e)+" "+number+"（"+e.title+"）");
   section.append(heading);
   const link=anchor(entryNumber(e)+"　"+e.title,"#"+e.id,"web-toc-entry");bindPreview(link,e);side.append(link);
   renderEntryContent(section,e);
   // Restrict only the reference panel, not the knowledge graph or inline citations.
   const visibleDependencies=(e.depends_on??[]).filter(id=>{
    const ref=entries.get(id);
    if(!ref||!Number.isInteger(e.knowledge_depth)||!Number.isInteger(ref.knowledge_depth))return false;
    const gap=e.knowledge_depth-ref.knowledge_depth;
    return gap>=1&&gap<=2;
   });
   if(visibleDependencies.length){const d=node("details","web-dependencies");d.append(node("summary","muted","参照する知識"));for(const id of visibleDependencies){const ref=entries.get(id);const a=anchor(ref.title,webUrl("id",id));bindPreview(a,ref);const row=node("div");row.append(a);d.append(row)}section.append(d)}
   chapter.append(section);
  }
  article.append(chapter);
 }
 layout.append(side,article);main.replaceChildren(layout);
 requestAnimationFrame(()=>{fitMath(article);if(restore!==null)window.scrollTo(0,restore);else document.getElementById(info.id??"N-"+info.n)?.scrollIntoView()});
}


function isNativeCatalogue(p){
 return ["examples","statements","notation"].includes(p.get("note"));
}
function catalogueText(target,parts,raw){
 renderParts(target,parts?.map(p=>p.tex?p:{...p,text:jpPunctuation(p.text??p.raw??"")}),jpPunctuation(raw));
}
function showCatalogue(info,restore){
 const isNotation=info.n==="notation",examplesOnly=info.n==="examples",title=isNotation?"記号・記法一覧":examplesOnly?"例・例題一覧":"定義・命題・公理一覧";
 const layout=node("div","reader web-reader catalogue-reader"),side=node("aside","sidebar web-toc"),article=node("article","web-article web-catalogue");
 const search=node("input","search catalogue-search");search.type="search";search.placeholder=isNotation?"記号・名称を検索":"名称・本文・分野・番号を検索";search.setAttribute("aria-label",search.placeholder);
 const count=node("p","meta catalogue-count"),body=node("div","catalogue-body");

 side.append(node("h2","","一覧の目次"),anchor("← 検索・総目次",root.href),anchor("定義・命題・公理一覧",url("note","statements")),anchor("例・例題一覧",url("note","examples")));
 article.append(node("p","web-running","数学原論　｜　索引"),node("h1","web-part-title",title),node("p","muted",isNotation?"記号とその意味を対照する．名称から対応する本文を参照できる．":examplesOnly?"具体例・反例と，問題及び解答を掲載する．例題の解答は初期状態で閉じている．":"数学的知識の参照用一覧．定義・命題・公理のみを掲載する．証明及び詳細な解説は本文を参照されたい．"));

 article.append(search,count,body);
 const groups=[];
 if(isNotation){
  for(const [i,g] of (data.notation??[]).entries()){
   const section=node("section","catalogue-group"),id="notation-group-"+(i+1);section.id=id;
   section.append(node("h2","web-treatise",g.title));side.append(anchor(g.title,"#"+id));
   const table=node("table","notation-table"),head=node("thead"),hr=node("tr");
   for(const label of ["記号","対象・意味"]){const th=node("th","",label);th.scope="col";hr.append(th)}
   head.append(hr);const tbody=node("tbody");table.append(head,tbody);section.append(table);body.append(section);
   const items=[];
   for(const r of g.rows){
    const tr=node("tr"),symbol=node("td","notation-symbol"),meaning=node("td","notation-meaning"),span=node("span","math");
    try{katex.render(r.tex,span,{throwOnError:true,trust:false,strict:"ignore",output:"htmlAndMathml"})}catch{span.textContent=r.tex;span.title="未変換の数式"}
    symbol.append(span);const e=entries.get(r.id);
    if(e){const a=anchor(r.label,webUrl("id",e.id),"notation-reference");bindPreview(a,e);meaning.append(a)}else meaning.textContent=r.label;
    tr.append(symbol,meaning);tbody.append(tr);items.push({el:tr,text:[g.title,r.tex,r.label,e?.title??""].join(" ")});
   }
   groups.push({el:section,items});
  }
 }else{
  const all=data.entries.filter(e=>isExample(e)===examplesOnly);
  for(const p of data.parts){
   const section=node("section","catalogue-group");section.id="catalogue-"+p.id;
   section.append(node("h2","web-treatise",p.id+"　"+p.title));
   const subgroups=[];
   for(const t of data.treatises.filter(t=>t.part===p.id)){
    const treatise=node("section","catalogue-treatise");treatise.append(node("h3","web-section-title",t.id+"　"+t.title));const items=[];
    for(const n of data.notes.filter(n=>n.treatise===t.id).sort((a,b)=>noteNumber(a).localeCompare(noteNumber(b),undefined,{numeric:true}))){
     const chapter=node("section","catalogue-note");chapter.id="catalogue-N-"+n.number;chapter.append(node("h4","web-note-title",noteNumber(n)+"　"+n.title));
     const rows=all.filter(e=>e.position[0]===n.number).sort((a,b)=>{for(let i=0;i<4;i++){const d=a.position[i]-b.position[i];if(d)return d}return 0});
     const noteItems=[];
     for(const e of rows){
      const block=node("section","catalogue-entry");block.id="catalogue-"+e.id;
      const heading=node("h5","web-statement-title");heading.append(headingLabel(e)+" "+entryNumber(e)+"（");const link=anchor(e.title,webUrl("id",e.id),"catalogue-reference");bindPreview(link,e);heading.append(link,"）");block.append(heading);
      if(e.assumptions.length){const a=node("p");a.append("仮定：");catalogueText(a,e.preview?.assumptions,e.assumptions.join("；"));block.append(a)}
      if(examplesOnly)renderEntryContent(block,e);
      else{const statement=node("p","catalogue-statement");catalogueText(statement,e.preview?.statement,e.statement);block.append(statement)}
      chapter.append(block);
      noteItems.push({el:block,text:[p.title,t.title,n.title,noteNumber(n),entryNumber(e),e.id,headingLabel(e),e.title,e.statement,e.problem_tex??"",...e.assumptions].join(" ")});
     }
     if(noteItems.length){treatise.append(chapter);items.push({el:chapter,items:noteItems})}
    }
    if(items.length){section.append(treatise);subgroups.push({el:treatise,items})}
   }
   if(subgroups.length){body.append(section);side.append(anchor(p.title,"#"+section.id));groups.push({el:section,items:subgroups})}
  }
 }
 const normalize=s=>String(s).normalize("NFKC").toLowerCase();
 function filter(){
  hidePreview();const terms=normalize(search.value.trim()).split(/\s+/).filter(Boolean);
  const visit=g=>{const n=g.items?g.items.reduce((sum,x)=>sum+visit(x),0):Number(terms.every(q=>normalize(g.text).includes(q)));g.el.hidden=!n;return n};
  const n=groups.reduce((sum,g)=>sum+visit(g),0);count.textContent=n+"項目";fitMath(article);
 }
 search.addEventListener("input",filter);layout.append(side,article);main.replaceChildren(layout);filter();
 requestAnimationFrame(()=>{fitMath(article);if(restore!==null)window.scrollTo(0,restore)});
}

function showError(e){main.replaceChildren(node("p","error",String(e.message??e)),anchor("検索・総目次へ戻る",root.href))}
async function render(restore=null){
 hidePreview();disposeReader?.();disposeReader=null;
 try{
  const p=new URL(location.href);
  if(p.searchParams.has("page")||p.searchParams.get("view")==="pdf"){
   p.searchParams.delete("page");if(p.searchParams.get("view")==="pdf")p.searchParams.set("view","web");
   history.replaceState(history.state,"",p);
  }
  if(p.searchParams.get("view")==="map"){showMap();return}
  const info=routeInfo();
  if(info){if(typeof info.n==="string")showCatalogue(info,restore);else showWeb(info,restore)}
  else{showHome();if(restore!==null)window.scrollTo(0,restore)}
 }catch(e){showError(e)}
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
