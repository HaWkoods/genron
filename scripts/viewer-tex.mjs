// Prepare reader-only TeX from canonical annotated manuscripts.
const idPattern=/^K-\d{6}$/;
export function prepareTex(source,entries,number,baseUrl){
 const known=new Map(entries.filter(e=>e.status==="verified").map(e=>[e.id,e]));
 const own=entries.filter(e=>e.status==="verified"&&e.position[0]===number);
 const labels=new Map(),seen=new Set(),refs=new Set();
 const blocks=[...source.matchAll(/^% genron:begin (K-\d{6})\r?\n([\s\S]*?)^% genron:end \1\s*$/gm)];
 for(const m of blocks){
  const e=known.get(m[1]);
  if(!e||e.position[0]!==number||seen.has(e.id))throw Error("Unexpected block "+m[1]);
  seen.add(e.id);
  const header=m[2].match(/\\begin\{(?:ruledef|principle|axiom|ax|defn|definition|prop|proposition|thm|theorem|lemma|cor|corollary|construction)\}(?:\[[^\]\n]*\])?(?:\\label\{[^{}]+\})?/);
  if(!header)throw Error("Missing statement header "+e.id);
  const label=header[0].match(/\\label\{([^{}]+)\}/);
  if(label){if(labels.has(label[1]))throw Error("Duplicate label");labels.set(label[1],e.id)}
 }
 if(own.some(e=>!seen.has(e.id)))throw Error("Missing anchors N-"+number);
 const url=id=>baseUrl+"?id="+id;
 const link=(id,body,owner)=>{
  if(!known.has(id))throw Error("Unknown reference "+id);
  if(owner&&!known.get(owner).depends_on.includes(id))throw Error("Unregistered explicit reference "+owner+" -> "+id);
  refs.add(id);return "\\href{"+url(id)+"}{"+body+"}";
 };
 let transformed=source.replace(/^% genron:begin (K-\d{6})\r?\n([\s\S]*?)^% genron:end \1\s*$/gm,(all,id,body)=>{
  // Only explicit reference syntax; do not infer references from words or use annotations.
  body=body.split("\n").map(line=>{
   const at=line.search(/(?<!\\)%/);const tail=at<0?"":line.slice(at);
   let text=at<0?line:line.slice(0,at);
   // Single-pass replacement prevents rewriting inserted href URLs.
   text=text.replace(/(選択公理（N-3, K-000060）)|\\GenronRefText\{(K-\d{6})\}\{([^{}]*)\}|\\GenronRef\{(K-\d{6})\}|(定義|命題|定理|補題|系|公理|規約|原理)?\\ref\{([^{}]+)\}|K-\d{6}/g,(raw,choice,id1,display,id2,kind,label)=>{
    if(choice)return link("K-000060",choice,id);
    if(id1)return link(id1,display,id);
    if(id2)return link(id2,id2,id);
    if(label)return labels.has(label)?link(labels.get(label),(kind??"")+"\\ref*{"+label+"}",id):raw;
    return link(raw,raw,id);
   });
   return text+tail;
  }).join("\n");
  body=body.replace(/\\begin\{(?:ruledef|principle|axiom|ax|defn|definition|prop|proposition|thm|theorem|lemma|cor|corollary|construction)\}(?:\[[^\]\n]*\])?(?:\\label\{[^{}]+\})?/,h=>h+"\\hypertarget{"+id+"}{}");
  return "% genron:begin "+id+"\n"+body+"% genron:end "+id+"\n";
 });
 if(/\\usepackage(?:\[[^\]]*\])?\{hyperref\}/.test(transformed))throw Error("Hyperref already loaded; adapt preparation N-"+number);
 if(!transformed.includes("\\begin{document}"))throw Error("Missing document");
 transformed=transformed.replace("\\begin{document}","\\usepackage[dvipdfmx,colorlinks=true,linkcolor=blue,urlcolor=blue]{hyperref}\n\\usepackage{pxjahyper}\n\\begin{document}");
 return {tex:transformed,anchors:[...seen],references:[...refs]};
}
