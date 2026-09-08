/* Prototype fixtures only. No Agent Platform credentials or WPS services. */
window.AgentArtifacts = (() => {
  const key = 'baizhi-v13-agent-artifacts-v1';
  const departments = ['AI2C_BU/销售运营部', 'AI2C_BU/AI2C产品组', 'AI2C_BU/客户交付部'];
  const description = '面向销售管理人员，基于日常销售录音内容，沉淀客户画像、需求痛点、商机异议风险与行动建议，形成可检索、可对比、可持续跟踪的销售洞察。开展任务前请添加AI全景数据表，并选择关联产品解决方案材料。销售洞察分析覆盖合规红线、沟通行为与表达结构，并输出可执行的改进建议；支持按个人 / 团队 / 区域 / 门店（如适用）做日/周/月汇总，解决「会议量极大、人工听不完」的管理痛点。';
  const folder = (space, agent = '') => `artifacts:${space}${agent ? ':' + agent : ''}`;
  const read = () => { try { const value = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value.filter(x => x && typeof x.id === 'string' && x.type === 'XLSX' && ['personal','enterprise'].includes(x.space) && Array.isArray(x.cells)) : []; } catch { return []; } };
  const save = (record, operationId) => {
    const records = read();
    const prior = records.find(x => x.operationId === operationId);
    if (prior) return prior;
    let name = record.name, n = 1;
    while (records.some(x => x.space === record.space && x.agent === record.agent && x.name === name)) name = record.name.replace(/\.xlsx$/i, ` (${n++}).xlsx`);
    const result = { ...record, name, id: crypto.randomUUID(), operationId };
    localStorage.setItem(key, JSON.stringify([...records, result]));
    return result;
  };
  const make = (space, week) => ({
    id: `artifact-${space}-${week}`, artifact: true, space, agent: '销售简报 Agent', folder: folder(space, '销售简报 Agent'),
    name: `第${week}周-华东销售数据.xlsx`, type: 'XLSX', size: '86 KB', count: '-', source: 'Agent 产物', state: '已入库', icon: 'ico-file', mark: 'excel',
    creator: space === 'personal' ? '张伟' : ['张伟','李悦','王磊'][(35-week)%3], organization: departments[space === 'personal' ? 0 : (35-week)%3],
    updated: new Date(Date.UTC(2026,7,30-(35-week)*7,10,2)).toISOString().slice(0,16).replace('T',' '), version: 1,
    app: 'sales_weekly', run: `run_2026_w${week}`, snapshot: `sales_w${week}_snapshot`, revision: `r${121-(35-week)*7}`, range: `2026 年第 ${week} 周 · 华东区域`, exportConfig: 'sales_excel_v1',
    cells: [['区域','负责人','成交额（元）','销售目标（元）','上期成交额（元）'], ...[['上海','周宁',1124870,1190000,1081606],['杭州','陈默',867416,965000,834054],['南京','许安',737049,785000,708701]].map(row => row.map((v,i) => i > 1 ? String(Math.round(v/(1+(35-week)*.04))) : v))]
  });
  return { key, departments, description, folder, read, save, seed: () => ['personal','enterprise'].flatMap(space => [35,34,33,32,31,30].map(week => make(space,week))) };
})();
