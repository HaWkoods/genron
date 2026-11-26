import {planGraph} from "./knowledge-core.mjs";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {fileURLToPath} from "node:url";
import {execFileSync} from "node:child_process";
import {prepareTex} from "./viewer-tex.mjs";
import {statementsTex,previewParts} from "./statements-tex.mjs";
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
fs.mkdirSync(path.join(out,"vendor"),{recursive:true});fs.mkdirSync(path.join(out,"pdf"),{recursive:true});
const cp=(src,dest)=>{if(!fs.existsSync(src))throw Error("Missing "+src+"; install viewer dependencies");fs.cpSync(src,dest,{recursive:true})};
const modules=path.join(root,"node_modules");
for(const dir of ["build","cmaps","standard_fonts"])cp(path.join(modules,"pdfjs-dist",dir),path.join(out,"vendor/pdfjs",dir));
cp(path.join(modules,"pdfjs-dist/LICENSE"),path.join(out,"vendor/pdfjs/LICENSE"));
for(const name of ["katex.min.js","katex.min.css","fonts"])cp(path.join(modules,"katex/dist",name),path.join(out,"vendor/katex",name));
cp(path.join(modules,"katex/LICENSE"),path.join(out,"vendor/katex/LICENSE"));
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"genron-viewer-"));
let anchorCount=0,referenceCount=0;
function compile(tex,file,ids,refs=[]){
 const dir=fs.mkdtempSync(path.join(tmp,"tex-"));fs.writeFileSync(path.join(dir,"main.tex"),tex);
 for(let i=0;i<2;i++)run("platex",["-interaction=nonstopmode","-halt-on-error","-no-shell-escape","main.tex"],dir);
 const log=fs.readFileSync(path.join(dir,"main.log"),"utf8");
 if(/(?:^|\n)! |Missing character:|There were undefined references|LaTeX Warning: (?:Reference|Citation).*undefined/i.test(log))throw Error("Unresolved TeX error: "+file);
 run("dvipdfmx",["-o","main.pdf","main.dvi"],dir);
 const pdf=path.join(dir,"main.pdf");
 const dests=execFileSync("pdfinfo",["-dests",pdf],{encoding:"utf8"});
 for(const id of ids)if(!dests.includes('"'+id+'"'))throw Error("Missing PDF destination "+id+" in "+file);
 const urls=execFileSync("pdfinfo",["-url",pdf],{encoding:"utf8"});
 for(const id of refs)if(!urls.includes(baseUrl+"?id="+id))throw Error("Missing PDF reference "+id+" in "+file);
 anchorCount+=ids.length;referenceCount+=refs.length;
 fs.copyFileSync(pdf,path.join(out,"pdf",file));
 console.log("Built "+file+" ("+ids.length+" destinations, "+refs.length+" distinct reference targets)");
}
try{
 for(const n of verified){
  const dir=path.join(root,"volumes","N-"+n.number);
  const source=fs.readFileSync(path.join(dir,"main.tex"),"utf8");
  const p=prepareTex(source,entries,n.number,baseUrl);
  compile(p.tex,"N-"+n.number+".pdf",p.anchors,p.references);
 }
 const catalogue=statementsTex(ledger).replace(/(\\entryhead\{[^\n]*\})\{(K-\d{6})\}/g,(all,head,id)=>head+"{\\href{"+baseUrl+"?id="+id+"}{"+id+"}}");
 compile(catalogue,"statements.pdf",[],entries.filter(e=>e.kind!=="exercise").map(e=>e.id));
 const publicNotes=verified.map(({number,title,area,goals,depends_on,treatise})=>({number,title,area,goals,depends_on,treatise}));
 const depth=new Map(planGraph(ledger).layers.flatMap((ids,i)=>ids.map(id=>[Number(id.slice(2)),i])));
 const plan=ledger.notes.filter(n=>n.status!=="retired").map(({number,title,area,goals,depends_on,treatise,status})=>({number,title,area,goals,depends_on,treatise,status,depth:depth.get(number)}));
 const publicEntries=entries.map(({id,kind,title,statement,assumptions,position,depends_on})=>({id,kind,title,statement,assumptions,position,depends_on,preview:{statement:previewParts(statement),assumptions:previewParts(assumptions.join("；"))}}));
 fs.writeFileSync(path.join(out,"data.json"),JSON.stringify({referenceOrigin:base.origin,referencePath:base.pathname,notes:publicNotes,entries:publicEntries,parts:ledger.parts??[],treatises:ledger.treatises??[],plan})+"\n");
 fs.writeFileSync(path.join(out,".nojekyll"),"");
 console.log("Site: "+verified.length+" notes, "+entries.length+" entries, "+anchorCount+" named destinations, "+referenceCount+" distinct targets counted per PDF.");
}finally{fs.rmSync(tmp,{recursive:true,force:true})}
