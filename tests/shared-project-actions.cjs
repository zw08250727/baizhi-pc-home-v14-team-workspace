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
    await page.goto(`${baseURL}/app.html?workspace=team`);
    const team = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)).teams.find(item => item.id === 'team-demo'), storageKey);
    const openProjects = async () => {
      const root = page.locator('[data-team-tree-toggle="team-demo"]');
      if (await root.getAttribute('aria-expanded') === 'false') await root.click();
      await page.locator('[data-team-folder="team-demo"][data-knowledge-folder="团队共享项目"]').click();
    };
    const checkAlignment = async () => {
      const positions = await page.evaluate(() => {
        const head = document.querySelector('#knowledge-table-head');
        const row = document.querySelector('.team-shared-project-row');
        return { columns: [getComputedStyle(head).gridTemplateColumns, getComputedStyle(row).gridTemplateColumns], starts: [...head.children].map((cell, i) => [cell.getBoundingClientRect().x, row.children[i].getBoundingClientRect().x]) };
      });
      assert.equal(positions.columns[0], positions.columns[1]);
      assert.ok(positions.starts.every(([head, row]) => head > 0 && row > 0), 'No shared-project fields are hidden');
      positions.starts.forEach(([head, row]) => assert.ok(Math.abs(head - row) < 1, `${head} != ${row}`));
    };
    await openProjects();
    const rows = page.locator('.team-shared-project-row');
    assert.equal(await rows.count(), 1);
    assert.deepEqual(await page.locator('#knowledge-table-head > span').allTextContents(), ['', '项目名称', '共享人', '类型', '状态', '更新时间', '操作']);
    assert.match(await rows.first().innerText(), /4 项上下文/);
    assert.equal(await rows.first().locator('[data-team-set-relay]').innerText(), '设置接力人');
    assert.equal(await rows.first().locator('[data-team-continue]').innerText(), '接力');
    await checkAlignment();
    if (process.env.SCREENSHOT_DIR) await page.screenshot({ animations: 'disabled', path: `${process.env.SCREENSHOT_DIR}/shared-projects-desktop.png` });
    await page.setViewportSize({ width: 1080, height: 680 });
    await checkAlignment();
    const actionBox = await rows.first().locator('[data-team-continue]').boundingBox();
    assert.ok(actionBox.x + actionBox.width <= 1080, 'All three actions remain visible at the compact desktop width');
    if (process.env.SCREENSHOT_DIR) await page.screenshot({ animations: 'disabled', path: `${process.env.SCREENSHOT_DIR}/shared-projects-compact.png` });
    await page.setViewportSize({ width: 1440, height: 900 });

    const initial = await team();
    await rows.first().locator('[data-team-shared-delete]').click();
    assert.equal(await page.locator('#drawer-title').innerText(), '删除共享项目');
    await page.locator('#drawer-actions [data-team-close]').click();
    assert.equal(await page.locator('#drawer').evaluate(node => node.classList.contains('show')), false);
    assert.equal((await team()).sharePackages.length, 1);

    await rows.first().locator('[data-team-set-relay]').click();
    assert.equal(await page.locator('#drawer-title').innerText(), '设置接力人');
    assert.deepEqual(await page.locator('#team-relay-member option').allTextContents(), ['张伟', '林晓', '王宁']);
    assert.deepEqual(await page.locator('#team-relay-permission option').allTextContents(), ['只读', '可编辑']);
    assert.equal(await page.locator('#team-relay-permission').inputValue(), 'edit');
    await page.locator('#team-relay-member').selectOption('user-linxiao');
    await page.locator('#team-relay-agent').selectOption('insight-agent');
    if (process.env.SCREENSHOT_DIR) await page.screenshot({ animations: 'disabled', path: `${process.env.SCREENSHOT_DIR}/relay-settings.png` });
    await page.locator('[data-team-relay-save]').click();
    assert.equal((await team()).sharePackages[0].relayMemberName, '林晓');
    assert.equal((await team()).sharePackages[0].targetAgentName, '客户洞察 Agent');
    assert.equal((await team()).usage.credits, initial.usage.credits);
    assert.match(await rows.first().innerText(), /接力人：林晓/);
    await page.reload();
    await openProjects();
    assert.match(await rows.first().innerText(), /接力人：林晓/);

    await rows.first().locator('[data-team-continue]').click();
    assert.equal(await page.locator('#drawer-title').innerText(), '共享项目 · 接力');
    assert.match(await page.locator('#drawer-body').innerText(), /林晓/);
    assert.match(await page.locator('#drawer-body').innerText(), /客户洞察 Agent/);
    await page.locator('#drawer-actions [data-team-close]').click();
    assert.equal((await team()).usage.credits, initial.usage.credits);
    await rows.first().locator('[data-team-continue]').click();
    await page.locator('[data-team-continue-confirm]').click();
    let updated = await team();
    assert.equal(updated.sharePackages[0].continuedBy, '林晓');
    assert.equal(updated.usage.credits, initial.usage.credits + 2400);
    assert.match(await rows.first().innerText(), /已接力/);
    let output = updated.agentArtifacts.find(item => item.sourceSessionId === initial.sharePackages[0].id);
    assert.equal(output.type, 'XLSX');
    assert.equal(output.version, 1);
    assert.equal(output.history[0].agent, '客户洞察 Agent');
    assert.equal(updated.agentArtifacts.every(item => item.type === 'XLSX'), true);
    assert.equal(await page.locator('[data-team-agent-children-top="team-demo"] > button').count(), updated.agentArtifacts.length);

    await rows.first().locator('[data-team-set-relay]').click();
    await page.locator('#team-relay-agent').selectOption('sales-agent');
    await page.locator('[data-team-relay-save]').click();
    await rows.first().locator('[data-team-continue]').click();
    await page.locator('[data-team-continue-confirm]').click();
    updated = await team();
    output = updated.agentArtifacts.find(item => item.sourceSessionId === initial.sharePackages[0].id);
    assert.equal(output.version, 2);
    assert.deepEqual(output.history.map(item => item.agent), ['客户洞察 Agent', '销售简报 Agent']);
    assert.equal(updated.agentArtifacts.length, initial.agentArtifacts.length + 1);

    // The generated Excel can be opened from the app-data directory.
    await page.locator('.team-app-data-group > .tree-folder-toggle').click();
    const outputRow = page.locator('.team-knowledge-row').filter({ hasText: output.name });
    await outputRow.locator('[data-team-knowledge-edit]').click();
    assert.equal(await page.locator('.artifact-sheet').isVisible(), true);
    await page.locator('#knowledge-preview-close').click();
    await openProjects();

    await rows.first().locator('[data-team-set-relay]').click();
    await page.locator('#team-relay-permission').selectOption('read');
    await page.locator('#drawer-actions [data-team-close]').click();
    assert.equal((await team()).sharePackages[0].relayPermission, 'edit', 'Cancel does not apply the draft permission');
    await rows.first().locator('[data-team-set-relay]').click();
    await page.locator('#team-relay-permission').selectOption('read');
    if (process.env.SCREENSHOT_DIR) await page.screenshot({ animations: 'disabled', path: `${process.env.SCREENSHOT_DIR}/relay-permission-settings.png` });
    await page.locator('[data-team-relay-save]').click();
    assert.match(await rows.first().innerText(), /林晓（只读）/);
    await page.reload();
    await openProjects();
    assert.equal((await team()).sharePackages[0].relayPermission, 'read');
    await rows.first().locator('[data-team-set-relay]').click();
    assert.equal(await page.locator('#team-relay-permission').inputValue(), 'read');
    await page.locator('#drawer-actions [data-team-close]').click();
    await rows.first().locator('[data-team-continue]').click();
    assert.equal(await page.locator('#drawer-title').innerText(), '共享项目 · 只读');
    assert.match(await page.locator('#drawer-body').innerText(), /仅可查看/);
    assert.equal(await page.locator('[data-team-continue-confirm]').isDisabled(), true);
    const readOnlySnapshot = await team();
    if (process.env.SCREENSHOT_DIR) await page.screenshot({ animations: 'disabled', path: `${process.env.SCREENSHOT_DIR}/relay-readonly.png` });
    // The execution handler also checks permission, even if the disabled UI is bypassed.
    await page.locator('[data-team-continue-confirm]').evaluate(button => { button.disabled = false; button.click(); });
    assert.deepEqual(await team(), readOnlySnapshot, 'Read-only attempts cannot alter credits, project state, or outputs');
    await page.locator('#drawer-actions [data-team-close]').click();
    await rows.first().locator('[data-team-set-relay]').click();
    await page.locator('#team-relay-permission').selectOption('edit');
    await page.locator('[data-team-relay-save]').click();
    await rows.first().locator('[data-team-continue]').click();
    assert.equal(await page.locator('[data-team-continue-confirm]').isEnabled(), true);
    await page.locator('#drawer-actions [data-team-close]').click();

    await rows.first().locator('[data-team-shared-delete]').click();
    await page.locator('[data-team-shared-delete-confirm]').click();
    assert.equal(await rows.count(), 0);
    assert.equal(await page.locator('#knowledge-empty').isVisible(), true);
    assert.equal((await team()).sharePackages.length, 0);
    assert.equal((await team()).agentArtifacts.length, updated.agentArtifacts.length);
    await page.reload();
    await openProjects();
    assert.equal(await rows.count(), 0);
    assert.deepEqual(errors, []);
    console.log('PASS: aligned columns; delete; member/Agent assignment; persisted read/edit permissions and execution guard; relay; XLSX output and multi-Agent version history.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
