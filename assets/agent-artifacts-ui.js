/* Integrates into v13's existing knowledge workspace, navigation and recycle bin. */
window.ArtifactUI = (() => {
  const model = AgentArtifacts;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const q = selector => document.querySelector(selector);
  const clone = value => JSON.parse(JSON.stringify(value));
  let current = null, editing = null, pending = null, returnFocus = null;
  const imported = new Set();
  const scope = () => activeKnowledgeFolder.startsWith('artifacts:enterprise') || enterpriseKnowledgeFolders.has(activeKnowledgeFolder) ? 'enterprise' : 'personal';
  const isArtifact = () => activeKnowledgeFolder.startsWith('artifacts:');
  const closePreview = () => { if (guard(closePreview)) return; q('#knowledge-preview').hidden = true; q('.knowledge-workspace').classList.remove('file-open'); current = null; renderKnowledgeFiles(); };
  function guard(action) {
    if (!editing) return false;
    if (!pending) {
      pending = action;
      returnFocus = document.activeElement;
      q('#artifact-leave-error').textContent = '';
      q('#artifact-leave').showModal();
      q('#artifact-continue').focus();
    }
    return true;
  }
  function cancelLeave() { pending = null; q('#artifact-leave').close(); returnFocus?.focus(); }
  function finishLeave(saveFirst) {
    if (saveFirst && !saveEdits()) return;
    if (!saveFirst) { editing = null; renderPreview(); }
    const action = pending; pending = null; q('#artifact-leave').close(); action?.();
  }
  function saveEdits() {
    if (!editing) return true;
    if (window.__artifactFailNextSave || navigator.onLine === false) {
      window.__artifactFailNextSave = false;
      const message = '保存失败，修改仍保留在当前页面，请重试。';
      q('#artifact-leave-error').textContent = message; showToast(message); return false;
    }
    const values = current.type === 'XLSX' ? editing.cells : editing.text;
    const original = current.type === 'XLSX' ? current.cells : (current.documentText || editing.originalText);
    if (JSON.stringify(values) !== JSON.stringify(original)) {
      if (current.type === 'XLSX') current.cells = clone(values); else current.documentText = values;
      current.version = (current.version || 1) + 1;
      current.updated = new Date().toLocaleString('sv-SE', { timeZone:'Asia/Shanghai' }).slice(0,16);
      current.editedBy = '张伟';
      current.history = [...(Array.isArray(current.history) ? current.history : [{ version: Math.max(1, (current.version || 2) - 1), agent: current.agent || '销售简报 Agent', time: current.updated, action: '生成并保存到应用数据' }]), { version: current.version, agent: current.editedBy, time: current.updated, action: '编辑并保存 Excel 数据' }];
      window.TeamWorkspace?.persist?.();
    }
    editing = null; renderPreview(); showToast('已保存当前知识库文件，未回写 Apps'); return true;
  }
  function renderPreview() {
    if (!current) return;
    const editable = ['XLSX','DOCX'].includes(current.type);
    q('#artifact-editor-actions').innerHTML = editable ? editing ? '<button id="artifact-save" class="primary">保存</button><button id="artifact-exit-edit">退出编辑</button>' : '<button id="artifact-edit">编辑</button>' : '';
    q('#artifact-edit')?.addEventListener('click', () => {
      const text = current.documentText || q('#knowledge-preview-body').innerText;
      editing = { cells: clone(current.cells || []), text, originalText: text };
      renderPreview(); q('#artifact-save').focus();
    });
    q('#artifact-save')?.addEventListener('click', saveEdits);
    q('#artifact-exit-edit')?.addEventListener('click', () => guard(() => renderPreview()));
    q('#knowledge-preview-meta').textContent = `${current.type} · ${current.updated}${editing ? ' · 编辑中' : ''}`;
    q('#knowledge-preview').classList.toggle('artifact-sheet-mode', current.type === 'XLSX' || !!editing);
    if (current.type === 'XLSX') {
      const values = editing?.cells || current.cells;
      q('#knowledge-preview-body').innerHTML = `<div class="artifact-office"><div class="artifact-ribbon"><strong>WPS 表格</strong><span>${editing ? '开始　插入　页面布局　公式　数据' : '只读预览'}</span><small>${editing ? '在线编辑交互示意' : 'Excel 文件'}</small></div>${editing ? '<div class="artifact-ribbon">正文　11　<b>B</b>　<i>I</i>　自动换行</div>' : ''}<div class="artifact-sheet-wrap"><table class="artifact-sheet"><thead><tr><th style="width:36px"></th>${values[0].map((_,i) => `<th>${String.fromCharCode(65+i)}</th>`).join('')}</tr></thead><tbody>${values.map((row,r) => `<tr><td>${r+1}</td>${row.map((value,c) => `<td>${editing ? `<input data-artifact-cell="${r}:${c}" aria-label="${String.fromCharCode(65+c)}${r+1}" value="${esc(value)}">` : esc(value)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><div class="artifact-sheet-tab">Sheet1${editing ? '　·　原型演示，不执行公式计算' : ''}</div></div>`;
    } else if (editing) {
      q('#knowledge-preview-body').innerHTML = `<div class="artifact-office"><div class="artifact-ribbon"><strong>WPS 文字</strong><span>开始　插入　页面布局</span><small>在线编辑交互示意</small></div><textarea id="artifact-word" class="artifact-word" aria-label="文档正文">${esc(editing.text)}</textarea></div>`;
    } else if (current.documentText) {
      q('#knowledge-preview-body').innerHTML = `<article class="knowledge-preview-paper">${current.documentText.split('\n').map(p => `<p>${esc(p)}</p>`).join('')}</article>`;
    } else if (current.type === 'DOCX' && current.originalPreview) q('#knowledge-preview-body').innerHTML = current.originalPreview;
  }
  function preview(item) {
    current = item;
    if (item.type === 'DOCX' && !item.originalPreview) item.originalPreview = q('#knowledge-preview-body').innerHTML;
    renderPreview();
  }
  function row(item, index) {
    const folder = item.preview === 'folder';
    return `<div class="knowledge-file-row" role="button" tabindex="0" data-schema="file" data-knowledge-index="${index}"><span>${item.system || folder ? '' : `<input class="knowledge-check" type="checkbox" aria-label="选择${esc(item.name)}">`}</span><span class="knowledge-file-name"><span class="knowledge-file-mark"><svg class="icon"><use href="#${folder ? 'ico-folder' : 'ico-file'}"/></svg></span><strong>${esc(item.name)}</strong></span><span>${esc(item.type)}</span><span>${esc(item.size)}</span><span>${folder ? '—' : knowledgeStateHTML(item.state)}${item.state === '解析失败' ? '<button class="artifact-retry" data-artifact-retry>重试解析</button>' : ''}</span><span class="artifact-creator"><span>${esc(item.creator || '—')}</span><small title="${esc(item.organization)}">${esc(item.organization || '—')}</small></span><span>${folder ? '—' : esc(item.updated)}</span><span class="artifact-actions">${KnowledgeFileActions.actions(item)}</span></div>`;
  }
  function matches(item) {
    if (item.artifact || item.system) { if (item.system ? item.folder !== activeKnowledgeFolder : !(activeKnowledgeFolder.startsWith('artifacts:') && item.space === scope())) return false; }
    else if (isArtifact() || (item.folder && item.folder !== activeKnowledgeFolder)) return false;
    const department = q('#artifact-department').value;
    return scope() !== 'enterprise' || department === 'all' || (item.system ? knowledgeCatalog.file.some(x => x.artifact && x.space === scope() && (!item.agent || x.agent === item.agent) && x.organization === department) : (item.organization || model.departments[0]) === department);
  }
  function configureFolder() {
    const artifact = isArtifact(), parts = activeKnowledgeFolder.split(':');
    q('.knowledge-workspace').classList.toggle('artifact-view', artifact);
    q('#artifact-department-wrap').hidden = scope() !== 'enterprise';
    q('#artifact-department').value = 'all';
    if (artifact) {
      q('#knowledge-folder-title').textContent = parts[2] || '应用数据';
      q('#knowledge-folder-meta').textContent = parts[2] === '销售简报 Agent' ? model.description : parts[2] ? `由「${parts[2]}」生成并保存的独立表格文件。` : '';
    }
    q('#knowledge-type-filter-wrap').hidden = false;
    const selected = document.querySelector(`[data-artifact-folder="${CSS.escape(activeKnowledgeFolder)}"]`);
    document.querySelectorAll('[data-artifact-folder]').forEach(x => x.classList.toggle('active', x === selected));
    if (selected) { let parent = selected.parentElement; while (parent && parent.id !== 'knowledge-side-list') { parent.classList.remove('hide'); if (parent.classList.contains('knowledge-tree-children')) parent.parentElement.querySelector(':scope > .tree-folder-toggle')?.setAttribute('aria-expanded','true'); parent = parent.parentElement; } }
    current = null;
  }
  function folderItem(space, agent = '') {
    return { id:`system-${space}-${agent}`,system:true,space,agent,name:agent || '应用数据',folder:agent ? model.folder(space) : space === 'personal' ? '我的文件' : '企业文件',folderKey:model.folder(space,agent),type:'文件夹',preview:'folder',size:'—',count:'—',source:'Agent 产物',state:'',updated:'',icon:'ico-folder' };
  }
  function sync() {
    model.read().forEach(record => { if (!imported.has(record.id)) { imported.add(record.id); knowledgeCatalog.file.push(record); } });
    ['personal','enterprise'].forEach(space => {
      const agents = [...new Set(knowledgeCatalog.file.filter(x => x.artifact && x.space === space).map(x => x.agent))];
      if (!agents.includes('销售简报 Agent')) agents.unshift('销售简报 Agent');
      [folderItem(space), ...agents.map(agent => folderItem(space, agent))].forEach(item => { if (!knowledgeCatalog.file.some(x => x.id === item.id)) knowledgeCatalog.file.push(item); });
      const files = knowledgeCatalog.file.filter(x => x.artifact && x.space === space && x.type === 'XLSX').slice(0, 3);
      q(`#artifact-tree-${space}`).innerHTML = `<div class="knowledge-tree-node artifact-tree-group"><button class="tree-folder-toggle artifact-root" data-artifact-folder="${model.folder(space)}" aria-expanded="true"><svg class="icon tree-chevron"><use href="#ico-chevron"/></svg><svg class="icon tree-folder-icon"><use href="#ico-folder"/></svg><span class="tree-folder-name">应用数据</span><span class="artifact-system">${files.length}</span></button><div class="knowledge-tree-children artifact-tree-children">${files.map(item => `<button class="side-sub-item knowledge-leaf artifact-leaf" data-artifact-folder="${esc(model.folder(space))}"><svg class="icon"><use href="#ico-file"/></svg><span class="tree-folder-name">${esc(item.name)}</span></button>`).join('')}</div></div>`;
    });
  }
  function init() {
    knowledgeCatalog.file.push(...model.seed());
    knowledgeSchemas.file.sources.push('Agent 产物'); knowledgeSchemas.file.types.push('XLSX');
    knowledgeCatalog.file.filter(x => !x.artifact).forEach(x => { x.creator = '张伟'; x.organization = model.departments[0]; });
    ['personal','enterprise'].forEach(space => { const tree = q(`#${space}-file-tree`); if (tree?.parentElement) tree.parentElement.insertAdjacentHTML('afterend', `<div id="artifact-tree-${space}" class="artifact-tree"></div>`); });
    q('.knowledge-filters').insertAdjacentHTML('afterbegin', `<label id="artifact-department-wrap" class="knowledge-filter-label">部门<select id="artifact-department"><option value="all">全部部门</option>${model.departments.map(d => `<option>${esc(d)}</option>`).join('')}</select></label>`);
    q('#artifact-department').addEventListener('change', renderKnowledgeFiles);
    q('#knowledge-preview-close').insertAdjacentHTML('beforebegin','<div id="artifact-editor-actions" class="artifact-editor-actions"></div>');
    document.body.insertAdjacentHTML('beforeend', '<dialog id="artifact-leave" class="artifact-dialog" aria-labelledby="artifact-leave-title"><h2 id="artifact-leave-title">离开编辑前是否保存？</h2><p>当前文件仍处于编辑状态，尚未保存或退出。保存仅更新此知识库文件，不回写 Apps。</p><p id="artifact-leave-error" class="artifact-error" role="alert"></p><footer><button id="artifact-continue">继续编辑</button><button id="artifact-discard">不保存离开</button><button id="artifact-save-leave" class="primary">保存并离开</button></footer></dialog>');
    q('#artifact-continue').onclick = cancelLeave;
    q('#artifact-discard').onclick = () => finishLeave(false);
    q('#artifact-save-leave').onclick = () => finishLeave(true);
    q('#artifact-leave').addEventListener('cancel', event => { event.preventDefault(); cancelLeave(); });
    q('#knowledge-preview-body').addEventListener('input', event => { if (!editing) return; if (event.target.dataset.artifactCell) { const [r,c] = event.target.dataset.artifactCell.split(':').map(Number); editing.cells[r][c] = event.target.value; } else if(event.target.id === 'artifact-word') editing.text = event.target.value; });
    q('#knowledge-side-list').addEventListener('click', event => { const button = event.target.closest('[data-artifact-folder]'); if (!button) return; if (button.classList.contains('artifact-root')) { const children = button.parentElement.querySelector(':scope > .artifact-tree-children'); const collapsed = children?.classList.toggle('hide'); button.setAttribute('aria-expanded', String(!collapsed)); event.preventDefault(); return; } openKnowledgeFolder(button.dataset.artifactFolder, button); });
    q('#knowledge-file-list').addEventListener('keydown', event => { if (event.target.matches('[data-knowledge-index]') && ['Enter',' '].includes(event.key)) { event.preventDefault(); event.target.click(); } });
    // Catch navigation at the interaction boundary before legacy listeners mutate state.
    // Function guards above remain authoritative for programmatic navigation.
    document.addEventListener('click', event => {
      if (!editing || event.target.closest('#knowledge-preview, .artifact-dialog')) return;
      const control = event.target.closest('button, a, [role="tab"], [data-history-item]');
      if (!control) return;
      event.preventDefault(); event.stopImmediatePropagation();
      guard(() => control.click());
    }, true);
    const beforeUnload = event => { if (editing) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', beforeUnload);
    if (window.parent !== window) { try { window.parent.addEventListener('beforeunload', beforeUnload); } catch {} }
    window.addEventListener('storage', event => { if (event.key === model.key) { sync(); if (!editing && !q('.knowledge-workspace').hidden) renderKnowledgeFiles(); } });
    sync();
  }
  return { init, guard, closePreview, preview, row, matches, configureFolder, sync, isArtifact, scope, dialogOpen: () => !!q('.artifact-dialog[open]'), labels: ['', '文件名','类型','大小','文件状态','创建人','更新时间','操作'] };
})();
