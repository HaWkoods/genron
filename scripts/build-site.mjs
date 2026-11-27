import {graph,planGraph,noteDisplayNumber,entryDisplayNumber,headingKind} from "./knowledge-core.mjs";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {spawnSync} from "node:child_process";
import {previewParts} from "./statements-tex.mjs";
const root=fileURLToPath(new URL("../",import.meta.url));
const out=path.join(root,"_site");
const ledger=JSON.parse(fs.readFileSync(path.join(root,"docs/knowledge.json"),"utf8"));
const baseUrl=process.env.GENRON_SITE_URL??"https://hawkoods.github.io/genron/";
const base=new URL(baseUrl);
if(base.protocol!=="https:"||!base.pathname.endsWith("/")||base.search||base.hash)throw Error("Invalid public base URL");
const published=ledger.notes.filter(n=>n.status==="verified"||(n.status==="draft"&&n.web_preview===true));
const noteNumbers=new Set(published.map(n=>n.number));
const entries=ledger.entries.filter(e=>noteNumbers.has(e.position[0])&&(e.status==="verified"||e.status==="draft"));
const publicIds=new Set(entries.map(e=>e.id));
for(const n of published)if(!entries.some(e=>e.position[0]===n.number))throw Error("Published note without entries N-"+n.number);
for(const e of entries)for(const d of e.depends_on)if(!publicIds.has(d))throw Error("Unpublished prerequisite "+e.id+" -> "+d);
// A preview is a publication decision, not mathematical verification.
const check=spawnSync(process.execPath,["scripts/knowledge.mjs","check"],{cwd:root,encoding:"utf8"});
if(check.stdout)process.stdout.write(check.stdout);
if(check.stderr)process.stderr.write(check.stderr);
if(check.error||check.status!==0)throw Error("Ledger validation failed");
const unexpected=(check.stderr??"").split(/\r?\n/).filter(Boolean).filter(line=>!/^WARNING UNVERIFIED_DEPENDENCY: K-\d+ -> K-\d+ \(draft\)$/.test(line));
if(unexpected.length)throw Error("Unexpected ledger warnings: "+unexpected.join("\n"));
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
for(const name of ["index.html","style.css","app.mjs"])fs.copyFileSync(path.join(root,"site",name),path.join(out,name));
fs.mkdirSync(path.join(out,"vendor"),{recursive:true});
const cp=(src,dest)=>{if(!fs.existsSync(src))throw Error("Missing "+src+"; install viewer dependencies");fs.cpSync(src,dest,{recursive:true})};
const modules=path.join(root,"node_modules");
for(const name of ["katex.min.js","katex.min.css","fonts"])cp(path.join(modules,"katex/dist",name),path.join(out,"vendor/katex",name));
cp(path.join(modules,"katex/LICENSE"),path.join(out,"vendor/katex/LICENSE"));

// Figure assets are authored SVGs keyed by permanent knowledge IDs.
const figureManifest=JSON.parse(fs.readFileSync(path.join(root,"site/figures.json"),"utf8"));
const knownIds=new Set(ledger.entries.map(e=>e.id));
const figurePaths=new Set(),figuresById=new Map();
for(const f of figureManifest){
 if(!knownIds.has(f.id)||!/^figures\/[a-z0-9-]+\.svg$/.test(f.src)||!f.alt?.trim()||!f.caption?.trim()||figurePaths.has(f.src))throw Error("Invalid figure manifest entry "+JSON.stringify(f));
 figurePaths.add(f.src);
 const source=path.join(root,"site",f.src);
 const svg=fs.readFileSync(source,"utf8");
 if(!/^<svg\b/.test(svg.trim())||/<(?:script|foreignObject)\b|\bon\w+\s*=|\b(?:href|src)\s*=/i.test(svg))throw Error("Unsafe or invalid figure "+f.src);
 if(!publicIds.has(f.id))continue;
 const dest=path.join(out,f.src);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(source,dest);
 const list=figuresById.get(f.id)??[];list.push({src:f.src,alt:f.alt,caption:f.caption});figuresById.set(f.id,list);
}
const webProofs=new Map();
function collectProofs(source){
 const labels=new Map();
 for(const m of source.matchAll(/^% genron:begin (K-\d+)\s*\n([\s\S]*?)^% genron:end \1\s*$/gm)){
  for(const label of m[2].matchAll(/\\label\{([^}]+)\}/g))labels.set(label[1],m[1]);
 }
 const macros=Object.fromEntries([...source.matchAll(/\\newcommand\{\\([A-Za-z]+)\}\{((?:[^{}]|\{[^{}]*\})*)\}/g)].map(m=>[m[1],m[2]]));
 for(const m of source.matchAll(/^% genron:begin (K-\d+)\s*\n([\s\S]*?)^% genron:end \1\s*$/gm)){
  const proofs=[...m[2].matchAll(/\\begin\{proof\}(?:\[([^\]]*)\])?([\s\S]*?)\\end\{proof\}/g)].map(p=>({title:p[1]??"証明",tex:p[2].trim()}));
  const block=m[2].replace(/^%[^\n]*\n/gm,"").replace(/\\Needspace\{[^}]*\}/g,"").replace(/\\label\{[^}]*\}/g,"").trim();
  const content=block.replace(/\\begin\{(?:ruledef|principle|defn|prop|thm|ax|example|worked_example)\}(?:\[[^\]]*\])?/g,"").replace(/\\end\{(?:ruledef|principle|defn|prop|thm|ax|example|worked_example)\}/g,"\n\n").trim();
  const sections=[...source.slice(0,m.index).matchAll(/\\section\{([^}]+)\}/g)];
  const sectionTitle=sections.at(-1)?.[1]??"";
  webProofs.set(m[1],{proofs,content,sectionTitle,labels:Object.fromEntries(labels),macros});
 }
}

// Web publication contains only HTML, data and math assets.
for(const n of published){
 const dir=path.join(root,"volumes","N-"+n.number);
 const source=fs.readFileSync(path.join(dir,n.web_only?"web.tex":"main.tex"),"utf8");
 // Knowledge references are prose, never followed by an orphan math delimiter.
 const badRef=source.match(/\\GenronRef\{K-\d+\}\$/);
 if(badRef)throw Error("N-"+n.number+": stray math delimiter after "+badRef[0]);
 // Check each proof independently so one malformed proof cannot mask another.
 for(const p of source.matchAll(/\\begin\{proof\}(?:\[[^\]]*\])?([\s\S]*?)\\end\{proof\}/g)){
  const body=p[1].replace(/^%[^\n]*$/gm,"");
  if((body.match(/(?<!\\)\$/g)??[]).length%2!==0)
   throw Error("N-"+n.number+": unbalanced dollar delimiters near source line "+(source.slice(0,p.index).split("\n").length));
 }
 collectProofs(source);
}
 const webNotation=JSON.parse(fs.readFileSync(path.join(root,"docs/notation.json"),"utf8"));
 for(const group of webNotation)for(const row of group.rows)if(row.id!==null&&!entries.some(e=>e.id===row.id))throw Error("Unpublished Web notation reference "+row.id);
 const publicNotes=published.map(({number,title,area,goals,depends_on,treatise,web_only,status})=>({number,display_number:noteDisplayNumber(ledger,number),title,area,goals,depends_on,treatise,web_only:!!web_only,review_status:status}));
 const depth=new Map(planGraph(ledger).layers.flatMap((ids,i)=>ids.map(id=>[Number(id.slice(2)),i])));
 const plan=ledger.notes.filter(n=>n.status!=="retired").map(({number,title,area,goals,depends_on,treatise,status,web_only})=>({number,display_number:noteDisplayNumber(ledger,number),title,area,goals,depends_on,treatise,status,web_only:!!web_only,depth:depth.get(number)}));
 // Knowledge layers use the individual-entry DAG, not the note plan or display numbers.
 const knowledgeGraph=graph({...ledger,entries},"knowledge");
 if(knowledgeGraph.unordered.length)throw Error("Cyclic published knowledge graph");
 const knowledgeDepth=new Map(knowledgeGraph.layers.flatMap((ids,i)=>ids.map(id=>[id,i])));
 const publicEntries=entries.map(({id,kind,heading_kind,problem_tex,title,statement,assumptions,position,depends_on})=>({id,heading_kind:headingKind({kind,heading_kind}),problem_tex,display_number:entryDisplayNumber(ledger,{position}),kind,title,statement,assumptions,position,depends_on,knowledge_depth:knowledgeDepth.get(id),webProof:webProofs.get(id),figures:figuresById.get(id)??[],preview:{statement:previewParts(statement),assumptions:previewParts(assumptions.join("；"))}}));
 fs.writeFileSync(path.join(out,"data.json"),JSON.stringify({referenceOrigin:base.origin,referencePath:base.pathname,notes:publicNotes,aliases:ledger.note_aliases??{},entries:publicEntries,notation:webNotation,parts:ledger.parts??[],treatises:ledger.treatises??[],plan})+"\n");
 fs.writeFileSync(path.join(out,".nojekyll"),"");
 console.log("Web-only site: "+published.length+" notes, "+entries.length+" entries; no PDF assets.");
