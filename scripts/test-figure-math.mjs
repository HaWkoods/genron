import assert from "node:assert/strict";
import fs from "node:fs";
import {typesetFigure} from "./figure-math.mjs";
const manifest=JSON.parse(fs.readFileSync(new URL("../site/figures.json",import.meta.url),"utf8"));
let count=0;
for(const f of manifest){
 const source=fs.readFileSync(new URL("../site/"+f.src,import.meta.url),"utf8");
 const rendered=typesetFigure(source,f.src);
 assert.ok(rendered.count>0,f.src);
 assert.doesNotMatch(rendered.svg,/<foreignObject\b|<script\b|data-mml-node="merror"/);
 assert.match(rendered.svg,/class="math-label"/);
 count+=rendered.count;
}
assert.throws(()=>typesetFigure('<svg><text x="0" y="0">x</text></svg>'),/missing explicit TeX/);
assert.throws(()=>typesetFigure('<svg><text x="0" y="0" data-tex="\\notARealCommand">x</text></svg>'));
console.log("Figure math: "+manifest.length+" SVGs, "+count+" typeset labels");
