/* Filter and sort interactions for the application data grid. */
window.AppsGridTools = (() => {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  const empty = value => value === null || value === undefined || value === '';
  const labels = {
    contains: '包含', eq: '等于', ne: '不等于', gt: '大于 / 晚于',
    gte: '大于等于', lt: '小于 / 早于', lte: '小于等于',
    empty: '未填写', not_empty: '已填写'
  };
  let getState, redraw, root, table = null;
  let filters = [], sorts = [], panel = '', filterDraft = [], sortDraft = [];

  const fieldDefs = currentTable => [
    ...(currentTable?.fields || []).map((field, index) => ({key: String(index), name: field[0], type: field[1]})),
    {key: 'created', name: '创建时间', type: '日期时间'},
    {key: 'updated', name: '更新时间', type: '日期时间'},
    {key: 'id', name: '记录 ID', type: '文本'}
  ];
  const read = (row, key) => /^\d+$/.test(key) ? row.values[Number(key)] : row[key];
  const normalise = (value, type) => {
    if (type === '日期时间' || type === '日期') return String(value ?? '').replace(' ', 'T').slice(0, 16);
    if (type === '整数' || type === '数值') return Number(value);
    if (type === '布尔') return value === true || value === 'true';
    return value;
  };
  const inputType = type => type === '日期' ? 'date' : type === '日期时间' ? 'datetime-local' : type === '整数' || type === '数值' ? 'number' : 'text';
  const availableOps = type => {
    if (type === '文本') return ['contains', 'eq', 'ne', 'empty', 'not_empty'];
    if (type === 'UUID') return ['eq', 'ne', 'empty', 'not_empty'];
    if (type === '布尔') return ['eq', 'ne', 'empty', 'not_empty'];
    if (type === 'JSON') return ['empty', 'not_empty'];
    return ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'empty', 'not_empty'];
  };
  const options = (pairs, selected) => pairs.map(([key, label]) => `<option value="${esc(key)}" ${String(key) === String(selected) ? 'selected' : ''}>${esc(label)}</option>`).join('');

  function query(rows, currentTable, conditions = filters, ordering = sorts) {
    const defs = fieldDefs(currentTable);
    const result = rows.filter(row => conditions.every(rule => {
      const definition = defs.find(field => field.key === rule.field);
      if (!definition) return true;
      const raw = read(row, rule.field);
      if (rule.op === 'empty') return empty(raw);
      if (rule.op === 'not_empty') return !empty(raw);
      if (empty(raw)) return false;
      const left = normalise(raw, definition.type);
      const right = normalise(rule.value, definition.type);
      if (rule.op === 'contains') return String(left).toLocaleLowerCase().includes(String(right).toLocaleLowerCase());
      if (rule.op === 'eq') return left === right || String(left) === String(right);
      if (rule.op === 'ne') return !(left === right || String(left) === String(right));
      if (rule.op === 'gt') return left > right;
      if (rule.op === 'gte') return left >= right;
      if (rule.op === 'lt') return left < right;
      return left <= right;
    }));
    return result.sort((a, b) => {
      for (const rule of ordering) {
        const definition = defs.find(field => field.key === rule.field);
        if (!definition) continue;
        const left = normalise(read(a, rule.field), definition.type);
        const right = normalise(read(b, rule.field), definition.type);
        if (empty(left) || empty(right)) {
          if (empty(left) && empty(right)) continue;
          return empty(left) ? 1 : -1;
        }
        let comparison;
        if (typeof left === 'number' && typeof right === 'number') comparison = left - right;
        else if (typeof left === 'boolean' && typeof right === 'boolean') comparison = Number(left) - Number(right);
        else comparison = String(left).localeCompare(String(right), 'zh-CN', {numeric: true});
        if (comparison) return rule.direction === 'desc' ? -comparison : comparison;
      }
      return 0;
    });
  }

  function builder() {
    const defs = fieldDefs(table);
    const draft = panel === 'filter' ? filterDraft : sortDraft;
    const selectable = defs.filter(field => panel === 'filter' || field.type !== 'JSON');
    return `<section class="apps-query-panel" aria-label="${panel === 'filter' ? '筛选条件' : '排序条件'}">
      <div class="apps-query-heading"><strong>${panel === 'filter' ? '同时满足以下条件' : '按以下优先级排序'}</strong><span>${panel === 'filter' ? '筛选覆盖当前权限范围内的数据' : '从上到下依次生效，空值排在最后'}</span></div>
      ${draft.map((rule, index) => {
        const definition = defs.find(field => field.key === rule.field) || selectable[0] || defs[0];
        if (!definition) return '';
        return `<div class="apps-query-rule"><span>${index + 1}</span>
          <select data-grid-rule="${index}" data-rule-part="field" aria-label="${panel === 'filter' ? '筛选' : '排序'}字段 ${index + 1}">${options(selectable.map(field => [field.key, field.name]), rule.field)}</select>
          ${panel === 'sort' ? `<select data-grid-rule="${index}" data-rule-part="direction" aria-label="排序方向 ${index + 1}">${options([['asc', '升序'], ['desc', '降序']], rule.direction)}</select><button class="apps-btn" type="button" data-grid-up="${index}" aria-label="上移排序 ${index + 1}" ${!index ? 'disabled' : ''}>↑</button><button class="apps-btn" type="button" data-grid-down="${index}" aria-label="下移排序 ${index + 1}" ${index === draft.length - 1 ? 'disabled' : ''}>↓</button>` : `<select data-grid-rule="${index}" data-rule-part="op" aria-label="筛选条件 ${index + 1}">${options(availableOps(definition.type).map(op => [op, labels[op]]), rule.op)}</select>${['empty', 'not_empty'].includes(rule.op) ? '<span class="apps-rule-no-value">无需填写值</span>' : definition.type === '布尔' ? `<select data-grid-rule="${index}" data-rule-part="value" aria-label="筛选值 ${index + 1}">${options([['', '请选择'], ['true', '是'], ['false', '否']], rule.value)}</select>` : `<input type="${inputType(definition.type)}" ${definition.type === '整数' ? 'step="1"' : definition.type === '数值' ? 'step="any"' : ''} data-grid-rule="${index}" data-rule-part="value" aria-label="筛选值 ${index + 1}" value="${esc(rule.value)}">`}`}
          <button class="apps-link" type="button" data-grid-remove="${index}" aria-label="删除条件 ${index + 1}">移除</button>
        </div>`;
      }).join('')}
      <div id="apps-query-error" role="alert" class="apps-field-error" hidden></div>
      <footer><button class="apps-link" type="button" data-grid-add ${draft.length >= 8 ? 'disabled' : ''}>＋ 添加${panel === 'filter' ? '筛选' : '排序'}条件</button><div><button class="apps-btn" type="button" data-grid-cancel>取消</button><button class="apps-btn primary" type="button" data-grid-apply>应用${panel === 'filter' ? '筛选' : '排序'}</button></div></footer>
    </section>`;
  }

  function toolbar(currentTable) {
    table = currentTable;
    return `<div class="apps-grid-controls apps-grid-controls-inline"><div><button class="apps-btn ${filters.length ? 'chosen' : ''}" type="button" data-grid-panel="filter" aria-expanded="${panel === 'filter'}">筛选${filters.length ? ` · ${filters.length}` : ''}</button><button class="apps-btn ${sorts.length ? 'chosen' : ''}" type="button" data-grid-panel="sort" aria-expanded="${panel === 'sort'}">排序${sorts.length ? ` · ${sorts.length}` : ''}</button>${filters.length || sorts.length ? '<button class="apps-link" type="button" data-grid-reset>清空条件</button>' : ''}</div>${filters.length ? `<span class="apps-query-summary">同时满足 ${filters.length} 个筛选条件</span>` : ''}</div>`;
  }

  function queryPanel() { return panel ? builder() : ''; }

  function footer(total) {
    const state = getState();
    const pages = Math.max(1, Math.ceil(total / 7));
    state.page = Math.max(1, Math.min(state.page, pages));
    return `<div class="apps-footer"><span>共 ${total} 条数据 · 每页 7 条</span><div><button class="apps-btn" type="button" data-app-page="-1" ${state.page === 1 ? 'disabled' : ''}>上一页</button><span>${state.page} / ${pages}</span><button class="apps-btn" type="button" data-app-page="1" ${state.page === pages ? 'disabled' : ''}>下一页</button></div></div>`;
  }

  function reset() { filters = []; sorts = []; filterDraft = []; sortDraft = []; panel = ''; }

  function apply() {
    if (panel === 'filter') {
      const defs = fieldDefs(table);
      try {
        filters = filterDraft.map(rule => {
          const definition = defs.find(field => field.key === rule.field);
          if (!definition) throw new Error('筛选字段不存在，请重新选择。');
          if (!['empty', 'not_empty'].includes(rule.op) && empty(rule.value)) throw new Error(`请填写第 ${filterDraft.indexOf(rule) + 1} 条筛选值。`);
          if ((definition.type === '整数' || definition.type === '数值') && !['empty', 'not_empty'].includes(rule.op) && Number.isNaN(Number(rule.value))) throw new Error(`第 ${filterDraft.indexOf(rule) + 1} 条筛选值必须是数字。`);
          return {...rule, value: ['empty', 'not_empty'].includes(rule.op) ? null : normalise(rule.value, definition.type)};
        });
      } catch (error) {
        const node = root.querySelector('#apps-query-error');
        if (node) { node.hidden = false; node.textContent = error.message; }
        return;
      }
    } else sorts = sortDraft.map(rule => ({...rule}));
    panel = '';
    getState().page = 1;
    redraw();
  }

  function init(getStateFn, redrawFn, element) {
    getState = getStateFn; redraw = redrawFn; root = element;
    root.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button) return;
      const data = button.dataset;
      if ('gridPanel' in data) {
        panel = panel === data.gridPanel ? '' : data.gridPanel;
        filterDraft = filters.map(rule => ({...rule})); sortDraft = sorts.map(rule => ({...rule}));
        if (panel === 'filter' && !filterDraft.length) filterDraft = [{field: '0', op: 'contains', value: ''}];
        if (panel === 'sort' && !sortDraft.length) sortDraft = [{field: '0', direction: 'asc'}];
        redraw();
      } else if ('gridReset' in data) { reset(); getState().page = 1; redraw(); }
      else if ('gridCancel' in data) { panel = ''; redraw(); }
      else if ('gridAdd' in data) { const list = panel === 'filter' ? filterDraft : sortDraft; if (list.length < 8) list.push(panel === 'filter' ? {field: '0', op: 'contains', value: ''} : {field: '0', direction: 'asc'}); redraw(); }
      else if ('gridRemove' in data) { (panel === 'filter' ? filterDraft : sortDraft).splice(Number(data.gridRemove), 1); redraw(); }
      else if ('gridUp' in data || 'gridDown' in data) { const list = sortDraft; const index = Number(data.gridUp ?? data.gridDown); const next = index + ('gridUp' in data ? -1 : 1); if (next >= 0 && next < list.length) [list[index], list[next]] = [list[next], list[index]]; redraw(); }
      else if ('gridApply' in data) apply();
    });
    root.addEventListener('change', event => {
      const data = event.target.dataset;
      if (!('gridRule' in data)) return;
      const list = panel === 'filter' ? filterDraft : sortDraft;
      const rule = list[Number(data.gridRule)];
      if (!rule) return;
      rule[data.rulePart] = event.target.value;
      if (data.rulePart === 'field' && panel === 'filter') { const definition = fieldDefs(table).find(field => field.key === rule.field); rule.op = availableOps(definition?.type || '文本')[0]; rule.value = ''; }
      if (data.rulePart !== 'value') redraw();
    });
    root.addEventListener('input', event => { const data = event.target.dataset; if ('gridRule' in data && data.rulePart === 'value') (panel === 'filter' ? filterDraft : sortDraft)[Number(data.gridRule)].value = event.target.value; });
  }

  return {init, reset, query, toolbar, queryPanel, footer};
})();
