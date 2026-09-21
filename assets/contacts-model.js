(function (global) {
  "use strict";

  const STORAGE_KEY = "baizhi-v14-contacts";
  const seedContacts = [
    { id: "john", initials: "JC", name: "John Chen", role: "销售副总裁", company: "ABC Energy", summary: "德国储能合作核心联系人，当前有 2 个开放承诺，明天需要跟进经销商名单。", tag: "需关注", count: 8, recent: "2 天前", region: "德国 / 欧盟", email: "john@abc-energy.example", timeline: [["德国 PCS 渠道策略", "2026 年 9 月 15 日 · 会议", "讨论经销商策略、目标名单、认证与 Demo，形成 2 个待办。"], ["Pricing Feedback", "2026 年 9 月 10 日 · 邮件", "John 分享德国渠道价格反馈，强调交付和售后支持。"], ["Pilot Cooperation", "2026 年 9 月 3 日 · 会议", "讨论首批 3 个潜在 Pilot 客户及联合拜访机制。"], ["首次认识", "2026 年 6 月 12 日 · 初次联系", "在 Energy Storage Summit 首次见面，确认德国储能市场合作方向。"]], commitments: [["John → 发送德国经销商名单", "9 月 18 日", "待跟进"], ["确认认证时间表", "9 月 22 日 · 来源：9 月 3 日会议", "待跟进"]], myCommitments: [["准备 Demo 环境", "9 月 19 日 · 来源：9 月 15 日会议", "进行中"], ["发送新版 Product Deck", "9 月 20 日 · 来源：9 月 10 日邮件", "进行中"]], themes: ["德国市场 · 12 次互动", "价格 · 8", "PCS · 7", "渠道 · 5", "Pilot · 4", "认证 · 3", "交付 · 3"], memories: ["John 负责 ABC Energy 的德国销售业务。", "当前目标是建立德国经销商网络。", "重点关注认证、交付周期与渠道支持。", "偏好简洁、数据化的 Proposal。"], inferences: ["John 似乎比价格本身更关注交付确定性。", "他可能更倾向先做小规模 Pilot，再讨论独家合作。"] },
    { id: "alice", initials: "AW", name: "Alice Wang", role: "采购负责人", company: "ABC Energy", summary: "负责采购与预算确认，当前主要议题是试点预算和供应商准入。", tag: "待回复", count: 4, recent: "4 天前", region: "德国", email: "alice@abc-energy.example", themes: ["试点预算 · 4", "供应商准入 · 3"], memories: ["负责采购流程与预算确认。"], inferences: [] },
    { id: "david", initials: "DL", name: "David Lee", role: "技术负责人", company: "ABC Energy", summary: "技术评估负责人，重点关注系统集成、认证和 Pilot 技术可行性。", tag: "活跃", count: 6, recent: "3 天前", region: "德国", email: "david@abc-energy.example", themes: ["系统集成 · 6", "认证 · 4"], memories: ["负责技术评估和系统集成。"], inferences: [] },
    { id: "lisa", initials: "LT", name: "Lisa Tan", role: "投资人", company: "Singapore", summary: "关注 AI hardware、knowledge worker 与个人智能体方向。", tag: "最近", count: 3, recent: "1 周前", region: "新加坡", email: "lisa@invest.example", themes: ["AI hardware · 3"], memories: ["关注 AI hardware 与知识工作者方向。"], inferences: [] },
    { id: "michael", initials: "MZ", name: "Michael Zhou", role: "创始人", company: "SolarHub", summary: "德国渠道潜在合作伙伴，与 Distribution 和 Pilot Project 相关。", tag: "合作伙伴", count: 2, recent: "2 周前", region: "德国", email: "michael@solarhub.example", themes: ["Distribution · 2", "Pilot · 2"], memories: ["正在评估德国渠道合作。"], inferences: [] },
    { id: "emma", initials: "EL", name: "Emma Li", role: "产品负责人", company: "Internal", summary: "产品协作联系人，最近围绕 People、Knowledge 和录音入口讨论。", tag: "高频", count: 12, recent: "今天", region: "中国", email: "emma@baizhi.example", themes: ["People · 12", "Knowledge · 8", "录音 · 6"], memories: ["负责产品协作与知识工作台体验。"], inferences: [] }
  ];

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const scope = (edition, workspace) => workspace === "team" ? "team" : edition === "personal" ? "personal" : "enterprise";
  const normalize = (space) => {
    const contacts = Array.isArray(space?.contacts) ? space.contacts : clone(seedContacts);
    const notes = space?.notes && typeof space.notes === "object" ? space.notes : {};
    return { contacts, notes, tasks: Array.isArray(space?.tasks) ? space.tasks : [] };
  };
  const read = () => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch (error) { return {}; }
  };
  const write = (value) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); return true; } catch (error) { return false; }
  };
  const load = (edition, workspace) => {
    const all = read();
    const key = scope(edition, workspace);
    const data = normalize(all[key]);
    if (!all[key]) { all[key] = data; write(all); }
    return { key, data };
  };
  const update = (key, data) => { const all = read(); all[key] = data; return write(all); };
  const searchable = (person) => [person.name, person.company, person.role, person.summary, person.region].join(" ").toLowerCase();
  const filter = (contacts, query = "", tag = "全部") => {
    const needle = String(query || "").trim().toLowerCase();
    return contacts.filter((person) => {
      const matchesQuery = !needle || searchable(person).includes(needle);
      const matchesTag = tag === "全部" || tag === "需关注" && ["需关注", "待回复"].includes(person.tag) || tag === "最近互动" && ["今天", "2 天前", "3 天前", "4 天前"].includes(person.recent) || tag === "高频" && Number(person.count) >= 8;
      return matchesQuery && matchesTag;
    });
  };
  const add = (data, person) => {
    const name = String(person.name || "").trim();
    if (!name) return { ok: false, message: "请填写联系人姓名" };
    if (data.contacts.some((item) => item.name === name)) return { ok: false, message: "联系人已存在" };
    const record = { id: `contact-${Date.now()}`, initials: name.slice(0, 2), name, role: String(person.role || "待补充").trim(), company: String(person.company || "待补充").trim(), summary: String(person.summary || "").trim(), tag: "最近", count: 0, recent: "刚刚", region: "待补充", email: "待补充", themes: [], memories: [], inferences: [] };
    data.contacts.push(record);
    return { ok: true, record };
  };
  const importContacts = (data, rows) => {
    if (!Array.isArray(rows) || !rows.length) return { ok: false, message: "请输入非空 JSON 数组" };
    const valid = rows.every((row) => row && typeof row.name === "string" && row.name.trim() && ["company", "role", "summary"].every((key) => row[key] == null || typeof row[key] === "string"));
    if (!valid) return { ok: false, message: "每项须有姓名，其他字段为文本" };
    const added = [];
    rows.forEach((row) => { const result = add(data, row); if (result.ok) added.push(result.record); });
    return added.length ? { ok: true, records: added } : { ok: false, message: "联系人已存在" };
  };
  const addNote = (data, personId, text) => {
    const value = String(text || "").trim();
    if (!value) return false;
    (data.notes[personId] ||= []).unshift({ text: value, time: new Date().toLocaleString("zh-CN") });
    return true;
  };

  global.ContactsModel = { STORAGE_KEY, seedContacts, scope, load, update, filter, add, importContacts, addNote, clone };
})(window);
