import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import {chromium} from "playwright-core";
const base=path.resolve("_site");
const types={".html":"text/html; charset=utf-8",".mjs":"text/javascript; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json",".pdf":"application/pdf",".woff2":"font/woff2",".woff":"font/woff",".ttf":"font/ttf"};
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,"http://localhost").pathname;
 const file=path.resolve(base,"."+pathname.replace(/\/$/,"/index.html"));
 if(!file.startsWith(base+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return}
 res.setHeader("Content-Type",types[path.extname(file)]??"application/octet-stream");fs.createReadStream(file).pipe(res);
});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const origin="http://127.0.0.1:"+server.address().port+"/";
let browser;
try{
 const executablePath=process.env.CHROME_BIN??["/usr/bin/google-chrome","/usr/bin/google-chrome-stable","/usr/bin/chromium"].find(p=>fs.existsSync(p));
 if(!executablePath)throw Error("Chrome not available");
 browser=await chromium.launch({executablePath,headless:true,args:["--no-sandbox"]});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on("pageerror",e=>{errors.push(e.message);console.error(e)});
 // Hierarchy is generated from the canonical plan; planned nodes never point to nonexistent PDFs.
 await page.goto(origin);await page.locator(".part-group").first().waitFor();
 const planData=JSON.parse(fs.readFileSync(path.join(base,"data.json"),"utf8"));
 assert.equal(await page.locator(".part-group").count(),planData.parts.length);
 assert.equal(await page.locator(".treatise-group").count(),planData.treatises.length);
 assert.equal(await page.locator(".note-result").count(),planData.plan.length);
 assert.equal(await page.locator('.note-result[data-status="planned"] a[href*="note="]').count()>0,true,"Published prerequisites may link to Web notes");
 assert.equal(await page.locator('.note-result[data-status="planned"] > a[href*="note="]').count(),0);
 await page.getByRole("searchbox").fill("Radon–Nikodym");
 const planned=page.locator(".note-result").filter({hasText:"Radon–Nikodymの定理"});await planned.waitFor();assert.equal(await planned.getAttribute("data-status"),"planned");assert.equal(await planned.locator("strong.planned-title").count(),1);
 await page.getByRole("button",{name:"公開済み",exact:true}).click();assert.equal(await page.locator(".note-result").count(),0);
 await page.getByRole("searchbox").fill("選択公理");await page.locator('.note-result[data-note="3"] > a').filter({hasText:"選択公理"}).waitFor();
 await page.getByRole("button",{name:"すべて",exact:true}).click();await page.getByRole("searchbox").fill("N-8");await page.locator('.note-result[data-note="8"]').waitFor();assert.equal(await page.locator(".note-result").count(),1);
 const note8=planData.plan.find(n=>n.number===8);
 await page.getByRole("searchbox").fill(note8.display_number);
 await page.locator('.note-result[data-note="8"]').waitFor();
 assert.equal(await page.locator(".note-result").count(),1);
 assert.match(await page.locator('.note-result[data-note="8"] .result-head').innerText(),/04\.08\.01/);



 // Exercise the map route from navigation and direct URL.
 await page.getByRole("link",{name:"数学構造地図",exact:true}).click();
 await page.locator(".map-stage canvas").first().waitFor();
 assert.equal(await page.getByRole("combobox",{name:"検索結果"}).locator("option").count(),planData.plan.length+1);
 await page.getByRole("searchbox",{name:"ノート検索"}).fill("N-3");
 await page.getByRole("combobox",{name:"検索結果"}).selectOption("3");
 await page.locator(".map-panel h2").filter({hasText:planData.plan.find(n=>n.number===3).display_number}).waitFor();
 await page.getByRole("combobox",{name:"依存方向"}).selectOption("path");
 await page.getByRole("combobox",{name:"表示範囲"}).selectOption("local");
 await page.getByRole("button",{name:"＋",exact:true}).click();
 await page.getByRole("button",{name:"全体に戻す",exact:true}).click();
 await page.goto(origin+"?view=map");await page.locator(".map-stage canvas").first().waitFor();
 assert.deepEqual(errors,[],"Map JavaScript errors");



 // Knowledge paths are computed at entry level and projected onto notes only afterwards.
 const pathById=new Map(planData.entries.map(e=>[e.id,e]));
 const pathReverse=new Map(planData.entries.map(e=>[e.id,[]]));
 for(const e of planData.entries)for(const d of e.depends_on)pathReverse.get(d).push(e.id);
 const pathExpected=(id,dir,direct)=>{
  const walk=forward=>{const seen=new Set([id]),queue=[id];for(let i=0;i<queue.length;i++){if(direct&&i>0)break;for(const x of (forward?pathReverse.get(queue[i]):pathById.get(queue[i]).depends_on))if(!seen.has(x)){seen.add(x);queue.push(x)}}return seen};
  return new Set([...(dir==="down"?[]:walk(false)),...(dir==="up"?[]:walk(true)),id]);
 };
 async function checkPath(id,dir,direct){
  const ids=pathExpected(id,dir,direct),expectedNotes=[...new Set([...ids].map(x=>pathById.get(x).position[0]))].sort((a,b)=>a-b);
  assert.deepEqual(await page.locator(".path-note").evaluateAll(els=>els.map(e=>Number(e.dataset.note)).sort((a,b)=>a-b)),expectedNotes);
  assert.deepEqual(await page.locator(".path-entry").evaluateAll(els=>els.map(e=>e.dataset.knowledge).sort()),[...ids].sort());
  assert.equal(await page.locator(".path-note[data-note='"+pathById.get(id).position[0]+"']").count(),1);
  const planByNo=new Map(planData.plan.map(n=>[n.number,n]));
  const orderedNotes=expectedNotes.slice().sort((a,b)=>planByNo.get(a).depth-planByNo.get(b).depth||a-b);
  assert.deepEqual(await page.locator(".path-note").evaluateAll(els=>els.map(e=>Number(e.dataset.note))),orderedNotes,"Note layer ordering");
  const mode=await page.getByRole("combobox",{name:"ノートの表示内容"}).inputValue();
  const expectedFull=mode==="full"?planData.entries.filter(e=>expectedNotes.includes(e.position[0])).map(e=>e.id):[...ids];
  assert.deepEqual(await page.locator(".path-note .web-entry").evaluateAll(els=>els.map(e=>e.id).sort()),expectedFull.sort(),"Full note bodies or relevant entries");
  assert.equal(await page.locator(".path-selected-entry").count(),1);
  assert.equal(await page.locator(".path-note .web-proof[open]").count(),0,"Proofs initially closed");
  assert.ok(await page.locator(".path-note .web-entry p,.path-note .web-entry .web-paragraph").count()>0,"Source text rendered");

 }
 await page.goto(origin+"?view=knowledge-path");
 await page.locator(".knowledge-path").waitFor();
 await page.getByRole("searchbox",{name:"知識の検索"}).fill("Lagrangeの定理");
 await page.getByRole("combobox",{name:"対象の知識"}).selectOption("K-000315");
 await checkPath("K-000315","up",false);
 await page.getByRole("combobox",{name:"知識の依存方向"}).selectOption("down");
 await checkPath("K-000315","down",false);
 await page.getByRole("combobox",{name:"知識の依存方向"}).selectOption("both");
 await page.getByRole("combobox",{name:"知識の依存範囲"}).selectOption("direct");
 await checkPath("K-000315","both",true);
 await page.reload();await page.locator(".path-target").waitFor();
 await checkPath("K-000315","both",true);
 await page.getByRole("combobox",{name:"ノートの表示内容"}).selectOption("related");
 await checkPath("K-000315","both",true);
 await page.getByRole("combobox",{name:"ノートの表示内容"}).selectOption("full");
 await checkPath("K-000315","both",true);
 await page.goto(origin+"?view=knowledge-path&target=K-000131");
 await page.locator(".path-target").waitFor();await checkPath("K-000131","up",false);
 await page.setViewportSize({width:390,height:844});
 assert.ok(await page.locator(".knowledge-path").evaluate(el=>el.scrollWidth<=el.clientWidth+1),"Knowledge paths should fit mobile widths");
 await page.getByRole("searchbox",{name:"知識の検索"}).fill("ZZZ無該当ZZZ");assert.equal(await page.locator(".path-note").count(),0);
 await page.setViewportSize({width:1440,height:1000});
 assert.deepEqual(errors,[],"Knowledge path errors");

 // Separate example catalogue: no theorem entries, and worked solutions are closed.
 await page.goto(origin+"?note=examples");
 await page.locator(".web-catalogue").waitFor();
 assert.equal(await page.locator(".catalogue-entry").count(),planData.entries.filter(e=>["example","worked_example"].includes(e.heading_kind)).length);
 assert.equal(await page.locator("#catalogue-K-000315").count(),0);
 assert.match(await page.locator("#catalogue-K-000164 .web-statement-title").innerText(),/^例 /);
 const worked=page.locator("#catalogue-K-000151");
 assert.match(await worked.locator(".web-statement-title").innerText(),/^例題 /);
 assert.match(await worked.locator(".worked-question").innerText(),/すべて求めよ/);
 assert.equal(await worked.locator(".worked-answer .proof-body").isVisible(),false);
 await worked.locator(".worked-answer summary").click();
 assert.equal(await worked.locator(".worked-answer .proof-body").isVisible(),true);
 assert.match(await worked.locator(".worked-answer .proof-body").innerText(),/四つに限る/);
 assert.deepEqual(errors,[],"Example catalogue errors");
 // Native catalogues are the default; explicit PDF routes are tested below.
 await page.goto(origin+"?note=statements");
 await page.locator(".web-catalogue").waitFor();
 assert.equal(await page.locator(".catalogue-entry").count(),planData.entries.filter(e=>!["example","worked_example"].includes(e.heading_kind)).length);
 for(const id of ["K-000047","K-000131","K-000289","K-000315"]){
  const e=planData.entries.find(e=>e.id===id);
  const heading=page.locator("#catalogue-"+id+" .web-statement-title");
  assert.equal(await heading.textContent(),"命題 "+e.display_number+"（"+e.title+"）");
 }

 assert.equal(await page.locator(".pdf-shell").count(),0);
 const statementRef=page.locator("#catalogue-K-000060 .catalogue-reference");
 assert.equal(await statementRef.innerText(),"選択公理");
 assert.match(await statementRef.getAttribute("href"),/view=web/);
 await page.locator(".catalogue-search").fill("K-000060");
 assert.equal(await page.locator(".catalogue-entry:visible").count(),1);
 await statementRef.click();
 await page.locator("#K-000060.web-entry").waitFor();
 await page.goto(origin+"?note=notation");
 await page.locator(".notation-table").first().waitFor();
 assert.equal(await page.locator(".notation-table tbody tr").count(),planData.notation.flatMap(g=>g.rows).length);
 assert.equal(await page.locator(".notation-symbol a").count(),0);
 assert.equal(await page.locator(".notation-reference").count(),planData.notation.flatMap(g=>g.rows).filter(r=>r.id!==null).length);
 const webNotationRef=page.locator(".notation-reference").filter({hasText:/^全称量化$/});
 await webNotationRef.hover();
 await page.locator("#preview:not([hidden])").waitFor();
 assert.match(await page.locator("#preview .foot a").getAttribute("href"),/view=web/);
 await webNotationRef.click();
 await page.locator("#K-000002.web-entry").waitFor();
 await page.setViewportSize({width:390,height:844});
 await page.goto(origin+"?note=notation");
 await page.locator(".notation-table").first().waitFor();
 assert.ok(await page.locator(".web-catalogue").evaluate(el=>el.scrollWidth<=el.clientWidth+1),"Native notation must not overflow horizontally");
 await page.locator(".catalogue-search").fill("全称量化");
 assert.ok(await page.locator(".notation-table tbody tr:visible").count()>0);
 await page.setViewportSize({width:1440,height:1000});
 assert.deepEqual(errors,[],"Native catalogue JavaScript errors");
 // Independently compute knowledge depth from the full exported dependency lists.
 const byKnowledgeId=new Map(planData.entries.map(e=>[e.id,e]));
 const ranks=new Map();
 function rankKnowledge(id){
  if(ranks.has(id))return ranks.get(id);
  const e=byKnowledgeId.get(id);
  assert.ok(e,"Missing dependency "+id);
  const depth=Math.max(0,...(e.depends_on??[]).map(d=>rankKnowledge(d)+1));
  ranks.set(id,depth);return depth;
 }
 const expectedPanel=e=>(e.depends_on??[]).filter(id=>{
  const gap=rankKnowledge(e.id)-rankKnowledge(id);
  return gap>=1&&gap<=2;
 });
 for(const e of planData.entries)assert.equal(e.knowledge_depth,rankKnowledge(e.id),"Exported knowledge depth "+e.id);
 const filtered=planData.entries.find(e=>expectedPanel(e).length>0&&expectedPanel(e).length<e.depends_on.length);
 assert.ok(filtered,"Need a regression case with both recent and distant dependencies");
 await page.goto(origin+"?id="+filtered.id+"&view=web");
 await page.locator("#"+filtered.id+".web-entry").waitFor();
 const renderedPanels=await page.locator(".web-entry").evaluateAll(elements=>elements.map(el=>({id:el.id,panels:el.querySelectorAll(":scope > .web-dependencies").length,refs:[...el.querySelectorAll(":scope > .web-dependencies a")].map(a=>new URL(a.href).searchParams.get("id"))})));
 for(const item of renderedPanels){
  const expected=expectedPanel(byKnowledgeId.get(item.id));
  assert.deepEqual(item.refs,expected,"Two-layer dependency panel "+item.id);
  assert.equal(item.panels,expected.length?1:0,"Empty dependency panel "+item.id);
 }
 assert.ok(filtered.depends_on.some(id=>!expectedPanel(filtered).includes(id)),"Distant edges remain in exported data");
 assert.deepEqual(errors,[],"Dependency panel JavaScript errors");
 // Native Web reader prototype: direct HTML, stable IDs and legacy escape hatch.
 await page.goto(origin+"?note=1&view=web");
 await page.locator(".web-article").waitFor();
 const firstNote=planData.plan.find(n=>n.number===1);
 const firstPart=planData.treatises.find(t=>t.id===firstNote.treatise).part;
 const partNotes=planData.plan.filter(n=>planData.treatises.some(t=>t.id===n.treatise&&t.part===firstPart));
 assert.equal(await page.locator(".web-chapter").count(),partNotes.length);
 assert.equal(await page.locator(".web-entry").count(),planData.entries.filter(e=>partNotes.some(n=>n.number===e.position[0])).length);
 assert.equal(await page.locator(".pdf-shell").count(),0);
 const logic=page.locator("#K-000001");
 for(const id of ["K-000047","K-000131"]){
  const e=planData.entries.find(e=>e.id===id);
  assert.equal(await page.locator("#"+id+" .web-statement-title").textContent(),"命題 "+e.display_number+"（"+e.title+"）");
 }

 assert.match(await page.locator("#N-1 .web-note-title").innerText(),/^01\.01\.01/);
 assert.match(await logic.locator(".web-statement-title").innerText(),/^定義 01\.01\.01\.1\.1\.1/);

 assert.equal(await logic.locator(".web-math-table tr").count(),5);
 // Check TeX source as well as rendered layout: a KaTeX node alone does not prove that symbols survived.
 const firstInline=logic.locator(".math").first();
 assert.equal(await firstInline.locator('annotation[encoding="application/x-tex"]').textContent(),"P,Q");
 assert.equal(await firstInline.evaluate(el=>getComputedStyle(el).display),"inline-block");
 assert.equal(await logic.locator(".katex-display").count(),0);
 assert.equal(await logic.locator(".web-math-table tr").first().locator('td').first().locator('annotation[encoding="application/x-tex"]').textContent(),"\\neg P");
 assert.equal(await logic.locator(".web-math-table tr").nth(1).locator('td').first().locator('annotation[encoding="application/x-tex"]').textContent(),"P\\land Q");
 assert.ok(await logic.locator(".math .katex").count()>10);

 assert.match(await logic.innerText(),/最後の記号は/);
 assert.doesNotMatch(await logic.innerText(),/[、。]/);
 assert.ok(await page.locator("#K-000004 .katex-display").count()>0);
 assert.ok(await page.locator("#K-000030 .katex-display").count()>0);

 await page.goto(origin+"?id=K-000002&view=web");
 await page.locator(".web-entry[id='K-000002']").waitFor();
 assert.ok(await page.locator(".web-article .katex").count()>0,"Web math must be rendered");
 assert.equal(await page.locator(".web-legacy").count(),0);
 assert.deepEqual(errors,[],"Web reader JavaScript errors");

 // Original proof content is rendered in the native reader.
 await page.goto(origin+"?id=K-000020&view=web");
 const proof=page.locator(".web-entry[id='K-000020'] .web-proof");
 await proof.waitFor();
 assert.equal(await proof.getAttribute("open"),null);
 assert.equal(await proof.locator(".proof-body").isVisible(),false);
 await proof.locator("summary").click();
 assert.equal(await proof.locator(".proof-body").isVisible(),true);
 assert.match(await proof.innerText(),/第1式は定義による/);
 assert.ok(await proof.locator(".katex").count()>0);
 assert.deepEqual(errors,[],"Proof rendering JavaScript errors");


 // Explicit prose citations must be linked, not only listed as dependencies.
 await page.goto(origin+"?id=K-000057&view=web");
 const citation=page.locator("#K-000057 a.web-citation[href*='id=K-000047']");
 await citation.waitFor();
 assert.equal(await citation.innerText(),"写像の集合と直積族");
 assert.doesNotMatch(await page.locator("#K-000057 .web-paragraph").allTextContents().then(xs=>xs.join(" ")),/N-2\s*の\s*定義|K-000047/);
 const localRef=page.locator("#K-000060 a.web-citation[href*='id=K-000057']");
 assert.equal(await localRef.innerText(),"選択函数");
 assert.doesNotMatch(await page.locator("#K-000060 .web-paragraph").allTextContents().then(xs=>xs.join(" ")),/定義選択函数/);
 const numericRef=page.locator("#K-000016 a.web-citation[href*='id=K-000015']");
 assert.equal(await numericRef.innerText(),"量化と論理結合子");
 await citation.hover();
 await page.locator("#preview:not([hidden])").waitFor();
 assert.match(await page.locator("#preview").innerText(),/写像の集合と直積族/);
 assert.match(await page.locator("#preview .foot a").getAttribute("href"),/view=web/);
 await citation.click();
 await page.waitForURL(/id=K-000047/);
 await page.locator("#K-000047.web-entry").waitFor();
 assert.equal(await page.locator(".pdf-shell").count(),0);
 assert.deepEqual(errors,[],"Web citation navigation errors");

 // Web-only publications never require a PDF.
 for(const n of planData.notes.filter(n=>n.web_only)){
  await page.goto(origin+"?note="+n.number);
  const chapter=page.locator("#N-"+n.number);
  await chapter.waitFor();
  assert.ok(await chapter.locator(".web-entry").count()>0);
  assert.equal(await chapter.locator(".web-legacy").count(),0);
  assert.equal(await page.locator(".pdf-shell").count(),0);
 }
 // Legacy URLs resolve to native content, never a PDF.
 for(const [old,a] of Object.entries(planData.aliases??{})){
  for(const suffix of ["","&page=1","&view=pdf&page=2"]){
   await page.goto(origin+"?note="+old+suffix);
   await page.locator("#"+a.first+".web-entry").waitFor();
   assert.equal(await page.locator(".pdf-shell").count(),0);
  }
 }
 for(const n of planData.notes){
  await page.goto(origin+"?note="+n.number+"&view=pdf&page=1");
  await page.locator("#N-"+n.number+" .web-entry").first().waitFor();
  assert.equal(await page.locator(".pdf-shell,.web-legacy").count(),0);
 }
 for(const name of ["statements","notation","examples"]){
  await page.goto(origin+"?note="+name+"&view=pdf&page=1");
  await page.locator(".web-catalogue").waitFor();
  assert.equal(await page.locator(".pdf-shell,.web-legacy").count(),0);
 }
 assert.equal((await page.request.get(origin+"pdf/N-1.pdf")).status(),404);
 assert.equal((await page.request.get(origin+"pdf/statements.pdf")).status(),404);
 assert.equal((await page.request.get(origin+"pdf/notation.pdf")).status(),404);
 assert.equal(fs.existsSync(path.join(base,"pdf")),false);
 assert.equal(fs.existsSync(path.join(base,"vendor/pdfjs")),false);
 await page.goto(origin);await page.getByRole("searchbox").fill("選択公理");
 const searchResult=page.locator(".result a[href*='id=K-000060']");await searchResult.waitFor();
 await searchResult.hover();await page.locator("#preview:not([hidden])").waitFor();
 assert.match(await page.locator("#preview").innerText(),/選択公理/);
 assert.equal(Math.round((await page.locator("#preview").boundingBox()).width),580);
 assert.equal(await page.locator("#preview").evaluate(el=>getComputedStyle(el).paddingLeft),"28px");
 await page.getByRole("button",{name:"閲覧設定"}).click();await page.locator("#width").fill("700");await page.locator("#padding").fill("36");await page.getByRole("button",{name:"閉じる",exact:true}).last().click();
 await page.reload();await searchResult.waitFor();await searchResult.hover();assert.equal(Math.round((await page.locator("#preview").boundingBox()).width),700);
 await searchResult.click();await page.locator("#K-000060.web-entry").waitFor();assert.match(page.url(),/id=K-000060/);
 await page.goBack();await searchResult.waitFor();
 await page.setViewportSize({width:390,height:844});await page.goto(origin);await page.getByRole("searchbox").fill("K-000060");await searchResult.waitFor();await searchResult.hover();const b=await page.locator("#preview").boundingBox();assert.ok(b.x>=0&&b.x+b.width<=391);
 assert.equal(await page.locator("#preview").evaluate(el=>getComputedStyle(el).overflowX),"hidden");
 assert.ok(await page.locator("#preview").evaluate(el=>el.scrollWidth<=el.clientWidth+1),"Preview must not overflow horizontally");
 assert.ok(await page.locator("#preview").evaluate(el=>[...el.querySelectorAll(".math")].every(s=>getComputedStyle(s).overflowX==="visible"&&s.getBoundingClientRect().width<=s.closest("p").clientWidth+1)),"Inline math must fit without internal scrollbars");
 assert.deepEqual(errors,[],"Unexpected browser JavaScript errors");
 console.log("Browser smoke test passed: Web-only routes, legacy URLs, absence of PDF assets, catalogues, search, proof/answer expansion, preview, settings, history and mobile layout.");
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve))}
