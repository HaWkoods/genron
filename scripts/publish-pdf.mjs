import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";

const root=fileURLToPath(new URL("../",import.meta.url));
const run=(cmd,args,cwd=root)=>execFileSync(cmd,args,{cwd,stdio:"inherit"});
const ledger=JSON.parse(fs.readFileSync(path.join(root,"docs/knowledge.json"),"utf8"));
const requested=process.argv.slice(2);
if(requested.some(id=>!/^N-[1-9]\d*$/.test(id)))throw Error("Usage: node scripts/publish-pdf.mjs [N-1 ...]");
const verified=ledger.notes.filter(n=>n.status==="verified"&&Number.isSafeInteger(n.number)&&n.number>0);
const notes=requested.length?verified.filter(n=>requested.includes("N-"+n.number)):verified;
if(requested.some(id=>!notes.some(n=>"N-"+n.number===id)))throw Error("Only verified notes can be published");
run(process.execPath,["scripts/test-knowledge.mjs"]);
run(process.execPath,["scripts/test-statements-tex.mjs"]);
run(process.execPath,["scripts/knowledge.mjs","check","--strict"]);
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"genron-pdf-"));
try{
 for(const n of notes){
  const id="N-"+n.number,dir=path.join(root,"volumes",id),out=path.join(tmp,id);
  if(!fs.existsSync(path.join(dir,"main.tex")))throw Error("Missing main.tex: "+id);
  fs.mkdirSync(out);
  for(let i=0;i<2;i++)run("platex",["-interaction=nonstopmode","-halt-on-error","-no-shell-escape","-output-directory="+out,"main.tex"],dir);
  const log=fs.readFileSync(path.join(out,"main.log"),"utf8");
  if(/(?:^|\n)! |LaTeX Warning: (?:Reference|Citation).*undefined|There were undefined references/i.test(log))throw Error("Unresolved LaTeX problem: "+id);
  const pdf=path.join(out,"main.pdf");
  run("dvipdfmx",["-o",pdf,path.join(out,"main.dvi")],dir);
  if(fs.readFileSync(pdf).subarray(0,5).toString()!=="%PDF-")throw Error("Not a PDF: "+id);
  run("pdfinfo",[pdf],dir);
 }
 // Build the reader-facing statement catalogue from the same ledger snapshot.
 const catalogue=path.join(tmp,"statements");
 fs.mkdirSync(catalogue);
 const catalogueTex=execFileSync(process.execPath,["scripts/statements-tex.mjs"],{cwd:root,encoding:"utf8",maxBuffer:64*1024*1024});
 fs.writeFileSync(path.join(catalogue,"statements.tex"),catalogueTex);
 for(let i=0;i<2;i++)run("platex",["-interaction=nonstopmode","-halt-on-error","-no-shell-escape","statements.tex"],catalogue);
 const catalogueLog=fs.readFileSync(path.join(catalogue,"statements.log"),"utf8");
 if(/(?:^|\n)! |Missing character:|Overfull \\[hv]box|There were undefined references|Package rerunfilecheck Warning/i.test(catalogueLog))throw Error("Unresolved typesetting problem in statements catalogue");
 run("dvipdfmx",["-o","statements.pdf","statements.dvi"],catalogue);
 run("pdfinfo",[path.join(catalogue,"statements.pdf")],catalogue);
 // Do not update the index or copy any output until all selected compilations succeed.
 fs.copyFileSync(path.join(catalogue,"statements.tex"),path.join(root,"docs","statements.tex"));
 fs.copyFileSync(path.join(catalogue,"statements.pdf"),path.join(root,"docs","statements.pdf"));
 for(const n of notes)fs.copyFileSync(path.join(tmp,"N-"+n.number,"main.pdf"),path.join(root,"volumes","N-"+n.number,"main.pdf"));
 const index=execFileSync(process.execPath,["scripts/knowledge.mjs","graph","plan","--markdown"],{cwd:root,encoding:"utf8"});
 const statements=execFileSync(process.execPath,["scripts/knowledge.mjs","statements"],{cwd:root,encoding:"utf8"});
 fs.writeFileSync(path.join(root,"docs/roadmap.md"),index);
 fs.writeFileSync(path.join(root,"docs/statements.md"),statements);
}finally{fs.rmSync(tmp,{recursive:true,force:true})}
