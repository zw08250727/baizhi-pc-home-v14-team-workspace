(function (global) {
  "use strict";
  const model = global.ContactsModel;
  const root = document.querySelector("#contacts-root");
  const view = document.querySelector('[data-main-view="contacts"]');
  const nav = document.querySelector("[data-contacts-entry]");
  if (!root || !view || !model) return;

  const esc = (value) => String(value == null ? "" : value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
  const edition = () => document.body.dataset.edition === "personal" ? "personal" : "enterprise";
  const workspace = () => document.body.dataset.workspace === "team" ? "team" : "";
  const state = { page: "list", contactId: "john", tab: "概览", query: "", filter: "全部", dialog: null, answer: "" };
  let store = model.load(edition(), workspace());

  const tags = (value) => `<span class="contacts-tag ${["需关注", "待回复"].includes(value) ? "warm" : ["已完成", "进行中"].includes(value) ? "green" : ""}">${esc(value)}</span>`;
  const button = (label, action, value = "", primary = false) => `<button type="button" class="contacts-button${primary ? " primary" : ""}" data-contact-action="${esc(action)}" data-value="${esc(value)}">${esc(label)}</button>`;
  const card = (title, body, extra = "") => `<section class="contacts-card ${extra}"><h2>${esc(title)}</h2>${body}</section>`;
  const line = (title, sub) => `<div class="contacts-line"><strong>${title}</strong><small>${sub}</small></div>`;
  const metrics = (items) => `<div class="contacts-metrics">${items.map(([value, label]) => `<div><strong>${esc(value)}</strong><span>${esc(label)}</span></div>`).join("")}</div>`;
  const activeContact = () => store.data.contacts.find((person) => person.id === state.contactId) || store.data.contacts[0];
  const persist = () => model.update(store.key, store.data);
  const notify = (message) => {
    let toast = root.querySelector(".contacts-toast");
    if (!toast) { toast = document.createElement("div"); toast.className = "contacts-toast"; root.appendChild(toast); }
    toast.textContent = message; toast.classList.add("show"); clearTimeout(toast._timer); toast._timer = setTimeout(() => toast.classList.remove("show"), 2200);
  };
  const header = (title, description, actions = "") => `<header class="contacts-head"><div><div class="contacts-breadcrumb"><button type="button" data-contact-action="back-library">知识库</button><span>/</span><span>联系人</span></div><h1>${esc(title)}</h1><p>${esc(description)}</p></div><div class="contacts-actions">${actions}</div></header>`;
  const aside = (person) => `<aside class="contacts-aside"><div class="contacts-ai-title"><span class="contacts-ai-mark">✦</span><div><strong>Wise AI</strong><small>联系人关系助手</small></div></div><p class="contacts-aside-context">上下文：${esc(person?.name || "联系人")} · 全部互动</p><div class="contacts-prompts">${["最近承诺了什么？", "第一次讨论德国市场是什么时候？", "最关心的三个问题是什么？", "准备下一次会议"].map((prompt) => `<button type="button" data-contact-action="ask" data-value="${esc(prompt)}">${esc(prompt)}</button>`).join("")}</div><div class="contacts-ai-answer" aria-live="polite">${esc(state.answer || person?.summary || "暂无关系摘要")}</div><small class="contacts-aside-note">示例回答 · 未连接 AI 服务</small><form class="contacts-ai-form" data-contact-form="ask"><input name="question" aria-label="询问 AI" placeholder="询问有关联系人的问题…" required /><button class="contacts-button primary" aria-label="发送问题">发送</button></form></aside>`;

  const renderList = () => {
    const people = model.filter(store.data.contacts, state.query, state.filter);
    const count = nav?.querySelector(".tree-count");
    if (count) count.textContent = String(store.data.contacts.length);
    const title = workspace() === "team" ? "团队联系人" : edition() === "personal" ? "我的联系人" : "企业联系人";
    root.innerHTML = `<div class="contacts-layout"><div class="contacts-main">${header(title, "浏览联系人，并查看关系记忆、互动和待跟进事项。", button("导入联系人", "import") + button("＋ 添加联系人", "add", "", true))}<div class="contacts-toolbar"><label class="contacts-search"><span aria-hidden="true">⌕</span><input id="contacts-search" type="search" aria-label="搜索联系人" placeholder="搜索姓名、公司、角色、主题…" value="${esc(state.query)}" /></label><div class="contacts-tabs" role="tablist" aria-label="联系人筛选">${["全部", "需关注", "最近互动", "高频"].map((item) => `<button type="button" role="tab" aria-selected="${item === state.filter}" data-contact-action="filter" data-value="${item}">${item}</button>`).join("")}</div></div><div class="contacts-grid">${people.map((person) => `<button type="button" class="contacts-person-card" data-contact-action="person" data-value="${esc(person.id)}"><span class="contacts-person"><span class="contacts-avatar">${esc(person.initials)}</span><span><strong>${esc(person.name)}</strong><small>${esc(person.role)} · ${esc(person.company)}</small></span></span><p>${esc(person.summary)}</p><span class="contacts-person-foot">${tags(person.tag)}<span>${esc(person.count)} 次互动 · ${esc(person.recent)}</span></span></button>`).join("")}</div>${people.length ? "" : '<div class="contacts-empty">未找到联系人</div>'}</div>${aside(activeContact())}</div>`;
  };

  const contactSummary = (person) => person.id === "john" ? "John 负责 ABC Energy 的德国销售业务。过去三个月，你们主要围绕德国储能 PCS 渠道合作、价格体系、认证和联合客户拜访展开讨论。最近一次会议中，John 承诺在本周内提供德国潜在经销商名单；当前最值得跟进的是渠道名单和 Demo 环境。" : person.summary;
  const detailContent = (person) => {
    const john = person.id === "john";
    const notes = store.data.notes[person.id] || [];
    if (state.tab === "概览") return `<div class="contacts-detail-grid"><div class="contacts-wide">${card("AI 关系摘要", `<p>${esc(contactSummary(person))}</p>`)}</div>${card("档案", `<dl class="contacts-facts"><dt>公司</dt><dd>${esc(person.company)}</dd><dt>角色</dt><dd>${esc(person.role)}</dd><dt>地区</dt><dd>${esc(person.region || "待补充")}</dd><dt>邮箱</dt><dd>${esc(person.email || "待补充")}</dd><dt>关系</dt><dd>${tags(person.tag)}</dd></dl>`)}${card("开放承诺", john ? person.commitments.map(([title, due, status]) => line(`${esc(title)} ${tags(status)}`, `截止 ${esc(due)}`)).join("") : "<p>暂无开放承诺</p>")}<div class="contacts-wide">${card("关键主题", (person.themes || []).map((item) => tags(item)).join(" ") || "<p>暂无主题</p>")}</div></div>`;
    if (state.tab === "时间线") return card("关系时间线", person.timeline?.length ? `<div class="contacts-timeline">${person.timeline.map(([title, meta, description]) => line(esc(title), `${esc(meta)}<br>${esc(description)}`)).join("")}</div>` : '<div class="contacts-empty">暂无时间线记录</div>');
    if (state.tab === "承诺") return john ? `<div class="contacts-detail-grid">${card("来自 John 的承诺", person.commitments.map(([title, due, status]) => line(`${esc(title)} ${tags(status)}`, `截止 ${esc(due)}`)).join(""))}${card("我的承诺", person.myCommitments.map(([title, due, status]) => line(`${esc(title)} ${tags(status)}`, esc(due))).join(""))}<div class="contacts-wide">${card("跟进建议", `<p>建议优先确认经销商名单交付时间，并将 Demo 环境准备情况同步给 John。</p>${button("创建跟进任务", "followup", person.name, true)}`)}</div></div>` : card("承诺", '<div class="contacts-empty">暂无承诺</div>');
    if (state.tab === "主题") return card("主题", (person.themes || []).map((item) => tags(item)).join(" ") || '<div class="contacts-empty">暂无主题</div>') + (john ? `<br>${card("主题动态", line("德国市场", "最近讨论：德国储能渠道策略与潜在经销商名单 · 最近 30 天") + line("价格", "最近讨论：德国渠道的定价反馈与售后支持 · 最近 30 天") + line("Pilot", "最近讨论：首批试点客户的认证节奏与 Demo 支持 · 最近 30 天"))}` : "");
    return `${card("已确认记忆", (person.memories || []).map((item) => `<p>• ${esc(item)}</p>`).join("") || "<p>暂无已确认记忆</p>")}<br>${card("AI 推断", (person.inferences || []).length ? person.inferences.map((item) => `<p>• ${esc(item)}</p>`).join("") + '<p class="contacts-muted">以上推断需要后续互动确认。</p>' : "<p>暂无推断</p>")}${notes.length ? `<br>${card("我的备注", notes.map((note) => line(esc(note.text), esc(note.time))).join(""))}` : ""}`;
  };
  const renderDetail = () => {
    const person = activeContact();
    if (!person) return renderList();
    root.innerHTML = `<div class="contacts-layout"><div class="contacts-main">${header("联系人详情", "保留关系上下文，方便继续跟进与交给 Agent 处理。", button("← 返回联系人", "list") + button("＋ 添加备注", "note", person.id) + button("创建跟进", "followup", person.name, true))}<div class="contacts-profile"><span class="contacts-avatar large">${esc(person.initials)}</span><div><h1>${esc(person.name)} ${tags("活跃")}</h1><p>${esc(person.role)} · ${esc(person.company)}${person.id === "john" ? " · 德国业务" : ""}</p><p>最近互动：${esc(person.recent)}${person.id === "john" ? " · 首次认识：2026/06/12" : ""}</p></div></div>${metrics([[person.count, "互动"], [(person.id === "john" ? 23 : 0) + (store.data.notes[person.id] || []).length, "备注"], [person.id === "john" ? 2 : 0, "开放承诺"], [person.id === "john" ? 5 : 0, "活跃主题"]])}<div class="contacts-tabs detail" role="tablist" aria-label="联系人详情">${["概览", "时间线", "承诺", "主题", "记忆"].map((tab) => `<button type="button" role="tab" aria-selected="${state.tab === tab}" data-contact-action="tab" data-value="${tab}">${tab}</button>`).join("")}</div>${detailContent(person)}</div>${aside(person)}</div>`;
  };

  const modal = (title, body) => {
    state.dialog = document.createElement("div"); state.dialog.className = "contacts-overlay"; state.dialog.innerHTML = `<div class="contacts-dialog" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header><h2>${esc(title)}</h2><button type="button" data-contact-action="close-dialog" aria-label="关闭">×</button></header><div class="contacts-dialog-body">${body}</div></div>`; root.appendChild(state.dialog); requestAnimationFrame(() => state.dialog.classList.add("show"));
  };
  const closeModal = () => { if (!state.dialog) return; state.dialog.remove(); state.dialog = null; };
  const openModal = (type, personId = "") => {
    if (type === "note") return modal("添加备注", `<form data-contact-form="note"><input type="hidden" name="person" value="${esc(personId)}"><label>备注内容<textarea name="text" required rows="5" maxlength="2000" placeholder="记录这段关系中需要保留的上下文"></textarea></label><div class="contacts-dialog-actions">${button("取消", "close-dialog") }<button class="contacts-button primary" type="submit">保存备注</button></div></form>`);
    if (type === "add") return modal("添加联系人", `<form data-contact-form="add"><div class="contacts-form-grid"><label>姓名<input name="name" required maxlength="100"></label><label>公司<input name="company" maxlength="100"></label><label>角色<input name="role" maxlength="100"></label></div><label>关系摘要<textarea name="summary" maxlength="1000" placeholder="补充这位联系人的背景与当前关系"></textarea></label><p class="contacts-form-error" aria-live="polite"></p><div class="contacts-dialog-actions">${button("取消", "close-dialog") }<button class="contacts-button primary" type="submit">添加联系人</button></div></form>`);
    if (type === "import") return modal("导入联系人", `<p class="contacts-muted">粘贴 JSON 数组，字段：name、company、role、summary。仅保存到当前版型的本地联系人目录。</p><form data-contact-form="import"><label>联系人数据<textarea name="json" required rows="8" placeholder='[{"name":"联系人姓名","company":"公司","role":"角色"}]'></textarea></label><p class="contacts-form-error" aria-live="polite"></p><div class="contacts-dialog-actions">${button("取消", "close-dialog") }<button class="contacts-button primary" type="submit">导入</button></div></form>`);
    if (type === "followup") return modal("创建跟进任务", `<form data-contact-form="followup"><input type="hidden" name="person" value="${esc(personId)}"><label>任务标题<input name="title" required value="跟进 ${esc(personId)} 的开放承诺" maxlength="120"></label><label>任务描述<textarea name="description" rows="4">结合联系人关系上下文，确认下一步行动并记录结果。</textarea></label><label>负责人<select name="owner"><option>张伟</option><option>Agent · 分析助手</option></select></label><div class="contacts-dialog-actions">${button("取消", "close-dialog") }<button class="contacts-button primary" type="submit">创建任务</button></div></form>`);
  };
  const answer = (question, person) => {
    if (!person) return "当前没有可用联系人上下文。";
    if (question.includes("第一次")) return "首次联系发生在 2026 年 6 月 12 日的 Energy Storage Summit。";
    if (question.includes("三个")) return "当前重点是认证、交付周期与渠道支持。";
    if (question.includes("会议")) return "建议先确认德国经销商名单，再同步 Demo 环境准备情况，并讨论认证时间表。";
    return person.id === "john" ? "John 承诺发送德国经销商名单，并确认认证时间表；你需要准备 Demo 环境。" : person.summary;
  };

  const open = () => {
    store = model.load(edition(), workspace());
    view.hidden = false; view.setAttribute("aria-hidden", "false");
    document.querySelectorAll('[data-main-view]').forEach((item) => { if (item !== view) { item.hidden = true; item.setAttribute("aria-hidden", "true"); } });
    document.querySelector("#page-crumb").textContent = "联系人";
    document.querySelectorAll(".side-sub-item, .nav-item, .side-group-head").forEach((item) => { item.classList.remove("active"); item.removeAttribute("aria-current"); });
    nav?.classList.add("active"); nav?.setAttribute("aria-current", "page");
    document.querySelector(".main")?.scrollTo({ top: 0, behavior: "auto" });
    state.page === "detail" ? renderDetail() : renderList();
  };
  const action = (name, value) => {
    if (name === "close-dialog") return closeModal();
    if (name === "list") { state.page = "list"; state.answer = ""; return renderList(); }
    if (name === "back-library") { document.querySelector('[data-knowledge-folder="我的文件"]')?.click(); return; }
    if (name === "person") { state.page = "detail"; state.contactId = value; state.tab = "概览"; state.answer = ""; return renderDetail(); }
    if (name === "filter") { state.filter = value; return renderList(); }
    if (name === "tab") { state.tab = value; return renderDetail(); }
    if (name === "ask") { state.answer = answer(value, activeContact()); return state.page === "detail" ? renderDetail() : renderList(); }
    if (["add", "import", "note", "followup"].includes(name)) return openModal(name, value);
  };
  root.addEventListener("click", (event) => { const trigger = event.target.closest("[data-contact-action]"); if (trigger) action(trigger.dataset.contactAction, trigger.dataset.value); });
  root.addEventListener("input", (event) => { if (event.target.id !== "contacts-search") return; state.query = event.target.value; const cursor = event.target.selectionStart; renderList(); const next = root.querySelector("#contacts-search"); next?.focus(); next?.setSelectionRange(cursor, cursor); });
  root.addEventListener("submit", (event) => {
    const form = event.target.closest("[data-contact-form]"); if (!form) return; event.preventDefault(); const values = Object.fromEntries(new FormData(form));
    if (form.dataset.contactForm === "ask") { state.answer = answer(values.question, activeContact()); closeModal(); return state.page === "detail" ? renderDetail() : renderList(); }
    let result = { ok: true };
    if (form.dataset.contactForm === "note") { result.ok = model.addNote(store.data, values.person, values.text); if (!result.ok) result.message = "备注内容不能为空"; }
    if (form.dataset.contactForm === "add") result = model.add(store.data, values);
    if (form.dataset.contactForm === "import") { try { result = model.importContacts(store.data, JSON.parse(values.json)); } catch (error) { result = { ok: false, message: "JSON 格式不正确" }; } }
    if (form.dataset.contactForm === "followup") { const title = String(values.title || "").trim(); if (!title) result = { ok: false, message: "请填写任务标题" }; else { store.data.tasks.unshift({ id: `contact-task-${Date.now()}`, title, description: values.description, owner: values.owner, contactId: values.person, createdAt: new Date().toLocaleString("zh-CN") }); } }
    if (!result.ok) { const error = form.querySelector(".contacts-form-error"); if (error) error.textContent = result.message || "保存失败"; return; }
    persist(); closeModal(); notify(form.dataset.contactForm === "followup" ? "跟进任务已创建" : "联系人信息已保存"); if (form.dataset.contactForm === "add" || form.dataset.contactForm === "import") state.page = "list"; if (form.dataset.contactForm === "note") state.page = "detail"; state.answer = ""; state.contactId = result.record?.id || state.contactId; state.page === "detail" ? renderDetail() : renderList();
  });
  document.addEventListener("click", (event) => { if (event.target === state.dialog) closeModal(); });
  nav?.addEventListener("click", () => open());
  global.ContactsUI = { open, render: open };
  if (new URLSearchParams(location.search).get("page") === "contacts") open(); else renderList();
})(window);
