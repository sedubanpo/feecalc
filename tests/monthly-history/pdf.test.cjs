const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
test('PDF refuses unreadable oversized pages rather than silently shrinking',async()=>{
 const context={window:{},TextEncoder,Blob,Uint8Array};vm.createContext(context);vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../../history-pdf.js'),'utf8'),context);
 let rasterized=false;await assert.rejects(context.window.FeeHistoryPdf.create([{width:1000,height:2000,toBlob(){rasterized=true;}}]),/너무 길어/);assert.equal(rasterized,false);
});
