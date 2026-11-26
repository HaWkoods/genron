function comparePosition(a,b){for(let i=0;i<4;i++){if(a[i]!==b[i])return a[i]-b[i]}return 0}

function validPosition(p){return Array.isArray(p)&&p.length===4&&p.every(x=>Number.isSafeInteger(x)&&x>0)}

function parseSources(sources){
 const blocks=new Map(),errors=[], uses=[];
 for(const [path,body] of Object.entries(sources)){
  let active=null;
  for(const [i,line] of body.split(/\r?\n/).entries()){
   const loc=`${path}:${i+1}`;
   const marker=line.match(/^\s*%\s*genron:(begin|end|use)\s+(.*?)\s*$/);
   if(marker){
    const [,action,id]=marker;
    if(!/^K-\d{6}$/.test(id)){errors.push(`${loc}: INVALID_MARKER ${id}`);continue}
    if(action==="begin"){
     if(active||blocks.has(id)){errors.push(`${loc}: DUPLICATE_OR_NESTED_BLOCK ${id}`);continue}
     active={id,path,line:i+1,refs:new Set()};blocks.set(id,active);
    }else if(action==="end"){
     if(active?.id!==id)errors.push(`${loc}: UNMATCHED_END ${id}`);else active=null;
    }else if(!active)errors.push(`${loc}: USE_OUTSIDE_BLOCK ${id}`);else {active.refs.add(id);uses.push({owner:active.id,id,loc})}
    continue;
   }
   if(/^\s*%\s*genron:/.test(line)){errors.push(`${loc}: INVALID_MARKER`);continue}
   const code=line.replace(/(?<!\\)%.*$/,"");
   for(const match of code.matchAll(/\\Genron(?:Ref|Use)\s*\{([^{}]*)\}/g)){
    const id=match[1].trim();
    if(!active)errors.push(`${loc}: USE_OUTSIDE_BLOCK ${id}`);else {active.refs.add(id);uses.push({owner:active.id,id,loc})}
   }
  }
  if(active)errors.push(`${path}: UNCLOSED_BLOCK ${active.id}`);
 }
 return {blocks,errors,uses};
}

function validate(ledger,sources={}){
 const errors=[],warnings=[],entries=new Map(),positions=new Map();
 const report=(code,msg,warning=false)=>(warning?warnings:errors).push(`${code}: ${msg}`);
 if(!ledger||ledger.schema_version!==1||!Array.isArray(ledger.entries)){report("SCHEMA","schema_version=1 and entries array required");return {errors,warnings}}
 if(!ledger.foundation||typeof ledger.foundation!=="object"||Array.isArray(ledger.foundation)||!["undecided","adopted"].includes(ledger.foundation.status)||typeof ledger.foundation.description!=="string")report("FOUNDATION","foundation.status and description required");
 const kinds=["axiom","convention","definition","lemma","proposition","theorem","corollary","construction","exercise","background"];
 const statuses=["planned","draft","verified","review","retired"];
 const text=x=>typeof x==="string"&&x.trim().length>0;
 for(const e of ledger.entries){
  if(!e||typeof e!=="object"||!/^K-\d{6}$/.test(e.id??"")){report("INVALID_ID",JSON.stringify(e));continue}
  if(entries.has(e.id)){report("DUPLICATE_ID",e.id);continue}
  entries.set(e.id,e);
  if(!kinds.includes(e.kind)||!statuses.includes(e.status)||!text(e.title)||!text(e.statement)||!Array.isArray(e.assumptions)||!e.assumptions.every(text))report("SCHEMA",e.id+" kind/status/title/statement/assumptions");
  if(!Array.isArray(e.depends_on)||!e.depends_on.every(x=>typeof x==="string"&&/^K-\d{6}$/.test(x))){report("SCHEMA",e.id+" depends_on");}
  else if(new Set(e.depends_on).size!==e.depends_on.length)report("DUPLICATE_DEPENDENCY",e.id);
  if(!validPosition(e.position))report("POSITION",e.id);
  else if(e.status!=="retired"){const key=e.position.join(".");if(positions.has(key))report("DUPLICATE_POSITION",`${e.id} / ${positions.get(key)} at ${key}`);positions.set(key,e.id)}
  if(e.source!==null&&!(typeof e.source==="string"&&/^volumes\/(?:[\w.-]+\/)*[\w.-]+\.tex$/.test(e.source)&&!e.source.split("/").includes("..")))report("SOURCE_PATH",e.id);
  if(e.status==="verified"){
   if(!text(e.review))report("MISSING_REVIEW",e.id);
   if(!e.source)report("MISSING_SOURCE",e.id);
   if(ledger.foundation?.status!=="adopted")report("FOUNDATION_UNADOPTED",e.id);
  }
 }
 const deps=e=>Array.isArray(e.depends_on)?e.depends_on.filter(x=>typeof x==="string"):[];
 for(const e of entries.values()){
  for(const id of deps(e)){
   const d=entries.get(id);
   if(!d){report("UNKNOWN_DEPENDENCY",`${e.id} -> ${id}`);continue}
   if(e.status==="retired")continue;
   if(d.status==="retired")report("RETIRED_DEPENDENCY",`${e.id} -> ${id}`);
   if(d.status!=="verified")report("UNVERIFIED_DEPENDENCY",`${e.id} -> ${id} (${d.status})`,e.status!=="verified"&&d.status!=="retired");
   if(validPosition(e.position)&&validPosition(d.position)&&e.position[0]===d.position[0]&&comparePosition(d.position,e.position)>=0)report("FORWARD_DEPENDENCY",`${e.id} -> ${id}`,e.status!=="verified");
  }
 }
 // Iterative DFS: no recursion limit on large ledgers.
 const colors=new Map();
 for(const start of entries.keys()){
  if(colors.has(start)||entries.get(start).status==="retired")continue;
  const stack=[{id:start,index:0,ds:deps(entries.get(start))}];colors.set(start,1);
  while(stack.length){
   const top=stack[stack.length-1];
   if(top.index===top.ds.length){colors.set(top.id,2);stack.pop();continue}
   const next=top.ds[top.index++];
   if(!entries.has(next)||entries.get(next).status==="retired")continue;
   if(colors.get(next)===1){const idx=stack.findIndex(x=>x.id===next);report("CYCLE",[...stack.slice(idx).map(x=>x.id),next].join(" -> "));}
   else if(!colors.has(next)){colors.set(next,1);stack.push({id:next,index:0,ds:deps(entries.get(next))})}
  }
 }
 const notes=graph(ledger,"notes");
 if(notes.unordered.length)report("NOTE_CYCLE","Notes blocked by a cycle: "+notes.unordered.join(", "));
 const parsed=parseSources(sources);errors.push(...parsed.errors);
 for(const [id,b] of parsed.blocks){
  const e=entries.get(id);
  if(!e){report("UNREGISTERED_BLOCK",`${id} at ${b.path}:${b.line}`);continue}
  if(e.source!==b.path)report("SOURCE_MISMATCH",`${id}: ${e.source} != ${b.path}`);
  if(e.status==="retired")report("RETIRED_BLOCK",id);
  for(const ref of b.refs){
   if(!entries.has(ref))report("UNKNOWN_SOURCE_REFERENCE",`${id} -> ${ref}`);
   if(!deps(e).includes(ref))report("UNDECLARED_SOURCE_DEPENDENCY",`${id} -> ${ref}`);
   const d=parsed.blocks.get(ref);
   if(d?.path===b.path&&d.line>=b.line)report("SOURCE_FORWARD_REFERENCE",`${id} -> ${ref}`,e.status!=="verified");
  }
  for(const dep of deps(e))if(!b.refs.has(dep))report("UNMARKED_DEPENDENCY",`${id} -> ${dep}`,e.status!=="verified");
 }
 const previous=new Map();
 for(const [id,b] of parsed.blocks){
  const e=entries.get(id);if(!e||!validPosition(e.position))continue;
  const prior=previous.get(b.path);
  if(prior&&comparePosition(prior.position,e.position)>=0)report("SOURCE_ORDER",`${prior.id} before ${id} in ${b.path}`,e.status!=="verified"||prior.status!=="verified");
  previous.set(b.path,e);
 }
 for(const e of entries.values())if(e.source&&e.status!=="retired"&&!parsed.blocks.has(e.id))report("MISSING_BLOCK",`${e.id} in ${e.source}`);
 const p=validatePlan(ledger);errors.push(...p.errors);warnings.push(...p.warnings);
 return {errors,warnings};
}

function affected(ledgers,changed){
 const reverse=new Map();
 for(const ledger of ledgers)for(const e of ledger.entries)for(const d of e.depends_on??[]){if(!reverse.has(d))reverse.set(d,new Set());reverse.get(d).add(e.id)}
 const seen=new Set(changed),queue=[...seen];
 for(let i=0;i<queue.length;i++)for(const id of reverse.get(queue[i])??[])if(!seen.has(id)){seen.add(id);queue.push(id)}
 return {changed:[...new Set(changed)].sort(),affected:[...seen].filter(id=>!changed.includes(id)).sort()};
}

function changedEntries(oldLedger,newLedger,oldSources={},newSources={}){
 const a=new Map(oldLedger.entries.map(e=>[e.id,e])),b=new Map(newLedger.entries.map(e=>[e.id,e]));
 const stable=x=>Array.isArray(x)?x.map(stable):x&&typeof x==="object"?Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])])):x;
 const norm=x=>JSON.stringify(stable(x));
 const keys=[...new Set([...a.keys(),...b.keys()])];
 const foundationChanged=norm(oldLedger.foundation)!==norm(newLedger.foundation);
 return keys.filter(id=>{const x=a.get(id),y=b.get(id);return foundationChanged||norm(x)!==norm(y)||(x?.source&&oldSources[x.source]!==newSources[x.source])||(y?.source&&oldSources[y.source]!==newSources[y.source])});
}

// Logical DAG: arrows point from prerequisites to dependent nodes.
function graph(ledger,mode="knowledge"){
 const active=ledger.entries.filter(e=>e&&e.status!=="retired"&&typeof e.id==="string"&&validPosition(e.position));
 const byId=new Map(active.map(e=>[e.id,e]));
 const nodeId=e=>mode==="notes"?"N-"+e.position[0]:e.id;
 const nodes=new Map(),edges=new Map();
 for(const e of active){
  const id=nodeId(e);
  if(!nodes.has(id))nodes.set(id,{id,title:mode==="notes"?(ledger.notes?.find(n=>n.number===e.position[0])?.title??"Note "+e.position[0]):e.title,members:[],status:mode==="notes"?"verified":e.status});
  const n=nodes.get(id);n.members.push(e.id);if(mode==="notes"&&e.status!=="verified")n.status="incomplete";
 }
 for(const e of active)for(const d of Array.isArray(e.depends_on)?e.depends_on:[]){
  if(!byId.has(d))continue;
  const from=nodeId(byId.get(d)),to=nodeId(e);
  if(mode==="notes"&&from===to)continue;
  if(!edges.has(from))edges.set(from,new Set());edges.get(from).add(to);
 }
 const indegree=new Map([...nodes.keys()].map(id=>[id,0]));
 for(const targets of edges.values())for(const to of targets)indegree.set(to,indegree.get(to)+1);
 let queue=[...nodes.keys()].filter(id=>indegree.get(id)===0).sort();
 const layers=[],visited=new Set();
 while(queue.length){
  layers.push(queue);const next=[];
  for(const from of queue){visited.add(from);for(const to of edges.get(from)??[]){const n=indegree.get(to)-1;indegree.set(to,n);if(n===0)next.push(to)}}
  queue=next.sort();
 }
 return {nodes:[...nodes.values()],edges:[...edges].flatMap(([from,targets])=>[...targets].map(to=>({from,to}))),layers,unordered:[...nodes.keys()].filter(id=>!visited.has(id)).sort()};
}
function prerequisites(ledger,id){
 const byId=new Map(ledger.entries.map(e=>[e.id,e]));
 if(!byId.has(id)||byId.get(id).status==="retired")throw Error("Unknown or retired target: "+id);
 const seen=new Set([id]),queue=[id];
 for(let i=0;i<queue.length;i++)for(const d of byId.get(queue[i]).depends_on){
  if(!byId.has(d)||byId.get(d).status==="retired")throw Error("Unavailable dependency: "+d);
  if(!seen.has(d)){seen.add(d);queue.push(d)}
 }
 const order=graph(ledger).layers.flat();
 if(seen.size!==order.filter(x=>seen.has(x)).length)throw Error("Cyclic or invalid prerequisite graph");
 return order.filter(x=>x!==id&&seen.has(x)).map(x=>byId.get(x));
}
function available(ledger,completed=[]){
 const byId=new Map(ledger.entries.map(e=>[e.id,e])),known=new Set(completed);
 for(const id of known){
  const e=byId.get(id);
  if(!e||e.status!=="verified")throw Error("Unknown or unverified completed ID: "+id);
  for(const d of e.depends_on)if(!known.has(d))throw Error("Completed set not closed under prerequisites: "+id+" requires "+d);
 }
 const order=graph(ledger).layers.flat();
 return order.map(id=>byId.get(id)).filter(e=>e.status==="verified"&&!known.has(e.id)&&e.depends_on.every(d=>known.has(d)));
}

// Planned note graph is separate from the dependency graph established by manuscript items.
function planGraph(ledger){
 const notes=Array.isArray(ledger.notes)?ledger.notes:[], ids=new Set(notes.map(n=>n.number));
 const nodes=notes.map(n=>({id:"N-"+n.number,title:n.title,area:n.area,status:n.status,goals:n.goals}));
 const edges=notes.flatMap(n=>(Array.isArray(n.depends_on)?n.depends_on:[]).filter(d=>ids.has(d)).map(d=>({from:"N-"+d,to:"N-"+n.number})));
 const incoming=new Map(nodes.map(n=>[n.id,0])), out=new Map();
 for(const {from,to} of edges){incoming.set(to,incoming.get(to)+1);if(!out.has(from))out.set(from,[]);out.get(from).push(to)}
 const sort=xs=>xs.sort((a,b)=>Number(a.slice(2))-Number(b.slice(2)));
 let ready=sort([...incoming.keys()].filter(k=>incoming.get(k)===0)),layers=[],seen=new Set();
 while(ready.length){layers.push(ready);const next=[];for(const a of ready){seen.add(a);for(const b of out.get(a)??[]){incoming.set(b,incoming.get(b)-1);if(incoming.get(b)===0)next.push(b)}}ready=sort(next)}
 return {nodes,edges,layers,unordered:sort(nodes.map(n=>n.id).filter(id=>!seen.has(id)))};
}
function validatePlan(ledger){
 const errors=[],warnings=[];
 if(ledger.notes===undefined)return {errors,warnings}; // legacy test fixtures and historical ledgers
 const add=(code,msg)=>errors.push(code+": "+msg), warn=(code,msg)=>warnings.push(code+": "+msg);
 if(!Array.isArray(ledger.notes)){add("PLAN_SCHEMA","notes must be an array");return {errors,warnings}}
 const map=new Map(), nonempty=v=>typeof v==="string"&&v.trim().length>0;
 for(const n of ledger.notes){
  if(!n||!Number.isSafeInteger(n.number)||n.number<1){add("PLAN_ID","invalid note number");continue}
  if(map.has(n.number)){add("PLAN_DUPLICATE_ID","N-"+n.number);continue}
  map.set(n.number,n);
  if(!nonempty(n.title)||!nonempty(n.area)||!["planned","draft","verified","review","retired"].includes(n.status)||!Array.isArray(n.goals)||!n.goals.length||!n.goals.every(nonempty)||!Array.isArray(n.depends_on)||!n.depends_on.every(d=>Number.isSafeInteger(d)&&d>0)){add("PLAN_SCHEMA","N-"+n.number);continue}
  if(new Set(n.depends_on).size!==n.depends_on.length)add("PLAN_DUPLICATE_DEPENDENCY","N-"+n.number);
 }
 if(errors.length)return {errors,warnings};
 for(const n of map.values())for(const d of n.depends_on){
  if(!map.has(d))add("PLAN_UNKNOWN_DEPENDENCY","N-"+n.number+" requires N-"+d);
  else if(n.status!=="retired"&&map.get(d).status==="retired")add("PLAN_RETIRED_DEPENDENCY","N-"+n.number+" requires retired N-"+d);
 }
 const g=planGraph(ledger);
 if(g.unordered.length)add("PLAN_CYCLE","Blocked: "+g.unordered.join(", "));
 const members=new Map();
 const byId=new Map((ledger.entries??[]).filter(e=>e&&typeof e.id==="string").map(e=>[e.id,e]));
 for(const e of byId.values())if(validPosition(e.position)&&e.status!=="retired"){
  const n=e.position[0];if(!map.has(n)){add("PLAN_UNKNOWN_NOTE",e.id+" in N-"+n);continue}
  if(map.get(n).status==="retired")add("PLAN_RETIRED_NOTE",e.id+" in N-"+n);
  if(!members.has(n))members.set(n,[]);members.get(n).push(e);
 }
 const closure=n=>{const seen=new Set(),q=[...(map.get(n)?.depends_on??[])];for(let i=0;i<q.length;i++){const d=q[i];if(seen.has(d))continue;seen.add(d);q.push(...(map.get(d)?.depends_on??[]))}return seen};
 for(const [n,items] of members){
  const allowed=closure(n);
  for(const e of items)for(const id of Array.isArray(e.depends_on)?e.depends_on:[]){
   const d=byId.get(id);if(!d||!validPosition(d.position)||d.position[0]===n)continue;
   if(!allowed.has(d.position[0]))add("PLAN_UNDECLARED_NOTE_DEPENDENCY",e.id+" requires "+id+" across unplanned branches");
  }
 }
 for(const n of map.values())if(n.status==="verified"){
  const items=members.get(n.number)??[];
  if(!items.length||items.some(e=>e.status!=="verified"))add("PLAN_UNVERIFIED_NOTE","N-"+n.number+" has missing or unverified knowledge");
  for(const d of n.depends_on)if(map.get(d)?.status!=="verified")add("PLAN_UNVERIFIED_PREREQUISITE","N-"+n.number+" requires N-"+d);
 }
 return {errors,warnings};
}
function planPrerequisites(ledger,id){
 const num=Number(id.replace(/^N-/,"")), notes=new Map(ledger.notes.map(n=>[n.number,n]));
 if(!notes.has(num))throw Error("Unknown planned note: "+id);
 const seen=new Set(),q=[...notes.get(num).depends_on];
 for(let i=0;i<q.length;i++){const d=q[i];if(seen.has(d))continue;seen.add(d);q.push(...notes.get(d).depends_on)}
 return planGraph(ledger).layers.flat().map(k=>Number(k.slice(2))).filter(n=>seen.has(n)).map(n=>notes.get(n));
}
function planMermaid(ledger){
 const g=planGraph(ledger);
 const esc=s=>String(s).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
 return ["flowchart TD",...g.nodes.map(n=>"  "+n.id.replace("-","")+"[\""+n.id+" "+esc(n.title)+"\"]"),...g.edges.map(e=>"  "+e.from.replace("-","")+" --> "+e.to.replace("-",""))].join("\n")+"\n";
}
function planMarkdown(ledger,published=[]){
 const pdfs=new Set(published);
 const noteTitle=n=>n.status==="verified"?(pdfs.has(n.number)?`[${n.title}](../volumes/N-${n.number}/main.pdf)`:`${n.title}（PDF未掲載）`):n.title;
 const g=planGraph(ledger), depth=new Map(g.layers.flatMap((ids,i)=>ids.map(id=>[id,i])));
 const table=["| ID | 層 | ノート | 分野 | 状態 | 直接前提 | 到達目標 |","|---|---:|---|---|---|---|---|",...ledger.notes.map(n=>"| N-"+n.number+" | "+depth.get("N-"+n.number)+" | "+noteTitle(n)+" | "+n.area+" | "+n.status+" | "+(n.depends_on.map(d=>"N-"+d).join(", ")||"なし")+" | "+n.goals.join("；")+" |")];
 return "# 数学原論：予定ノートグラフ\n\nこのファイルは docs/knowledge.json の notes から生成する。この図は計画上の依存関係を表す。成立済みの個別知識は entries で確認する。完成済みのノート名のリンクをクリックすると、GitHub上でPDFを閲覧できる。未掲載のPDFにはリンクを付けない。\n\n[定義・命題一覧（PDF）](statements.pdf) · [テキスト版](statements.md)\n\n```mermaid\n"+planMermaid(ledger)+"```\n\n"+table.join("\n")+"\n";
}

function statementsMarkdown(ledger){
 const names={axiom:"公理",convention:"規約",definition:"定義",lemma:"補題",proposition:"命題",theorem:"定理",corollary:"系",construction:"構成",background:"背景原理"};
 const escape=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/[\\\x60*_\[\]~$]/g,c=>"\\"+c).replace(/\r?\n/g," ");
 const entries=(ledger.entries??[]).filter(e=>e.status==="verified"&&Object.hasOwn(names,e.kind)).sort((a,b)=>{
  for(let i=0;i<4;i++)if(a.position[i]!==b.position[i])return a.position[i]-b.position[i];
  return a.id.localeCompare(b.id);
 });
 const notes=new Map((ledger.notes??[]).map(n=>[n.number,n.title]));
 const groups=new Map();
 for(const e of entries){const n=e.position[0];if(!groups.has(n))groups.set(n,[]);groups.get(n).push(e)}
 const lines=["# 数学原論　定義・命題一覧","","[PDF版（推奨）](statements.pdf) · [総目次](roadmap.md) · [知識台帳](knowledge.json)","","知識台帳から自動生成した復習・確認用の一覧。検証済みの記法・公理・定義・構成・結果を、各ノート内の掲載順に掲げる（全"+entries.length+"項目）。証明・解説は収録しない。本文の厳密な記述と照合するには総目次から該当ノートを参照する。","","## ノート別索引",""];
 for(const [n,items] of groups)lines.push("- [N-"+n+" "+escape(notes.get(n)??"")+"（"+items.length+"項目）](#n-"+n+")");
 for(const [n,items] of groups){
  lines.push("","---","",'<a id="n-'+n+'"></a>',"## N-"+n+" "+escape(notes.get(n)??""),"");
  let section="";
  for(const e of items){
   const current=e.position[1]+"."+e.position[2];
   if(current!==section){section=current;lines.push("### 第"+e.position[1]+"章 第"+e.position[2]+"節","")}
   lines.push("**"+names[e.kind]+"（"+escape(e.title)+"）**　"+e.id,"");
   if(e.assumptions.length)lines.push("仮定： "+e.assumptions.map(escape).join("；")+"","");
   lines.push(escape(e.statement),"");
  }
 }
 if(!entries.length)lines.push("検証済みの項目はまだない。","");
 return lines.join("\n").trimEnd()+"\n";
}

export {validate, affected, changedEntries, available, validPosition, graph, prerequisites, validatePlan, planGraph, planPrerequisites, planMermaid, planMarkdown, statementsMarkdown};
