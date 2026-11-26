import fs from "node:fs";
import path from "node:path";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {validate, affected, changedEntries, available, validPosition} from "./knowledge-core.mjs";

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
  const p=(args[0]??"").split(".").map(Number);
  if(args.length!==1||!validPosition(p))throw Error("Usage: available V.C.S.N");
  console.log(JSON.stringify(available(ledger,p),null,2));return;
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
 throw Error("Usage: knowledge.mjs check [--strict] | available V.C.S.N | impact ID... | impact --base COMMIT");
}
try{main()}catch(e){console.error(e.message);process.exitCode=1}
