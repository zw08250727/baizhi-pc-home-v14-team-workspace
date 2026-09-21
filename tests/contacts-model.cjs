const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('assets/contacts-model.js', 'utf8');
const storage = new Map();
const context = {
  window: {},
  localStorage: {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, String(value))
  },
  Date,
  JSON,
  String,
  Number,
  console
};
vm.runInNewContext(source, context);
const model = context.window.ContactsModel;

assert.equal(model.scope('personal', ''), 'personal');
assert.equal(model.scope('enterprise', ''), 'enterprise');
assert.equal(model.scope('enterprise', 'team'), 'team');

const personal = model.load('personal', '').data;
const team = model.load('enterprise', 'team').data;
assert.equal(personal.contacts.length, 6);
assert.equal(team.contacts.length, 6);
const attention = model.filter(personal.contacts, '', '需关注');
assert.deepEqual(attention.map((item) => item.id), ['john', 'alice']);
assert.equal(model.filter(personal.contacts, 'ABC', '全部').length, 3);

const added = model.add(personal, { name: '新联系人', company: '新公司', role: '采购', summary: '新的合作上下文' });
assert.equal(added.ok, true);
assert.equal(personal.contacts.at(-1).name, '新联系人');
assert.equal(model.add(personal, { name: '新联系人' }).ok, false);
assert.equal(model.addNote(personal, 'john', '需要在下次会议确认名单'), true);
assert.equal(personal.notes.john.length, 1);
const imported = model.importContacts(personal, [{ name: '导入联系人', company: 'Demo', role: '负责人' }]);
assert.equal(imported.ok, true);
assert.equal(personal.contacts.some((item) => item.name === '导入联系人'), true);
assert.equal(model.update(model.scope('personal', ''), personal), true);
assert.equal(model.load('enterprise', 'team').data.contacts.some((item) => item.name === '新联系人'), false);

console.log('contacts-model tests passed');
