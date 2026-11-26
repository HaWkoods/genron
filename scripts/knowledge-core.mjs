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
  if(!nodes.has(id))nodes.set(id,{id,title:mode==="notes"?"Note "+e.position[0]:e.title,members:[],status:mode==="notes"?"verified":e.status});
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

export {validate, affected, changedEntries, available, validPosition, graph, prerequisites};
