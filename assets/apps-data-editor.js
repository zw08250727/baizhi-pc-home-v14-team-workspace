/* Local interaction prototype. Real permissions and mutations must be enforced by the Apps service. */
window.AppsDataEditor = (() => {
  const M=AppsDataModel,$=s=>document.querySelector(s);
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let draft=null,context,redraw,pending=null,deleteTarget=null;
  const dirty=()=>!!draft&&JSON.stringify(draft.values)!==JSON.stringify(draft.original);
  const definition=c=>M.apps.find(a=>a.id===c.appId)?.tables.find(t=>t.id===c.table);
  const permissions=row=>M.permissions(context().user,context().appId,context().table,row,context().scope,context().access);
  const icon='<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M3 5h14M7 5V3h6v2M5 5l1 12h8l1-12M8 8v6m4-6v6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const active=id=>draft?.kind==='update'&&draft.id===id;
  function control(field,index,raw,drawer=false){
    const [name,type,config={}]=field,attrs=`data-edit-field="${index}" aria-label="${esc(name)}" ${config.required?'required':''}`;
    let input;
    if(type==='布尔')input=`<select ${attrs}><option value="">未填写</option><option value="true" ${String(raw)==='true'?'selected':''}>是</option><option value="false" ${String(raw)==='false'?'selected':''}>否</option></select>`;
    else if(type==='JSON'||/痛点|建议|行动|描述/.test(name))input=`<textarea ${attrs} rows="${type==='JSON'?4:drawer?3:2}" ${type==='JSON'?'spellcheck="false" placeholder=\'{"渠道":"电话"}\'':''}>${esc(raw)}</textarea>`;
    else input=`<input ${attrs} type="${AppsFieldValues.inputType(type)}" ${type==='整数'?'step="1"':type==='数值'?'step="any"':''} value="${esc(raw)}">`;
    return `<div class="apps-editor-cell">${input}<small class="apps-field-error" data-field-error="${index}" hidden></small></div>`;
  }
  function cells(row,table,format){
    const editable=permissions(row).update;
    return row.values.map((v,j)=>{const editing=active(row.id)&&draft.field===j;return `<td class="${editable?'apps-editable-cell':'apps-readonly-cell'} ${editing?'apps-cell-editing':''}" ${editable?`data-edit-cell="${esc(row.id)}" data-cell-index="${j}" tabindex="0" title="双击编辑 · Enter 保存 · Esc 取消" aria-label="${esc(row.values[0])} · ${esc(table.fields[j][0])}"`:`aria-readonly="true" title="只读：${row.owner!==context().user?'当前身份没有此表编辑权限':'此表未开放人工修改'}"`}>${editing?control(table.fields[j],j,draft.values[j]):format(v)}</td>`;}).join('');
  }
  function actions(row){
    const p=permissions(row);
    return `<td class="apps-row-operation">${p.delete?`<div class="apps-row-actions"><button class="apps-trash" data-delete-row="${row.id}" aria-label="删除 ${esc(row.values[0])}" title="删除">${icon}</button></div>`:p.update?'<span class="apps-caption">—</span>':`<span class="apps-row-readonly" title="${row.owner!==context().user?'当前身份没有此表编辑权限':'这张表未开放人工修改'}">只读</span>`}</td>`;
  }
  function banner(){return draft?.kind==='update'?'<div class="apps-editor-error" id="apps-inline-error" role="alert" hidden></div>':'';}
  function closeDraft(reset=false){draft=null;$('#apps-create-dialog')?.close();redraw(reset);}
  function guard(action){
    if(!draft)return false;
    if(draft.kind==='update'&&save())return false;
    if(!dirty()){closeDraft();return false;}
    pending=action;
    const modal=$('#apps-leave-dialog');if(!modal.open)modal.showModal();return true;
  }
  function start(id,field=0){
    if(active(id)&&draft.field===field)return;
    if(guard(()=>start(id,field)))return;
    const c=context(),table=definition(c),row=id?M.rows(c.user,c.appId,c.table,c.scope,c.access).find(r=>r.id===id):null;
    if(!permissions(row)[id?'update':'create']){showToast('当前没有操作权限');return;}
    const values=id?row.values.map((v,i)=>table.fields[i][1]==='JSON'&&v!==null?JSON.stringify(v,null,2):AppsFieldValues.raw(v)):table.fields.map(()=> '');
    draft={kind:id?'update':'create',id,field,context:{...c},version:row?.version||row?.updated,values:[...values],original:[...values],rawValues:row?.values};
    if(id){redraw();$(`[data-edit-field="${field}"]`)?.focus();}
    else{
      $('#apps-create-dialog').innerHTML=`<header><div class="apps-caption">${esc(M.apps.find(a=>a.id===c.appId).name)} / ${esc(table.name)}</div><div class="apps-detail-heading"><h2>新增记录</h2><button class="apps-icon-close" data-edit-cancel aria-label="关闭新增记录">×</button></div><p>填写记录内容，保存后加入当前数据表。</p></header><div class="apps-create-fields">${table.fields.map((f,i)=>`<label><span>${esc(f[0])}${f[2]?.required?'<em>*</em>':''}<small>${esc(f[1])}</small></span>${control(f,i,'',true)}</label>`).join('')}<div class="apps-create-owner"><span>数据所属人</span><strong>${esc(M.users[c.user].name)}</strong><small>${esc(M.users[c.user].department)}</small></div><div class="apps-editor-error" id="apps-create-error" role="alert" hidden></div></div><footer><button class="apps-btn" data-edit-cancel>取消</button><button class="apps-btn primary" data-edit-save>保存记录</button></footer>`;
      $('#apps-create-dialog').showModal();$('#apps-create-dialog [data-edit-field]')?.focus();
    }
  }
  function validate(){
    const table=definition(draft.context),values=[],errors=[];
    table.fields.forEach((field,i)=>{
      if(draft.kind==='update'&&i!==draft.field){values.push(draft.rawValues[i]);errors.push('');return;}
      let v=null,error='';try{v=AppsFieldValues.parse(field,draft.values[i]);}catch(e){error=e.message;}
      values.push(v);errors.push(error);
    });
    const container=draft.kind==='create'?$('#apps-create-dialog'):$('.apps-workspace');
    errors.forEach((error,i)=>{const node=container.querySelector(`[data-field-error="${i}"]`);if(node){node.hidden=!error;node.textContent=error;}container.querySelector(`[data-edit-field="${i}"]`)?.setAttribute('aria-invalid',String(!!error));});
    if(errors.some(Boolean)){container.querySelector('[aria-invalid="true"]')?.focus();return null;}return values;
  }
  function save(){
    if(!draft)return true;
    if(draft.kind==='update'&&!dirty()){closeDraft();return true;}
    const values=validate();if(!values)return false;
    try{const kind=draft.kind;M.mutate(draft.context,kind,{id:draft.id,values,version:draft.version});closeDraft(kind==='create');showToast(kind==='create'?'记录已新增':'修改已保存');return true;}
    catch(error){const node=$(draft.kind==='create'?'#apps-create-error':'#apps-inline-error');node.hidden=false;node.textContent=error.message;return false;}
  }
  function askDelete(id){
    if(guard(()=>askDelete(id)))return;
    const c=context(),row=M.rows(c.user,c.appId,c.table,c.scope,c.access).find(r=>r.id===id);
    if(!row||!permissions(row).delete){showToast('当前没有删除权限');return;}
    deleteTarget={context:{...c},id,version:row.version||row.updated};
    $('#apps-delete-dialog').innerHTML=`<div class="apps-confirm-symbol danger">${icon}</div><h2>删除这条记录？</h2><p>「${esc(row.values[0])}」删除后，Agent 和应用页面将无法再读取该记录。此操作无法撤销。</p><div class="apps-editor-error" role="alert" hidden></div><footer><button class="apps-btn" data-delete-cancel>取消</button><button class="apps-btn danger" data-delete-confirm>删除记录</button></footer>`;
    $('#apps-delete-dialog').showModal();
  }
  function init(getContext,render){
    context=getContext;redraw=render;
    document.body.insertAdjacentHTML('beforeend',`<dialog id="apps-create-dialog" class="apps-dialog apps-create-drawer" aria-label="新增记录" data-app-editor></dialog><dialog id="apps-delete-dialog" class="apps-dialog apps-confirm" aria-label="删除记录" data-app-editor></dialog><dialog id="apps-leave-dialog" class="apps-dialog apps-confirm" aria-label="有未保存的修改" data-app-editor><div class="apps-confirm-symbol">!</div><h2>有未保存的修改</h2><p>离开后，尚未保存的内容将丢失。是否保存本次修改？</p><footer><button class="apps-btn" data-leave-continue>继续编辑</button><button class="apps-btn" data-leave-discard>放弃修改</button><button class="apps-btn primary" data-leave-save>保存并离开</button></footer></dialog>`);
    document.addEventListener('input',event=>{const i=event.target.dataset.editField;if(draft&&i!==undefined)draft.values[Number(i)]=event.target.value;});
    document.addEventListener('change',event=>{const i=event.target.dataset.editField;if(draft&&i!==undefined)draft.values[Number(i)]=event.target.value;});
    document.addEventListener('dblclick',event=>{
      const cell=event.target.closest('[data-edit-cell]');
      if(cell&&!event.target.closest('[data-edit-field]')){event.preventDefault();start(cell.dataset.editCell,Number(cell.dataset.cellIndex));}
    });
    document.addEventListener('focusout',event=>{
      if(draft?.kind!=='update'||event.target.dataset.editField===undefined)return;
      const session=draft;
      // Allow a double-click on another cell to establish its target before re-rendering.
      setTimeout(()=>{if(draft===session&&!$('#apps-leave-dialog').open&&!document.activeElement?.closest('[data-edit-field]'))save();},250);
    });
    document.addEventListener('click',event=>{
      const b=event.target.closest('button,a,[role="button"],[data-side-entry]');if(!b)return;
      const d=b.dataset;
      if(b.closest('[data-app-editor]')||'editCreate'in d||'deleteRow'in d){
        if('editCreate'in d)start();
        else if('editSave'in d)save();
        else if('editCancel'in d){if(!guard(closeDraft))closeDraft();}
        else if('deleteRow'in d)askDelete(d.deleteRow);
        else if('deleteCancel'in d)$('#apps-delete-dialog').close();
        else if('deleteConfirm'in d){try{M.mutate(deleteTarget.context,'delete',deleteTarget);$('#apps-delete-dialog').close();redraw();showToast('记录已删除');}catch(error){const node=$('#apps-delete-dialog .apps-editor-error');node.hidden=false;node.textContent=error.message;}}
        else if('leaveContinue'in d){pending=null;$('#apps-leave-dialog').close();}
        else if('leaveDiscard'in d){const next=pending;pending=null;$('#apps-leave-dialog').close();closeDraft();next?.();}
        else if('leaveSave'in d){const next=pending;pending=null;$('#apps-leave-dialog').close();if(save())next?.();}
        return;
      }
      if(draft){
        const attr=[...b.attributes].find(a=>a.name.startsWith('data-'));
        const selector=b.id?'#'+CSS.escape(b.id):attr?`[${attr.name}="${CSS.escape(attr.value)}"]`:null;
        if(draft.kind==='update'){
          event.preventDefault();event.stopImmediatePropagation();
          const next=()=>{const target=selector?$(selector):b;target?.click();};
          if(!guard(next))next();return;
        }
        if(guard(()=>{const target=selector?$(selector):b;target?.click();})){event.preventDefault();event.stopImmediatePropagation();}
      }
    },true);
    document.addEventListener('keydown',event=>{
      if(event.isComposing)return;
      const cell=event.target.closest('[data-edit-cell]');
      if(event.key==='Enter'&&cell){if(event.shiftKey&&event.target.tagName==='TEXTAREA')return;event.preventDefault();event.stopImmediatePropagation();if(active(cell.dataset.editCell)&&draft.field===Number(cell.dataset.cellIndex))save();else start(cell.dataset.editCell,Number(cell.dataset.cellIndex));return;}
      if(event.key==='Escape'&&draft){event.preventDefault();event.stopImmediatePropagation();if($('#apps-leave-dialog').open){pending=null;$('#apps-leave-dialog').close();}else if(draft.kind==='update')closeDraft();else if(!guard(closeDraft))closeDraft();}
    },true);
    $('#apps-create-dialog').addEventListener('cancel',event=>{event.preventDefault();if(!guard(closeDraft))closeDraft();});
    $('#apps-leave-dialog').addEventListener('cancel',event=>{event.preventDefault();pending=null;$('#apps-leave-dialog').close();});
    const unload=event=>{if(dirty()){event.preventDefault();event.returnValue='';}};
    window.addEventListener('beforeunload',unload);try{if(window.top!==window)window.top.addEventListener('beforeunload',unload);}catch{}
  }
  return {init,cells,actions,banner,active,guard,dirty};
})();
