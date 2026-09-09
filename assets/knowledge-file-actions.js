/* Local prototype file operations. No download or cross-space move capability. */
window.KnowledgeFileActions = (() => {
  const q = s => document.querySelector(s);
  const esc = x => String(x ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const folderSpace = folder => enterpriseKnowledgeFolders.has(folder) ? 'enterprise' : 'personal';
  let transfer = null;
  const folders = new Map();
  function allowed(item) {
    if (!item || item.system || item.preview === 'folder' || (item.space === 'enterprise' && document.body.dataset.edition === 'personal')) return [];
    if (item.artifact && item.type === 'XLSX') return ['edit','delete'];
    if (item.artifact) return item.space === 'personal' && document.body.dataset.edition !== 'personal' ? ['copy','delete'] : ['delete'];
    return item.space === 'enterprise' ? ['move'] : ['copy','move','delete'];
  }
  function button(action, bulk = false, artifact = false) {
    const label = action === 'copy' ? artifact ? '复制到企业' : '复制' : action === 'move' ? '移动' : action === 'edit' ? '编辑' : '删除';
    const icon = action === 'delete' ? '<svg class="icon" aria-hidden="true"><use href="#ico-trash"/></svg>' : action === 'edit' ? '<svg class="icon" aria-hidden="true"><use href="#ico-task"/></svg>' : label;
    return `<button type="button" ${bulk ? 'data-knowledge-bulk' : 'data-knowledge-row-action'}="${action}" title="${label}" aria-label="${label}" ${action === 'delete' ? 'class="file-trash-button"' : ''}>${icon}</button>`;
  }
  function actions(item) { return allowed(item).map(a=>button(a,false,item.artifact)).join(''); }
  const selected = () => [...document.querySelectorAll('#knowledge-file-list .knowledge-check:checked')].map(x=>knowledgeCatalog.file[Number(x.closest('[data-knowledge-index]').dataset.knowledgeIndex)]).filter(Boolean);
  function selection() {
    const items = selected();
    const actions = ['copy','move','delete'].filter(a=>items.length && items.every(item=>allowed(item).includes(a)));
    q('#knowledge-selection-bar').innerHTML = `<span>已选择 <strong id="knowledge-selected-count">${items.length}</strong> 项</span>${actions.map(a=>button(a,true,items.every(x=>x.artifact))).join('')}`;
    q('#knowledge-selection-bar').classList.toggle('show',items.length > 0);
  }
  function execute(action, items) {
    if (!items.length || !items.every(item=>knowledgeCatalog.file.includes(item) && allowed(item).includes(action))) { showToast('当前文件不支持此操作'); return; }
    if (action === 'edit') {
      const item = items[0];
      if (item?.artifact && item.type === 'XLSX' && typeof window.BaizhiOpenKnowledgePreview === 'function') window.BaizhiOpenKnowledgePreview(item);
      return;
    }
    if (action === 'delete') {
      openDeleteConfirm({title:`确认删除 ${items.length} 个文件？`,description:'删除后移入回收站，30 天内可恢复。',onConfirm:()=>{
        items.forEach(item=>{if(allowed(item).includes('delete')) moveKnowledgeToRecycle(item,knowledgeCatalog.file.indexOf(item));});
        renderKnowledgeFiles();renderRecycleBin();showToast('已移入回收站');
      }});return;
    }
    const artifacts = items.every(x=>x.artifact);
    if (items.some(x=>x.artifact) && !artifacts) { showToast('请分别操作普通文件与 Agent 产物');return; }
    transfer={action,items,artifacts};
    q('#file-transfer-title').textContent = artifacts ? '复制到企业应用数据' : action === 'copy' ? '复制文件' : '移动文件';
    q('#file-transfer-copy').textContent = artifacts ? `将 ${items.length} 个文件复制到企业文件 / 应用数据 / 对应 Agent。保留个人原文件，复制当前已保存的内容，不重新读取 Apps；同名自动编号。` : `已选择 ${items.length} 个文件。请选择${items[0].space === 'enterprise' ? '企业文件' : '我的文件'}下的目标目录。${action === 'copy' ? '原文件保留，同名自动编号。' : '移动后原目录不再展示该文件。'}`;
    q('#file-transfer-target-wrap').hidden = artifacts;
    q('#file-transfer-target').innerHTML = [...folders].filter(([key,space])=>space===items[0].space && items.every(x=>x.folder!==key)).map(([key])=>`<option value="${esc(key)}">${esc(key)}</option>`).join('');
    q('#file-transfer-submit').disabled = !artifacts && !q('#file-transfer-target').options.length;
    q('#file-transfer-error').textContent='';q('#file-transfer-dialog').showModal();
  }
  function uniqueName(item, folder) {
    let name=item.name,n=1;const dot=name.lastIndexOf('.');
    while(knowledgeCatalog.file.some(x=>x!==item && x.folder===folder && x.name===name)) name=dot>0 ? `${item.name.slice(0,dot)} (${n++})${item.name.slice(dot)}` : `${item.name} (${n++})`;
    return name;
  }
  function confirm() {
    if(!transfer)return;
    const {action,items,artifacts}=transfer,target=q('#file-transfer-target').value;
    if(!items.every(item=>knowledgeCatalog.file.includes(item)&&allowed(item).includes(action)) || (!artifacts && (!folders.has(target)||folders.get(target)!==items[0].space||items.some(x=>x.folder===target)))) {q('#file-transfer-error').textContent='目标或文件状态已改变，请重新选择。';return;}
    for(const item of items) {
      const folder=artifacts ? AgentArtifacts.folder('enterprise',item.agent) : target;
      if(action==='copy') {
        const copy=structuredClone(item);copy.id=crypto.randomUUID();copy.folder=folder;copy.space=artifacts?'enterprise':item.space;
        copy.name=uniqueName(copy,folder);copy.creator='张伟';copy.organization=AgentArtifacts.departments[0];copy.updated=new Date().toLocaleString('sv-SE',{timeZone:'Asia/Shanghai'}).slice(0,16);copy.version=1;copy.copiedFrom=item.id;
        delete copy.editedBy;delete copy.operationId;
        knowledgeCatalog.file.push(copy);
      } else {item.name=uniqueName(item,folder);item.folder=folder;}
    }
    transfer=null;q('#file-transfer-dialog').close();ArtifactUI.sync();renderKnowledgeFiles();
    showToast(action==='copy' ? '复制成功，原文件已保留' : '已移动到目标目录');
  }
  function init() {
    document.querySelectorAll('.knowledge-file-leaf').forEach(el=>{if(el.nextElementSibling?.classList.contains('tree-folder-more'))el.nextElementSibling.remove();});
    document.querySelectorAll('[data-knowledge-folder], .tree-folder-toggle, #knowledge-side-list .knowledge-leaf').forEach(el=>{
      const name=el.dataset.knowledgeFolder||el.dataset.sideEntry||el.querySelector('.tree-folder-name')?.textContent;
      if(name)folders.set(name,folderSpace(name));
    });
    // Give normal samples actual folder ownership so copy/move are observable.
    const normal=knowledgeCatalog.file.filter(x=>!x.artifact && !x.system && x.preview!=='folder');
    knowledgeCatalog.file.splice(0,knowledgeCatalog.file.length,...knowledgeCatalog.file.filter(x=>x.artifact||x.system));
    for(const [folder,space] of folders) normal.forEach((item,i)=>knowledgeCatalog.file.push({...structuredClone(item),id:`normal-${folder}-${i}`,folder,space}));
    const addedFolders=new Set();
    document.querySelectorAll('[data-knowledge-folder], .tree-folder-toggle, #knowledge-side-list .knowledge-leaf').forEach(el=>{
      const name=el.dataset.knowledgeFolder||el.dataset.sideEntry||el.querySelector('.tree-folder-name')?.textContent;
      const branch=el.closest('.knowledge-tree-children');
      const parent=branch?.parentElement.querySelector(':scope > .tree-folder-toggle');
      const parentName=parent?.dataset.knowledgeFolder||parent?.querySelector('.tree-folder-name')?.textContent;
      if(!name || !parentName || !folders.has(name) || addedFolders.has(name))return;
      addedFolders.add(name);knowledgeCatalog.file.push({id:`normal-folder-${name}`,name,folder:parentName,folderKey:name,space:folders.get(name),type:'文件夹',preview:'folder',size:'—',count:'—',state:'',source:'自行创建',creator:'张伟',organization:AgentArtifacts.departments[0],updated:''});
    });
    document.body.insertAdjacentHTML('beforeend','<dialog id="file-transfer-dialog" class="artifact-dialog" aria-labelledby="file-transfer-title"><h2 id="file-transfer-title"></h2><p id="file-transfer-copy"></p><label id="file-transfer-target-wrap">目标目录<select id="file-transfer-target"></select></label><p id="file-transfer-error" class="artifact-error" role="alert"></p><footer><button id="file-transfer-cancel">取消</button><button id="file-transfer-submit" class="primary">确认</button></footer></dialog>');
    q('#file-transfer-cancel').onclick=()=>{transfer=null;q('#file-transfer-dialog').close();};q('#file-transfer-submit').onclick=confirm;
    q('#file-transfer-dialog').addEventListener('cancel',()=>{transfer=null;});
    q('#knowledge-selection-bar').addEventListener('click',event=>{const b=event.target.closest('[data-knowledge-bulk]');if(b)execute(b.dataset.knowledgeBulk,selected());});
  }
  return {init,allowed,actions,selection,execute};
})();
