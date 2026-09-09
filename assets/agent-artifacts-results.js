window.ArtifactResults = (() => {
  const q = selector => document.querySelector(selector);
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const salesCells = [['区域','负责人','成交额（元）','销售目标（元）','上期成交额（元）'],['上海','周宁','1284600','1190000','1124870'],['杭州','陈默','926400','965000','867416'],['南京','许安','714200','785000','737049']];
  const leadCells = [['企业名称','区域','机会信号','优先级'],['东辰商业','上海','门店数字化招标','高'],['华悦零售','浙江','新开 12 家门店','高'],['苏城百货','江苏','招聘数据产品负责人','中'],['海岸生活','福建','会员系统升级','中']];
  let requestId = null, selectedTask = null, note = null;
  const sales = task => task?.id === 'sales-week36';
  function configureTask(task) {
    selectedTask = task;
    files['lead-list'] = sales(task) ? {name:'第36周-华东销售数据.xlsx',type:'XLSX',meta:'3 个区域 · 2026-09-06 09:42'} : {name:'华东零售客户线索.xlsx',type:'XLSX',meta:'4 条示例线索 · 2026-09-04 14:18'};
    if (sales(task)) delete files['verification-note']; else files['verification-note'] = note;
  }
  function conversation(task) {
    return `<article class="message message-user"><div>${esc(task.prompt)}</div></article><article class="message message-agent"><h3>第 36 周销售简报已完成</h3><p>已复用 Apps 的销售数据结构，更新本周数据并固定本次运行快照。</p><div class="tool-call"><div class="tool-call-button"><strong>Apps · sales_weekly</strong><span>快照 sales_w36_snapshot</span><em>已完成</em></div></div><p>本次结果为独立 Excel 表格，可预览后保存至个人或企业知识库。</p><div class="output-files"><button class="output-file" data-file-id="lead-list"><span class="file-mark">X</span><span><strong>${files['lead-list'].name}</strong><small>${files['lead-list'].meta}</small></span></button></div></article>`;
  }
  function augmentPreview(fileId) {
    if (fileId !== 'lead-list') return;
    q('#file-preview h2').textContent = files[fileId].name;
    const cells = sales(selectedTask) ? salesCells : leadCells;
    q('#file-preview .preview-table').innerHTML = `<thead><tr>${cells[0].map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${cells.slice(1).map(row => `<tr>${row.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>`;
    if (sales(selectedTask)) q('#file-preview p').textContent = '2026 年第 36 周 · 华东区域 · 数据快照 2026-09-06 09:42';
    q('#file-preview').insertAdjacentHTML('beforeend', `<button id="artifact-save-result" class="artifact-save-entry" ${selectedTask?.status !== 'done' ? 'disabled' : ''}>保存至应用数据</button>${selectedTask?.status !== 'done' ? '<p>任务完成后可保存正式产物。</p>' : ''}`);
    q('#artifact-save-result').onclick = openSave;
  }
  function openSave() {
    if (selectedTask?.status !== 'done') return;
    requestId = crypto.randomUUID();
    q('#artifact-result-error').textContent = '';
    q('#artifact-result-status').textContent = '';
    q('#artifact-result-submit').hidden = false;
    q('#artifact-result-view').hidden = true;
    q('#artifact-result-space').disabled = false;
    q('#artifact-result-path').textContent = `应用数据 / ${sales(selectedTask) ? '销售简报 Agent' : agentName} / ${files['lead-list'].name}`;
    q('#artifact-result-dialog').showModal();
  }
  function submit() {
    const button = q('#artifact-result-submit');
    button.disabled = true;
    const space = edition === 'personal' ? 'personal' : q('#artifact-result-space').value;
    const agent = sales(selectedTask) ? '销售简报 Agent' : agentName;
    const record = { artifact:true,space,agent,folder:AgentArtifacts.folder(space,agent),name:files['lead-list'].name,type:'XLSX',size:sales(selectedTask) ? '86 KB' : '24 KB',count:'-',source:'Agent 产物',state:'已入库',icon:'ico-file',mark:'excel',creator:'张伟',organization:AgentArtifacts.departments[0],version:1,updated:new Date().toLocaleString('sv-SE',{timeZone:'Asia/Shanghai'}).slice(0,16),app:sales(selectedTask)?'sales_weekly':'retail_leads',run:sales(selectedTask)?'run_0906_017':`run_${selectedTask.id}`,snapshot:sales(selectedTask)?'sales_w36_snapshot':`snapshot_${selectedTask.id}`,revision:sales(selectedTask)?'r128':'r1',range:sales(selectedTask)?'2026 年第 36 周 · 华东区域':selectedTask.title,exportConfig:sales(selectedTask)?'sales_excel_v1':'retail_leads_excel_v1',cells:sales(selectedTask)?salesCells:leadCells };
    try {
      const saved = AgentArtifacts.save(record,requestId);
      q('#artifact-result-status').textContent = `已保存「${saved.name}」，下次主动保存将创建另一份独立文件。`;
      button.hidden = true; q('#artifact-result-space').disabled = true;
      q('#artifact-result-view').hidden = false;
      q('#artifact-result-view').onclick = () => { window.location.href = `index.html?edition=${edition}&page=knowledge&folder=${encodeURIComponent(saved.folder)}`; };
    } catch { q('#artifact-result-error').textContent = '保存失败，请检查浏览器存储权限后重试。不会创建重复文件。'; }
    finally { button.disabled = false; }
  }
  function init() {
    note = files['verification-note'];
    taskGroups[0].tasks.unshift({id:'sales-week36',title:'第36周华东销售简报',status:'done',progress:100,prompt:'复用销售简报 Apps，更新第36周华东销售数据，生成 Excel 表格。',summary:'已更新 3 个区域的数据，生成独立 Excel 结果。'});
    document.body.insertAdjacentHTML('beforeend', `<dialog id="artifact-result-dialog" class="artifact-dialog" aria-labelledby="artifact-result-title"><h2 id="artifact-result-title">保存至应用数据</h2><label for="artifact-result-space">保存位置</label><select id="artifact-result-space"><option value="personal">我的文件</option>${edition === 'enterprise' ? '<option value="enterprise">企业文件</option>' : ''}</select><p id="artifact-result-path"></p><p>目录由系统自动创建，每次保存都是独立 Excel 文件，不覆盖历史产物。</p><p id="artifact-result-status" role="status"></p><p id="artifact-result-error" class="artifact-error" role="alert"></p><footer><button id="artifact-result-close">关闭</button><button id="artifact-result-submit" class="primary">保存</button><button id="artifact-result-view" class="primary" hidden>查看文件目录</button></footer></dialog>`);
    q('#artifact-result-close').onclick = () => q('#artifact-result-dialog').close();
    q('#artifact-result-submit').onclick = submit;
    renderTaskHistory();
  }
  return { init, configureTask, conversation, augmentPreview, sales };
})();
