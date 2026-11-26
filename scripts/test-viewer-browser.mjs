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
 // Check actual page changes on desktop and at the end of a page, not just button clicks.
 await page.goto(origin+"?note=1");await page.locator('.page[data-page="1"] .annotations').waitFor();
 await page.getByRole("button",{name:"次頁 →",exact:true}).click();await page.locator('.page[data-page="2"] .annotations').waitFor();assert.equal(await page.getByRole("spinbutton",{name:"ページ番号"}).inputValue(),"2");assert.match(page.url(),/page=2/);
 await page.getByRole("button",{name:"次のページ →",exact:true}).click();await page.locator('.page[data-page="3"] .annotations').waitFor();assert.equal(await page.getByRole("spinbutton",{name:"ページ番号"}).inputValue(),"3");
 await page.getByRole("button",{name:"← 前のページ",exact:true}).click();await page.locator('.page[data-page="2"] .annotations').waitFor();
 const pageInput=page.getByRole("spinbutton",{name:"ページ番号"});await pageInput.fill("6");await pageInput.press("Enter");await page.locator('.page[data-page="6"] .annotations').waitFor();assert.ok(await page.getByRole("button",{name:"次頁 →",exact:true}).isDisabled());
 await page.getByRole("link",{name:"次のノート：N-2 →",exact:true}).click();await page.locator('.page[data-page="1"] .annotations').waitFor();assert.match(page.url(),/note=2/);
 await page.goto(origin+"?id=K-000001");await page.locator(".annotations").waitFor();await page.getByRole("link",{name:"次の知識項目 →",exact:true}).click();await page.locator(".target").waitFor();assert.match(page.url(),/id=K-000002/);
 await page.goto(origin);await page.getByRole("searchbox").fill("選択公理");
 const searchResult=page.locator(".result a[href*='id=K-000060']");await searchResult.waitFor();
 await searchResult.hover();await page.locator("#preview:not([hidden])").waitFor();
 assert.match(await page.locator("#preview").innerText(),/選択公理/);
 assert.equal(Math.round((await page.locator("#preview").boundingBox()).width),580);
 assert.equal(await page.locator("#preview").evaluate(el=>getComputedStyle(el).paddingLeft),"28px");
 await page.getByRole("button",{name:"閲覧設定"}).click();await page.locator("#width").fill("700");await page.locator("#padding").fill("36");await page.getByRole("button",{name:"閉じる",exact:true}).last().click();
 await page.reload();await searchResult.waitFor();await searchResult.hover();assert.equal(Math.round((await page.locator("#preview").boundingBox()).width),700);
 await searchResult.click();await page.locator(".page canvas").waitFor();await page.locator(".target").waitFor();assert.match(page.url(),/id=K-000060/);
 await page.goBack();await searchResult.waitFor();
 await page.goto(origin+"?id=K-000129");await page.locator(".page canvas").waitFor();
 // Find a real PDF link in the proof of well-ordering; traverse the note if necessary.
 let found=false;
 for(let i=0;i<8;i++){
  await page.locator(".annotations").waitFor();
  const link=page.locator(".annotation[href*='id=K-000060']").first();
  if(await link.count()){await link.hover();await page.locator("#preview:not([hidden])").waitFor();assert.match(await page.locator("#preview").innerText(),/選択公理/);await link.click();await page.locator(".target").waitFor();assert.match(page.url(),/id=K-000060/);found=true;break}
  const next=page.getByRole("button",{name:"次頁 →"});if(await next.isDisabled())break;await next.click();await page.waitForTimeout(350);
 }
 assert.ok(found,"Cross-note PDF link must work");
 await page.goto(origin+"?note=statements");await page.locator('.page[data-page="1"] .annotations').waitFor();await page.getByRole("button",{name:"次頁 →",exact:true}).click();await page.locator('.page[data-page="2"] .annotations').waitFor();
 await page.setViewportSize({width:390,height:844});await page.goto(origin);await page.getByRole("searchbox").fill("K-000060");await searchResult.waitFor();await searchResult.hover();const b=await page.locator("#preview").boundingBox();assert.ok(b.x>=0&&b.x+b.width<=391);
 assert.deepEqual(errors,[],"Unexpected browser JavaScript errors");
 console.log("Browser smoke test passed: search, hover, settings persistence, PDF destination, cross-note link, history, catalogue, mobile bounds, page navigation (top and bottom), next note, next knowledge item.");
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve))}
