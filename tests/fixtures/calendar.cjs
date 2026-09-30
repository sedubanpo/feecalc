(function(root){
  const templates=[
    {id:'science3',subject:'과학',teacher:'강사 A',hours:3,rate:87500,dates:[9,16,23,30]},
    {id:'science4',subject:'과학',teacher:'강사 A',hours:4,rate:112500,dates:[2]},
    {id:'korean3',subject:'국어',teacher:'강사 B',hours:3,rate:87500,dates:[3,6,10,13,17,20,24,27]},
    {id:'math2c',subject:'수학',teacher:'강사 C',hours:2,rate:62500,dates:[10,17,24]},
    {id:'math3d',subject:'수학',teacher:'강사 D',hours:3,rate:87500,dates:[]},
    {id:'math4d',subject:'수학',teacher:'강사 D',hours:4,rate:112500,dates:[6,13,20,27]},
    {id:'math4c',subject:'수학',teacher:'강사 C',hours:4,rate:112500,dates:[1,5,8,12,15,19,22,26,29]},
    {id:'english2',subject:'영어',teacher:'강사 E',hours:2,rate:62500,dates:[15,22,29]},
    {id:'english3',subject:'영어',teacher:'강사 E',hours:3,rate:87500,dates:[11,18,25]}
  ].map(t=>({...t,type:'개별',unit:'회당'}));
  function planned(){return {kind:'planned',month:9,title:'다과목 월 계산',templates:structuredClone(templates),adjustments:[{label:'전월 이월금',amount:-362500}],events:templates.flatMap(t=>t.dates.map(day=>({id:t.id+'-'+day,templateId:t.id,subject:t.subject,teacher:t.teacher,type:t.type,day,hours:t.hours,amount:t.rate,status:'예정',start:null,end:null}))) };}
  function historical(){
    const defs={m2:['수학','강사 D',2,62500],m3:['수학','강사 D',3,87500],c3:['수학','강사 C',3,87500],c2:['수학','강사 C',2,62500],k3:['국어','강사 B',3,87500],k4:['국어','강사 B',4,112500],s2:['사탐','강사 F',2,62500],s3:['사탐','강사 G',3,120000],e2:['영어','강사 E',2,62500],e3:['영어','강사 E',3,87500]};
    const lines=[
      [1,'m2',10],[1,'k3',13],[1,'s2',16],[2,'m3',10],[3,'c3',14],[3,'k4',18],
      [4,'m3',10],[4,'e3',14],[5,'m3',10],[5,'s2',15],[6,'c3',10],[6,'e2',14],[7,'c3',10],[7,'e3',14],
      [8,'m2',10],[8,'k3',13],[8,'s2',16],[9,'m3',10],[10,'c3',14],[10,'k4',18],
      [11,'m3',10,'지각',1,29167],[11,'m3',11,'출석',2,58333],[11,'e3',14],
      [12,'m3',10,'지각',1,29167],[12,'m3',11,'출석',2,58333],[12,'s2',15],
      [13,'c3',10],[13,'e2',14],[14,'c3',10],[14,'e3',14],[15,'k3',13],[15,'s2',16],
      [16,'m3',10],[17,'c3',14],[17,'k4',18],[18,'e2',17],[18,'c2',19],
      [21,'e2',17],[21,'s2',19],[22,'m2',10],[22,'k3',13],[22,'s2',16],
      [23,'m3',10,'지각',1,29167],[23,'m3',11,'출석',2,58333],[24,'k4',18],
      [25,'e2',18,'당일취소'],[25,'c2',20,'당일취소'],[27,'c2',18],[27,'e2',20],
      [28,'e2',17],[28,'s2',19],[29,'m2',10,'당일취소'],[29,'k3',13],[29,'s2',16],
      [30,'m3',10,'결석예고',0,0],[30,'s3',19],[31,'k4',18]
    ];
    return {kind:'history',month:8,title:'다수업·분할 이력',templates:[],adjustments:[{label:'전월 초과금',amount:87500},{label:'기납부액',amount:-4237500}],events:lines.map(([day,key,start,status='출석',hours,amount],index)=>{const [subject,teacher,h,a]=defs[key];return {id:'history-'+index,templateId:key,subject,teacher,type:key==='s3'?'특강':'개별',day,hours:hours??h,amount:amount??a,status,start,end:start+(hours||h),sourceHours:h,sourceHourly:key==='m3'?29167:null};})};
  }
  function totals(state){const active=state.events.filter(e=>e.status!=='결석예고');const subtotal=active.reduce((s,e)=>s+e.amount,0);return {count:active.length,hours:active.reduce((s,e)=>s+e.hours,0),subtotal,total:subtotal+state.adjustments.reduce((s,a)=>s+a.amount,0),absences:state.events.length-active.length};}
  function apply(state,templateId,days,operation,override={},allowDuplicate=false){
    if(state.kind!=='planned')throw Error('실제 이력은 읽기 전용입니다.');
    const t=state.templates.find(t=>t.id===templateId);if(!t)throw Error('수업 조건을 선택하세요.');
    if(days.some(d=>!Number.isInteger(d)||d<1||d>30))throw Error('해당 월의 날짜를 선택하세요.');
    const selected=new Set(days), next=structuredClone(state);let changed=0,skipped=0;
    if(operation==='add'){
      for(const day of selected){if(!allowDuplicate&&next.events.some(e=>e.templateId===templateId&&e.day===day)){skipped++;continue;}
        next.events.push({id:'added-'+day+'-'+next.events.length,templateId,subject:t.subject,teacher:t.teacher,type:t.type,day,hours:t.hours,amount:t.rate,status:'예정',start:null,end:null});changed++;}
    }else if(operation==='remove'){
      next.events=next.events.filter(e=>{if(e.templateId===templateId&&selected.has(e.day)){changed++;return false;}return true;});
    }else if(operation==='replace'){
      if(!(Number.isFinite(override.hours)&&override.hours>0&&override.hours<=24&&Number.isFinite(override.amount)&&override.amount>=0))throw Error('변경할 시수와 회당 금액을 확인하세요.');
      for(const e of next.events)if(e.templateId===templateId&&selected.has(e.day)){e.hours=override.hours;e.amount=Math.round(override.amount);e.overridden=true;changed++;}
    }else throw Error('지원하지 않는 동작입니다.');
    return {state:next,changed,skipped};
  }
  const api={planned,historical,totals,apply};if(typeof module!=='undefined')module.exports=api;else root.FeeUX=api;
})(typeof window!=='undefined'?window:{});
