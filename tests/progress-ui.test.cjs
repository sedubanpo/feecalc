const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../progress-ui.js'),'utf8');
test('restored old snapshot refresh advances Sep10 to Sep15 and preserves end and exclusions',async()=>{
 const context=vm.createContext({progressRequest:0,progressLoading:false,progressVerified:false,progressStatus:'',staffAuthEpoch:1,progressState:{snapshot:{},mode:'auto',cutoff:'2026-09-10',endDate:'2026-09-20',excluded:['x'],manual:[]},matchedStudent:()=>({id:'qa'}),progressMonth:()=>'2026-09',isServerConfigured:()=>true,progressBound:()=>true,progressToday:()=>'2026-09-16',renderProgress:()=>{},ProgressCore:{validMonth:()=>true,validateSnapshot:x=>x,defaultCutoff:()=> '2026-09-15',monthEnd:()=> '2026-09-30'},getSupabaseClient:()=>({rpc:async()=>({data:{studentId:'qa',month:'2026-09',lessons:[{date:'2026-09-15'}]}})})});
 vm.runInContext(source.slice(source.indexOf('async function loadProgressLessons'),source.indexOf('function setProgressMode')),context);
 await context.loadProgressLessons({preserveForecast:true});assert.equal(context.progressState.cutoff,'2026-09-15');assert.equal(context.progressState.endDate,'2026-09-20');assert.equal(context.progressState.excluded[0],'x');assert.equal(context.progressVerified,true);
 context.progressVerified=false;context.getSupabaseClient=()=>({rpc:async()=>({error:{message:'offline'}})});await context.loadProgressLessons({preserveForecast:true});assert.equal(context.progressVerified,false);assert.match(context.progressStatus,/offline/);assert.equal(context.progressState.snapshot.lessons.length,1);
});
test('legacy restore defaults end to month end and requires refresh before export',()=>{
 const core=require('../progress-core.js'),snapshot={studentId:'qa',month:'2026-09',lessons:[]};
 const context=vm.createContext({ProgressCore:core,applyCalculatorState:()=>{},renderProgress:()=>{},progressRequest:0});
 vm.runInContext(source.slice(source.indexOf('const progressOriginalApply'),source.indexOf('const progressOriginalClear')),context);
 context.applyCalculatorState({studentId:'qa',targetYear:2026,targetMonth:9,progress:{snapshot,cutoff:'2026-09-10'}});
 assert.equal(context.progressState.endDate,'2026-09-30');assert.equal(context.progressRefreshPending,true);assert.equal(context.progressVerified,false);
 assert.throws(()=>context.applyCalculatorState({studentId:'qa',targetYear:2026,targetMonth:9,progress:{snapshot,cutoff:'2026-09-10',endDate:'2026-09-09'}}));
});
test('compact receipt groups subject/teacher across actual and forecast, preserving types and totals',()=>{
 const context=vm.createContext({parseSubjectInfo:name=>({mainName:name.split('-')[0],type:name.split('-')[1]})});
 vm.runInContext(source.slice(source.indexOf('function groupProgressReceipt'),source.indexOf('function renderProgressReceipt')),context);
 const row=(predicted,extra={})=>({className:'국어-개별-2h',teacher:'검증',minutes:120,amount:62500,kind:'regular',date:'2026-09-10',predicted,...extra});
 const groups=context.groupProgressReceipt([row(false),row(true),row(false,{kind:'absence',minutes:0,amount:0}),row(true,{className:'국어-1:1-2h',amount:200000})]);
 assert.equal(groups.length,1);assert.equal(groups[0].teachers.length,1);
 const group=groups[0].teachers[0];assert.equal(group.total,325000);assert.equal(group.variants.size,3);
 assert.equal([...group.variants.values()][0].count,2);assert.equal([...group.variants.values()][0].predicted,1);
});
test('progress message retains offsetting named adjustments and manual provenance',()=>{
 const adjustments=[{label:'8월 이월금',amount:-50000},{label:'8월 초과금',amount:50000}];
 const context=vm.createContext({collectAdjustmentItems:()=>adjustments,getCurrentStudentName:()=>'검증학생',progressEl:()=>({value:9}),progressMoney:n=>n.toLocaleString('ko-KR')+'원',buildAdjustmentMessageLines:items=>items.map(x=>`${x.label}: ${x.amount.toLocaleString('ko-KR')}원`),getAdjustmentTotal:items=>items.reduce((s,x)=>s+x.amount,0),progressState:{cutoff:'2026-09-15',mode:'manual'}});
 vm.runInContext(source.slice(source.indexOf('function buildProgressMessage'),source.indexOf('const progressOriginalSwitch')),context);
 const text=context.buildProgressMessage({actual:[{}],predicted:[{}],actualAmount:100000,predictedAmount:50000},150000,{amount:0});
 assert.match(text,/8월 이월금: -50,000원/);assert.match(text,/8월 초과금: 50,000원/);assert.match(text,/조정 합계: 0원/);assert.match(text,/선택한 날짜/);
});
test('legacy and modern class names share compact details without repeating teacher',()=>{
 const context=vm.createContext({parseSubjectInfo:name=>({mainName:name.split('-')[0],type:'김경석'})});
 vm.runInContext(source.slice(source.indexOf('function groupProgressReceipt'),source.indexOf('function renderProgressReceipt')),context);
 const row=className=>({className,teacher:'김경석',minutes:120,amount:220000,kind:'regular',date:'2026-09-12'});
 const group=context.groupProgressReceipt([row('국어-1:1(김경석)-1h'),row('국어-1:1-김경석')])[0].teachers[0];
 assert.equal(group.variants.size,1);assert.equal([...group.variants.values()][0].type,'1:1');assert.equal([...group.variants.values()][0].count,2);assert.equal(group.total,440000);
});
test('month invalidation settles before the first fetch request token',async()=>{
 const context=vm.createContext({progressRequest:0,progressLoading:false,progressStatus:'',staffAuthEpoch:1,progressState:{mode:'auto'},matchedStudent:()=>({id:'qa'}),progressMonth:()=>'2026-10',isServerConfigured:()=>true,progressBound:()=>false,progressToday:()=>'2026-09-16',ProgressCore:{validMonth:()=>true,validateSnapshot:x=>x,defaultCutoff:()=> '2026-10-01',monthEnd:()=> '2026-10-31'},getSupabaseClient:()=>({rpc:async()=>({data:{studentId:'qa',month:'2026-10',lessons:[]}})})});
 let first=true;context.renderProgress=()=>{if(first){first=false;context.progressRequest++;context.progressLoading=false;}};
 vm.runInContext(source.slice(source.indexOf('async function loadProgressLessons'),source.indexOf('function setProgressMode')),context);
 await context.loadProgressLessons();assert.equal(context.progressState.snapshot.month,'2026-10');assert.equal(context.progressLoading,false);assert.match(context.progressStatus,/저장된 수업이 없습니다/);
});
test('same-user auth retry preserves forecast; sign-out clears it',async()=>{
 const context=vm.createContext({handleStaffAuthState:async()=>{},previousStaffUid:'one',progressRequest:0,progressLoading:false,progressState:{snapshot:{studentId:'qa'},manual:[{date:'2026-09-21'}]}});
 vm.runInContext(source.slice(source.indexOf('const progressOriginalAuth'),source.indexOf('const progressOriginalSaveUi')),context);
 await context.handleStaffAuthState({state:'pending',user:{uid:'one'}});assert.equal(context.progressState.manual.length,1);
 await context.handleStaffAuthState({state:'signed-out',user:null});assert.equal(context.progressState.snapshot,null);
});
