import fs from "node:fs";
import path from "node:path";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {validate, affected, changedEntries, available, graph, prerequisites, planGraph, planPrerequisites, planMermaid, planMarkdown, statementsMarkdown} from "./knowledge-core.mjs";

const root=fileURLToPath(new URL("../",import.meta.url));
const ledgerPath="docs/knowledge.json";
const git=(...args)=>execFileSync("git",args,{cwd:root,encoding:"utf8",maxBuffer:64*1024*1024});
function readSources(){
 const sources={};
 function walk(dir){
  if(!fs.existsSync(dir))return;
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
   const p=path.join(dir,entry.name);
   if(entry.isDirectory())walk(p);
   else if(entry.isFile()&&p.endsWith(".tex"))sources[path.relative(root,p).split(path.sep).join("/")]=fs.readFileSync(p,"utf8");
  }
 }
 walk(path.join(root,"volumes"));return sources;
}
function publishedPDFs(ledger){
 return (ledger.notes??[]).filter(n=>{
  if(n.status!=="verified")return false;
  const p=path.join(root,"volumes","N-"+n.number,"main.pdf");
  if(!fs.existsSync(p)||!fs.statSync(p).isFile())return false;
  const fd=fs.openSync(p,"r");try{const header=Buffer.alloc(5);return fs.readSync(fd,header,0,5,0)===5&&header.toString()==="%PDF-";}finally{fs.closeSync(fd)}
 }).map(n=>n.number);
}
function historical(ref){
 const sha=git("rev-parse","--verify","--end-of-options",ref+"^{commit}").trim();
 const names=git("ls-tree","-r","--name-only","-z",sha).split("\0");
 if(!names.includes(ledgerPath))throw Error("Base commit has no "+ledgerPath+": "+sha);
 const sources={};
 for(const name of names.filter(n=>n.startsWith("volumes/")&&n.endsWith(".tex")))sources[name]=git("show",sha+":"+name);
 return {ledger:JSON.parse(git("show",sha+":"+ledgerPath)),sources};
}
function diagnostics(result){
 for(const w of result.warnings)console.warn("WARNING "+w);
 for(const e of result.errors)console.error("ERROR "+e);
 return result.errors.length===0;
}
function main(){
 const [cmd="check",...args]=process.argv.slice(2);
 const ledger=JSON.parse(fs.readFileSync(path.join(root,ledgerPath),"utf8")),sources=readSources();
 const result=validate(ledger,sources);
 if(cmd==="check"){
  if(args.some(a=>a!=="--strict"))throw Error("Unknown check option");
  if(!diagnostics(result)||args.includes("--strict")&&result.warnings.length){process.exitCode=1;return}
  console.log("OK: "+ledger.entries.length+" entries; "+result.warnings.length+" warnings.");return;
 }
 const valid=diagnostics(result);
 if(cmd==="available"){
  if(!valid){process.exitCode=1;return}
  console.log(JSON.stringify(available(ledger,args),null,2));return;
 }
 if(cmd==="prerequisites"){
  if(!valid){process.exitCode=1;return}
  if(args.length!==1)throw Error("Usage: prerequisites K-000001 | N-1");
  console.log(JSON.stringify(args[0].startsWith("N-")?planPrerequisites(ledger,args[0]):prerequisites(ledger,args[0]),null,2));return;
 }
 if(cmd==="graph"){
  if(!valid){process.exitCode=1;return}
  if(args.length>2||args.length&& !["knowledge","notes","plan"].includes(args[0])||args.length===2&&!(args[0]==="plan"&&["--mermaid","--markdown"].includes(args[1])))throw Error("Usage: graph [knowledge|notes|plan] [--mermaid|--markdown (plan only)]");
  if(args[0]==="plan"){if(args[1]==="--mermaid")process.stdout.write(planMermaid(ledger));else if(args[1]==="--markdown")process.stdout.write(planMarkdown(ledger,publishedPDFs(ledger)));else console.log(JSON.stringify(planGraph(ledger),null,2));}
  else console.log(JSON.stringify(graph(ledger,args[0]??"knowledge"),null,2));return;
 }
 if(cmd==="statements"){
  if(args.length)throw Error("Usage: statements");
  if(!valid){process.exitCode=1;return}
  process.stdout.write(statementsMarkdown(ledger));return;
 }
 if(cmd==="impact"){
  if(!Array.isArray(ledger.entries))throw Error("Invalid ledger entries");
  let ledgers=[ledger],changed=args;
  if(args[0]==="--base"){
   if(args.length!==2)throw Error("Usage: impact --base COMMIT");
   const old=historical(args[1]);ledgers=[old.ledger,ledger];changed=changedEntries(old.ledger,ledger,old.sources,sources);
  }else if(!args.length||args.some(id=>!ledger.entries.some(e=>e.id===id)))throw Error("Usage: impact K-000001 [K-...]");
  const r=affected(ledgers,changed);
  const current=new Map(ledger.entries.map(e=>[e.id,e]));
  console.log(JSON.stringify({...r,review_required:[...new Set([...r.changed,...r.affected])].filter(id=>current.get(id)?.status==="verified"),locations:[...new Set([...r.changed,...r.affected])].map(id=>({id,source:current.get(id)?.source??null,status:current.get(id)?.status??"removed"}))},null,2));if(!valid)process.exitCode=1;return;
 }
 throw Error("Usage: knowledge.mjs check [--strict] | available [ID...] | prerequisites ID | graph [knowledge|notes|plan] | statements | impact ID... | impact --base COMMIT");
}
try{main()}catch(e){console.error(e.message);process.exitCode=1}
