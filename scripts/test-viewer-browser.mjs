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
 assert.equal(await page.locator('.note-result[data-status="planned"] a[href*="note="]').count()>0,true,"Published prerequisites may link to PDFs");
 assert.equal(await page.locator('.note-result[data-status="planned"] > a[href*="note="]').count(),0);
 await page.getByRole("searchbox").fill("Radon–Nikodym");
 const planned=page.locator(".note-result").filter({hasText:"Radon–Nikodymの定理"});await planned.waitFor();assert.equal(await planned.getAttribute("data-status"),"planned");assert.equal(await planned.locator("strong.planned-title").count(),1);
 await page.getByRole("button",{name:"公開済み",exact:true}).click();assert.equal(await page.locator(".note-result").count(),0);
 await page.getByRole("searchbox").fill("選択公理");await page.locator('.note-result[data-note="3"] > a').filter({hasText:"選択公理"}).waitFor();
 await page.getByRole("button",{name:"すべて",exact:true}).click();await page.getByRole("searchbox").fill("N-8");await page.locator('.note-result[data-note="8"]').waitFor();assert.equal(await page.locator(".note-result").count(),1);


 // Exercise the map route from navigation and direct URL.
 await page.getByRole("link",{name:"数学構造地図",exact:true}).click();
 await page.locator(".map-stage canvas").first().waitFor();
 assert.equal(await page.getByRole("combobox",{name:"検索結果"}).locator("option").count(),planData.plan.length+1);
 await page.getByRole("searchbox",{name:"ノート検索"}).fill("N-3");
 await page.getByRole("combobox",{name:"検索結果"}).selectOption("3");
 await page.locator(".map-panel h2").filter({hasText:"N-3"}).waitFor();
 await page.getByRole("combobox",{name:"依存方向"}).selectOption("path");
 await page.getByRole("combobox",{name:"表示範囲"}).selectOption("local");
 await page.getByRole("button",{name:"＋",exact:true}).click();
 await page.getByRole("button",{name:"全体に戻す",exact:true}).click();
 await page.goto(origin+"?view=map");await page.locator(".map-stage canvas").first().waitFor();
 assert.deepEqual(errors,[],"Map JavaScript errors");

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
 await page.locator("#N-1 .web-legacy").click();
 await page.locator(".pdf-shell").waitFor();
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

 // Web-only publications never require a PDF.
 for(const n of planData.notes.filter(n=>n.web_only)){
  await page.goto(origin+"?note="+n.number);
  const chapter=page.locator("#N-"+n.number);
  await chapter.waitFor();
  assert.ok(await chapter.locator(".web-entry").count()>0);
  assert.equal(await chapter.locator(".web-legacy").count(),0);
  assert.equal(await page.locator(".pdf-shell").count(),0);
 }
 // Merged-away note numbers retain their section and archived page URLs.
 for(const [old,a] of Object.entries(planData.aliases??{})){
  await page.goto(origin+"?note="+old);
  await page.locator(".target").waitFor();
  assert.match(await page.locator(".reader-title").innerText(),new RegExp("N-"+a.number+"\\s"));
  await page.goto(origin+"?note="+old+"&page=1");
  await page.locator(".page[data-page='1'] .annotations").waitFor();
  assert.match(await page.locator(".reader-title").innerText(),new RegExp("N-"+old+"\\s"));
  await page.goto(origin+"?id="+a.first);
  await page.locator(".target").waitFor();
  assert.match(await page.locator(".reader-title").innerText(),new RegExp("N-"+a.number+"\\s"));
 }
 // Scroll through the actual N-3 document without pressing a page button.
 const currentPage=page.getByRole("spinbutton",{name:"ページ番号"});
 const sheet=n=>page.locator('.page[data-page="'+n+'"]');
 const rendered=n=>sheet(n).locator(".annotations");
 const waitPage=async n=>{await page.waitForFunction(n=>document.querySelector('input[aria-label="ページ番号"]')?.value===String(n),n);await rendered(n).waitFor()};
 await page.goto(origin+"?note=3");await rendered(1).waitFor();
 assert.equal(await page.locator(".pdf-shell .page").count(),6);
 const y1=(await sheet(1).boundingBox()).y,y2=(await sheet(2).boundingBox()).y;
 assert.ok(y2>y1+(await sheet(1).boundingBox()).height,"Pages must be vertically stacked");
 await page.mouse.move(950,700);await page.mouse.wheel(0,Math.ceil(y2-30));await waitPage(2);
 assert.match(page.url(),/note=3&page=2/);
 await page.getByRole("button",{name:"次頁 →",exact:true}).click();await waitPage(3);
 await page.getByRole("button",{name:"← 前頁",exact:true}).click();await waitPage(2);
 await currentPage.fill("6");await currentPage.press("Enter");await waitPage(6);
 assert.ok(await page.getByRole("button",{name:"次頁 →",exact:true}).isDisabled());
 await page.getByRole("link",{name:"次のノート：N-4 →",exact:true}).click();await rendered(1).waitFor();assert.match(page.url(),/note=4/);
 await page.goto(origin+"?note=3&page=3");await waitPage(3);
 // Both modes use identical PDF destinations and preserve the current page.
 const mode=page.getByRole("combobox",{name:"表示方式"});
 await mode.selectOption("single");await waitPage(3);
 assert.equal(await page.locator(".pdf-shell .page:visible").count(),1);
 assert.ok(await sheet(3).isVisible());
 await page.getByRole("button",{name:"次頁 →",exact:true}).click();await waitPage(4);
 await page.getByRole("button",{name:"← 前のページ",exact:true}).click();await waitPage(3);
 await page.getByRole("button",{name:"次のページ →",exact:true}).click();await waitPage(4);
 await page.reload();await waitPage(4);assert.equal(await mode.inputValue(),"single");assert.equal(await page.locator(".pdf-shell .page:visible").count(),1);
 await page.goto(origin+"?id=K-000060");await page.locator(".page:has(.target) .annotations").waitFor();assert.equal(await mode.inputValue(),"single");assert.equal(await page.locator(".pdf-shell .page:visible").count(),1);
 await page.goto(origin+"?note=statements");await waitPage(1);assert.equal(await mode.inputValue(),"single");await page.getByRole("button",{name:"次頁 →",exact:true}).click();await waitPage(2);
 await mode.selectOption("continuous");await waitPage(2);assert.ok(await page.locator(".pdf-shell .page:visible").count()>1);
 await page.reload();await waitPage(2);assert.equal(await mode.inputValue(),"continuous");
 await page.goto(origin+"?id=K-000001");await page.locator(".target").waitFor();await page.getByRole("link",{name:"次の知識項目 →",exact:true}).click();await page.locator(".target").waitFor();assert.match(page.url(),/id=K-000002/);
 await page.goto(origin);await page.getByRole("searchbox").fill("選択公理");
 const searchResult=page.locator(".result a[href*='id=K-000060']");await searchResult.waitFor();
 await searchResult.hover();await page.locator("#preview:not([hidden])").waitFor();
 assert.match(await page.locator("#preview").innerText(),/選択公理/);
 assert.equal(Math.round((await page.locator("#preview").boundingBox()).width),580);
 assert.equal(await page.locator("#preview").evaluate(el=>getComputedStyle(el).paddingLeft),"28px");
 await page.getByRole("button",{name:"閲覧設定"}).click();await page.locator("#width").fill("700");await page.locator("#padding").fill("36");await page.getByRole("button",{name:"閉じる",exact:true}).last().click();
 await page.reload();await searchResult.waitFor();await searchResult.hover();assert.equal(Math.round((await page.locator("#preview").boundingBox()).width),700);
 await searchResult.click();await page.locator(".target").waitFor();await page.locator(".page:has(.target) .annotations").waitFor();assert.match(page.url(),/id=K-000060/);
 await page.goBack();await searchResult.waitFor();
 await page.goto(origin+"?id=K-000129");await page.locator(".target").waitFor();
 // Navigate to each page through ordinary scroll and inspect real PDF annotations.
 let found=false;
 for(let i=1;i<=7;i++){
  await sheet(i).evaluate(el=>window.scrollTo(0,el.getBoundingClientRect().top+window.scrollY-100));
  await rendered(i).waitFor();
  const link=sheet(i).locator(".annotation[href*='id=K-000060']").first();
  if(await link.count()){
   await link.scrollIntoViewIfNeeded();await link.hover();await page.locator("#preview:not([hidden])").waitFor();assert.match(await page.locator("#preview").innerText(),/選択公理/);
   const originalY=await page.evaluate(()=>scrollY);
   await link.click();await page.waitForURL(/id=K-000060/);await page.locator(".page:has(.target) .annotations").waitFor();
   await page.goBack();await page.waitForURL(/note=6|id=K-000129/);await rendered(i).waitFor();
   assert.ok(Math.abs(await page.evaluate(()=>scrollY)-originalY)<100,"Back should restore reading position");found=true;break
  }
 }
 assert.ok(found,"Cross-note PDF link must work");
 await page.goto(origin+"?note=statements");await rendered(1).waitFor();assert.ok(await page.locator(".pdf-shell .page").count()>1);await sheet(2).evaluate(el=>window.scrollTo(0,el.getBoundingClientRect().top+window.scrollY-30));await waitPage(2);
 await page.goto(origin+"?note=notation");await rendered(1).waitFor();
 const notationLinks=sheet(1).locator(".annotation[href*='id=K-000002']");
 const notationLink=notationLinks.first();
 await notationLink.waitFor();
 for(const link of await notationLinks.all()){const box=await link.boundingBox(), paper=await sheet(1).boundingBox();assert.ok(box.x>paper.x+paper.width*.40,"Notation links belong to the right column");}
 await notationLink.waitFor();await notationLink.hover();await page.locator("#preview:not([hidden])").waitFor();
 assert.match(await page.locator("#preview").innerText(),/量化/);
 await notationLink.click();await page.waitForURL(/id=K-000002/);await page.locator(".target").waitFor();
 await page.goBack();await page.waitForURL(/note=notation/);await rendered(1).waitFor();
 await page.setViewportSize({width:390,height:844});await page.goto(origin+"?note=3");await rendered(1).waitFor();await sheet(2).evaluate(el=>window.scrollTo(0,el.getBoundingClientRect().top+window.scrollY-150));await rendered(2).waitFor();assert.equal(await page.locator(".pdf-shell .page").count(),6);
 await page.setViewportSize({width:390,height:844});await page.goto(origin);await page.getByRole("searchbox").fill("K-000060");await searchResult.waitFor();await searchResult.hover();const b=await page.locator("#preview").boundingBox();assert.ok(b.x>=0&&b.x+b.width<=391);
 assert.equal(await page.locator("#preview").evaluate(el=>getComputedStyle(el).overflowX),"hidden");
 assert.ok(await page.locator("#preview").evaluate(el=>el.scrollWidth<=el.clientWidth+1),"Preview must not overflow horizontally");
 assert.ok(await page.locator("#preview").evaluate(el=>[...el.querySelectorAll(".math")].every(s=>getComputedStyle(s).overflowX==="visible"&&s.getBoundingClientRect().width<=s.closest("p").clientWidth+1)),"Inline math must fit without internal scrollbars");
 assert.deepEqual(errors,[],"Unexpected browser JavaScript errors");
 console.log("Browser smoke test passed: search, hover, settings persistence, PDF destination, cross-note link, history, catalogue, mobile bounds, continuous scrolling, single-page mode, mode persistence, direct page links, next note, next knowledge item.");
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve))}
