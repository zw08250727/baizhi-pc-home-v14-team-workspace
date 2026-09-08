(function () {
  "use strict";

  const TEAM_STORAGE_KEY = "baizhi-v14-team-workspace";
  const nowISO = () => new Date().toISOString();
  const el = (selector, root) => (root || document).querySelector(selector);
  const els = (selector, root) => Array.from((root || document).querySelectorAll(selector));
  const escapeTeamHTML = (value) => String(value == null ? "" : value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
  const formatCurrency = (amount) => `¥${Number(amount).toLocaleString("zh-CN")}`;

  const TEAM_PLANS = {
    collaboration: { id: "collaboration", name: "团队协作版", seats: 10, month: 599, year: 5990, minutes: 12000, credits: 150000, storage: 200, agents: 2, management: "管理员协作、成员管理", recommended: true },
    growth: { id: "growth", name: "团队成长版", seats: 30, month: 1199, year: 11990, minutes: 30000, credits: 400000, storage: 500, agents: 2, management: "更高席位、团队知识治理" }
  };

  const ENTERPRISE_PLAN = {
    name: "企业版",
    tag: "联系专属顾问",
    summary: "已包含全部团队版能力，面向组织级管理，覆盖权限、协作、数据治理与安全合规，不支持在线支付。",
    sections: [
      ["团队与组织管理", "管理后台、多成员协作、成员管理"],
      ["知识与 AI 能力", "AI 智能体、企业知识库、热词库"],
      ["数据与安全", "数据安全合规、硬件设备、专属高级支持"]
    ]
  };

  const HARDWARE_TIERS = {
    standard: { id: "standard", name: "标准", price: 799, summary: "录音卡与基础录音权益" },
    professional: { id: "professional", name: "专业", price: 1398, summary: "录音卡与专业录音权益" },
    excellent: { id: "excellent", name: "卓越", price: 1998, summary: "录音卡与卓越录音权益" }
  };

  const createSeedAgentArtifacts = () => ([
    { agent: "销售简报 Agent", name: "第36周-华东销售数据.xlsx", type: "Excel", owner: "销售简报 Agent", updated: "今天 15:10" },
    { agent: "销售简报 Agent", name: "华东销售简报.html", type: "HTML", owner: "销售简报 Agent", updated: "今天 15:18" },
    { agent: "客户洞察 Agent", name: "重点客户名单.md", type: "Markdown", owner: "客户洞察 Agent", updated: "昨天 17:20" }
  ]);

  const normalizeTeam = (team) => {
    if (!team) return team;
    if (!Array.isArray(team.members)) team.members = [];
    if (!Array.isArray(team.agents)) team.agents = [{ id: "sales-agent", name: "销售简报 Agent", status: "常驻" }, { id: "insight-agent", name: "客户洞察 Agent", status: "常驻" }];
    if (!team.usage || typeof team.usage !== "object") team.usage = { minutes: 0, credits: 0, storage: 0 };
    if (!Array.isArray(team.hardwareOrders)) team.hardwareOrders = [];
    if (!Array.isArray(team.sharePackages)) team.sharePackages = [];
    if (!Array.isArray(team.artifacts)) team.artifacts = [];
    if (!Array.isArray(team.agentArtifacts)) team.agentArtifacts = team.id === "team-demo" ? createSeedAgentArtifacts() : [];
    if (team.status === "active" && !team.sharePackages.length && !team.artifacts.length && !team.agentArtifacts.length) {
      team.sharePackages = [{
        id: "SHR-20260904-001",
        version: 1,
        title: "竞品分析与首页方案复盘",
        sourceOwner: "林晓",
        sourceType: "个人 Session",
        createdAt: "2026-09-04 14:26",
        status: "published",
        items: ["Session 摘要", "引用资料 4 份", "竞品对比表.xlsx", "首页方案说明.md"],
        continuedBy: null
      }];
      team.artifacts = [
        { name: "竞品对比表.xlsx", type: "Excel", owner: "林晓", updated: "今天 14:26" },
        { name: "团队协作方案-v1.md", type: "Markdown", owner: "张伟", updated: "昨天 18:05" }
      ];
      team.agentArtifacts = createSeedAgentArtifacts();
    }
    return team;
  };

  const createBlankState = () => ({
    version: 1,
    ownedTeamId: null,
    ownedTeamIds: [],
    activeWorkspace: "personal",
    activeTeamId: null,
    teams: [],
    personalFiles: [],
    processedOrders: [],
    checkout: {
      step: 1,
      teamName: "产品共创组",
      planId: "collaboration",
      cycle: "year",
      hardware: { standard: 0, professional: 0, excellent: 0 },
      recipient: "张伟",
      phone: "13800136688",
      address: "北京市朝阳区百智路 8 号",
      paymentMethod: "wechat",
      orderId: null
    },
    upgrade: { teamId: null, planId: null, orderId: null }
  });

  const loadState = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(TEAM_STORAGE_KEY) || "null");
      return saved && saved.version === 1 ? saved : createBlankState();
    } catch (error) {
      return createBlankState();
    }
  };

  let teamState = loadState();
  if (!Array.isArray(teamState.ownedTeamIds)) teamState.ownedTeamIds = teamState.ownedTeamId ? [teamState.ownedTeamId] : [];
  if (!Array.isArray(teamState.personalFiles)) teamState.personalFiles = [];
  if (!Array.isArray(teamState.teams)) teamState.teams = [];
  teamState.teams = teamState.teams.map((team) => normalizeTeam(team));
  let activeTeamSettingsPanel = "overview";
  let activeSharePackageId = null;

  const persistTeamState = () => {
    try { localStorage.setItem(TEAM_STORAGE_KEY, JSON.stringify(teamState)); } catch (error) {}
  };

  const getVisibleTeams = () => teamState.teams.filter((team) => !["archived", "left"].includes(team.status) && team.access !== "left");
  const getActiveTeam = () => getVisibleTeams().find((team) => team.id === teamState.activeTeamId) || getVisibleTeams()[0] || null;
  const getOwnedTeams = () => getVisibleTeams().filter((team) => team.ownerId === "user-zhangwei" || team.role === "owner");
  const canCreateTeam = () => getOwnedTeams().length < 3;
  const isTeamOwner = (team) => Boolean(team && (team.ownerId === "user-zhangwei" || team.role === "owner"));
  const renderPersonalFileCount = () => {
    const count = el('[data-knowledge-folder="我的文件"] .tree-count');
    if (count) count.textContent = String(40 + teamState.personalFiles.length);
  };
  const getPlan = (team) => TEAM_PLANS[(team && team.planId) || teamState.checkout.planId] || TEAM_PLANS.collaboration;
  const getSeatUsage = (team) => (team ? team.members.filter((member) => ["active", "pending"].includes(member.status)).length : 0);
  const hardwareCount = (hardware) => Object.values(hardware || {}).reduce((total, value) => total + Number(value || 0), 0);
  const hardwareTotal = (hardware) => Object.entries(hardware || {}).reduce((total, entry) => total + (HARDWARE_TIERS[entry[0]] ? HARDWARE_TIERS[entry[0]].price * Number(entry[1] || 0) : 0), 0);
  const subscriptionTotal = () => {
    const plan = TEAM_PLANS[teamState.checkout.planId];
    return plan[teamState.checkout.cycle];
  };

  const createSeedTeam = (options) => {
    const seed = options || {};
    const id = seed.id || `team-${Date.now()}`;
    const planId = seed.planId || "collaboration";
    const plan = TEAM_PLANS[planId];
    return {
      id,
      name: seed.name || "产品共创组",
      role: seed.role || "owner",
      planId,
      cycle: seed.cycle || "year",
      status: seed.status || "active",
      createdAt: nowISO(),
      renewAt: "2027-09-04",
      ownerId: "user-zhangwei",
      members: [
        { id: "user-zhangwei", name: "张伟", email: "zhangwei@example.com", role: "owner", status: "active" },
        { id: "user-linxiao", name: "林晓", email: "linxiao@example.com", role: "admin", status: "active" },
        { id: "user-wangning", name: "王宁", email: "wangning@example.com", role: "member", status: "active" }
      ].slice(0, plan.seats),
      usage: { minutes: Math.round(plan.minutes * 0.38), credits: Math.round(plan.credits * 0.46), storage: Math.max(8, Math.round(plan.storage * 0.24)) },
      residentAgents: plan.agents > 1 ? ["general", "insight"] : ["general"],
      hardwareOrders: seed.hardwareOrders || [],
      agentArtifacts: createSeedAgentArtifacts(),
      sharePackages: [{
        id: "SHR-20260904-001",
        version: 1,
        title: "竞品分析与首页方案复盘",
        sourceOwner: "林晓",
        sourceType: "个人 Session",
        createdAt: "2026-09-04 14:26",
        status: "published",
        items: ["Session 摘要", "引用资料 4 份", "竞品对比表.xlsx", "首页方案说明.md"],
        continuedBy: null
      }],
      artifacts: [
        { name: "竞品对比表.xlsx", type: "Excel", owner: "林晓", updated: "今天 14:26" },
        { name: "团队协作方案-v1.md", type: "Markdown", owner: "张伟", updated: "昨天 18:05" }
      ]
    };
  };

  const ensureDemoTeam = () => {
    let team = getActiveTeam();
    if (!team) {
      team = createSeedTeam({ id: "team-demo", name: "产品共创组" });
      teamState.teams.push(team);
      teamState.ownedTeamId = team.id;
      teamState.ownedTeamIds = [team.id];
      teamState.activeTeamId = team.id;
      persistTeamState();
    }
    return normalizeTeam(team);
  };

  const showTeamToast = (message) => {
    if (typeof showToast === "function") showToast(message);
  };

  const openTeamDrawer = (title, body, actions) => {
    if (typeof openDrawer === "function") openDrawer(title, body, actions || "", "team");
  };

  const closeTeamOverlays = () => {
    els(".team-modal.show").forEach((modal) => modal.classList.remove("show"));
    const enterpriseApply = el("#enterprise-apply-modal");
    if (enterpriseApply) enterpriseApply.remove();
    const scrim = el("#scrim");
    if (scrim && !el(".modal.show, .drawer.show")) scrim.classList.remove("show");
  };

  const openTeamModal = (selector) => {
    if (typeof closeOverlays === "function") closeOverlays();
    closeTeamOverlays();
    const modal = el(selector);
    const scrim = el("#scrim");
    if (!modal || !scrim) return;
    modal.classList.add("show");
    scrim.classList.add("show");
    const focusTarget = el("input, select, textarea, button", modal);
    if (focusTarget) window.setTimeout(() => focusTarget.focus(), 40);
  };

  const workspaceSwitcherHTML = () => `
    <div class="team-workspace-switcher" id="team-workspace-switcher">
      <button type="button" id="team-workspace-switcher-button" aria-expanded="false" aria-controls="team-space-menu">
        <span class="team-space-avatar" id="team-workspace-avatar">张</span>
        <span class="team-workspace-switcher-copy"><small id="team-workspace-kind">个人工作台</small><strong id="team-workspace-name">张伟的空间</strong></span>
        <svg class="icon chevron"><use href="#ico-chevron"/></svg>
      </button>
      <div class="team-space-menu" id="team-space-menu" role="menu"></div>
    </div>`;

  const personalCTAHTML = () => `
    <aside class="personal-team-cta personal-workspace-only" id="personal-team-cta">
      <strong>和伙伴一起把 Agent 结果接着做</strong>
      <p>3–30 人轻量空间，支付即开通，无需企业审核。</p>
      <div class="personal-team-cta-actions">
        <button class="create" type="button" data-team-action="create">创建团队</button>
        <button class="apply" type="button" data-team-action="apply-enterprise">申请企业版</button>
      </div>
    </aside>`;

  const teamHomeHTML = () => "";

  const teamFileTreeHTML = (team) => {
    const owner = isTeamOwner(team);
    const fileCount = team.sharePackages.length + team.artifacts.length + team.agentArtifacts.length;
    const agentFolders = [...new Set(team.agentArtifacts.map((item) => item.agent))];
    return `<div class="knowledge-tree-node team-only team-file-group" data-team-file-group="${escapeTeamHTML(team.id)}"><button class="tree-folder-toggle" data-team-tree-toggle="${escapeTeamHTML(team.id)}" data-knowledge-folder="${escapeTeamHTML(team.name)}的团队文件" aria-expanded="true"><svg class="icon tree-chevron"><use href="#ico-chevron"/></svg><svg class="icon tree-folder-icon"><use href="#ico-folder"/></svg><span class="tree-folder-name">${escapeTeamHTML(team.name)}的团队文件</span><span class="tree-count">${fileCount}</span></button><button class="tree-folder-more" type="button" data-team-file-menu="${escapeTeamHTML(team.id)}" aria-label="${escapeTeamHTML(team.name)}团队文件操作"><svg class="icon"><use href="#ico-more"/></svg></button><div class="team-file-actions-menu" data-team-file-actions="${escapeTeamHTML(team.id)}" role="menu"><button type="button" data-team-file-action="settings" data-team-id="${escapeTeamHTML(team.id)}"><svg class="icon"><use href="#ico-task"/></svg>团队设置</button><button type="button" data-team-file-action="invite" data-team-id="${escapeTeamHTML(team.id)}"><svg class="icon"><use href="#ico-plus"/></svg>邀请成员</button>${owner ? `<button type="button" data-team-file-action="archive" data-team-id="${escapeTeamHTML(team.id)}" class="danger"><svg class="icon"><use href="#ico-trash"/></svg>归档团队协作区</button>` : `<button type="button" data-team-file-action="leave" data-team-id="${escapeTeamHTML(team.id)}" class="danger"><svg class="icon"><use href="#ico-users"/></svg>离开团队协作区</button>`}</div><div class="knowledge-tree-children" data-team-file-children="${escapeTeamHTML(team.id)}"><button class="side-sub-item knowledge-leaf" type="button" data-team-folder="${escapeTeamHTML(team.id)}" data-knowledge-folder="团队共享"><svg class="icon"><use href="#ico-folder"/></svg><span class="tree-folder-name">团队共享</span><span class="tree-count">${team.sharePackages.length}</span></button><button class="side-sub-item knowledge-leaf" type="button" data-team-folder="${escapeTeamHTML(team.id)}" data-knowledge-folder="团队产物"><svg class="icon"><use href="#ico-folder"/></svg><span class="tree-folder-name">团队产物</span><span class="tree-count">${team.artifacts.length}</span></button><div class="knowledge-tree-node team-agent-group"><button class="tree-folder-toggle" type="button" data-team-agent-tree-toggle="${escapeTeamHTML(team.id)}" data-team-folder="${escapeTeamHTML(team.id)}" data-knowledge-folder="Agent 产物" aria-expanded="true"><svg class="icon tree-chevron"><use href="#ico-chevron"/></svg><svg class="icon tree-folder-icon"><use href="#ico-folder"/></svg><span class="tree-folder-name">Agent 产物</span><span class="tree-count team-system-label">系统</span></button><div class="knowledge-tree-children" data-team-agent-children="${escapeTeamHTML(team.id)}">${agentFolders.length ? agentFolders.map((agent) => { const count = team.agentArtifacts.filter((item) => item.agent === agent).length; return `<button class="side-sub-item knowledge-leaf" type="button" data-team-folder="${escapeTeamHTML(team.id)}" data-knowledge-folder="${escapeTeamHTML(agent)}"><svg class="icon"><use href="#ico-folder"/></svg><span class="tree-folder-name">${escapeTeamHTML(agent)}</span><span class="tree-count">${count}</span></button>`; }).join("") : `<button class="side-sub-item knowledge-leaf" type="button" data-team-folder="${escapeTeamHTML(team.id)}" data-knowledge-folder="Agent 产物"><svg class="icon"><use href="#ico-folder"/></svg><span class="tree-folder-name">暂无 Agent 产物</span><span class="tree-count">0</span></button>`}</div></div></div></div>`;
  };

  const renderTeamFilesTree = () => {
    const groups = el("#team-files-groups");
    if (groups) groups.innerHTML = getVisibleTeams().map(teamFileTreeHTML).join("");
  };

  const teamSettingsHTML = () => `
    <section class="team-settings-workspace" data-main-view="team-settings" hidden aria-label="团队设置">
      <div class="team-settings-shell">
        <aside class="team-settings-nav">
          <div class="team-settings-team" id="team-settings-team"></div>
          ${[
            ["overview", "ico-chart", "团队概览"],
            ["members", "ico-users", "成员与邀请"],
            ["billing", "ico-task", "订阅与用量"],
            ["general", "ico-task", "基础设置"]
          ].map((item) => `<button type="button" data-team-settings-nav="${item[0]}"><svg class="icon"><use href="#${item[1]}"/></svg>${item[2]}</button>`).join("")}
        </aside>
        <div class="team-settings-content" id="team-settings-content"></div>
      </div>
    </section>`;

  const teamModalsHTML = () => `
    <section class="modal team-modal" id="team-flow-modal" role="dialog" aria-modal="true" aria-labelledby="team-flow-title">
      <div class="modal-head"><div><h3 id="team-flow-title">创建团队</h3><p class="connector-config-intro">支付即开通，不需要企业资质审核</p></div><button class="close-btn" type="button" data-team-close aria-label="关闭"><svg class="icon"><use href="#ico-x"/></svg></button></div>
      <div class="modal-body" id="team-flow-body"></div>
    </section>
    <section class="modal team-share-modal team-modal" id="team-share-modal" role="dialog" aria-modal="true" aria-labelledby="team-share-title">
      <div class="modal-head"><div><h3 id="team-share-title">发布到团队</h3><p class="connector-config-intro">只发布你明确选择的 Session 内容</p></div><button class="close-btn" type="button" data-team-close aria-label="关闭"><svg class="icon"><use href="#ico-x"/></svg></button></div>
      <div class="modal-body" id="team-share-body"></div>
      <div class="modal-foot" id="team-share-foot"></div>
    </section>
    <section class="modal team-invite-modal team-modal" id="team-invite-modal" role="dialog" aria-modal="true" aria-labelledby="team-invite-title">
      <div class="modal-head"><div><h3 id="team-invite-title">邀请团队成员</h3><p class="connector-config-intro">邀请中的成员会预占一个席位</p></div><button class="close-btn" type="button" data-team-close aria-label="关闭"><svg class="icon"><use href="#ico-x"/></svg></button></div>
      <div class="modal-body" id="team-invite-body"></div>
      <div class="modal-foot"><button class="secondary-btn" type="button" data-team-close>取消</button><button class="primary-btn" type="button" id="team-invite-submit">发送邀请</button></div>
    </section>
    <section class="modal team-confirm-modal team-modal" id="team-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="team-confirm-title">
      <div class="modal-head"><div><h3 id="team-confirm-title">确认操作</h3><p class="connector-config-intro">请确认你已了解此操作的影响</p></div><button class="close-btn" type="button" data-team-close aria-label="关闭"><svg class="icon"><use href="#ico-x"/></svg></button></div>
      <div class="modal-body" id="team-confirm-body"></div>
      <div class="modal-foot"><button class="secondary-btn" type="button" data-team-close>取消</button><button class="primary-btn" type="button" id="team-confirm-submit" disabled>确认</button></div>
    </section>
    <section class="modal team-upgrade-modal team-modal" id="team-upgrade-modal" role="dialog" aria-modal="true" aria-labelledby="team-upgrade-title">
      <div class="modal-head"><div><h3 id="team-upgrade-title">升级团队套餐</h3><p class="connector-config-intro">升级后立即获得更高席位与共享权益</p></div><button class="close-btn" type="button" data-team-close aria-label="关闭"><svg class="icon"><use href="#ico-x"/></svg></button></div>
      <div class="modal-body" id="team-upgrade-body"></div>
    </section>`;

  const injectTeamUI = () => {
    const brandRow = el(".brand-row");
    if (brandRow && !el("#team-workspace-switcher")) brandRow.insertAdjacentHTML("afterbegin", workspaceSwitcherHTML());
    const sidebar = el(".sidebar");
    if (sidebar && !el("#personal-team-cta")) sidebar.insertAdjacentHTML("beforeend", personalCTAHTML());
    const recordingHome = el(".recording-home");
    if (recordingHome && teamHomeHTML().trim() && !el("#team-home-hero")) recordingHome.insertAdjacentHTML("afterbegin", teamHomeHTML());
    const main = el("main.main");
    if (main && !el('[data-main-view="team-settings"]')) main.insertAdjacentHTML("beforeend", teamSettingsHTML());
    if (!el("#team-flow-modal")) document.body.insertAdjacentHTML("beforeend", teamModalsHTML());

    const history = el("#history-task-list");
    if (history && !el('[data-team-shared-history="true"]')) {
      history.insertAdjacentHTML("afterbegin", '<div class="history-row team-only team-flex" data-history-type="shared" data-team-shared-history="true"><svg class="icon"><use href="#ico-users"/></svg><span class="history-text">竞品分析与首页方案复盘</span><span class="history-time">可接力</span><button class="team-inline-share" type="button" data-team-shared-open aria-label="打开共享 Session">打开并接力</button></div>');
    }
    const firstHistory = el(".history-row[data-history-type='normal']");
    if (firstHistory && !el(".team-inline-share", firstHistory)) {
      firstHistory.insertAdjacentHTML("beforeend", '<button class="team-inline-share" type="button" aria-label="发布 Session 到团队" data-team-action="share"><svg class="icon"><use href="#ico-users"/></svg><span>发布 Session</span></button>');
    }

    const knowledgeList = el("#knowledge-side-list");
    if (knowledgeList && !el("#team-files-groups")) knowledgeList.insertAdjacentHTML("afterbegin", '<div id="team-files-groups" class="team-files-groups team-only"></div>');
    renderTeamFilesTree();
  };

  const renderWorkspaceSwitcher = () => {
    const menu = el("#team-space-menu");
    if (!menu) return;
    const activeTeam = getActiveTeam();
    const inTeam = document.body.dataset.workspace === "team" && activeTeam;
    el("#team-workspace-kind").textContent = inTeam ? "团队工作台" : "个人工作台";
    el("#team-workspace-name").textContent = inTeam ? activeTeam.name : "张伟的空间";
    el("#team-workspace-avatar").textContent = inTeam ? activeTeam.name.slice(0, 1) : "张";
    menu.innerHTML = `
      <div class="team-space-menu-label">个人空间</div>
      <button type="button" class="${inTeam ? "" : "active"}" data-workspace-target="personal"><span class="team-space-menu-mark">张</span><span><strong>张伟的空间</strong><small>私人会议、知识与 Agent 任务</small></span>${inTeam ? "" : "<em>当前</em>"}</button>
      ${inTeam ? `<div class="team-space-menu-label">当前团队</div><button type="button" class="team-space-action" data-team-action="settings" data-team-panel="overview"><svg class="icon"><use href="#ico-task"/></svg><span><strong>团队设置</strong><small>${escapeTeamHTML(getPlan(activeTeam).name)} · 成员、订阅、基础设置</small></span></button><button type="button" class="team-space-action" data-team-action="invite"><svg class="icon"><use href="#ico-plus"/></svg><span><strong>邀请成员</strong><small>通过链接或邮件邀请</small></span></button><button type="button" class="team-space-action" data-team-action="upgrade"><svg class="icon"><use href="#ico-task"/></svg><span><strong>升级套餐</strong><small>提升席位、额度与协作能力</small></span></button>` : ""}
      ${getVisibleTeams().length ? `<div class="team-space-menu-label">团队空间</div>${getVisibleTeams().map((team) => `<button type="button" class="${inTeam && team.id === activeTeam.id ? "active" : ""}" data-workspace-target="team" data-team-id="${escapeTeamHTML(team.id)}"><span class="team-space-menu-mark team">${escapeTeamHTML(team.name.slice(0, 1))}</span><span><strong>${escapeTeamHTML(team.name)}</strong><small>${escapeTeamHTML(getPlan(team).name)} · ${getSeatUsage(team)}/${getPlan(team).seats} 人 · ${team.role === "owner" ? "创建人" : team.role === "admin" ? "管理员" : "成员"}</small></span>${inTeam && team.id === activeTeam.id ? "<em>当前</em>" : ""}</button>`).join("")}` : ""}
      <div class="team-space-menu-divider"></div>
      <button type="button" class="team-space-action" data-team-action="create" ${canCreateTeam() ? "" : "disabled"}><svg class="icon"><use href="#ico-plus"/></svg><span><strong>${canCreateTeam() ? "创建团队" : "已达到创建上限"}</strong><small>${canCreateTeam() ? `${getOwnedTeams().length} / 3 个团队，支付即开通` : "一个账号最多创建 3 个团队"}</small></span></button>
      <button type="button" class="team-space-action" data-team-action="apply-enterprise"><svg class="icon"><use href="#ico-users"/></svg><span><strong>申请企业版</strong><small>组织架构、SSO 与复杂权限</small></span></button>`;
  };

  const renderTeamHome = () => {
    const team = getActiveTeam();
    if (!team) return;
    const latest = team.sharePackages[0];
    const sharedHistory = el('[data-team-shared-history="true"]');
    if (sharedHistory) {
      const title = el(".history-text", sharedHistory);
      if (title) title.textContent = latest ? latest.title : "暂无团队共享 Session";
    }
    const count = el("#team-files-count");
    if (count) count.textContent = String(team.artifacts.length + team.agentArtifacts.length);
  };

  const teamKnowledgeRows = (team, folderName) => {
    const includeShared = !folderName || folderName.includes("团队文件") || folderName === "团队共享";
    const includeArtifacts = !folderName || folderName.includes("团队文件") || folderName === "团队产物";
    const includeAgentArtifacts = !folderName || folderName.includes("团队文件") || folderName === "Agent 产物" || team.agentArtifacts.some((item) => item.agent === folderName);
    const selectedAgentArtifacts = includeAgentArtifacts ? team.agentArtifacts.filter((item) => !folderName || folderName.includes("团队文件") || folderName === "Agent 产物" || item.agent === folderName) : [];
    const sharedRows = includeShared ? team.sharePackages.map((item) => ({
      id: item.id,
      kind: "share",
      name: item.title,
      meta: `${item.sourceOwner} 发布 · v${item.version} · ${item.items.length} 项上下文`,
      size: "-",
      count: item.items.length,
      type: "共享 Session",
      source: "团队共享",
      state: item.continuedBy ? "已接力" : "可接力",
      updated: item.createdAt,
      icon: "ico-task"
    })) : [];
    const artifactRows = includeArtifacts ? team.artifacts.map((item, index) => ({
      id: `${team.id}-artifact-${index}`,
      kind: "artifact",
      name: item.name,
      meta: `${item.owner} 沉淀 · ${item.type}`,
      size: "-",
      count: "-",
      type: item.type,
      source: "团队产物",
      state: "已入库",
      updated: item.updated,
      icon: "ico-file"
    })) : [];
    const agentRows = selectedAgentArtifacts.map((item) => ({
      id: `${team.id}-agent-${item.agent}-${item.name}`,
      kind: "agent",
      name: item.name,
      meta: `${item.agent} 生成 · ${item.type}`,
      size: "-",
      count: "-",
      type: item.type,
      source: "Agent 产物",
      state: "已生成",
      updated: item.updated,
      icon: "ico-agent",
      agent: item.agent
    }));
    return sharedRows.concat(artifactRows, agentRows);
  };

  const renderTeamKnowledgeFiles = (team, folderName) => {
    const list = el("#knowledge-file-list");
    const empty = el("#knowledge-empty");
    const tableHead = el("#knowledge-table-head");
    if (!list || !empty || !tableHead) return;
    const rows = teamKnowledgeRows(team, folderName);
    tableHead.dataset.schema = "team";
    tableHead.innerHTML = ["", "名称", "大小", "数量", "类型", "来源", "状态", "更新时间", "操作"].map((label, index) => index === 0 ? '<span><input class="knowledge-check" id="knowledge-check-all" type="checkbox" aria-label="全选" /></span>' : `<span>${label}</span>`).join("");
    list.innerHTML = rows.map((item) => `<div class="knowledge-file-row team-knowledge-row" data-schema="file" role="button" tabindex="0" data-team-knowledge-kind="${escapeTeamHTML(item.kind)}" data-team-knowledge-id="${escapeTeamHTML(item.id)}"><span><input class="knowledge-check" type="checkbox" aria-label="选择${escapeTeamHTML(item.name)}" /></span><span class="knowledge-file-name"><span class="knowledge-file-mark team"><svg class="icon"><use href="#${escapeTeamHTML(item.icon)}"/></svg></span><span><strong>${escapeTeamHTML(item.name)}</strong><small>${escapeTeamHTML(item.meta)}</small></span></span><span>${escapeTeamHTML(item.size)}</span><span>${escapeTeamHTML(item.count)}</span><span>${escapeTeamHTML(item.type)}</span><span>${escapeTeamHTML(item.source)}</span><span class="knowledge-state${item.state === "可接力" ? " pending" : ""}"><i></i>${escapeTeamHTML(item.state)}</span><span>${escapeTeamHTML(item.updated)}</span><span class="knowledge-row-action"><button type="button" data-team-knowledge-preview aria-label="打开${escapeTeamHTML(item.name)}"><svg class="icon"><use href="#ico-file"/></svg></button>${item.kind === "share" ? `<button type="button" data-team-continue="${escapeTeamHTML(item.id)}" aria-label="接力${escapeTeamHTML(item.name)}"><svg class="icon"><use href="#ico-agent"/></svg></button>` : ""}</span></div>`).join("");
    empty.hidden = rows.length > 0;
  };

  const updateTeamKnowledgeStorage = (team) => {
    const storage = el('[data-storage-space="personal"]');
    const used = el("#personal-storage-remaining");
    const progress = el("#personal-storage-progress");
    const meta = el("#personal-storage-meta");
    if (!storage || !used || !progress || !meta) return;
    const plan = getPlan(team);
    const label = el(".knowledge-storage-copy span", storage);
    if (label) label.textContent = "团队空间已使用";
    used.textContent = `${team.usage.storage} GB / ${plan.storage} GB`;
    progress.style.width = `${Math.min(100, team.usage.storage / plan.storage * 100).toFixed(2)}%`;
    meta.textContent = `剩余 ${Math.max(0, plan.storage - team.usage.storage)} GB`;
  };

  const restorePersonalKnowledgeStorage = () => {
    const storage = el('[data-storage-space="personal"]');
    const used = el("#personal-storage-remaining");
    const progress = el("#personal-storage-progress");
    const meta = el("#personal-storage-meta");
    if (!storage || !used || !progress || !meta) return;
    const label = el(".knowledge-storage-copy span", storage);
    if (label) label.textContent = "个人空间已使用";
    used.textContent = "859.38 MB / 50 GB";
    progress.style.width = "1.68%";
    meta.textContent = "剩余 49.16 GB";
  };

  const openTeamKnowledgeFolder = (team, folderName, trigger) => {
    if (!team || typeof openKnowledgeFolder !== "function") return;
    const title = folderName || `${team.name}的团队文件`;
    openKnowledgeFolder(title, trigger || el(`[data-team-tree-toggle="${team.id}"]`));
    const titleNode = el("#knowledge-folder-title");
    const crumb = el("#knowledge-breadcrumb-current");
    const meta = el("#knowledge-folder-meta");
    const primary = el("#knowledge-primary-label");
    if (titleNode) titleNode.textContent = title === `${team.name}的团队文件` ? `${team.name}的团队文件` : title;
    if (crumb) crumb.textContent = title === `${team.name}的团队文件` ? `${team.name}的团队文件` : title;
    if (meta) meta.textContent = title === "团队共享" ? "成员显式发布的 Session 快照，可交给你的 Agent 继续" : title === "团队产物" ? "团队成员协作生成的 Excel、PPT、HTML、MD 等文件" : title === "Agent 产物" ? "团队 Agent 生成的结构化文件与网页产物" : title.includes("Agent") ? `由「${title}」生成并保存的团队 Agent 产物。` : "团队成员共享的 Session、资料与 Agent 产物";
    if (primary) primary.textContent = title.includes("Agent") ? "上传Agent产物" : "上传团队文件";
    renderTeamKnowledgeFiles(team, title);
    updateTeamKnowledgeStorage(team);
  };

  const setTeamWorkspace = (workspace, teamId, options = {}) => {
    if (workspace === "team") {
      const team = teamId ? teamState.teams.find((item) => item.id === teamId) : getActiveTeam() || ensureDemoTeam();
      if (!team) return;
      teamState.activeTeamId = team.id;
      teamState.activeWorkspace = "team";
      document.body.dataset.edition = "personal";
      document.body.dataset.workspace = "team";
      document.body.classList.toggle("team-readonly", team.status === "readonly");
      if (typeof mainViewTitles === "object") mainViewTitles.home = `${team.name} · 团队工作台`;
      const editionLabel = el("#user-edition-label");
      if (editionLabel) editionLabel.textContent = "团队版";
      if (typeof showMainView === "function") showMainView("home", { silent: true });
      const pageCrumb = el("#page-crumb");
      if (pageCrumb) pageCrumb.textContent = `${team.name} · 团队文件`;
      renderTeamHome();
    } else {
      teamState.activeWorkspace = "personal";
      document.body.dataset.edition = "personal";
      document.body.dataset.workspace = "personal";
      document.body.classList.remove("team-readonly");
      if (typeof mainViewTitles === "object") mainViewTitles.home = "我的 AI 工作台";
      const editionLabel = el("#user-edition-label");
      if (editionLabel) editionLabel.textContent = "个人版";
      if (typeof showMainView === "function") showMainView("home", { silent: true });
      const pageCrumb = el("#page-crumb");
      if (pageCrumb) pageCrumb.textContent = "我的 AI 工作台";
      restorePersonalKnowledgeStorage();
    }
    persistTeamState();
    renderWorkspaceSwitcher();
    renderTeamFilesTree();
    if (workspace === "team" && !options.preserveView) {
      window.setTimeout(() => {
        const currentTeam = getActiveTeam();
        if (currentTeam) openTeamKnowledgeFolder(currentTeam, `${currentTeam.name || "团队"}的团队文件`);
      }, 0);
    }
    const menu = el("#team-space-menu");
    const button = el("#team-workspace-switcher-button");
    if (menu) menu.classList.remove("show");
    if (button) button.setAttribute("aria-expanded", "false");
  };

  const flowStepSidebar = (step) => {
    const items = [
      [1, "团队与套餐", "名称、人数与订阅周期"],
      [2, "选配硬件", "三档录音卡可混合购买"],
      [3, "确认并支付", "订阅与硬件分别计价"],
      [4, "开通完成", "进入团队文件协作区"]
    ];
    return `<aside class="team-flow-aside"><strong>创建轻团队</strong><p>个人账号直接创建，无需企业资质审核。</p><div class="team-flow-steps">${items.map((item) => `<div class="team-flow-step ${step === item[0] ? "active" : step > item[0] ? "done" : ""}"><span>${step > item[0] ? "✓" : item[0]}</span><div><strong>${item[1]}</strong><small>${item[2]}</small></div></div>`).join("")}</div></aside>`;
  };

  const flowFooter = (step, note, nextLabel) => `<div class="team-flow-footer"><span>${note || "原型试算值，不作为正式销售政策"}</span><div class="team-flow-footer-actions">${step > 1 ? '<button class="back" type="button" data-team-flow-back>上一步</button>' : ""}<button class="next" type="button" data-team-flow-next>${nextLabel || "下一步"}</button></div></div>`;

  const renderPlanCard = (plan, cycle, selected) => `<button type="button" class="team-plan-option ${selected ? "selected" : ""}" data-team-plan="${plan.id}">${plan.recommended ? '<em class="recommended">推荐</em>' : ""}<h3>${plan.name}</h3><div class="team-plan-price"><strong>${formatCurrency(plan[cycle])}</strong><span>/${cycle === "month" ? "月" : "年"}</span></div><p>${plan.seats} 个固定席位</p><ul><li>${plan.minutes.toLocaleString()} 分钟团队转写</li><li>${(plan.credits / 10000).toLocaleString()} 万共享 Credits</li><li>${plan.storage}GB 团队知识库</li><li>${plan.agents} 个 AI 专家协作入口</li><li>团队与组织管理：${plan.management}</li></ul></button>`;

  const renderEnterprisePlanCard = () => `<article class="team-plan-enterprise" aria-label="企业版"><div><span class="team-plan-kicker">企业版</span><h3>${ENTERPRISE_PLAN.name}</h3><p>${ENTERPRISE_PLAN.summary}</p></div><div class="team-enterprise-includes">已包含全部团队版能力</div><ul>${ENTERPRISE_PLAN.sections.map((section) => `<li><strong>${section[0]}</strong><span>${section[1]}</span></li>`).join("")}</ul><button type="button" data-team-enterprise-plan>${ENTERPRISE_PLAN.tag}</button></article>`;

  const renderPlanStep = () => {
    const checkout = teamState.checkout;
    return `<div class="team-flow-shell">${flowStepSidebar(1)}<div class="team-flow-content">
      <h2>创建一个可以接力工作的团队</h2><p class="team-flow-lead">团队不是小号企业版：没有组织架构和审批，成员在同一空间共享 Session、知识与 Agent 产物。</p>
      <div class="team-flow-name"><input id="team-create-name" maxlength="24" value="${escapeTeamHTML(checkout.teamName)}" aria-label="团队名称" placeholder="输入团队名称"/><span class="team-flow-error" id="team-name-error">请输入 2–24 个字符的团队名称</span></div>
      <div class="team-cycle-toggle" role="group" aria-label="订阅周期"><button type="button" data-team-cycle="month" class="${checkout.cycle === "month" ? "active" : ""}">月付</button><button type="button" data-team-cycle="year" class="${checkout.cycle === "year" ? "active" : ""}">年付 · 省 2 个月</button></div>
      <div class="team-plan-grid">${Object.values(TEAM_PLANS).map((plan) => renderPlanCard(plan, checkout.cycle, checkout.planId === plan.id)).join("")}${renderEnterprisePlanCard()}</div>
      ${flowFooter(1, "一个账号最多创建 3 个团队", "配置硬件")}
    </div></div>`;
  };

  const renderHardwareStep = () => {
    const checkout = teamState.checkout;
    const totalCount = hardwareCount(checkout.hardware);
    return `<div class="team-flow-shell">${flowStepSidebar(2)}<div class="team-flow-content">
      <h2>按使用岗位选配录音卡</h2><p class="team-flow-lead">硬件一次性购买，可同时选择不同档位；不购买也能直接开通团队订阅。</p>
      <div class="team-hardware-grid">${Object.values(HARDWARE_TIERS).map((tier) => `<article class="team-hardware-card"><h3>${tier.name}</h3><p>${tier.summary}</p><strong>${formatCurrency(tier.price)}</strong><div class="team-hardware-stepper"><button type="button" data-hardware-tier="${tier.id}" data-hardware-step="-1" aria-label="减少${tier.name}数量">−</button><span>${checkout.hardware[tier.id]}</span><button type="button" data-hardware-tier="${tier.id}" data-hardware-step="1" aria-label="增加${tier.name}数量">＋</button></div></article>`).join("")}</div>
      <div class="team-hardware-note">已选 ${totalCount} 台，硬件小计 <strong>${formatCurrency(hardwareTotal(checkout.hardware))}</strong>。硬件与团队订阅在同一订单支付，订阅立即开通，硬件进入待发货。</div>
      ${totalCount ? `<div class="team-form-grid" style="margin-top:14px"><div class="team-form-field"><label>收货人</label><input id="team-recipient" value="${escapeTeamHTML(checkout.recipient)}"/></div><div class="team-form-field"><label>手机号</label><input id="team-phone" value="${escapeTeamHTML(checkout.phone)}"/></div><div class="team-form-field full"><label>收货地址</label><input id="team-address" value="${escapeTeamHTML(checkout.address)}"/></div></div><span class="team-flow-error" id="team-address-error">购买硬件时需要填写完整收货信息</span>` : ""}
      ${flowFooter(2, "硬件价格沿用现有标准 / 专业 / 卓越三档", "确认订单")}
    </div></div>`;
  };

  const checkoutRows = () => {
    const checkout = teamState.checkout;
    const plan = TEAM_PLANS[checkout.planId];
    const rows = [{ label: `${plan.name} · ${checkout.cycle === "month" ? "月付" : "年付"}`, amount: plan[checkout.cycle] }];
    Object.entries(checkout.hardware).forEach((entry) => {
      if (entry[1] > 0) rows.push({ label: `${HARDWARE_TIERS[entry[0]].name}录音卡 × ${entry[1]}`, amount: HARDWARE_TIERS[entry[0]].price * entry[1] });
    });
    return rows;
  };

  const renderCheckoutStep = () => {
    const checkout = teamState.checkout;
    const rows = checkoutRows();
    const total = rows.reduce((sum, row) => sum + row.amount, 0);
    return `<div class="team-flow-shell">${flowStepSidebar(3)}<div class="team-flow-content">
      <h2>确认订单并开通团队</h2><p class="team-flow-lead">订单会锁定团队草稿、套餐周期和硬件配置；重复支付回调不会创建重复团队。</p>
      <div class="team-checkout-grid"><div><div class="team-order-card">${rows.map((row) => `<div class="team-order-row"><span>${escapeTeamHTML(row.label)}</span><strong>${formatCurrency(row.amount)}</strong></div>`).join("")}<div class="team-order-row total"><span>本次应付</span><strong>${formatCurrency(total)}</strong></div></div>${hardwareCount(checkout.hardware) ? `<div class="team-setting-note">收货至：${escapeTeamHTML(checkout.recipient)}，${escapeTeamHTML(checkout.phone)}，${escapeTeamHTML(checkout.address)}</div>` : ""}</div>
      <aside class="team-payment-box"><strong>选择支付方式</strong><div class="team-payment-methods"><button class="team-payment-method ${checkout.paymentMethod === "wechat" ? "selected" : ""}" type="button" data-payment-method="wechat"><i></i>微信支付</button><button class="team-payment-method ${checkout.paymentMethod === "alipay" ? "selected" : ""}" type="button" data-payment-method="alipay"><i></i>支付宝</button></div><div class="team-payment-actions"><button class="pay" type="button" data-team-pay>支付 ${formatCurrency(total)} 并开通</button><button class="fail" type="button" data-team-pay-fail>模拟支付失败</button></div><div class="team-payment-error" id="team-payment-error">支付未完成，订单配置已保留。你可以检查支付方式后重试。</div></aside></div>
      ${flowFooter(3, "本原型不会发起真实支付", "返回修改")}
    </div></div>`;
  };

  const renderSuccessStep = () => {
    const team = getActiveTeam();
    const plan = getPlan(team);
    const count = hardwareCount(teamState.checkout.hardware);
    return `<div class="team-flow-shell">${flowStepSidebar(4)}<div class="team-flow-content"><div class="team-success"><div class="team-success-inner"><span class="team-success-mark">✓</span><h2>团队已开通</h2><p>${escapeTeamHTML(team.name)} 已成为独立团队 Workspace。成员只会看到发布到团队的内容。</p><div class="team-success-summary"><div><span>当前套餐</span><strong>${plan.name} · ${plan.seats} 人</strong></div><div><span>共享权益</span><strong>${plan.minutes.toLocaleString()} 分钟 · ${(plan.credits / 10000).toLocaleString()} 万 Credits</strong></div><div><span>硬件订单</span><strong>${count ? `${count} 台 · 待发货` : "未选购"}</strong></div></div><div class="team-success-actions"><button class="secondary" type="button" data-team-action="invite">邀请成员</button><button class="primary" type="button" data-team-enter-workspace>进入团队文件</button></div></div></div></div></div>`;
  };

  const bindFlowEvents = () => {
    const body = el("#team-flow-body");
    if (!body) return;
    const nameInput = el("#team-create-name", body);
    if (nameInput) nameInput.addEventListener("input", () => { teamState.checkout.teamName = nameInput.value; persistTeamState(); el("#team-name-error").classList.remove("show"); });
    els("[data-team-cycle]", body).forEach((button) => button.addEventListener("click", () => { teamState.checkout.cycle = button.dataset.teamCycle; persistTeamState(); renderTeamFlow(1); }));
    els("[data-team-plan]", body).forEach((button) => button.addEventListener("click", () => { teamState.checkout.planId = button.dataset.teamPlan; persistTeamState(); renderTeamFlow(1); }));
    els("[data-team-enterprise-plan]", body).forEach((button) => button.addEventListener("click", () => { closeTeamOverlays(); applyEnterprise({ teamName: teamState.checkout.teamName.trim() }); }));
    els("[data-hardware-step]", body).forEach((button) => button.addEventListener("click", () => {
      const tier = button.dataset.hardwareTier;
      const next = Math.max(0, Math.min(20, Number(teamState.checkout.hardware[tier] || 0) + Number(button.dataset.hardwareStep)));
      teamState.checkout.hardware[tier] = next;
      persistTeamState();
      renderTeamFlow(2);
    }));
    [["team-recipient", "recipient"], ["team-phone", "phone"], ["team-address", "address"]].forEach((entry) => {
      const input = el(`#${entry[0]}`, body);
      if (input) input.addEventListener("input", () => { teamState.checkout[entry[1]] = input.value; persistTeamState(); });
    });
    els("[data-payment-method]", body).forEach((button) => button.addEventListener("click", () => { teamState.checkout.paymentMethod = button.dataset.paymentMethod; persistTeamState(); renderTeamFlow(3); }));
    const back = el("[data-team-flow-back]", body);
    if (back) back.addEventListener("click", () => renderTeamFlow(Math.max(1, teamState.checkout.step - 1)));
    const next = el("[data-team-flow-next]", body);
    if (next) next.addEventListener("click", () => {
      if (teamState.checkout.step === 1) {
        const name = teamState.checkout.teamName.trim();
        if (name.length < 2) { el("#team-name-error").classList.add("show"); nameInput.focus(); return; }
        renderTeamFlow(2);
      } else if (teamState.checkout.step === 2) {
        if (hardwareCount(teamState.checkout.hardware) && (!teamState.checkout.recipient.trim() || !/^1\d{10}$/.test(teamState.checkout.phone.trim()) || teamState.checkout.address.trim().length < 6)) {
          el("#team-address-error").classList.add("show"); return;
        }
        if (!teamState.checkout.orderId) teamState.checkout.orderId = `TEAM-ORDER-${Date.now()}`;
        persistTeamState();
        renderTeamFlow(3);
      } else if (teamState.checkout.step === 3) renderTeamFlow(2);
    });
    const pay = el("[data-team-pay]", body);
    if (pay) pay.addEventListener("click", processTeamPayment);
    const fail = el("[data-team-pay-fail]", body);
    if (fail) fail.addEventListener("click", () => { el("#team-payment-error").classList.add("show"); showTeamToast("支付失败，订单配置已保留"); });
    const enter = el("[data-team-enter-workspace]", body);
    if (enter) enter.addEventListener("click", () => { closeTeamOverlays(); setTeamWorkspace("team", teamState.activeTeamId); });
  };

  const renderTeamFlow = (step) => {
    teamState.checkout.step = step;
    persistTeamState();
    const body = el("#team-flow-body");
    if (!body) return;
    body.innerHTML = step === 1 ? renderPlanStep() : step === 2 ? renderHardwareStep() : step === 3 ? renderCheckoutStep() : renderSuccessStep();
    bindFlowEvents();
  };

  const openTeamFlow = (step) => {
    if (!canCreateTeam() && step < 4) {
      showTeamToast("已达到 3 个团队的创建上限");
      return;
    }
    if ((step || 1) === 1) {
      teamState.checkout.orderId = null;
      if (getOwnedTeams().length) teamState.checkout.teamName = `产品共创组 ${getOwnedTeams().length + 1}`;
    }
    renderTeamFlow(step || 1);
    openTeamModal("#team-flow-modal");
  };

  const renderUpgradeModal = (team) => {
    const body = el("#team-upgrade-body");
    if (!body || !team) return;
    const current = getPlan(team);
    const options = Object.values(TEAM_PLANS).filter((plan) => plan.seats > current.seats);
    if (!options.length) {
      body.innerHTML = '<div class="team-upgrade-empty"><span class="team-success-mark">✓</span><h3>当前已是最高团队套餐</h3><p>团队成长版已包含 30 个固定席位。需要组织架构、SSO、复杂权限或安全合规时，建议联系专属顾问申请企业版。</p><div class="team-upgrade-empty-actions"><button type="button" class="secondary-btn" data-team-close>返回团队设置</button><button type="button" class="primary-btn" data-team-action="apply-enterprise">联系专属顾问</button></div></div>';
      return;
    }
    teamState.upgrade = { teamId: team.id, planId: options[0].id, orderId: null };
    body.innerHTML = `<div class="team-upgrade-context"><strong>${escapeTeamHTML(team.name)}</strong><span>当前：${escapeTeamHTML(current.name)} · ${team.cycle === "year" ? "年付" : "月付"}</span></div><div class="team-upgrade-grid">${options.map((plan) => `<button type="button" class="team-upgrade-option ${plan.id === teamState.upgrade.planId ? "selected" : ""}" data-team-upgrade-plan="${plan.id}"><span class="team-upgrade-option-top"><strong>${plan.name}</strong>${plan.recommended ? "<em>推荐</em>" : ""}</span><span class="team-upgrade-price">${formatCurrency(plan[team.cycle])}<small>/${team.cycle === "year" ? "年" : "月"}</small></span><span>${plan.seats} 人席位 · ${plan.minutes.toLocaleString()} 分钟 · ${(plan.credits / 10000).toFixed(0)} 万 Credits · ${plan.storage}GB · ${plan.management}</span></button>`).join("")}</div><div class="team-upgrade-summary"><span>本次应付（模拟）</span><strong id="team-upgrade-total">${formatCurrency(options[0][team.cycle])}</strong></div><p class="team-upgrade-note">升级会立即增加席位、共享额度、知识容量与团队协作管理能力；超过 30 人或需要组织架构时申请企业版。</p><div class="modal-foot team-upgrade-foot"><button class="secondary-btn" type="button" data-team-close>取消</button><button class="secondary-btn" type="button" data-team-action="apply-enterprise">申请企业版</button><button class="primary-btn" type="button" data-team-upgrade-pay>支付并升级</button></div>`;
    body.querySelectorAll("[data-team-upgrade-plan]").forEach((option) => option.addEventListener("click", () => {
      body.querySelectorAll("[data-team-upgrade-plan]").forEach((item) => item.classList.remove("selected"));
      option.classList.add("selected");
      teamState.upgrade.planId = option.dataset.teamUpgradePlan;
      el("#team-upgrade-total").textContent = formatCurrency(TEAM_PLANS[teamState.upgrade.planId][team.cycle]);
    }));
    body.querySelector("[data-team-upgrade-pay]").addEventListener("click", () => processTeamUpgrade(team));
  };

  const openTeamUpgrade = () => {
    const team = getActiveTeam();
    if (!team) return;
    if (team.status === "readonly") { showTeamToast("团队订阅已到期，请续费后再升级"); return; }
    renderUpgradeModal(team);
    openTeamModal("#team-upgrade-modal");
  };

  const processTeamUpgrade = (team) => {
    const plan = TEAM_PLANS[teamState.upgrade.planId];
    if (!plan || plan.seats <= getPlan(team).seats) { showTeamToast("请选择更高档套餐"); return; }
    const orderId = teamState.upgrade.orderId || `UPGRADE-${team.id}-${Date.now()}`;
    teamState.upgrade.orderId = orderId;
    if (teamState.processedOrders.includes(orderId)) { showTeamToast("升级订单已处理，没有重复扣费"); closeTeamOverlays(); return; }
    team.planId = plan.id;
    teamState.processedOrders.push(orderId);
    persistTeamState();
    closeTeamOverlays();
    renderWorkspaceSwitcher();
    renderTeamFilesTree();
    renderTeamHome();
    renderTeamSettings("billing");
    showTeamToast(`已升级至${plan.name}，团队权益立即生效`);
  };

  const processTeamPayment = () => {
    const orderId = teamState.checkout.orderId || `TEAM-ORDER-${Date.now()}`;
    teamState.checkout.orderId = orderId;
    let team = null;
    if (teamState.processedOrders.includes(orderId)) {
      team = teamState.teams.find((item) => item.orderId === orderId) || getActiveTeam();
      showTeamToast("订单已处理，没有重复创建团队");
    } else {
      if (!canCreateTeam()) { showTeamToast("已达到 3 个团队的创建上限"); return; }
      const plan = TEAM_PLANS[teamState.checkout.planId];
      const orderCount = hardwareCount(teamState.checkout.hardware);
      team = createSeedTeam({
        id: `team-${Date.now()}`,
        name: teamState.checkout.teamName.trim(),
        planId: plan.id,
        cycle: teamState.checkout.cycle,
        hardwareOrders: orderCount ? [{ id: `HW-${Date.now()}`, count: orderCount, status: "待发货", amount: hardwareTotal(teamState.checkout.hardware), hardware: Object.assign({}, teamState.checkout.hardware) }] : []
      });
      team.orderId = orderId;
      teamState.teams.push(team);
      teamState.ownedTeamId = team.id;
      teamState.ownedTeamIds = [...new Set([...teamState.ownedTeamIds, team.id])];
      teamState.activeTeamId = team.id;
      teamState.processedOrders.push(orderId);
      persistTeamState();
      showTeamToast("支付成功，团队已立即开通");
    }
    teamState.activeTeamId = team.id;
    persistTeamState();
    renderWorkspaceSwitcher();
    renderTeamFlow(4);
  };

  const applyEnterprise = (options = {}) => {
    const team = document.body.dataset.workspace === "team" && !options.teamName ? getActiveTeam() : null;
    const existing = el("#enterprise-apply-modal");
    if (existing) existing.remove();
    const prefill = escapeTeamHTML(options.teamName || (team ? team.name : ""));
    const modal = document.createElement("section");
    modal.id = "enterprise-apply-modal";
    modal.className = "modal enterprise-apply-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.innerHTML = `<div class="modal-head"><div><h2>企业入驻申请</h2><p>提交企业信息，审核通过后开通百销试用与企业工作台</p></div><button class="modal-close" type="button" data-enterprise-apply-close aria-label="关闭">×</button></div>
      <form id="enterprise-apply-form" class="enterprise-apply-body">
        ${team ? `<div class="enterprise-apply-context"><strong>已带入团队信息</strong>${prefill} · ${getSeatUsage(team)} 名成员 · ${escapeTeamHTML(getPlan(team).name)}</div>` : options.teamName ? `<div class="enterprise-apply-context"><strong>已带入申请信息</strong>${prefill} · 企业版 · 专属顾问对接</div>` : ""}
        <section class="enterprise-apply-section"><h3>主体信息</h3><p>提交企业基础资料，便于工作人员联系与审核</p><div class="enterprise-apply-grid">
          <div class="enterprise-apply-field"><label>公司 / 背景 / 机构名称 <em>*</em></label><input name="company" required value="${prefill}" placeholder="请输入单位名称" /></div>
          <div class="enterprise-apply-field"><label>所属行业 <em>*</em></label><select name="industry" required><option value="">请选择行业</option><option>互联网 / 软件</option><option>教育培训</option><option>制造业</option><option>金融服务</option><option>专业服务</option><option>其他</option></select></div>
          <div class="enterprise-apply-field"><label>联系人姓名 <em>*</em></label><input name="contact" required placeholder="请输入联系人姓名" /></div>
          <div class="enterprise-apply-field"><label>预计开通人数 <em>*</em></label><select name="scale" required><option value="">请选择人数规模</option><option>1–20 人</option><option>21–50 人</option><option>51–200 人</option><option>200 人以上</option></select></div>
          <div class="enterprise-apply-field full"><label>联系人手机号 <em>*</em></label><input name="phone" required inputmode="tel" placeholder="请输入手机号" /></div>
          <div class="enterprise-apply-field full"><label>企业邮箱 <em>*</em></label><div class="enterprise-apply-inline"><input name="email" required type="email" placeholder="请输入企业邮箱" /><button type="button" data-enterprise-code>获取验证码</button></div></div>
          <div class="enterprise-apply-field full"><label>邮箱验证码 <em>*</em></label><input name="emailCode" required inputmode="numeric" placeholder="请输入邮箱验证码" /></div>
          <div class="enterprise-apply-field full"><label>当前使用的 OA</label><div class="enterprise-oa-options"><label><input type="radio" name="oa" value="飞书" checked />飞书</label><label><input type="radio" name="oa" value="钉钉" />钉钉</label><label><input type="radio" name="oa" value="企业微信" />企业微信</label><label><input type="radio" name="oa" value="其他" />其他</label></div></div>
          <div class="enterprise-apply-field"><label>企业代码 <em>*</em></label><input name="companyCode" required placeholder="仅限数字和字母" /><div class="enterprise-apply-help">仅可输入数字和字母，不区分大小写</div></div>
        </div></section>
        <label class="enterprise-apply-consent"><input type="checkbox" name="consent" required /> 我已阅读并同意 <a href="#" data-toast="隐私政策预览">《隐私政策》</a> 与 <a href="#" data-toast="服务条款预览">《服务条款》</a></label>
      </form><div class="enterprise-apply-footer"><button class="enterprise-apply-submit" type="submit" form="enterprise-apply-form">提交申请</button></div>`;
    document.body.appendChild(modal);
    el("#scrim").classList.add("show");
    modal.classList.add("show");
    el("#enterprise-apply-form").addEventListener("submit", (event) => { event.preventDefault(); if (!event.currentTarget.reportValidity()) return; modal.remove(); closeTeamOverlays(); showTeamToast("申请已提交，工作人员将尽快联系你"); });
    modal.querySelector("[data-enterprise-apply-close]").addEventListener("click", () => { modal.remove(); closeTeamOverlays(); });
    modal.querySelector("[data-enterprise-code]").addEventListener("click", (event) => { event.currentTarget.textContent = "已发送"; event.currentTarget.disabled = true; showTeamToast("验证码已发送至企业邮箱"); });
  };

  const teamSettingsHeader = (title, description, action) => `<div class="team-settings-title"><div><h2>${title}</h2><p>${description}</p></div>${action || ""}</div>`;

  const renderProgressRows = (team) => {
    const plan = getPlan(team);
    return `<div class="team-progress-list">${[
      ["转写时长", team.usage.minutes, plan.minutes, `${team.usage.minutes.toLocaleString()} / ${plan.minutes.toLocaleString()} 分钟`],
      ["Credits", team.usage.credits, plan.credits, `${team.usage.credits.toLocaleString()} / ${plan.credits.toLocaleString()}`],
      ["知识库", team.usage.storage, plan.storage, `${team.usage.storage} / ${plan.storage} GB`]
    ].map((item) => `<div class="team-progress-row"><span>${item[0]}</span><div class="team-usage-track"><i style="width:${Math.min(100, item[1] / item[2] * 100)}%"></i></div><strong>${item[3]}</strong></div>`).join("")}</div>`;
  };

  const renderOverviewPanel = (team) => `${teamSettingsHeader("团队概览", "查看成员与共享用量", '<button type="button" data-team-action="invite">邀请成员</button>')}
    <div class="team-stat-grid"><article class="team-stat-card"><span>团队成员</span><strong>${getSeatUsage(team)} / ${getPlan(team).seats}</strong><small>包含待接受邀请</small></article><article class="team-stat-card"><span>共享 Session</span><strong>${team.sharePackages.length}</strong><small>团队资产快照</small></article><article class="team-stat-card"><span>团队产物</span><strong>${team.artifacts.length + team.agentArtifacts.length}</strong><small>Excel、PPT、HTML、MD、Agent 产物</small></article><article class="team-stat-card"><span>协作空间</span><strong>${escapeTeamHTML(team.name)}的团队文件</strong><small>共享包、团队产物与 Agent 产物</small></article></div>
    <section class="team-section-card"><div class="team-section-card-head"><strong>本期共享用量</strong><span>每 31 天重置，不结转</span></div>${renderProgressRows(team)}</section>
    `;

  const renderMembersPanel = (team) => `${teamSettingsHeader("成员与邀请", "所有者、管理员和成员三种固定角色", '<button type="button" data-team-action="invite">邀请成员</button>')}
    <div class="team-seat-note"><span>已使用席位</span><strong>${getSeatUsage(team)} / ${getPlan(team).seats}</strong></div>
    <div class="team-settings-table"><div class="team-settings-table-row head"><span>成员</span><span>角色</span><span>状态</span><span>操作</span></div>${team.members.map((member) => `<div class="team-settings-table-row" data-member-id="${escapeTeamHTML(member.id)}"><div class="team-member"><span class="team-member-avatar">${escapeTeamHTML(member.name.slice(0,1))}</span><span><strong>${escapeTeamHTML(member.name)}</strong><small>${escapeTeamHTML(member.email)}</small></span></div><select class="team-role-select" data-team-member-role ${member.role === "owner" ? "disabled" : ""}><option value="admin" ${member.role === "admin" ? "selected" : ""}>管理员</option><option value="member" ${member.role === "member" ? "selected" : ""}>成员</option><option value="owner" ${member.role === "owner" ? "selected" : ""}>所有者</option></select><span class="team-member-state ${member.status === "pending" ? "pending" : ""}"><i></i>${member.status === "pending" ? "待接受" : "已加入"}</span><button class="team-row-action" type="button" data-team-member-remove ${member.role === "owner" ? "disabled" : ""}>${member.status === "pending" ? "撤销邀请" : "移除"}</button></div>`).join("")}</div>`;

  const renderBillingPanel = (team) => {
    const plan = getPlan(team);
    return `${teamSettingsHeader("订阅与用量", "团队权益归团队共享池，与个人会员互不混用", `<span class="team-settings-title-actions"><button type="button" data-team-action="upgrade">升级套餐</button><button type="button" data-team-action="apply-enterprise">申请企业版</button></span>`)}<div class="team-plan-current"><div><small>${team.status === "readonly" ? "订阅已到期 · 只读" : "当前生效"}</small><h3>${plan.name}</h3><p>${plan.seats} 个固定席位 · ${plan.management} · ${team.cycle === "year" ? "年付" : "月付"}</p></div><strong>${formatCurrency(plan[team.cycle])}<span>/${team.cycle === "year" ? "年" : "月"}</span></strong></div><section class="team-section-card"><div class="team-section-card-head"><strong>权益消耗</strong><span>下次重置：2026-10-05 00:00</span></div>${renderProgressRows(team)}</section><div class="team-setting-note">团队升级会立即增加席位、共享额度、知识容量与协作管理能力。超过 30 人，或需要组织架构、SSO、复杂权限、审计合规时，申请企业版并进入人工审核链路。</div>`;
  };

  const renderGeneralPanel = (team) => `${teamSettingsHeader("基础设置", "维护团队名称与轻量工作空间状态", '<button type="button" data-team-save-name>保存设置</button>')}<div class="team-form-grid"><div class="team-form-field full"><label>团队名称</label><input id="team-general-name" value="${escapeTeamHTML(team.name)}" maxlength="24"/></div><div class="team-form-field"><label>团队创建人</label><input value="${isTeamOwner(team) ? "张伟" : "其他成员"}" disabled/></div><div class="team-form-field"><label>数据范围</label><input value="团队共享包、团队产物与 Agent 产物" disabled/></div></div><div class="team-setting-note">需要组织架构、SSO、审计导出、私域部署或 30 人以上成员时，可带入当前团队信息申请企业版。</div><div class="team-danger-zone"><strong>原型状态模拟</strong><p>用于验收订阅到期后的只读状态。已有内容仍可查看和导出。</p><button type="button" data-team-toggle-readonly>${team.status === "readonly" ? "恢复有效订阅" : "模拟订阅到期"}</button></div>${isTeamOwner(team) ? '<div class="team-danger-zone team-archive-zone"><strong>归档团队协作区</strong><p>归档后团队将解散，团队文件与产物会转入创建人的个人文件区，成员将无法继续访问。</p><button type="button" data-team-archive>归档并解散团队</button></div>' : '<div class="team-danger-zone team-leave-zone"><strong>离开团队</strong><p>离开后你将无法访问此团队，但已经发布的团队资产会继续保留。</p><button type="button" data-team-leave>离开团队</button></div>'}`;

  const renderTeamSettings = (panel) => {
    const team = getActiveTeam() || ensureDemoTeam();
    activeTeamSettingsPanel = ["overview", "members", "billing", "general"].includes(panel || activeTeamSettingsPanel) ? (panel || activeTeamSettingsPanel) : "overview";
    const header = el("#team-settings-team");
    const content = el("#team-settings-content");
    if (!header || !content) return;
    header.innerHTML = `<span class="team-space-menu-mark team">${escapeTeamHTML(team.name.slice(0,1))}</span><span><strong>${escapeTeamHTML(team.name)}</strong><small>${escapeTeamHTML(getPlan(team).name)}</small></span>`;
    els("[data-team-settings-nav]").forEach((button) => {
      const active = button.dataset.teamSettingsNav === activeTeamSettingsPanel;
      button.classList.toggle("active", active);
      if (active) button.setAttribute("aria-current", "page"); else button.removeAttribute("aria-current");
    });
    content.innerHTML = activeTeamSettingsPanel === "members" ? renderMembersPanel(team) : activeTeamSettingsPanel === "billing" ? renderBillingPanel(team) : activeTeamSettingsPanel === "general" ? renderGeneralPanel(team) : renderOverviewPanel(team);
  };

  const openTeamSettings = (panel) => {
    ensureDemoTeam();
    setTeamWorkspace("team", teamState.activeTeamId, { preserveView: true });
    renderTeamSettings(panel || "overview");
    if (typeof mainViewTitles === "object") mainViewTitles["team-settings"] = "团队设置";
    if (typeof showMainView === "function") showMainView("team-settings", { silent: true });
    els(".nav-item, .side-group-head, .side-sub-item").forEach((item) => { item.classList.remove("active"); item.removeAttribute("aria-current"); });
    const crumb = el("#page-crumb");
    if (crumb) crumb.textContent = "团队设置";
  };

  const openInviteModal = () => {
    const team = getActiveTeam() || ensureDemoTeam();
    if (team.status === "readonly") { showTeamToast("团队为只读状态，续费后才能邀请成员"); return; }
    const plan = getPlan(team);
    const used = getSeatUsage(team);
    el("#team-invite-body").innerHTML = `<div class="team-seat-note"><span>邀请会预占席位</span><strong>${used} / ${plan.seats}</strong></div><div class="team-form-grid"><div class="team-form-field"><label>姓名</label><input id="team-invite-name" placeholder="输入成员姓名"/></div><div class="team-form-field"><label>角色</label><select id="team-invite-role"><option value="member">成员</option><option value="admin">管理员</option></select></div><div class="team-form-field full"><label>工作邮箱</label><input id="team-invite-email" type="email" placeholder="name@example.com"/></div></div><span class="team-flow-error" id="team-invite-error">请填写姓名和有效邮箱</span>`;
    el("#team-invite-submit").disabled = used >= plan.seats;
    if (used >= plan.seats) {
      el("#team-invite-error").textContent = "当前套餐席位已满，请升级套餐后再邀请";
      el("#team-invite-error").classList.add("show");
    }
    openTeamModal("#team-invite-modal");
  };

  const submitInvite = () => {
    const team = getActiveTeam();
    const plan = getPlan(team);
    if (getSeatUsage(team) >= plan.seats) return;
    const name = el("#team-invite-name").value.trim();
    const email = el("#team-invite-email").value.trim();
    const role = el("#team-invite-role").value;
    if (name.length < 2 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { el("#team-invite-error").classList.add("show"); return; }
    team.members.push({ id: `invite-${Date.now()}`, name, email, role, status: "pending" });
    persistTeamState();
    closeTeamOverlays();
    renderTeamHome();
    renderTeamSettings("members");
    showTeamToast(`邀请已发送给 ${name}，席位已预留`);
  };

  const renderShareComposer = () => {
    const team = getActiveTeam();
    const body = el("#team-share-body");
    const foot = el("#team-share-foot");
    if (!team) {
      body.innerHTML = '<div class="team-share-result show"><div><span class="team-success-mark">＋</span><h3>先创建一个团队</h3><p>Session 只能发布到你已加入的团队空间。</p></div></div>';
      foot.innerHTML = '<button class="secondary-btn" type="button" data-team-close>取消</button><button class="primary-btn" type="button" data-team-action="create">创建团队</button>';
      return;
    }
    body.innerHTML = `<div id="team-share-composer"><div class="team-share-banner"><svg class="icon"><use href="#ico-shield"/></svg><span><strong>私人内容不会自动共享。</strong><br/>发布后会生成不可变的团队资产快照；成员退出后仍保留，由团队管理员统一删除。</span></div><div class="team-share-section"><strong>发布到</strong><div class="team-share-target"><span class="team-space-menu-mark team">${escapeTeamHTML(team.name.slice(0,1))}</span><span><strong>${escapeTeamHTML(team.name)}</strong><small>${getSeatUsage(team)}/${getPlan(team).seats} 人 · 当前工作空间</small></span><em>可发布</em></div></div><div class="team-share-section"><strong>选择发布内容</strong><div class="team-share-checklist"><label class="team-share-check"><input type="checkbox" checked disabled/><span><strong>Session 目标与执行摘要</strong><small>让接收方 Agent 理解已经完成了什么</small></span><em>必选</em></label><label class="team-share-check"><input type="checkbox" checked data-share-item="引用资料 4 份"/><span><strong>本次引用资料</strong><small>只包含当前 Session 已授权的 4 份资料</small></span><em>4 份</em></label><label class="team-share-check"><input type="checkbox" checked data-share-item="竞品对比表.xlsx"/><span><strong>竞品对比表.xlsx</strong><small>Agent 生成的结构化分析产物</small></span><em>Excel</em></label><label class="team-share-check"><input type="checkbox" checked data-share-item="首页方案说明.md"/><span><strong>首页方案说明.md</strong><small>当前结论与后续待办</small></span><em>Markdown</em></label></div></div></div><div class="team-share-result" id="team-share-result"></div>`;
    foot.innerHTML = '<button class="secondary-btn" type="button" data-team-close>取消</button><button class="primary-btn" type="button" id="team-share-publish">确认发布为团队资产</button>';
  };

  const openShareModal = () => {
    const team = getActiveTeam();
    if (team && team.status === "readonly") { showTeamToast("团队为只读状态，不能发布新的 Session"); return; }
    renderShareComposer();
    openTeamModal("#team-share-modal");
  };

  const publishSharePackage = () => {
    const team = getActiveTeam();
    if (!team) return;
    const selectedItems = ["Session 摘要"].concat(els("[data-share-item]:checked", el("#team-share-body")).map((input) => input.dataset.shareItem));
    const version = team.sharePackages.filter((item) => item.title === "三季度产品复盘与行动项").length + 1;
    const targetAgent = team.agents[0];
    const packageItem = { id: `SHR-${Date.now()}`, version, title: "三季度产品复盘与行动项", sourceOwner: "张伟", sourceType: "个人 Session", createdAt: "今天 16:42", status: "published", items: selectedItems, targetAgentId: targetAgent.id, targetAgentName: targetAgent.name, continuedBy: null };
    team.sharePackages.unshift(packageItem);
    selectedItems.filter((item) => /\.(xlsx|md|pptx|html)$/i.test(item)).forEach((name) => {
      if (!team.artifacts.some((artifact) => artifact.name === name)) team.artifacts.unshift({ name, type: name.split(".").pop().toUpperCase(), owner: "张伟", updated: "刚刚" });
    });
    activeSharePackageId = packageItem.id;
    persistTeamState();
    el("#team-share-composer").hidden = true;
    const result = el("#team-share-result");
    result.classList.add("show");
    result.innerHTML = `<div><span class="team-success-mark">✓</span><h3>已发布到 ${escapeTeamHTML(team.name)}</h3><p>团队成员现在可以查看 v${version} 快照，并交给自己的 Agent 继续执行。</p><code>${escapeTeamHTML(packageItem.id)} · ${selectedItems.length} 项上下文</code></div>`;
    el("#team-share-foot").innerHTML = '<button class="secondary-btn" type="button" data-team-close>完成</button><button class="primary-btn" type="button" id="team-share-enter">进入团队查看</button>';
    renderTeamHome();
    renderTeamSettings("overview");
    showTeamToast("Session 已成为团队资产快照");
  };

  const continueSharePackage = (packageId) => {
    const team = getActiveTeam();
    const sharePackage = team && team.sharePackages.find((item) => item.id === packageId);
    if (!sharePackage) return;
    if (team.status === "readonly") { showTeamToast("团队为只读状态，续费后才能继续执行"); return; }
    openTeamDrawer("共享 Session · 可接力", `<small>${escapeTeamHTML(team.name)} · v${sharePackage.version}</small><h4>${escapeTeamHTML(sharePackage.title)}</h4><div class="drawer-section"><strong>来源与归属</strong><p>${escapeTeamHTML(sharePackage.sourceOwner)} 发布的${escapeTeamHTML(sharePackage.sourceType)}，发布后已成为团队资产。</p></div><div class="drawer-section"><strong>Agent 可用上下文</strong><p>${sharePackage.items.map(escapeTeamHTML).join("　·　")}</p></div><div class="drawer-section"><strong>隐私边界</strong><p>不会读取发布者或接力人的其他私人 Session；如需新增私人资料，必须先显式发布。</p></div>`, `<button class="secondary-btn" data-toast="共享包链接已复制">复制团队链接</button><button class="primary-btn" type="button" data-team-continue-confirm="${escapeTeamHTML(sharePackage.id)}">交给我的 Agent 继续</button>`);
  };

  const executeContinuation = (packageId) => {
    const team = getActiveTeam();
    const sharePackage = team.sharePackages.find((item) => item.id === packageId);
    if (!sharePackage) return;
    const plan = getPlan(team);
    const cost = 2400;
    if (team.usage.credits + cost > plan.credits) { showTeamToast("团队 Credits 已用尽，升级套餐后继续"); return; }
    team.usage.credits += cost;
    sharePackage.continuedBy = "张伟";
    const outputName = "团队接力结论与下一步.html";
    const targetAgent = team.agents.find((agent) => agent.id === sharePackage.targetAgentId) || team.agents[0];
    if (!team.agentArtifacts.some((artifact) => artifact.name === outputName)) team.agentArtifacts.unshift({ agent: targetAgent?.name || "接力 Agent", name: outputName, type: "HTML", owner: "团队 Agent", updated: "刚刚", sourceSessionId: sharePackage.id });
    persistTeamState();
    if (typeof closeOverlays === "function") closeOverlays();
    renderTeamHome();
    showTeamToast("团队 Agent 已接力，结果已沉淀到团队文件");
  };

  const openTeamConfirm = (mode) => {
    const team = getActiveTeam();
    if (!team) return;
    if (mode === "archive" && !isTeamOwner(team)) { showTeamToast("只有团队创建人可以归档团队"); return; }
    const archive = mode === "archive";
    const body = el("#team-confirm-body");
    const submit = el("#team-confirm-submit");
    if (!body || !submit) return;
    body.innerHTML = `<div class="team-confirm-content"><div class="team-confirm-mark ${archive ? "danger" : "neutral"}"><svg class="icon"><use href="#ico-${archive ? "trash" : "users"}"/></svg></div><h3>${archive ? "是否要归档“${escapeTeamHTML(team.name)}”团队协作区？" : `确定要离开“${escapeTeamHTML(team.name)}”吗？`}</h3><p>${archive ? "归档后团队协作区会被解散，团队文件、共享 Session 和 Agent 产物将归到创建人的个人文件区，其他成员将无法继续访问。" : "离开后你将从成员列表中移除，无法继续使用该团队空间；已发布的团队资产仍会保留。"}</p><label class="team-confirm-check"><input id="team-confirm-checkbox" type="checkbox" /> <span>我已了解${archive ? "归档后团队文件会转入个人文件区" : "离开后需要重新接受邀请才能加入"}</span></label></div>`;
    submit.textContent = archive ? "归档并解散" : "确认离开";
    submit.disabled = true;
    submit.dataset.teamConfirmMode = mode;
    el("#team-confirm-checkbox").addEventListener("change", (event) => { submit.disabled = !event.currentTarget.checked; });
    openTeamModal("#team-confirm-modal");
  };

  const archiveActiveTeam = () => {
    const team = getActiveTeam();
    if (!team || !isTeamOwner(team)) { showTeamToast("只有团队创建人可以归档团队"); return; }
    team.artifacts.forEach((artifact) => teamState.personalFiles.unshift({ name: artifact.name, type: artifact.type, source: team.name, archivedAt: nowISO() }));
    team.agentArtifacts.forEach((artifact) => teamState.personalFiles.unshift({ name: artifact.name, type: artifact.type, source: `${team.name} · ${artifact.agent}`, archivedAt: nowISO() }));
    team.sharePackages.forEach((share) => teamState.personalFiles.unshift({ name: share.title, type: "团队共享 Session", source: team.name, archivedAt: nowISO() }));
    team.artifacts = [];
    team.agentArtifacts = [];
    team.sharePackages = [];
    team.status = "archived";
    team.archivedAt = nowISO();
    team.archivedBy = "user-zhangwei";
    team.members = [];
    teamState.activeTeamId = null;
    teamState.ownedTeamId = getOwnedTeams()[0]?.id || null;
    teamState.ownedTeamIds = getOwnedTeams().map((item) => item.id);
    renderPersonalFileCount();
    persistTeamState();
    closeTeamOverlays();
    setTeamWorkspace("personal");
    showTeamToast(`团队已归档，${team.name} 的文件已转入个人文件区`);
  };

  const leaveActiveTeam = () => {
    const team = getActiveTeam();
    if (!team || isTeamOwner(team)) { showTeamToast("团队创建人不能直接离开，请先归档团队"); return; }
    team.members = team.members.filter((member) => member.id !== "user-zhangwei");
    team.access = "left";
    team.leftAt = nowISO();
    teamState.activeTeamId = null;
    teamState.activeWorkspace = "personal";
    persistTeamState();
    closeTeamOverlays();
    setTeamWorkspace("personal");
    showTeamToast("已离开团队，团队资产继续保留");
  };

  const handleSettingsInteraction = (event) => {
    const nav = event.target.closest("[data-team-settings-nav]");
    if (nav) { renderTeamSettings(nav.dataset.teamSettingsNav); return; }
    const role = event.target.closest("[data-team-member-role]");
    if (role && event.type === "change") {
      const row = role.closest("[data-member-id]");
      const team = getActiveTeam();
      const member = team.members.find((item) => item.id === row.dataset.memberId);
      if (member && member.role !== "owner") { member.role = role.value; persistTeamState(); showTeamToast("成员角色已更新"); }
      return;
    }
    const remove = event.target.closest("[data-team-member-remove]");
    if (remove) {
      const row = remove.closest("[data-member-id]");
      const team = getActiveTeam();
      const member = team.members.find((item) => item.id === row.dataset.memberId);
      if (!member || member.role === "owner") return;
      team.members = team.members.filter((item) => item.id !== member.id);
      persistTeamState();
      renderTeamSettings("members");
      renderTeamHome();
      showTeamToast(member.status === "pending" ? "邀请已撤销，席位已释放" : "成员已移除，团队资产继续保留");
      return;
    }
    const saveName = event.target.closest("[data-team-save-name]");
    if (saveName) {
      const team = getActiveTeam();
      const input = el("#team-general-name");
      const name = input?.value.trim() || "";
      if (!team || name.length < 2) { showTeamToast("团队名称至少需要 2 个字符"); return; }
      team.name = name.slice(0, 24);
      persistTeamState();
      renderWorkspaceSwitcher();
      renderTeamFilesTree();
      renderTeamSettings("general");
      renderTeamHome();
      showTeamToast("团队设置已保存");
      return;
    }
    const readonly = event.target.closest("[data-team-toggle-readonly]");
    if (readonly) {
      const team = getActiveTeam();
      team.status = team.status === "readonly" ? "active" : "readonly";
      persistTeamState();
      document.body.classList.toggle("team-readonly", team.status === "readonly");
      renderTeamSettings("general");
      renderTeamHome();
      showTeamToast(team.status === "readonly" ? "已模拟订阅到期，团队进入只读" : "订阅已恢复有效");
      return;
    }
    const archive = event.target.closest("[data-team-archive]");
    if (archive) { openTeamConfirm("archive"); return; }
    const leave = event.target.closest("[data-team-leave]");
    if (leave) { openTeamConfirm("leave"); return; }
  };

  const bindGlobalEvents = () => {
    const switcherButton = el("#team-workspace-switcher-button");
    switcherButton.addEventListener("click", (event) => {
      event.stopPropagation();
      const menu = el("#team-space-menu");
      const open = !menu.classList.contains("show");
      menu.classList.toggle("show", open);
      switcherButton.setAttribute("aria-expanded", String(open));
    });
    el("#team-space-menu").addEventListener("click", (event) => {
      event.stopPropagation();
      const workspace = event.target.closest("[data-workspace-target]");
      if (workspace) { setTeamWorkspace(workspace.dataset.workspaceTarget, workspace.dataset.teamId); return; }
      const action = event.target.closest("[data-team-action]");
      if (action) dispatchTeamAction(action.dataset.teamAction, action.dataset.teamPanel);
    });
    document.addEventListener("click", (event) => {
      const sharedOpen = event.target.closest("[data-team-shared-open]");
      if (sharedOpen) { event.preventDefault(); event.stopPropagation(); const first = getActiveTeam()?.sharePackages?.[0]; if (first) continueSharePackage(first.id); return; }
      if (!event.target.closest("#team-workspace-switcher")) {
        el("#team-space-menu").classList.remove("show");
        switcherButton.setAttribute("aria-expanded", "false");
      }
      const fileMenuTrigger = event.target.closest("[data-team-file-menu]");
      if (fileMenuTrigger) {
        event.preventDefault();
        event.stopPropagation();
        const target = el(`[data-team-file-actions="${fileMenuTrigger.dataset.teamFileMenu}"]`);
        els(".team-file-actions-menu.show").forEach((menu) => { if (menu !== target) menu.classList.remove("show"); });
        target?.classList.toggle("show");
        return;
      }
      const fileAction = event.target.closest("[data-team-file-action]");
      if (fileAction) {
        event.preventDefault();
        event.stopPropagation();
        const team = teamState.teams.find((item) => item.id === fileAction.dataset.teamId);
        if (!team) return;
        teamState.activeTeamId = team.id;
        els(".team-file-actions-menu.show").forEach((menu) => menu.classList.remove("show"));
        if (fileAction.dataset.teamFileAction === "settings") openTeamSettings("overview");
        else if (fileAction.dataset.teamFileAction === "invite") openInviteModal();
        else if (fileAction.dataset.teamFileAction === "archive") openTeamConfirm("archive");
        else if (fileAction.dataset.teamFileAction === "leave") openTeamConfirm("leave");
        return;
      }
      const action = event.target.closest("[data-team-action]");
      if (action && !action.closest("#team-space-menu")) { event.preventDefault(); event.stopPropagation(); dispatchTeamAction(action.dataset.teamAction, action.dataset.teamPanel); }
      const teamToggle = event.target.closest("[data-team-tree-toggle]");
      if (teamToggle) {
        event.preventDefault();
        event.stopPropagation();
        const team = teamState.teams.find((item) => item.id === teamToggle.dataset.teamTreeToggle);
        if (team) {
          teamState.activeTeamId = team.id;
          teamState.activeWorkspace = "team";
          document.body.dataset.workspace = "team";
          persistTeamState();
          renderWorkspaceSwitcher();
          openTeamKnowledgeFolder(team, `${team.name}的团队文件`, teamToggle);
        }
        const children = el(`[data-team-file-children="${teamToggle.dataset.teamTreeToggle}"]`);
        const collapsed = children?.classList.toggle("hide");
        teamToggle.setAttribute("aria-expanded", String(!collapsed));
      }
      const teamAgentToggle = event.target.closest("[data-team-agent-tree-toggle]");
      if (teamAgentToggle) {
        event.preventDefault();
        event.stopPropagation();
        const team = teamState.teams.find((item) => item.id === teamAgentToggle.dataset.teamAgentTreeToggle);
        if (team) {
          teamState.activeTeamId = team.id;
          teamState.activeWorkspace = "team";
          document.body.dataset.workspace = "team";
          persistTeamState();
          renderWorkspaceSwitcher();
          openTeamKnowledgeFolder(team, "Agent 产物", teamAgentToggle);
        }
        const children = el(`[data-team-agent-children="${teamAgentToggle.dataset.teamAgentTreeToggle}"]`);
        const collapsed = children?.classList.toggle("hide");
        teamAgentToggle.setAttribute("aria-expanded", String(!collapsed));
      }
      const teamFolder = event.target.closest("[data-team-folder]");
      if (teamFolder) {
        event.preventDefault();
        event.stopPropagation();
        const team = teamState.teams.find((item) => item.id === teamFolder.dataset.teamFolder);
        if (team) { teamState.activeTeamId = team.id; persistTeamState(); renderWorkspaceSwitcher(); }
        if (team) openTeamKnowledgeFolder(team, teamFolder.dataset.knowledgeFolder || "团队文件", teamFolder);
      }
      const teamKnowledgePreview = event.target.closest("[data-team-knowledge-preview], .team-knowledge-row");
      if (teamKnowledgePreview && !event.target.closest(".knowledge-check")) {
        const row = teamKnowledgePreview.closest(".team-knowledge-row");
        const team = getActiveTeam();
        if (row && team) {
          const share = team.sharePackages.find((item) => item.id === row.dataset.teamKnowledgeId);
          const artifact = team.artifacts.find((item, index) => `${team.id}-artifact-${index}` === row.dataset.teamKnowledgeId);
          const agentArtifact = team.agentArtifacts.find((item) => row.dataset.teamKnowledgeId === `${team.id}-agent-${item.agent}-${item.name}`);
          if (share) continueSharePackage(share.id);
          else if (artifact) openTeamDrawer("团队产物", `<small>${escapeTeamHTML(team.name)} · ${escapeTeamHTML(artifact.type)}</small><h4>${escapeTeamHTML(artifact.name)}</h4><div class="drawer-section"><strong>归属</strong><p>${escapeTeamHTML(artifact.owner)} 沉淀到团队文件，成员退出后仍由团队保留。</p></div><div class="drawer-section"><strong>可用方式</strong><p>可作为团队 Agent 的上下文继续引用，消耗团队 Credits。</p></div>`, `<button class="secondary-btn" data-toast="团队文件链接已复制">复制链接</button><button class="primary-btn" data-toast="已引用到团队 Agent">引用给 Agent</button>`);
          else if (agentArtifact) openTeamDrawer("Agent 产物", `<small>${escapeTeamHTML(team.name)} · ${escapeTeamHTML(agentArtifact.agent)} · ${escapeTeamHTML(agentArtifact.type)}</small><h4>${escapeTeamHTML(agentArtifact.name)}</h4><div class="drawer-section"><strong>归属</strong><p>${escapeTeamHTML(agentArtifact.agent)} 直接生成并沉淀到团队空间，成员退出后仍由团队保留。</p></div><div class="drawer-section"><strong>可用方式</strong><p>可作为团队 Agent 的后续上下文继续引用，或在团队文件区直接预览。</p></div>`, `<button class="secondary-btn" data-toast="Agent 产物链接已复制">复制链接</button><button class="primary-btn" data-toast="已引用到团队 Agent">引用给 Agent</button>`);
        }
        return;
      }
      const teamKnowledgeCheck = event.target.closest(".team-knowledge-row .knowledge-check");
      if (teamKnowledgeCheck) {
        const count = els(".team-knowledge-row .knowledge-check:checked").length;
        const selected = el("#knowledge-selected-count");
        const bar = el("#knowledge-selection-bar");
        if (selected) selected.textContent = String(count);
        if (bar) bar.classList.toggle("show", count > 0);
        return;
      }
      const close = event.target.closest("[data-team-close]");
      if (close) closeTeamOverlays();
      const continueButton = event.target.closest("[data-team-continue]");
      if (continueButton) continueSharePackage(continueButton.dataset.teamContinue);
      const continueConfirm = event.target.closest("[data-team-continue-confirm]");
      if (continueConfirm) executeContinuation(continueConfirm.dataset.teamContinueConfirm);
      const sharePublish = event.target.closest("#team-share-publish");
      if (sharePublish) publishSharePackage();
      const shareEnter = event.target.closest("#team-share-enter");
      if (shareEnter) { closeTeamOverlays(); setTeamWorkspace("team", teamState.activeTeamId); }
    });
    document.addEventListener("change", (event) => handleSettingsInteraction(event));
    el("#team-settings-content").addEventListener("click", handleSettingsInteraction);
    el("#team-invite-submit").addEventListener("click", submitInvite);
    el("#team-confirm-submit").addEventListener("click", (event) => { if (event.currentTarget.disabled) return; if (event.currentTarget.dataset.teamConfirmMode === "archive") archiveActiveTeam(); else leaveActiveTeam(); });
    el("#scrim").addEventListener("click", closeTeamOverlays);
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeTeamOverlays(); });
    els("[data-edition-choice]").forEach((button) => button.addEventListener("click", () => {
      if (button.dataset.editionChoice === "personal") setTeamWorkspace("personal");
      else {
        document.body.dataset.workspace = "enterprise";
        teamState.activeWorkspace = "enterprise";
        persistTeamState();
      }
    }));

    const sendButton = el("#send-button");
    if (sendButton) sendButton.addEventListener("click", () => {
      if (document.body.dataset.workspace !== "team") return;
      const team = getActiveTeam();
      if (!team || team.status === "readonly") { showTeamToast("团队为只读状态，不能发起新任务"); return; }
      const plan = getPlan(team);
      if (team.usage.credits + 1200 > plan.credits) { showTeamToast("团队 Credits 已用尽，升级套餐后继续"); return; }
      team.usage.credits += 1200;
      persistTeamState();
      window.setTimeout(renderTeamHome, 3600);
    }, true);
  };

  const dispatchTeamAction = (action, panel) => {
    if (action === "create") { closeTeamOverlays(); openTeamFlow(1); }
    else if (action === "apply-enterprise") applyEnterprise();
    else if (action === "upgrade") openTeamUpgrade();
    else if (action === "settings") openTeamSettings(panel || "overview");
    else if (action === "invite") { closeTeamOverlays(); openInviteModal(); }
    else if (action === "share") openShareModal();
  };

  const applyPreviewParams = () => {
    const params = new URLSearchParams(window.location.search);
    const workspace = params.get("workspace");
    const teamFlow = params.get("teamFlow");
    const teamPage = params.get("teamPage");
    const share = params.get("share");
    const teamUpgrade = params.get("teamUpgrade");
    if (workspace === "team" || teamPage || share) {
      ensureDemoTeam();
      if (typeof setEdition === "function") setEdition("personal");
      setTeamWorkspace("team", teamState.activeTeamId);
    } else if (params.get("edition") === "personal") {
      document.body.dataset.workspace = "personal";
      renderWorkspaceSwitcher();
    } else if (params.get("edition") === "enterprise") document.body.dataset.workspace = "enterprise";

    if (teamFlow) {
      const stepMap = { create: 1, hardware: 2, checkout: 3, success: 4 };
      if (teamFlow === "success") {
        ensureDemoTeam();
        renderTeamFlow(4);
        openTeamModal("#team-flow-modal");
      } else {
        teamState.ownedTeamId = null;
        teamState.checkout.orderId = null;
        renderTeamFlow(stepMap[teamFlow] || 1);
        openTeamModal("#team-flow-modal");
      }
    }
    if (teamPage) openTeamSettings(teamPage);
    if (share === "compose") openShareModal();
    if (share === "published") {
      openShareModal();
      window.setTimeout(publishSharePackage, 80);
    }
    if (share === "continue") {
      const team = ensureDemoTeam();
      setTeamWorkspace("team", team.id);
      window.setTimeout(() => continueSharePackage(team.sharePackages[0].id), 80);
    }
    if (teamUpgrade === "1") { ensureDemoTeam(); setTeamWorkspace("team", teamState.activeTeamId); window.setTimeout(openTeamUpgrade, 80); }
  };

  window.TeamWorkspace = {
    getActiveTeam,
    openKnowledgeFolder: openTeamKnowledgeFolder,
    renderKnowledgeFiles: () => {
      const team = getActiveTeam();
      if (team) renderTeamKnowledgeFiles(team, activeKnowledgeFolder || `${team.name}的团队文件`);
    },
    renderFilesTree: renderTeamFilesTree,
    setWorkspace: setTeamWorkspace
  };

  injectTeamUI();
  renderPersonalFileCount();
  renderWorkspaceSwitcher();
  bindGlobalEvents();
  applyPreviewParams();
})();
