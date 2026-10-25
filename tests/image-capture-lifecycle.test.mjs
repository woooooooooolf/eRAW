import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
const url=source=>`data:text/javascript;base64,${Buffer.from(source+"\n//# sourceURL=capture-regression.js").toString("base64")}`;
async function compile(file,strip=false){return ts.transpileModule(await readFile(new URL(`../src/${file}.ts`,import.meta.url),"utf8"),{
  compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},
  transformers:strip?{before:[context=>source=>ts.visitEachChild(source,node=>ts.isImportDeclaration(node)?undefined:node,context)]}:undefined,
}).outputText;}
const {ImageCaptureSession}=await import(url(await compile("image-capture-session")));
const {normalizeDisplayExposure}=await import(url(await compile("display-adjustment")));
const {channelTint}=await import(url(await compile("channel-rendering")));
const {normalizeMissingPixelColor}=await import(url(await compile("missing-pixel-rendering")));
const {coordinateHighlightEnabled}=await import(url(await compile("statistics-link")));
let renderer;
globalThis.__captureTest={ImageCaptureSession,normalizeDisplayExposure,channelTint,normalizeMissingPixelColor,coordinateHighlightEnabled,
  renderTile:request=>renderer(request),renderCaptureTile:request=>renderer(request)};
const capture=await import(url(`const {renderTile,normalizeDisplayExposure,channelTint,normalizeMissingPixelColor}=globalThis.__captureTest;\n${await compile("image-capture",true)}`));
globalThis.__captureTest.renderPreviewCanvas=capture.renderPreviewCanvas;
const {RawViewport}=await import(url(`const {ImageCaptureSession,normalizeDisplayExposure,renderCaptureTile,renderPreviewCanvas,coordinateHighlightEnabled}=globalThis.__captureTest;\n${await compile("viewport",true)}`));
const defer=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
let painted;
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({putImageData(){painted++;}})})};
globalThis.ImageData=class{constructor(data,width,height){Object.assign(this,{data,width,height});}};
const bytes=()=>{const result=new Uint8Array(256*256*4);for(let i=3;i<result.length;i+=4)result[i]=255;return result;};
function viewport(){
  const result=Object.create(RawViewport.prototype),noOp=()=>{};
  Object.assign(result,{
    captureSession:new ImageCaptureSession(),document:{generation:1,descriptor:{width:512,height:4},layout:{frameCount:2}},
    frame:0,renderRevision:7,inFlight:new Map(),settings:{mode:"demosaic",processing:{demosaicAlgorithm:"bilinear",remosaic:{sameColorReconstruction:false}},displayWindow:{blackPoint:0,whitePoint:255}},
    channelRendering:"color",displayExposure:0,missingPixelAppearance:{pattern:"solid",color:"#101010"},
    transform:{zoom:1,cameraX:0,cameraY:0},canvas:{classList:{remove:noOp}},overlayLayer:{clearSelection:noOp,hide:noOp},
    callbacks:{onSelectionChange:noOp,onSampleChange:noOp,onPointerPixelChange:noOp,onZoomChange:noOp,onRenderStats:noOp},
    updatePointerPosition:noOp,clearTextures(){this.renderRevision++;},requestDraw:noOp,fit:noOp,
    abortSelectionGesture:noOp,hideCrosshair:noOp,
  });return result;
}
test("capture sessions never resurrect after invalidation or clear a newer operation",()=>{
  const cancelled=[],session=new ImageCaptureSession(revision=>cancelled.push(revision));
  const first=session.begin();session.invalidate();assert.throws(()=>first.check(),{code:"capture_cancelled"});
  const second=session.begin();first.finish();second.check();assert.ok(second.revision>first.revision);
  second.commit();session.invalidate();assert.equal(cancelled.length,1);second.finish();
});
test("real viewport semantic changes reject a late last tile before painting or output",async()=>{
  const changes=[v=>v.setFrame(1),v=>v.setDisplayExposure(1),v=>v.setChannelRendering("grayscale"),
    v=>v.setMissingPixelAppearance({pattern:"solid",color:"#ffffff"}),v=>v.setDisplay({...v.settings,mode:"red"}),
    v=>v.setDisplay({...v.settings,displayWindow:{blackPoint:1,whitePoint:255}}),
    v=>v.setDisplay({...v.settings,processing:{...v.settings.processing,remosaic:{sameColorReconstruction:true}}}),
    v=>v.setDocument({...v.document,generation:2},true),v=>v.clearDocument()];
  for(const change of changes){
    painted=0;const pending=[];renderer=()=>{const request=defer();pending.push(request);return request.promise;};
    const view=viewport(),job=view.beginImageCapture(),captured=view.captureFullPreview(job);
    assert.equal(pending.length,2);pending[0].resolve(bytes());await Promise.resolve();assert.equal(painted,1);
    change(view);pending[1].resolve(bytes());await assert.rejects(captured,{code:"capture_cancelled"});assert.equal(painted,1);
  }
});
test("viewport LOD revisions and no-op presentation edits do not cancel full preview",async()=>{
  const pending=[];renderer=()=>{const request=defer();pending.push(request);return request.promise;};
  const view=viewport(),job=view.beginImageCapture(),captured=view.captureFullPreview(job);
  view.advanceRenderRevision();view.setFrame(0);view.setDisplayExposure(0);view.setDisplay({...view.settings});
  view.setChannelRendering("color");view.setMissingPixelAppearance({...view.missingPixelAppearance});
  pending.forEach(request=>request.resolve(bytes()));const canvas=await captured;assert.equal(canvas.width,512);job.check();job.finish();
});
test("one tile failure stops queued work and cancels the capture group",async()=>{
  const pending=[];renderer=()=>{const request=defer();pending.push(request);return request.promise;};
  const view=viewport();view.document.descriptor.width=2048;
  const job=view.beginImageCapture(),captured=view.captureFullPreview(job);
  assert.equal(pending.length,4);pending[0].reject(new Error("tile failed"));await Promise.resolve();
  pending.slice(1).forEach(request=>request.resolve(bytes()));await assert.rejects(captured,/tile failed/);assert.equal(pending.length,4);
});
let pngOperation,imageOperation,writes,closed;
globalThis.__captureOutput={Image:{new:()=>imageOperation.promise},writeImage:async()=>{writes++;},savePng:async()=>{writes++;},
  canvasRgba:()=>new Uint8Array(4),canvasToPngBlob:()=>pngOperation.promise};
const output=await import(url(`const {Image,writeImage,savePng,canvasRgba,canvasToPngBlob}=globalThis.__captureOutput;\n${await compile("image-output",true)}`));
test("PNG encoding and buffer awaits are checked before the native save commit",async()=>{
  for(const step of ["encoding","buffer"]){
    writes=0;pngOperation=defer();const buffer=defer(),session=new ImageCaptureSession(),job=session.begin();
    const saved=output.saveCanvasPng({},"unused.png",job);if(step==="encoding")session.invalidate();
    pngOperation.resolve({arrayBuffer:()=>buffer.promise});await Promise.resolve();
    if(step==="buffer")session.invalidate();buffer.resolve(new ArrayBuffer(4));
    await assert.rejects(saved,{code:"capture_cancelled"});assert.equal(writes,0);
  }
});
test("late clipboard image resources are released without writing stale content",async()=>{
  writes=0;closed=0;imageOperation=defer();const session=new ImageCaptureSession(),job=session.begin();
  const copied=output.copyCanvasImage({width:1,height:1},job);session.invalidate();imageOperation.resolve({close:async()=>{closed++;}});
  await assert.rejects(copied,{code:"capture_cancelled"});assert.equal(writes,0);assert.equal(closed,1);
});
test("native save starts only after the final check and later changes do not roll it back",async()=>{
  writes=0;pngOperation=defer();const cancellations=[],session=new ImageCaptureSession(r=>cancellations.push(r)),job=session.begin();
  const saved=output.saveCanvasPng({},"unused.png",job);pngOperation.resolve({arrayBuffer:async()=>new ArrayBuffer(4)});await saved;
  session.invalidate();assert.equal(writes,1);assert.deepEqual(cancellations,[]);job.finish();
});
