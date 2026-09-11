/* Prototype fixtures only. No Agent Platform credentials or WPS services. */
window.AgentArtifacts = (() => {
  const key = 'baizhi-v13-agent-artifacts-v1';
  const departments = ['AI2C_BU/销售运营部', 'AI2C_BU/AI2C产品组', 'AI2C_BU/客户交付部'];
  const description = '面向销售管理人员，基于日常销售录音内容，沉淀客户画像、需求痛点、商机异议风险与行动建议，形成可检索、可对比、可持续跟踪的销售洞察。开展任务前请添加AI全景数据表，并选择关联产品解决方案材料。销售洞察分析覆盖合规红线、沟通行为与表达结构，并输出可执行的改进建议；支持按个人 / 团队 / 区域 / 门店（如适用）做日/周/月汇总，解决「会议量极大、人工听不完」的管理痛点。';
  const apps = [{ id: 'app-a', name: '应用A' }, { id: 'app-b', name: '应用B' }];
  const folder = (space, appName = '') => `artifacts:${space}${appName ? ':' + appName : ''}`;
  const appFor = (record, index = 0) => {
    if (record?.appName) return apps.find(app => app.name === record.appName || app.id === record.appId) || { id: record.appId || 'custom-app', name: record.appName };
    if (record?.app === 'retail_leads') return apps[1];
    if (record?.app === 'sales_weekly') return apps[0];
    return apps[index % apps.length];
  };
  const normalize = (record, index = 0) => {
    const app = appFor(record, index);
    const tableName = record.tableName || String(record.name || `airtable${index + 1}.xlsx`).replace(/\.[^.]+$/, '');
    return { ...record, appId: record.appId || app.id, appName: app.name, tableName, folder: folder(record.space, app.name), name: record.name || `${tableName}.xlsx` };
  };
  const read = () => { try { const value = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value.filter(x => x && typeof x.id === 'string' && x.type === 'XLSX' && ['personal','enterprise'].includes(x.space) && Array.isArray(x.cells)).map(normalize) : []; } catch { return []; } };
  const save = (record, operationId) => {
    const records = read();
    const prior = records.find(x => x.operationId === operationId);
    if (prior) return prior;
    const normalized = normalize(record, records.length);
    let name = normalized.name, n = 1;
    while (records.some(x => x.space === normalized.space && x.appName === normalized.appName && x.name === name)) name = normalized.name.replace(/\.xlsx$/i, ` (${n++}).xlsx`);
    const result = { ...normalized, name, id: crypto.randomUUID(), operationId };
    localStorage.setItem(key, JSON.stringify([...records, result]));
    return result;
  };
  const make = (space, spec, index) => ({
    id: `artifact-${space}-${spec.app.id}-${spec.table}`, artifact: true, space, agent: spec.agent, appId: spec.app.id, appName: spec.app.name, tableName: spec.table, folder: folder(space, spec.app.name),
    name: `${spec.table}.xlsx`, type: 'XLSX', size: '86 KB', count: '-', source: spec.agent, state: '已入库', icon: 'ico-file', mark: 'excel',
    creator: space === 'personal' ? '张伟' : ['张伟','李悦','王磊'][index % 3], organization: departments[space === 'personal' ? 0 : index % 3],
    updated: new Date(Date.UTC(2026,8,9-index,10,2)).toISOString().slice(0,16).replace('T',' '), version: 1,
    app: spec.app.id, run: `run_${spec.app.id}_${spec.table}`, snapshot: `${spec.app.id}_${spec.table}_snapshot`, revision: `r${128-index}`, range: `${spec.app.name} · ${spec.table}`, exportConfig: 'sales_excel_v1',
    cells: [['区域','负责人','成交额（元）','销售目标（元）','上期成交额（元）'], ...[['上海','周宁',1124870,1190000,1081606],['杭州','陈默',867416,965000,834054],['南京','许安',737049,785000,708701]].map(row => row.map((v,i) => i > 1 ? String(Math.round(v/(1+(35-spec.week)*.04))) : v))]
  });
  const seeds = [
    { app: apps[0], table: 'airtable1', agent: '销售简报 Agent', week: 35 },
    { app: apps[0], table: 'airtable2', agent: '销售简报 Agent', week: 34 },
    { app: apps[1], table: 'airtable1', agent: '客户洞察 Agent', week: 33 },
    { app: apps[1], table: 'airtable2', agent: '客户洞察 Agent', week: 32 }
  ];
  return { key, apps, departments, description, folder, appFor, normalize, read, save, seed: () => ['personal','enterprise'].flatMap(space => seeds.map((spec, index) => make(space, spec, index))) };
})();
