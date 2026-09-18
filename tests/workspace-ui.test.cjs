const test=require('node:test'),assert=require('node:assert/strict');
const {lessonType,subject,fingerprint}=require('../workspace-ui.js');
const vm=require('node:vm'),fs=require('node:fs');
test('saved baseline preserves edits made while a save is pending',()=>{
 const source=fs.readFileSync(require.resolve('../workspace-ui.js'),'utf8');
 let state={studentName:'검증',autoRows:[{rate:87500}]};
 const context={window:{},FeeWorkspace:{fingerprint},rateLibraryDirty:false,collectCalculatorState:()=>state};
 vm.createContext(context);
 vm.runInContext(source.slice(source.indexOf("    let baseline="),source.indexOf("    window.addEventListener('beforeunload'")),context);
 const saved=structuredClone(state);
 context.window.markCalculatorSaved(saved);assert.equal(context.window.hasUnsavedCalculatorChanges(),false);
 state={...state,autoRows:[{rate:90000}]};
 context.window.markCalculatorSaved(saved);assert.equal(context.window.hasUnsavedCalculatorChanges(),true);
 context.window.markCalculatorSaved();assert.equal(context.window.hasUnsavedCalculatorChanges(),false);
 context.rateLibraryDirty=true;assert.equal(context.window.hasUnsavedCalculatorChanges(),true);
});
test('class names recognize individual aliases and exact teaching formats',()=>{
 for(const name of ['수학-개별(박은채)-3h','국어-개별정규-남종언T-4h'])assert.equal(lessonType(name),'개별정규');
 assert.equal(lessonType('국어-1:1-김경석'),'1:1');assert.equal(lessonType('수학-특강(강사)-2h'),'특강');
 assert.equal(lessonType('개별 학생 이름'),'');assert.equal(lessonType('국어-새유형-강사'),'');
});
test('subject grouping never includes teaching format or teacher',()=>{
 assert.equal(subject(' 수학-개별(박은채)-3h'),'수학');assert.equal(subject('영어'),'영어');assert.equal(subject(''),'미분류');
});
test('unsaved fingerprint ignores view/auth/shared hydration but detects billing changes',()=>{
 const original={studentName:'검증',studentId:'',currentTab:'auto',autoRows:[{name:'수학',rate:87500,days:[2,4]}]};
 assert.equal(fingerprint(original),fingerprint({...original,currentTab:'select',studentId:'qa',pricePresets:[1],adNotices:['공지']}));
 assert.notEqual(fingerprint(original),fingerprint({...original,autoRows:[{name:'수학',rate:62500,days:[2,4]}]}));
});
