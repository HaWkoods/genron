// Typeset figure labels as self-contained MathJax SVG outlines at build time.
import {mathjax} from "mathjax-full/js/mathjax.js";
import {TeX} from "mathjax-full/js/input/tex.js";
import {SVG} from "mathjax-full/js/output/svg.js";
import {liteAdaptor} from "mathjax-full/js/adaptors/liteAdaptor.js";
import {RegisterHTMLHandler} from "mathjax-full/js/handlers/html.js";
import "mathjax-full/js/input/tex/ams/AmsConfiguration.js";
const adaptor=liteAdaptor();
RegisterHTMLHandler(adaptor);
const doc=mathjax.document("",{
 InputJax:new TeX({packages:["base","ams"],formatError:(_jax,error)=>{throw error}}),
 OutputJax:new SVG({fontCache:"none"})
});
const decode=s=>s.replace(/&(?:quot|apos|lt|gt|amp);/g,x=>({"&quot;":'"',"&apos;":"'","&lt;":"<","&gt;":">","&amp;":"&"}[x]));
const esc=s=>String(s).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const attrs=s=>Object.fromEntries([...s.matchAll(/([\w:-]+)="([^"]*)"/g)].map(m=>[m[1],decode(m[2])]));
const round=n=>Number(n.toFixed(4));
const cache=new Map();
function glyphs(tex){
 if(cache.has(tex))return cache.get(tex);
 const container=doc.convert(tex,{display:false});
 const svg=adaptor.firstChild(container);
 const box=adaptor.getAttribute(svg,"viewBox").split(/\s+/).map(Number);
 const content=adaptor.innerHTML(svg);
 if(box.length!==4||box.some(n=>!Number.isFinite(n))||box[2]<=0||box[3]<=0||/<(?:text|merror)\b|data-mml-node="merror"/.test(content)||!/<path\b|<rect\b/.test(content))throw Error("Invalid or non-outline math label: "+tex);
 const result={box,content};cache.set(tex,result);return result;
}
export function typesetFigure(source,name="figure"){
 // Source SVG uses explicit TeX attributes. Text content is the readable source fallback.
 // Japanese prose labels are intentionally plain text, marked with data-text="true".
 const defaultSize=Number(source.match(/<g\b[^>]*\bfont-size="([\d.]+)"/)?.[1]??17);
 let count=0;
 const output=source.replace(/<text\b([^>]*)>([\s\S]*?)<\/text>/g,(whole,raw,body)=>{
  const a=attrs(raw),tex=a["data-tex"];
  if(a["data-text"]==="true"){
   if(tex!==undefined||!/[ぁ-んァ-ヶ一-龯]/.test(body))throw Error(name+": invalid prose label "+body);
   return whole;
  }
  if(!tex?.trim())throw Error(name+": missing explicit TeX label: "+body);
  const size=Number(a["font-size"]??defaultSize),x=Number(a.x),y=Number(a.y);
  if(![size,x,y].every(Number.isFinite)||size<=0||a.transform)throw Error(name+": unsupported label coordinates");
  const {box,content}=glyphs(tex),scale=size/1000;
  const anchor=a["text-anchor"]??"start";
  if(!["start","middle","end"].includes(anchor))throw Error(name+": invalid text anchor");
  const offset=box[0]+box[2]*(anchor==="middle"?.5:anchor==="end"?1:0);
  const tx=round(x-offset*scale),ty=round(y);
  // The SVG math box has baseline y=0; retain the original baseline and anchor.
  // For labels on hatching, paint a white outline behind the glyph paths.
  const halo=a.stroke==="#fff"||a.stroke==="#ffffff"||a.stroke==="white";
  const white=halo?'<g color="#fff">'+content.replace(/stroke-width="0"/g,'stroke-width="'+Math.round(2000/size)+'" stroke-linejoin="round"')+'</g>':"";
  count++;
  return '<g class="math-label" data-tex="'+esc(tex)+'" aria-label="'+esc(tex)+'" transform="translate('+tx+' '+ty+') scale('+round(scale)+')" color="#222" stroke="none" fill="none">'+white+content+'</g>';
 });
 if(!count)throw Error(name+": no mathematical labels");
 if(/<text\b(?![^>]*data-text="true")/.test(output))throw Error(name+": unprocessed text label");
 return {svg:output,count};
}
