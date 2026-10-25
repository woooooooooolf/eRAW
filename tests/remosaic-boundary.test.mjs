import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
const {outputText}=ts.transpileModule(await readFile(new URL("../src/remosaic-boundary.ts",import.meta.url),"utf8"),{
  compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},
});
const {unsupportedReorderEdges}=await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const processing={remosaic:{sameColorReconstruction:false}};
test("reorder crop support agrees with every actual one-axis read including the RGB halo",()=>{
  for(let width=1;width<=24;width++)for(let phase=0;phase<4;phase++)for(let x=0;x<width;x++)for(let size=1;size<=width-x;size++){
    const d={width,height:4,cfa:"QRGGB",cfaPhaseX:phase,cfaPhaseY:0};
    for(const mode of ["remosaic","demosaic"]){
      const halo=mode==="remosaic"?0:1;
      const coordinates=Array.from({length:Math.min(width,x+size+halo)-Math.max(0,x-halo)},(_,i)=>Math.max(0,x-halo)+i);
      const valid=coordinates.every(v=>{const q=v+phase,r=q%4,s=q-r+[0,2,1,3][r]-phase;return s>=0&&s<width;});
      assert.equal(unsupportedReorderEdges(d,processing,mode,{x,y:0,width:size,height:4}).length===0,valid);
    }
  }
});
test("only relevant Quad processing is restricted and safe crops do not have to be four pixels wide",()=>{
  const d={width:4,height:4,cfa:"QRGGB",cfaPhaseX:2,cfaPhaseY:0};
  assert.deepEqual(unsupportedReorderEdges(d,processing,"remosaic"),["left","right"]);
  assert.deepEqual(unsupportedReorderEdges(d,processing,"remosaic",{x:1,y:0,width:2,height:4}),[]);
  assert.deepEqual(unsupportedReorderEdges(d,processing,"demosaic",{x:1,y:0,width:2,height:4}),["left","right"]);
  assert.deepEqual(unsupportedReorderEdges(d,processing,"raw"),[]);
  assert.deepEqual(unsupportedReorderEdges({...d,cfa:"RGGB"},processing,"demosaic"),[]);
  assert.deepEqual(unsupportedReorderEdges(d,{remosaic:{sameColorReconstruction:true}},"demosaic"),[]);
});
