/* Prototype data only. Production must filter rows and audit details on the server. */
window.AppsDataModel = (() => {
  const key = 'baizhi-apps-data-v2';
  const clone = x => JSON.parse(JSON.stringify(x));
  const users = {
    zhang:{name:'张伟',department:'AI2C_BU / 销售运营部',role:'成员'},
    zhou:{name:'周宁',department:'AI2C_BU / 华东销售部',role:'成员'},
    chen:{name:'陈琳',department:'AI2C_BU / AI2C产品组',role:'应用创建者'},
    li:{name:'李敏',department:'AI2C_BU / 企业管理部',role:'企业管理员'},
    new:{name:'许安',department:'AI2C_BU / 客户交付部',role:'新成员'}
  };
  const apps = [
    {id:'sales',name:'销售洞察',description:'沉淀客户画像、商机进展与周期汇总，持续跟踪销售变化。',creator:'chen',tables:[
      {id:'customers',name:'客户画像',fields:[['客户名称','文本'],['所在区域','文本'],['需求痛点','文本'],['客户等级','文本']]},
      {id:'opportunities',name:'商机跟进',fields:[['商机名称','文本'],['阶段','文本'],['预计金额','数值'],['下次跟进','日期']]},
      {id:'weekly',name:'周期汇总',fields:[['统计周期','文本'],['有效商机','整数'],['成交金额','数值'],['行动建议','文本']]}
    ]},
    {id:'leads',name:'客户商机',description:'归集客户线索与跟进动作，供多个销售 Agent 共用。',creator:'chen',tables:[
      {id:'leads',name:'客户线索',fields:[['企业名称','文本'],['线索来源','文本'],['优先级','文本'],['已联系','布尔']]},
      {id:'actions',name:'跟进计划',fields:[['客户名称','文本'],['下一步行动','文本'],['计划日期','日期']]}
    ]},
    {id:'delivery',name:'项目交付',description:'跟踪交付项目、里程碑与待解决问题。',creator:'li',tables:[
      {id:'projects',name:'项目清单',fields:[['项目名称','文本'],['进度','文本'],['计划验收','日期']]},
      {id:'risks',name:'风险记录',fields:[['项目名称','文本'],['风险描述','文本'],['级别','文本']]}
    ]}
  ];
  let db;
  const stamp = n => `2026-09-${String(6 + Math.floor(n/20)).padStart(2,'0')} ${String(9 + Math.floor(n%20/4)).padStart(2,'0')}:${String((n*7)%60).padStart(2,'0')}`;
  function apply(run,app,table,owner,op,id,values) {
    const rows = db.rows[app][table], index = rows.findIndex(x=>x.id===id);
    const before = index < 0 ? null : clone(rows[index].values);
    if (op !== '新增' && index < 0) return;
    if (op === '修改' && JSON.stringify(before)===JSON.stringify(values)) return;
    if (op === '新增') rows.push({id,owner,values:clone(values),updated:run.time});
    if (op === '修改') rows[index]={...rows[index],values:clone(values),updated:run.time};
    if (op === '删除') rows.splice(index,1);
    run.changes.push({app,table,owner,op,id,before,after:op==='删除'?null:clone(values),time:run.time,sequence:run.changes.length+1});
  }
  function finish(run) {
    db.runs.unshift(run); db.revision++;
    if(run.status==='成功') [...new Set(run.changes.map(c=>c.app))].forEach(a=>{
      const list=db.visible[run.actor] ||= [];if(!list.includes(a))list.push(a);
    });
  }
  function seed() {
    db={revision:1,rows:{},runs:[],visible:{},counter:0};
    apps.forEach(a=>{db.rows[a.id]={};a.tables.forEach(t=>db.rows[a.id][t.id]=[]);});
    ['zhang','zhou','chen','li'].forEach((owner,u)=>{
      const run={id:`run-seed-${owner}`,actor:owner,agent:'销售洞察 Agent',title:'整理客户画像与销售进展',time:stamp(u*5),status:'成功',trigger:'手动执行',changes:[]};
      for(let i=0;i<9;i++)apply(run,'sales','customers',owner,'新增',`${owner}-c${i}`,[['东辰商业','华悦零售','苏城百货','海岸生活','嘉禾商贸','融兴科技','辰星电子','明远集团','云锦零售'][i],['上海','杭州','南京'][i%3],['统一门店数据','提高线索转化','降低培训成本'][i%3],i%3===0?'重点客户':'潜力客户']);
      apply(run,'sales','opportunities',owner,'新增',`${owner}-o1`,['门店销售数字化','需求确认',280000,'2026-09-15']);
      apply(run,'sales','weekly',owner,'新增',`${owner}-w1`,['2026 第 36 周',8,520000,'优先推进重点客户试点']);
      apply(run,'leads','leads',owner,'新增',`${owner}-l1`,['东辰商业','销售录音','高',false]);
      finish(run);
    });
    const changed={id:'run-0908-review',actor:'zhang',agent:'商机复盘 Agent',title:'复盘华东销售商机，更新客户跟进状态',time:'2026-09-08 16:25',status:'成功',trigger:'手动执行',changes:[]};
    apply(changed,'sales','opportunities','zhang','修改','zhang-o1',['门店销售数字化','方案报价',350000,'2026-09-12']);
    apply(changed,'sales','customers','zhang','删除','zhang-c8');
    apply(changed,'sales','weekly','zhang','修改','zhang-w1',['2026 第 36 周',9,620000,'本周安排报价评审']);finish(changed);
    const fail={id:'run-0909-partial',actor:'zhou',agent:'销售洞察 Agent',title:'补充上海客户画像',time:'2026-09-09 10:40',status:'失败',trigger:'手动执行',changes:[]};
    apply(fail,'sales','customers','zhou','修改','zhou-c0',['东辰商业','上海','本月完成试点验证','重点客户']);finish(fail);
    const deliver={id:'run-0909-delivery',actor:'li',agent:'交付跟踪 Agent',title:'更新项目交付进展',time:'2026-09-09 15:20',status:'成功',trigger:'手动执行',changes:[]};
    apply(deliver,'delivery','projects','li','新增','li-p1',['门店数据试点','实施中','2026-09-30']);finish(deliver);
    db.runs.sort((a,b)=>b.time.localeCompare(a.time));
  }
  function persist() { try { localStorage.setItem(key,JSON.stringify(db)); } catch {} }
  try { db=JSON.parse(localStorage.getItem(key)); } catch {}
  if(!db || !db.rows || !db.visible || !db.counter && db.counter!==0){seed();persist();}
  const canManage=(user,app,personal=false)=>!!app && (app.creator===user || (!personal&&user==='li'));
  const allowed=(user,app,scope,personal=false)=>scope==='all'?canManage(user,app,personal):(db.visible[user]||[]).includes(app?.id);
  function list(user,mode,personal=false) { return apps.filter(a=>allowed(user,a,mode==='managed'?'all':'mine',personal)); }
  function rows(user,appId,table,scope,personal=false) {
    const app=apps.find(a=>a.id===appId);
    if(!allowed(user,app,scope,personal))return [];
    return clone(db.rows[appId][table]||[]).filter(r=>scope==='all'||r.owner===user);
  }
  function history(user,appId,scope,personal=false) {
    if(!allowed(user,apps.find(a=>a.id===appId),scope,personal))return [];
    return clone(db.runs).map(r=>({...r,changes:r.changes.filter(c=>c.app===appId&&(scope==='all'||c.owner===user))})).filter(r=>r.changes.length);
  }
  function run(user,scenario) {
    const id=++db.counter,time=new Date().toLocaleString('sv-SE',{timeZone:'Asia/Shanghai'}).slice(0,16);
    const run={id:`run-demo-${id}`,actor:user,agent:scenario==='multi'?'销售洞察 Agent':scenario==='first'?'交付跟踪 Agent':'商机复盘 Agent',title:scenario==='first'?'更新项目交付数据':scenario==='read'?'读取销售数据进行分析':'刷新客户与销售进展',time,status:scenario==='failed'?'失败':'成功',trigger:'手动执行',changes:[]};
    if(scenario==='first'||scenario==='failed')apply(run,'delivery','projects',user,'新增',`${user}-p${id}`,['销售协同试点 '+id,'实施中','2026-10-15']);
    else if(scenario!=='read'){
      const current=db.rows.sales.customers.find(x=>x.owner===user);
      if(current)apply(run,'sales','customers',user,'修改',current.id,[...current.values.slice(0,2),'已完成第 '+id+' 次客户回访',current.values[3]]);
      else apply(run,'sales','customers',user,'新增',`${user}-dc${id}`,['远景零售','上海','建设销售数据看板','潜力客户']);
      apply(run,'sales','opportunities',user,'新增',`${user}-do${id}`,['新增试点商机 '+id,'需求确认',180000+id*1000,'2026-10-01']);
      if(scenario==='multi')apply(run,'leads','actions',user,'新增',`${user}-da${id}`,['远景零售','安排产品演示','2026-09-18']);
    }
    finish(run);persist();return clone(run);
  }
  function reset(){seed();persist();}
  // Prototype task ACL: only the initiator has a task-detail grant. App access alone is not a task grant.
  function taskFor(user,id){const task=db.runs.find(r=>r.id===id&&r.actor===user);return task?clone(task):null;}
  function reload(){try{const data=JSON.parse(localStorage.getItem(key));if(data?.rows)db=data;}catch{}}
  return {users,apps,list,rows,history,canManage,allowed,taskFor,run,reset,reload,key,revision:()=>db.revision,visible:user=>[...(db.visible[user]||[])]};
})();
