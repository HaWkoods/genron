import assert from "node:assert/strict";
import {prepareTex} from "./viewer-tex.mjs";
import {previewParts} from "./statements-tex.mjs";
const root="https://hawkoods.github.io/genron/";
const e=(id,position,depends_on=[])=>({id,position,status:"verified",depends_on});
const entries=[e("K-000001",[1,1,1,1]),e("K-000002",[1,1,1,2],["K-000001"])];
const source=String.raw`\documentclass{jsarticle}
\begin{document}
% genron:begin K-000001
\begin{prop}[First]\label{a}
Statement.
\end{prop}
% genron:end K-000001
% genron:begin K-000002
% genron:use K-000001
\begin{prop}[Second]\label{b}
命題\ref{a}、K-000001、\GenronRef{K-000001}。
\end{prop}
% genron:end K-000002
\end{document}`;
const r=prepareTex(source,entries,1,root);
assert.equal(r.anchors.length,2);assert.equal(r.references.length,1);
assert.equal((r.tex.match(/\\hypertarget\{K-/g)||[]).length,2);
assert.equal((r.tex.match(/\\href\{/g)||[]).length,3);
assert.ok(r.tex.includes("\\href{"+root+"?id=K-000001}{命題\\ref*{a}}"));
assert.ok(r.tex.includes("% genron:use K-000001"));
assert.throws(()=>prepareTex(source,entries.slice(0,1),1,root));
assert.throws(()=>prepareTex(source,[entries[0],e("K-000002",[1,1,1,2])],1,root));
assert.ok(previewParts("集合 x∈ℕ").some(p=>p.tex?.includes("\\mathbb{N}")));
assert.equal(previewParts("集合 x∈ℕ").map(p=>p.raw??p.text).join(""),"集合 x∈ℕ");
console.log("Viewer source tests passed.");
