const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'assets', 'apps-data-model.js'), 'utf8');
const store = new Map();
const sandbox = {
  window: {},
  localStorage: {
    getItem: key => store.get(key) || null,
    setItem: (key, value) => store.set(key, String(value))
  }
};
sandbox.window.localStorage = sandbox.localStorage;
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: 'apps-data-model.js' });

const M = sandbox.window.AppsDataModel;
const ctx = { space: 'team', teamId: 'team-demo' };
const sales = M.apps.find(app => app.id === 'sales');
const leads = M.apps.find(app => app.id === 'leads');
const delivery = M.apps.find(app => app.id === 'delivery');

assert.equal(M.allowed('wangning', sales, 'team', ctx), true, 'team members can read team app data');
assert.equal(M.allowed('wangning', leads, 'team', ctx), true, 'team members can read every bound app');
assert.equal(M.allowed('wangning', delivery, 'team', ctx), false, 'unbound apps stay outside the team scope');
assert.equal(M.canManage('wangning', sales, ctx), false, 'ordinary members cannot manage tables');
assert.equal(M.canManage('zhang', sales, ctx), true, 'team creator can manage bound app tables');
assert.equal(M.canManage('linxiao', leads, ctx), true, 'granted team admin can manage bound app tables');

const memberTeamRows = M.rows('wangning', 'sales', 'customers', 'team', ctx);
const memberOwnRows = M.rows('wangning', 'sales', 'customers', 'mine', ctx);
assert.ok(memberTeamRows.length > memberOwnRows.length, 'team scope returns the whole team dataset, not just my rows');

assert.equal(M.agentAllowed('商机复盘 Agent', 'sales', 'customers', 'delete'), true, 'authorized Agent can delete declared table rows');
assert.equal(M.agentAllowed('客户洞察 Agent', 'sales', 'customers', 'delete'), false, 'unbound Agent operation is blocked');

const run = M.run('zhang', 'multi', ctx);
assert.equal(run.permissionModel, 'agent-table-binding');
assert.ok(run.changes.some(change => change.app === 'leads' && change.table === 'actions'), 'Agent writes are audited as table changes');

const blocked = M.run('wangning', 'update', ctx);
assert.equal(blocked.changes.length, 0, 'ordinary members cannot write App tables through Agent');
assert.ok(blocked.blocked.some(item => item.reason === 'ACTOR_TABLE_WRITE_NOT_ALLOWED'), 'blocked writes record the actor permission reason');

console.log('PASS: Apps data team scope, table management, and Agent operation permissions.');
