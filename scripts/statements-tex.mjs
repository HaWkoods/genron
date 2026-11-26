import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

const kinds={axiom:'公理',convention:'規約',definition:'定義',lemma:'補題',proposition:'命題',theorem:'定理',corollary:'系',construction:'構成',background:'背景原理'};
const symbols={'⟨':'\\langle ','⟩':'\\rangle ','·':'\\cdot ','ℕ':'\\mathbb{N}','¬':'\\neg ','×':'\\times ','ι':'\\iota ','π':'\\pi ','′':'\\prime ','→':'\\to ','↦':'\\mapsto ','⇒':'\\Rightarrow ','⇔':'\\Leftrightarrow ','∀':'\\forall ','∃':'\\exists ','∅':'\\varnothing ','∈':'\\in ','∉':'\\notin ','∏':'\\prod ','∖':'\\setminus ','∘':'\\circ ','∧':'\\land ','∨':'\\lor ','∩':'\\cap ','∪':'\\cup ','≠':'\\ne ','≤':'\\leq ','⊆':'\\subseteq ','⊊':'\\subsetneq ','⋂':'\\bigcap ','⋃':'\\bigcup ','⨿':'\\coprod ','≥':'\\geq ','⊂':'\\subset ','⊇':'\\supseteq ','∞':'\\infty ','∑':'\\sum ','≈':'\\approx ','≡':'\\equiv ','∣':'\\mid ','∥':'\\parallel ','α':'\\alpha ','β':'\\beta ','γ':'\\gamma ','δ':'\\delta ','ε':'\\varepsilon ','λ':'\\lambda ','μ':'\\mu ','ν':'\\nu ','ρ':'\\rho ','σ':'\\sigma ','τ':'\\tau ','φ':'\\varphi ','ψ':'\\psi ','ω':'\\omega '};
const roman=new Set(['De','Morgan','Boolean','Galois','iff','on','Knaster','Tarski']);
const op={sup:'\\sup ',inf:'\\inf ',id:'\\mathrm{id}',Fix:'\\operatorname{Fix}',op:'\\mathrm{op}'};
const txt=s=>String(s).replace(/[\\{}$%&#_^~]/g,c=>({'\\':'\\textbackslash{}','{':'\\{','}':'\\}','$':'\\$','%':'\\%','&':'\\&','#':'\\#','_':'\\_','^':'\\textasciicircum{}','~':'\\textasciitilde{}'}[c]));
// Plain ledger notation, not a general TeX parser. Only ASCII scripts and listed symbols are interpreted.
function math(s,breaks=true){
 let result='';
 for(let i=0;i<s.length;){
  const c=s[i++];
  if(c==='_'||c==='^'){
   let arg='';
   if(s[i]==='{'){
    const start=++i;let d=1;
    while(i<s.length&&d){if(s[i]==='{')d++;if(s[i]==='}')d--;if(d)i++;}
    if(d)throw Error('Unclosed script in '+s);
    arg=s.slice(start,i++);
   }else if(i<s.length){
    const m=s.slice(i).match(/^(?:op|[A-Za-z0-9*+-])/);
    if(m){arg=m[0];i+=arg.length;}else arg=s[i++];
   }else throw Error('Empty script in '+s);
   result+=c+'{'+math(arg,false)+'}';continue;
  }
  const match=(c+s.slice(i)).match(/^(sup|inf|Fix|id|op)(?![a-z])/);
  if(match){result+=op[match[0]];i+=match[0].length-1;continue;}
  if(c==='′'){result+="'";continue;}
  if(c==='\\')result+='\\backslash ';
  else if(c==='{'||c==='}'||c==='$'||c==='%'||c==='&'||c==='#')result+='\\'+c;
  else if(c==='~')result+='\\sim ';
  else if(c==='|')result+='\\mid ';
  else if(c==='*')result+='\\ast ';
  else result+=symbols[c]??c;
  if(breaks&&',=⇔⇒≤≥⊆'.includes(c))result+='\\allowbreak ';
 }
 return result;
}
function formatted(s){
 const re=new RegExp('[!-~'+Object.keys(symbols).join('')+']+','gu');
 let out='',last=0;
 for(const m of String(s).matchAll(re)){
  out+=txt(s.slice(last,m.index));const token=m[0];
  if(roman.has(token)||/^N-\d+$/.test(token)||/^K-\d+$/.test(token)||/^\d+$/.test(token)||/^[,.;:!?]+$/.test(token))out+=txt(token);
  else out+='\\('+math(token)+'\\)';
  last=m.index+token.length;
 }
 return out+txt(s.slice(last));
}

// Same limited notation conversion as the printed catalogue; keep original text on errors.
export function previewParts(s){
 const re=new RegExp('[!-~'+Object.keys(symbols).join('')+']+','gu');
 const out=[];let last=0;
 for(const m of String(s).matchAll(re)){
  if(m.index>last)out.push({text:s.slice(last,m.index)});
  const t=m[0];if(roman.has(t)||/^N-\d+$/.test(t)||/^K-\d+$/.test(t)||/^\d+$/.test(t)||/^[,.;:!?]+$/.test(t))out.push({text:t});
  else {try{out.push({tex:math(t,false),raw:t})}catch{out.push({text:t})}}
  last=m.index+t.length;
 }
 if(last<s.length)out.push({text:s.slice(last)});
 return out;
}

export function statementsTex(ledger){
 const entries=ledger.entries.filter(e=>e.status==='verified'&&Object.hasOwn(kinds,e.kind)).sort((a,b)=>{for(let i=0;i<4;i++){const d=a.position[i]-b.position[i];if(d)return d;}return a.id.localeCompare(b.id)});
 const names=new Map((ledger.notes??[]).map(n=>[n.number,n.title]));
 const counts=new Map();for(const e of entries)counts.set(e.position[0],(counts.get(e.position[0])??0)+1);
 const lines=[String.raw`\documentclass[a5paper,10pt,dvipdfmx]{jsarticle}
\usepackage{amsmath,amssymb}
\usepackage[margin=17mm,headsep=5mm,includehead]{geometry}
\usepackage{fancyhdr,needspace}
\usepackage[dvipdfmx,bookmarks=true,hidelinks]{hyperref}
\usepackage{pxjahyper}
\pagestyle{fancy}
\fancyhf{}
\fancyhead[L]{\small 数学原論}
\fancyhead[R]{\small 定義・命題一覧\quad\thepage}
\renewcommand{\headrulewidth}{0pt}
\setlength{\headheight}{14pt}
\setlength{\parindent}{0pt}
\setlength{\parskip}{0pt}
\setlength{\emergencystretch}{2em}
\raggedbottom
\newcommand{\entryhead}[2]{\par\addvspace{.55\baselineskip}\Needspace{4\baselineskip}\noindent\textbf{#1}\hfill{\small\ttfamily #2}\par\nobreak\smallskip}
\begin{document}
\begin{center}
{\small 数学原論}\par\vspace{3mm}
{\LARGE 定義・命題一覧}\par\vspace{2mm}
{\small 読者確認用}
\end{center}`,
'知識台帳の検証済み項目（全'+entries.length+'項目）を各ノートの掲載順に掲げる。証明・解説は収録しない。本文の厳密な記述については該当ノートを参照されたい。','\\bigskip','\\textbf{ノート別目次}\\par\\smallskip'];
 for(const [n,count] of counts)lines.push('\\hyperlink{note-'+n+'}{N-'+n+'\\quad '+txt(names.get(n)??'')+'}\\dotfill '+count+'項目\\par');
 let lastN=0,lastS='';
 for(const e of entries){const [n,ch,se]=e.position;
  if(n!==lastN){lines.push('\\par\\bigskip','\\Needspace{12\\baselineskip}','\\hypertarget{note-'+n+'}{}','\\section*{N-'+n+'\\quad '+txt(names.get(n)??'')+'}','\\pdfbookmark[1]{N-'+n+' '+txt(names.get(n)??'')+'}{bookmark-'+n+'}');lastN=n;lastS='';}
  const sec=ch+'.'+se;if(sec!==lastS){lines.push('\\Needspace{9\\baselineskip}','\\subsection*{第'+ch+'章\\quad 第'+se+'節}');lastS=sec;}
  lines.push('\\entryhead{'+txt(kinds[e.kind]+'（'+e.title+'）')+'}{'+txt(e.id)+'}');
  if(e.assumptions.length)lines.push('仮定： '+formatted(e.assumptions.join('；'))+'\\par');
  lines.push(formatted(e.statement)+'\\par');
 }
 lines.push('\\end{document}','');return lines.join('\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const file=process.argv[2]??new URL('../docs/knowledge.json',import.meta.url);
 process.stdout.write(statementsTex(JSON.parse(fs.readFileSync(file,'utf8'))));
}
