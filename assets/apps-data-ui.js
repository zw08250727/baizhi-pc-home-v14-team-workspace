window.AppsDataUI = (() => {
  const M=AppsDataModel, E=AppsDataEditor, G=AppsGridTools, q=s=>document.querySelector(s);
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const value=x=>x===null||x===undefined?'—':typeof x==='boolean'?(x?'是':'否'):typeof x==='number'?x.toLocaleString('zh-CN'):esc(AppsFieldValues.raw(x));
  let state={user:'zhang',mode:'mine',app:null,scope:'mine',tab:'data',table:null,search:'',owner:'',department:'',agent:'',operation:'',historyTable:'',from:'',to:'',page:1};
  let root,lastRun=null,historySnapshot=[],loadedFingerprint='';
  const team=()=>document.body.dataset.workspace==='team';
  const personal=()=>document.body.dataset.edition==='personal'&&!team();
  const context=()=>({space:team()?'team':personal()?'personal':'enterprise',teamId:window.TeamWorkspace?.getActiveTeam?.()?.id||'team-demo'});
  const app=()=>M.apps.find(x=>x.id===state.app);
  const availableApps=()=>M.apps.filter(a=>M.allowed(state.user,a,team()?'team':'mine',context())||M.canManage(state.user,a,context()));
  const initialScope=a=>team()&&M.allowed(state.user,a,'team',context())?'team':a&&!M.allowed(state.user,a,'mine',context())&&M.canManage(state.user,a,context())?'all':'mine';
  const person=id=>`<span class="apps-person">${esc(M.users[id]?.name||id)}<small>${esc(M.users[id]?.department||'')}</small></span>`;
  const counts=cs=>`<span class="apps-mutations"><span>新增 ${cs.filter(c=>c.op==='新增').length}</span><span>修改 ${cs.filter(c=>c.op==='修改').length}</span><span>删除 ${cs.filter(c=>c.op==='删除').length}</span></span>`;
  const opts=(values,selected)=>values.map(([id,name])=>`<option value="${esc(id)}" ${id===selected?'selected':''}>${esc(name)}</option>`).join('');
  const resetFilters=()=>{G.reset();Object.assign(state,{search:'',owner:'',department:'',agent:'',operation:'',historyTable:'',from:'',to:'',page:1});};
  function navigate(id=null,scope=null,tab='data') {
    if(E.guard(()=>navigate(id,scope,tab))||ArtifactUI.guard(()=>navigate(id,scope,tab)))return;
    const a=M.apps.find(x=>x.id===id);
    state.app=a?.id||null;state.scope=initialScope(a);state.tab=tab;state.table=a?.tables[0]?.id||null;resetFilters();
    if(a&&!M.allowed(state.user,a,state.scope,context())){state.app=null;showToast('当前身份无权查看此应用数据');}
    showMainView('apps',{silent:true});document.querySelectorAll('.tree-folder-toggle.active,.knowledge-leaf.active,.apps-side-entry.active').forEach(x=>x.classList.remove('active'));render();
  }
  function nav() {
    const list=availableApps();
    q('#apps-nav-children').innerHTML=list.map(a=>`<button class="side-sub-item knowledge-leaf apps-side-entry ${state.app===a.id?'active':''}" type="button" data-app-open="${a.id}"><svg class="icon"><use href="#ico-folder"/></svg><span class="tree-folder-name">${esc(a.name)}</span><span class="tree-count">${a.tables.length}</span></button>`).join('');
    q('#apps-entry-count').textContent=String(list.length);
    q('#apps-entry').classList.toggle('active',!root.hidden);
    q('#apps-entry').setAttribute('aria-current',!root.hidden?'page':'false');
  }
  function head(title,description) {
    const crumb=state.app
      ? `<button type="button" data-app-back>应用数据</button><span>/</span><span>${esc(title)}</span>`
      : `<span>应用数据</span>`;
    return `<header class="apps-page-head"><div class="apps-heading"><div class="apps-breadcrumb"><button type="button" data-app-back>知识库</button><span>/</span>${crumb}</div><h1>${esc(title)}</h1><p>${esc(description)}</p></div><div class="apps-head-actions"><button class="apps-btn primary" type="button" data-app-refresh><span>刷新数据</span></button><button class="apps-btn" type="button" data-app-demo><span>模拟更新</span></button></div></header><div id="apps-new-data" class="apps-update" hidden><span>有新数据，刷新查看</span><button class="apps-link" data-app-refresh>刷新</button></div>`;
  }
  function empty(text,sub='') {return `<div class="apps-empty"><span class="apps-symbol">▦</span><strong>${esc(text)}</strong>${esc(sub)}</div>`;}
  function renderList() {
    const list=availableApps().filter(a=>a.name.includes(state.search)||a.description.includes(state.search));
    const copy=team()?'团队成员可查看应用数据；表 Owner、团队创建人或授权管理员可新增、编辑和删除记录。':M.apps.some(a=>M.canManage(state.user,a,context()))?'展示已使用及有权管理的应用；按表权限开放编辑':'仅展示我的数据，成功更新后自动加入应用';
    root.innerHTML=head('应用数据','查看 Agent 更新的业务数据与变更记录')+`<div class="apps-toolbar"><div class="apps-filter-group"><span class="apps-filter-copy">${copy}</span></div><label class="apps-search"><svg class="icon"><use href="#ico-search"/></svg><input type="search" data-app-filter="search" aria-label="搜索应用" placeholder="搜索应用名称" value="${esc(state.search)}"></label></div><div class="apps-panel">${list.length?`<div class="apps-table-scroll"><table class="apps-table"><thead><tr><th>应用名称</th><th>数据表</th><th>数据条数</th><th>最近更新时间</th><th>最近更新人</th></tr></thead><tbody>${list.map(a=>{
      const scope=initialScope(a),h=[M.latestActivity(state.user,a.id,scope,context())],total=a.tables.reduce((n,t)=>n+M.rows(state.user,a.id,t.id,scope,context()).length,0);
      return `<tr><td><button class="apps-link apps-name" data-app-open="${a.id}"><span class="apps-symbol">▦</span><span><strong>${esc(a.name)}</strong><small>${esc(a.description)}</small></span></button></td><td>${a.tables.length} 张表</td><td>${total} 条</td><td>${h[0]?.time||'—'}</td><td>${h[0]?person(h[0].actor):'—'}</td></tr>`;
    }).join('')}</tbody></table></div><div class="apps-footer">共 ${list.length} 个应用 · 按 App 展示，不按 Agent 分组</div>`:empty(state.search?'没有匹配的应用':'暂无应用数据',state.search?'试试其他应用名称':'运行带应用工具的 Agent 并成功更新数据后，应用将自动出现。')}</div>`;
  }
  function getHistory() {
    return M.history(state.user,state.app,state.scope,context()).filter(r=>(!state.agent||r.agent===state.agent)&&(!state.from||r.time.slice(0,10)>=state.from)&&(!state.to||r.time.slice(0,10)<=state.to)&&(!state.owner||r.actor===state.owner)).map(r=>({...r,changes:r.changes.filter(c=>(!state.historyTable||c.table===state.historyTable)&&(!state.operation||c.op===state.operation))})).filter(r=>r.changes.length);
  }
  function pageFooter(total) {
    const pages=Math.max(1,Math.ceil(total/7));state.page=Math.min(state.page,pages);
    return `<div class="apps-footer"><span>共 ${total} ${state.tab==='history'?'次更新':'条数据'} · 每页 7 条</span><div><button class="apps-btn" data-app-page="-1" ${state.page===1?'disabled':''}>上一页</button><span>${state.page} / ${pages}</span><button class="apps-btn" data-app-page="1" ${state.page===pages?'disabled':''}>下一页</button></div></div>`;
  }
  function filteredTableRows(a,table) {
    const all=M.rows(state.user,a.id,table.id,state.scope,context());
    const base=all.filter(r=>(!state.owner||r.owner===state.owner)&&(!state.department||M.users[r.owner]?.department===state.department)&&(!state.search||r.values.some(v=>String(v).toLowerCase().includes(state.search.toLowerCase()))));
    const rows=G.query(base,table);
    return {all,rows};
  }
  function downloadTable() {
    if(E.guard(downloadTable))return;
    M.reload();
    const a=app(),table=a?.tables.find(t=>t.id===state.table);
    if(!table||state.tab!=='data'||!M.allowed(state.user,a,state.scope,context())){showToast('当前没有下载此表的权限');return;}
    try {
      const {rows}=filteredTableRows(a,table);
      AppsTableExport.download(a,table,rows,M.users,false);
      showToast(`已下载「${table.name}」 · ${rows.length} 条记录（全部匹配结果）`);
    } catch { showToast('表格下载失败，请重试'); }
  }
  function renderDetail() {
    const a=app();if(!M.allowed(state.user,a,state.scope,context())){state.app=null;renderList();return;}
    const table=a.tables.find(t=>t.id===state.table)||a.tables[0];state.table=table.id;
    let body='';
    const fullHistory=M.history(state.user,a.id,state.scope,context());
    const wideScope=state.scope==='all'||state.scope==='team';
    const ownerIds=[...new Set(fullHistory.map(r=>r.actor))];
    const ownerFilter=state.tab==='history'&&wideScope?`<select aria-label="触发人" data-app-filter="owner">${opts([['','全部触发人'],...ownerIds.map(id=>[id,M.users[id]?.name||id])],state.owner)}</select>`:'';
    if(state.tab==='data'){
      const {all,rows}=filteredTableRows(a,table);
      const footer=G.footer(rows.length),slice=rows.slice((state.page-1)*7,state.page*7),tools=G.toolbar(table),queryPanel=G.queryPanel();
      const widths=table.fields.map(f=>/痛点|建议|行动|描述/.test(f[0])?180:/区域|等级|优先级|已联系/.test(f[0])?104:f[1]==='日期'?128:140);
      const writable=M.permissions(state.user,a.id,table.id,null,state.scope,context()).create;
      const accessHint=wideScope?'':`<span class="apps-caption apps-access-hint">表 owner 和获授权管理员可维护数据</span>`;
      const tableNav=`<aside class="apps-sheet-nav"><div class="apps-sheet-nav-heading">数据表 <span>${a.tables.length}</span></div><nav aria-label="应用内数据表">${a.tables.map(t=>`<button aria-pressed="${t.id===table.id}" class="${t.id===table.id?'active':''}" data-app-table="${t.id}"><svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="2" y="2.5" width="12" height="11" rx="1.5"/><path d="M2 6.5h12M6 6.5v7"/></svg><span title="${esc(t.name)}">${esc(t.name)}</span><em>${M.rows(state.user,a.id,t.id,state.scope,context()).length}</em></button>`).join('')}</nav></aside>`;
      body=`<div class="apps-data-layout">${tableNav}<section class="apps-sheet-content" aria-label="${esc(table.name)}"><div class="apps-sheet-heading"><div class="apps-sheet-heading-copy"><strong>${esc(table.name)}</strong><span class="apps-caption">${writable?'双击编辑 · Enter / 失焦保存 · Esc 取消':'只读 · 当前身份无编辑权限'}</span>${accessHint}</div><div class="apps-sheet-actions"><button class="apps-btn apps-download-btn" type="button" data-app-download title="下载当前权限和筛选条件下的全部记录"><svg class="icon" aria-hidden="true"><use href="#ico-download"/></svg><span>下载表格</span></button>${writable?'<button class="apps-btn primary" type="button" data-edit-create>新增记录</button>':''}</div></div><div class="apps-toolbar"><div class="apps-filter-group">${wideScope?`<select data-app-filter="department" aria-label="部门">${opts([['','全部部门'],...[...new Set(all.map(r=>M.users[r.owner]?.department).filter(Boolean))].map(d=>[d,d])],state.department)}</select>`:''}${tools}</div><label class="apps-search"><svg class="icon"><use href="#ico-search"/></svg><input type="search" aria-label="搜索表格数据" data-app-filter="search" placeholder="搜索表格内容" value="${esc(state.search)}"></label></div>${queryPanel}${E.banner()}<div class="apps-table-scroll apps-grid-scroll"><table class="apps-table apps-data-grid" style="width:${44+widths.reduce((n,w)=>n+w,0)+170+158+106}px"><colgroup><col style="width:44px">${widths.map(w=>`<col style="width:${w}px">`).join('')}<col style="width:170px"><col style="width:158px"><col style="width:106px"></colgroup><thead><tr><th scope="col">#</th>${table.fields.map(f=>`<th scope="col">${esc(f[0])}<small>${esc(f[1])}</small></th>`).join('')}<th scope="col">数据所属人</th><th scope="col">更新时间</th><th scope="col" class="apps-row-operation">操作</th></tr></thead><tbody>${slice.map((r,i)=>`<tr><td class="apps-readonly-cell" aria-readonly="true">${(state.page-1)*7+i+1}</td>${E.cells(r,table,value)}<td class="apps-readonly-cell" aria-readonly="true">${person(r.owner)}</td><td class="apps-time-cell apps-readonly-cell" aria-readonly="true">${esc(r.updated)}</td>${E.actions(r)}</tr>`).join('')}</tbody></table>${!rows.length?empty('当前范围暂无记录',state.search||state.owner||state.department?'请调整筛选条件':'Agent 更新这张表后，可在这里查看。'):''}</div>${footer}</section></div>`;
    }else{
      historySnapshot=getHistory();const footer=pageFooter(historySnapshot.length),slice=historySnapshot.slice((state.page-1)*7,state.page*7);
	      body=`<div class="apps-toolbar"><div class="apps-filter-group">${ownerFilter}<select data-app-filter="agent" aria-label="Agent">${opts([['','全部 Agent'],...[...new Set(fullHistory.map(r=>r.agent))].map(n=>[n,n])],state.agent)}</select><select data-app-filter="historyTable" aria-label="历史数据表">${opts([['','全部数据表'],...a.tables.map(t=>[t.id,t.name])],state.historyTable)}</select><select data-app-filter="operation" aria-label="变更类型">${opts([['','全部变更类型'],...['新增','修改','删除'].map(x=>[x,x])],state.operation)}</select><input type="date" aria-label="开始日期" data-app-filter="from" value="${state.from}"><span class="apps-caption">至</span><input type="date" aria-label="结束日期" data-app-filter="to" value="${state.to}"></div><button class="apps-link" data-app-clear>清空筛选</button></div><div class="apps-panel"><div class="apps-table-scroll"><table class="apps-table"><thead><tr><th>更新时间 / 任务</th><th>触发人</th><th>Agent</th><th>执行状态</th><th>数据变更<small>当前筛选范围 · 行变更次数</small></th><th></th></tr></thead><tbody>${slice.map(r=>`<tr><td>${esc(r.time)}<small style="display:block;color:#8d98a9;max-width:210px;white-space:normal">${esc(r.title)}</small></td><td>${person(r.actor)}</td><td>${esc(r.agent)}</td><td><span class="apps-pill ${r.status==='失败'?'warn':''}">${r.status==='失败'?'执行失败':'执行成功'}</span>${r.status==='失败'?'<small style="display:block;color:#af8957">部分数据已提交</small>':''}</td><td>${counts(r.changes)}<small class="apps-caption">${[...new Set(r.changes.map(c=>a.tables.find(t=>t.id===c.table)?.name))].map(esc).join('、')}</small></td><td><button class="apps-link" data-app-history="${r.id}">查看变更</button></td></tr>`).join('')}</tbody></table>${!slice.length?empty('没有匹配的更新记录','只展示已实际提交的数据变更。'):''}</div>${footer}</div>`;
    }
    const scopeButtons='';
    const scopeNote=state.scope==='team'?'当前团队可见数据':state.scope==='all'?'授权管理范围内数据':'当前身份关联数据';
    root.innerHTML=head(a.name,a.description)+`${scopeButtons?`<div class="apps-scope">${scopeButtons}<span class="apps-caption">${scopeNote}</span></div>`:''}<div class="apps-segment"><button data-app-tab="data" class="${state.tab==='data'?'active':''}">数据表</button><button data-app-tab="history" class="${state.tab==='history'?'active':''}">更新历史</button></div>${body}<p class="apps-caption">最近读取：${new Date().toLocaleString('zh-CN',{hour12:false})} · 当前为已提交数据 · 按表权限开放编辑</p>`;
  }
  function fingerprint() {
    const items=state.app?[app()]:availableApps();
    return JSON.stringify([M.revision(),items.filter(Boolean).map(a=>[a.id,M.history(state.user,a.id,state.app?state.scope:initialScope(a),context())])]);
  }
  function render() {if(state.app)renderDetail();else renderList();nav();loadedFingerprint=fingerprint();}
  function detail(id) {
    const run=historySnapshot.find(r=>r.id===id);if(!run){showToast('当前范围内没有这次更新记录');return;}
    const a=app(),d=q('#apps-history-dialog');
    d.innerHTML=`<div class="apps-detail-heading"><div><h2>本次数据变更</h2><p>${esc(a.name)} · 当前可见范围</p></div><button class="apps-btn" data-app-close>关闭</button></div><div class="apps-detail-meta"><div><small>任务</small>${esc(run.title)}</div><div><small>执行状态</small>${run.status==='失败'?'执行失败 · 已提交部分数据':'执行成功'}</div><div><small>触发人</small>${person(run.actor)}</div><div><small>Agent</small>${esc(run.agent)}</div><div><small>提交时间</small>${esc(run.time)}</div><div><small>运行标识</small>${esc(run.id)}</div></div><div class="apps-title-row">${counts(run.changes)}<button class="apps-link" data-app-task="${run.id}">查看本次任务</button></div><p>按实际行变更次数统计；同一行多次修改分别记录。这里保留当时的值，不随最新数据变化。</p>${run.changes.map(c=>{
      const t=a.tables.find(t=>t.id===c.table);return `<section class="apps-change"><div class="apps-change-head"><span class="apps-pill ${c.op==='删除'?'warn':''}">${c.op}</span><strong>${esc(t.name)}</strong><small>#${c.sequence} · ${esc(c.id)}</small></div><div style="padding:10px 14px;color:#8894a6;font-size:11px">数据所属人：${esc(M.users[c.owner].name)} · ${esc(c.time)}</div><table class="apps-diff"><thead><tr><th>字段</th><th>修改前</th><th>修改后</th></tr></thead><tbody>${t.fields.map((f,i)=>c.before&&c.after&&c.before[i]===c.after[i]?'':`<tr><td>${esc(f[0])}</td><td>${c.before?value(c.before[i]):'不存在'}</td><td>${c.after?value(c.after[i]):'已删除'}</td></tr>`).join('')}</tbody></table></section>`;
    }).join('')}`;d.showModal();
  }
  function task(run) {
    if(!run)return;
    if(!M.taskFor(state.user,run.id)){showToast('暂无该任务的查看权限，仍可查看当前应用的数据变更');return;}
    sessionStorage.setItem('apps-history-return',JSON.stringify({state,run:run.id}));
    const query=new URLSearchParams({edition:document.body.dataset.edition==='personal'?'personal':'enterprise',workspace:team()?'team':'',agent:run.agent,run:run.id,app:state.app||'',scope:state.scope,from:'apps-history'});
    window.top.location.href='agent.html?'+query;
  }
  function demo() {
    q('#apps-demo-dialog').innerHTML=`<h2>演示设置</h2><p>仅用于原型评审。切换身份不会修改真实账号，执行场景不会调用真实 Agent。</p><label>当前身份<select id="apps-demo-user">${opts(Object.entries(M.users).map(([id,u])=>[id,`${u.name} · ${u.role}`]),state.user)}</select></label><label>模拟任务<select id="apps-demo-scenario"><option value="update">商机复盘 Agent → 更新销售洞察</option><option value="multi">销售洞察 Agent → 同时更新销售洞察、客户商机</option><option value="first">交付跟踪 Agent → 成功写入项目交付</option><option value="read">只读成功 → 不新增应用</option><option value="failed">项目交付写入后失败 → 不新增应用</option></select></label><p>新成员许安初始没有应用数据。陈琳创建了销售洞察和客户商机；李敏是本企业管理员。</p><footer><button class="apps-btn" data-app-close>取消</button><button class="apps-btn" data-app-identity>切换身份</button><button class="apps-btn primary" data-app-simulate>模拟执行</button></footer>`;q('#apps-demo-dialog').showModal();
  }
  function identity() {
    state.user=q('#apps-demo-user').value;state.mode='mine';state.app=null;resetFilters();
    sessionStorage.setItem('apps-demo-user',state.user);
  }
  function init() {
    document.body.classList.add('app-data-mode');
    state.user=sessionStorage.getItem('apps-demo-user')||'zhang';if(!M.users[state.user])state.user='zhang';
	    mainViewTitles.apps='知识库';
	    q('.main').insertAdjacentHTML('beforeend','<section class="apps-workspace" data-main-view="apps" hidden aria-label="应用数据工作台"></section>');root=q('.apps-workspace');
    q('#knowledge-side-list').insertAdjacentHTML('beforeend','<div class="knowledge-tree-node apps-nav"><button id="apps-entry" class="tree-folder-toggle apps-side-entry" type="button" aria-expanded="true" aria-controls="apps-nav-children"><svg class="icon tree-chevron"><use href="#ico-chevron"/></svg><svg class="icon tree-folder-icon"><use href="#ico-folder"/></svg><span class="tree-folder-name">应用数据</span><span class="tree-count" id="apps-entry-count">0</span></button><div id="apps-nav-children" class="knowledge-tree-children apps-nav-children"></div></div>');
    // Keep the app-data root above the Contacts first-level entry in the
    // knowledge tree. The entry is wrapped by the shell after static markup
    // is prepared, so insert before its row when available.
    const contactsRow=q('[data-contacts-entry]')?.closest('.knowledge-tree-leaf-row');
    (contactsRow||q('[data-contacts-entry]')||q('.knowledge-sidebar-tools')).before(q('.apps-nav'));
    document.body.insertAdjacentHTML('beforeend','<dialog id="apps-history-dialog" class="apps-dialog apps-drawer" aria-label="本次数据变更"></dialog><dialog id="apps-demo-dialog" class="apps-dialog" aria-label="演示设置"></dialog>');
    q('#apps-entry').onclick=()=>{const children=q('#apps-nav-children');const expanded=q('#apps-entry').getAttribute('aria-expanded')==='true';children.classList.toggle('hide',expanded);q('#apps-entry').setAttribute('aria-expanded',String(!expanded));navigate();};
    document.addEventListener('click',event=>{
      const b=event.target.closest('button');if(!b)return;const d=b.dataset;
      if('appOpen'in d)navigate(d.appOpen);
      else if('appBack'in d)navigate();
      else if('appMode'in d){state.mode=d.appMode;state.search='';render();}
      else if('appTab'in d){state.tab=d.appTab;resetFilters();render();}
      else if('appTable'in d){state.table=d.appTable;resetFilters();render();}
      else if('appPage'in d){state.page+=Number(d.appPage);render();}
      else if('appClear'in d){resetFilters();render();}
      else if('appHistory'in d)detail(d.appHistory);
      else if('appDownload'in d)downloadTable();
      else if('appTask'in d)task(historySnapshot.find(r=>r.id===d.appTask));
      else if('appDemo'in d)demo();
      else if('appClose'in d)b.closest('dialog').close();
      else if('appIdentity'in d){identity();q('#apps-demo-dialog').close();navigate();}
      else if('appSimulate'in d){const scenario=q('#apps-demo-scenario').value;const changed=state.user!==q('#apps-demo-user').value;if(changed)identity();lastRun=M.run(state.user,scenario,context());q('#apps-demo-dialog').close();if(changed)navigate();task(lastRun);if(q('#apps-new-data'))q('#apps-new-data').hidden=fingerprint()===loadedFingerprint;nav();}
      else if('appRefresh'in d){M.reload();render();showToast('已读取当前范围的最新数据');}
      else if('appResult'in d){document.querySelectorAll('.apps-dialog[open]').forEach(x=>x.close());navigate(d.appResult,d.scope,d.run?'history':'data');if(d.run)detail(d.run);}
    });
    root.addEventListener('change',event=>{const name=event.target.dataset.appFilter;if(name){state[name]=event.target.value;state.page=1;render();}});
    root.addEventListener('input',event=>{if(event.target.dataset.appFilter!=='search')return;const cursor=event.target.selectionStart;state.search=event.target.value;state.page=1;render();const next=q('[data-app-filter="search"]');next?.focus();next?.setSelectionRange(cursor,cursor);});
    window.addEventListener('storage',e=>{if(e.key!==M.key)return;M.reload();if(!root.hidden&&fingerprint()!==loadedFingerprint)q('#apps-new-data').hidden=false;});
    E.init(()=>({user:state.user,appId:state.app,table:state.table,scope:state.scope,access:context()}),reset=>{if(reset)resetFilters();render();});
    G.init(()=>state,render,root);
    nav();
  }
  function openRun(id) { if(!state.app)return;state.tab='history';resetFilters();render();detail(id); }
  function restoreHistory(id) {
    try {
      const saved=JSON.parse(sessionStorage.getItem('apps-history-return'));
      if(saved?.run===id&&saved.state.app===state.app&&saved.state.user===state.user) {
        const next=saved.state;
        if(M.allowed(state.user,app(),next.scope,context())){state={...next,tab:'history'};render();detail(id);return;}
      }
    } catch {}
    openRun(id);
  }
  return {init,navigate,openRun,restoreHistory,state:()=>({...state})};
})();
