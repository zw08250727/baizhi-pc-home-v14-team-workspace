const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const baseURL = process.env.PROTOTYPE_URL || 'http://127.0.0.1:4173';

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.goto(`${baseURL}/app.html?edition=enterprise`);
    assert.equal(await page.locator('#apps-entry').count(), 1);
    assert.equal(await page.locator('#apps-entry').evaluate(el => el.classList.contains('tree-folder-toggle')), true);
    assert.equal(await page.locator('#apps-entry .tree-chevron').count(), 1);
    assert.equal(await page.locator('#apps-entry .tree-folder-icon').count(), 1);
    assert.equal(await page.locator('#apps-entry-count').innerText(), '2');
    assert.equal(await page.locator('#apps-nav-children').evaluate(el => el.classList.contains('knowledge-tree-children')), true);
    assert.deepEqual(await page.locator('#apps-nav-children .knowledge-leaf .tree-folder-name').allTextContents(), ['销售洞察', '客户商机']);
    assert.equal(await page.locator('.artifact-tree').first().evaluate(el => getComputedStyle(el).display), 'none');

    await page.locator('#apps-entry').click();
    assert.equal(await page.locator('#page-crumb').innerText(), '知识库');
    assert.match(await page.locator('.apps-breadcrumb').innerText(), /知识库\s*\/\s*应用数据/);
    assert.equal(await page.locator('.apps-page-head h1').innerText(), '应用数据');
    assert.equal(await page.locator('#apps-xiaozhi-entry').count(), 1);
    assert.equal(await page.locator('[data-app-demo]').count(), 0);
    await page.locator('#apps-xiaozhi-entry').click();
    assert.equal(await page.locator('#knowledge-xiaozhi-panel').getAttribute('aria-hidden'), 'false');
    assert.match(await page.locator('#knowledge-xiaozhi-scope').innerText(), /应用数据/);
    const openWorkspaceBox = await page.locator('.apps-workspace').boundingBox();
    const openPanelBox = await page.locator('#knowledge-xiaozhi-panel').boundingBox();
    assert.ok(openWorkspaceBox && openPanelBox);
    assert.ok(openWorkspaceBox.x + openWorkspaceBox.width <= openPanelBox.x, '小智展开后应用数据工作区不能与侧栏重叠');
    await page.locator('#knowledge-xiaozhi-close').click();
    const workspaceBox = await page.locator('.apps-workspace').boundingBox();
    const knowledgeBox = await page.locator('.knowledge-workspace').evaluate(el => {
      const style = getComputedStyle(el);
      return { borderRadius: style.borderRadius, borderColor: style.borderTopColor };
    });
    const appBoxStyle = await page.locator('.apps-workspace').evaluate(el => {
      const style = getComputedStyle(el);
      return { borderRadius: style.borderRadius, borderColor: style.borderTopColor };
    });
    assert.ok(workspaceBox.width > 1000);
    assert.deepEqual(appBoxStyle, knowledgeBox);
    assert.deepEqual(await page.locator('.apps-table thead th').allTextContents(), ['应用名称', '数据表', '数据条数', '最近更新时间', '最近更新人']);
    assert.deepEqual(await page.locator('.apps-name strong').allTextContents(), ['销售洞察', '客户商机']);
    assert.match(await page.locator('.apps-footer').innerText(), /按 App 展示，不按 Agent 分组/);

    await page.locator('.apps-name').filter({ hasText: '销售洞察' }).click();
    assert.equal(await page.locator('.apps-page-head h1').innerText(), '销售洞察');
    assert.deepEqual(await page.locator('.apps-segment button').allTextContents(), ['数据表', '更新历史']);
    assert.deepEqual(await page.locator('.apps-sheet-nav button span').allTextContents(), ['客户画像', '商机跟进', '周期汇总']);
    assert.equal(await page.locator('.apps-sheet-heading strong').innerText(), '客户画像');
    assert.match(await page.locator('.apps-data-grid tbody tr').first().innerText(), /东辰商业/);

    await page.locator('[data-app-table="opportunities"]').click();
    assert.equal(await page.locator('.apps-sheet-heading strong').innerText(), '商机跟进');
    await page.locator('[data-app-filter="search"]').fill('门店销售');
    assert.match(await page.locator('.apps-data-grid tbody tr').first().innerText(), /门店销售数字化/);

    await page.locator('[data-app-tab="history"]').click();
    assert.equal(await page.locator('.apps-table tbody tr').count(), 2);
    assert.match(await page.locator('.apps-table tbody tr').first().innerText(), /商机复盘 Agent/);
    await page.locator('[data-app-history]').first().click();
    assert.equal(await page.locator('#apps-history-dialog[open]').count(), 1);
    assert.equal(await page.locator('#apps-history-dialog h2').innerText(), '本次数据变更');
    assert.match(await page.locator('#apps-history-dialog').innerText(), /修改|删除|新增/);
    await page.locator('#apps-history-dialog [data-app-close]').click();

    await page.goto(`${baseURL}/app.html?workspace=team`);
    await page.locator('#apps-entry').click();
    assert.equal(await page.locator('.apps-page-head h1').innerText(), '应用数据');
    assert.equal(await page.locator('#apps-xiaozhi-entry').count(), 1);
    assert.equal(await page.locator('[data-app-demo]').count(), 0);
    assert.equal(await page.locator('.team-app-data-group').count(), 0);
    assert.deepEqual(await page.locator('.apps-name strong').allTextContents(), ['销售洞察', '客户商机']);

    assert.deepEqual(errors, []);
    console.log('PASS: v13 application-data workbench, app tables, history drawer, and team entry.');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
