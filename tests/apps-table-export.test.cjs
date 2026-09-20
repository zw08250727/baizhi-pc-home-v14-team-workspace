const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');

const context = { window: {}, TextEncoder };
vm.runInNewContext(fs.readFileSync('assets/apps-table-export.js', 'utf8'), context);
const build = context.window.AppsTableExport.build;
const bytes = build('表/[名称]?', ['文本', '数值', '布尔', 'JSON', '空值'], [
  ['=SUM(1,2)', 0, false, { 渠道: '电话 & <客户>' }, null],
  ['中文', 350000, true, '01234567890123456789', '']
]);

const check = spawnSync('python3', ['-c', `
import io, sys, zipfile
from xml.etree import ElementTree as ET
z = zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read()))
assert 'xl/worksheets/sheet1.xml' in z.namelist()
sheet = z.read('xl/worksheets/sheet1.xml').decode()
assert 'SUM(1,2)' in sheet and '<f>' not in sheet
assert '电话 &amp; &lt;客户&gt;' in sheet
assert 'autoFilter' in sheet
ET.fromstring(sheet)
print('xlsx export ok')
`], { input: bytes });
assert.equal(check.status, 0, check.stderr.toString());
assert.match(check.stdout.toString(), /xlsx export ok/);
assert.ok(build('空表', ['字段'], []).length > 0);
console.log(check.stdout.toString().trim());
