const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const context = {window: {}, console};
vm.runInNewContext(fs.readFileSync('assets/apps-grid-tools.js', 'utf8'), context);
const Grid = context.window.AppsGridTools;
const table = {fields: [['客户名称', '文本'], ['金额', '数值'], ['状态', '文本'], ['已联系', '布尔']]};
const rows = [
  {id: 'r1', values: ['华悦零售', 120, '跟进中', true], updated: '2026-09-03 10:00'},
  {id: 'r2', values: ['东辰商业', 320, '', false], updated: '2026-09-01 10:00'},
  {id: 'r3', values: ['苏城百货', 210, '已报价', true], updated: '2026-09-02 10:00'}
];

assert.deepStrictEqual(Grid.query(rows, table, [{field: '0', op: 'contains', value: '零售'}]).map(row => row.id), ['r1']);
assert.deepStrictEqual(Grid.query(rows, table, [{field: '1', op: 'gte', value: 200}]).map(row => row.id), ['r2', 'r3']);
assert.deepStrictEqual(Grid.query(rows, table, [{field: '2', op: 'empty', value: null}]).map(row => row.id), ['r2']);
assert.deepStrictEqual(Grid.query(rows, table, [
  {field: '1', op: 'gte', value: 100},
  {field: '3', op: 'eq', value: true}
]).map(row => row.id), ['r1', 'r3']);
assert.deepStrictEqual(Grid.query(rows, table, [], [{field: '1', direction: 'desc'}]).map(row => row.id), ['r2', 'r3', 'r1']);
assert.deepStrictEqual(Grid.query(rows, table, [], [{field: '2', direction: 'asc'}]).map(row => row.id), ['r1', 'r3', 'r2']);
console.log('PASS: app data filter and sort query behavior.');
