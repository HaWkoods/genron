import {statementsTex} from "./statements-tex.mjs";

const e=(id,kind,position,statement,assumptions=[],status="verified")=>({id,kind,position,title:"項目",statement,assumptions,status});
const fixture={notes:[{number:1,title:"試験"}],entries:[e("K-000002","theorem",[1,1,2,1],"x≤y",["x∈ℕ, m·n∈ℕ"]),e("K-000001","axiom",[1,1,1,1],"f^{-1}(A)"),e("K-000003","definition",[1,1,2,2],"未検証",[],"draft"),e("K-000004","exercise",[1,1,2,3],"演習")]};
const result=statementsTex(fixture);
const checks=[
 result.includes("\\leq")&&result.includes("\\mathbb{N}")&&result.includes("\\cdot"),
 result.includes("f^{-1}(A)"),
 result.includes("仮定："),
 !result.includes("未検証")&&!result.includes("演習")&&!result.includes("K-000003"),
 result.indexOf("K-000001")<result.indexOf("K-000002"),
 result.includes("全2項目")&&result.includes("\\hyperlink{note-1}")&&result.includes("\\hypertarget{note-1}"),
 statementsTex({notes:[],entries:[]}).includes("全0項目")
];
if(!checks.every(Boolean))throw Error("Statement TeX test failed: "+JSON.stringify(checks));

console.log("OK: 7 statement TeX tests.");
