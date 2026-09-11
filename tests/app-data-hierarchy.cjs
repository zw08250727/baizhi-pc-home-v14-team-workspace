const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const baseURL = process.env.PROTOTYPE_URL || 'http://127.0.0.1:4173';
const storageKey = 'baizhi-v14-team-workspace';

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.goto(`${baseURL}/app.html?edition=enterprise`);
    await page.locator('#artifact-tree-enterprise .artifact-root').click();
    assert.equal(await page.locator('#knowledge-folder-title').innerText(), '应用数据');
    assert.deepEqual(await page.locator('#knowledge-table-head > span').allTextContents(), ['', '名称', '类型', '来源', '状态', '更新时间', '操作']);
    assert.deepEqual(await page.locator('.artifact-app-folder-row strong').allTextContents(), ['应用A', '应用B']);
    assert.equal(await page.locator('.artifact-app-data-row').filter({ hasText: 'airtable1.xlsx' }).count(), 0);

    await page.locator('.artifact-app-folder-row').filter({ hasText: '应用A' }).click();
    assert.equal(await page.locator('#knowledge-folder-title').innerText(), '应用A');
    assert.deepEqual(await page.locator('.artifact-app-data-row strong').allTextContents(), ['airtable1.xlsx', 'airtable2.xlsx']);
    await page.locator('.artifact-app-data-row').filter({ hasText: 'airtable1.xlsx' }).click();
    assert.equal(await page.locator('#knowledge-preview-title').innerText(), 'airtable1.xlsx');
    assert.equal(await page.locator('#artifact-edit').isVisible(), true);
    await page.locator('#knowledge-preview-close').click();
    await page.locator('.artifact-app-data-row').filter({ hasText: 'airtable2.xlsx' }).locator('[data-knowledge-row-action="edit"]').click();
    assert.equal(await page.locator('#knowledge-preview-title').innerText(), 'airtable2.xlsx');
    assert.equal(await page.locator('#artifact-edit').isVisible(), true);

    await page.goto(`${baseURL}/app.html?workspace=team`);
    const appDataRoot = page.locator('[data-team-agent-tree-toggle="team-demo"]').first();
    await appDataRoot.click();
    assert.equal(await page.locator('#knowledge-folder-title').innerText(), '应用数据');
    assert.deepEqual(await page.locator('.team-app-data-row[data-team-knowledge-kind="app"] strong').allTextContents(), ['应用A', '应用B']);
    assert.equal(await page.locator('.team-app-data-row').filter({ hasText: 'airtable1.xlsx' }).count(), 0);
    assert.deepEqual(
      await page.evaluate(key => {
        const team = JSON.parse(localStorage.getItem(key)).teams.find(item => item.id === 'team-demo');
        return team.agentArtifacts.filter(item => item.type === 'XLSX').map(item => `${item.appName}/${item.tableName}`);
      }, storageKey),
      ['应用A/airtable1', '应用A/airtable2', '应用B/airtable1', '应用B/airtable2']
    );

    await page.locator('[data-team-agent-app-toggle="team-demo"][data-knowledge-folder="应用A"]').first().click();
    assert.equal(await page.locator('#knowledge-folder-title').innerText(), '应用A');
    assert.deepEqual(await page.locator('.team-app-data-row[data-team-knowledge-kind="agent"] strong').allTextContents(), ['airtable1.xlsx', 'airtable2.xlsx']);
    assert.deepEqual(await page.locator('#knowledge-table-head > span').allTextContents(), ['', '名称', '类型', '来源', '状态', '更新时间', '操作']);
    assert.deepEqual(await page.locator('.team-app-data-row[data-team-knowledge-kind="agent"]').first().locator('> span').nth(3).innerText(), '销售简报 Agent');
    assert.equal(await page.locator('[data-team-version-history]').first().innerText(), '版本记录');
    assert.equal(await page.locator('[data-team-knowledge-edit]').first().innerText(), '编辑');

    await page.locator('[data-team-artifact-id]').first().click();
    assert.equal(await page.locator('#knowledge-preview-title').innerText(), 'airtable1.xlsx');
    assert.equal(await page.locator('#artifact-edit').isVisible(), true);

    assert.deepEqual(errors, []);
    console.log('PASS: enterprise/team app-data hierarchy, default app tables, preview, and edit entry.');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
