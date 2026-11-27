import {planGraph,noteDisplayNumber,entryDisplayNumber,headingKind} from "./knowledge-core.mjs";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {execFileSync} from "node:child_process";
import {previewParts} from "./statements-tex.mjs";
const root=fileURLToPath(new URL("../",import.meta.url));
const out=path.join(root,"_site");
const ledger=JSON.parse(fs.readFileSync(path.join(root,"docs/knowledge.json"),"utf8"));
const baseUrl=process.env.GENRON_SITE_URL??"https://hawkoods.github.io/genron/";
const base=new URL(baseUrl);
if(base.protocol!=="https:"||!base.pathname.endsWith("/")||base.search||base.hash)throw Error("Invalid public base URL");
const verified=ledger.notes.filter(n=>n.status==="verified");
const noteNumbers=new Set(verified.map(n=>n.number));
const entries=ledger.entries.filter(e=>e.status==="verified"&&noteNumbers.has(e.position[0]));
const run=(cmd,args,cwd=root)=>execFileSync(cmd,args,{cwd,stdio:"inherit"});
run(process.execPath,["scripts/knowledge.mjs","check","--strict"]);
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
for(const name of ["index.html","style.css","app.mjs"])fs.copyFileSync(path.join(root,"site",name),path.join(out,name));
fs.mkdirSync(path.join(out,"vendor"),{recursive:true});
const cp=(src,dest)=>{if(!fs.existsSync(src))throw Error("Missing "+src+"; install viewer dependencies");fs.cpSync(src,dest,{recursive:true})};
const modules=path.join(root,"node_modules");
for(const name of ["katex.min.js","katex.min.css","fonts"])cp(path.join(modules,"katex/dist",name),path.join(out,"vendor/katex",name));
cp(path.join(modules,"katex/LICENSE"),path.join(out,"vendor/katex/LICENSE"));

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
  const content=block.replace(/\\begin\{(?:ruledef|principle|defn|prop|thm|ax)\}(?:\[[^\]]*\])?/g,"").replace(/\\end\{(?:ruledef|principle|defn|prop|thm|ax)\}/g,"\n\n").trim();
  const sections=[...source.slice(0,m.index).matchAll(/\\section\{([^}]+)\}/g)];
  const sectionTitle=sections.at(-1)?.[1]??"";
  webProofs.set(m[1],{proofs,content,sectionTitle,labels:Object.fromEntries(labels),macros});
 }
}

// Web publication contains only HTML, data and math assets.
for(const n of verified){
 const dir=path.join(root,"volumes","N-"+n.number);
 const source=fs.readFileSync(path.join(dir,n.web_only?"web.tex":"main.tex"),"utf8");
 collectProofs(source);
}
 const webNotation=JSON.parse(fs.readFileSync(path.join(root,"docs/notation.json"),"utf8"));
 for(const group of webNotation)for(const row of group.rows)if(row.id!==null&&!entries.some(e=>e.id===row.id))throw Error("Unpublished Web notation reference "+row.id);
 const publicNotes=verified.map(({number,title,area,goals,depends_on,treatise,web_only})=>({number,display_number:noteDisplayNumber(ledger,number),title,area,goals,depends_on,treatise,web_only:!!web_only}));
 const depth=new Map(planGraph(ledger).layers.flatMap((ids,i)=>ids.map(id=>[Number(id.slice(2)),i])));
 const plan=ledger.notes.filter(n=>n.status!=="retired").map(({number,title,area,goals,depends_on,treatise,status,web_only})=>({number,display_number:noteDisplayNumber(ledger,number),title,area,goals,depends_on,treatise,status,web_only:!!web_only,depth:depth.get(number)}));
 const publicEntries=entries.map(({id,kind,heading_kind,problem_tex,title,statement,assumptions,position,depends_on})=>({id,heading_kind:headingKind({kind,heading_kind}),problem_tex,display_number:entryDisplayNumber(ledger,{position}),kind,title,statement,assumptions,position,depends_on,webProof:webProofs.get(id),preview:{statement:previewParts(statement),assumptions:previewParts(assumptions.join("；"))}}));
 fs.writeFileSync(path.join(out,"data.json"),JSON.stringify({referenceOrigin:base.origin,referencePath:base.pathname,notes:publicNotes,aliases:ledger.note_aliases??{},entries:publicEntries,notation:webNotation,parts:ledger.parts??[],treatises:ledger.treatises??[],plan})+"\n");
 fs.writeFileSync(path.join(out,".nojekyll"),"");
 console.log("Web-only site: "+verified.length+" notes, "+entries.length+" entries; no PDF assets.");
