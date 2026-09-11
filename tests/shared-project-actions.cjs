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
    const openRelayDrawer = async () => {
      await page.locator('.team-shared-project-row').first().locator('[data-team-continue]').click();
      assert.equal(await page.locator('#drawer-title').innerText(), '设置并接力');
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
    assert.equal(await page.locator('[data-team-shared-history="true"] .history-time').innerText(), '接力共享');
    assert.equal(await page.locator('[data-team-shared-history="true"] [data-team-shared-open]').innerText(), '打开并接力');
    assert.deepEqual(await page.locator('#knowledge-table-head > span').allTextContents(), ['', '项目名称', '共享人', '类型', '状态', '更新时间', '操作']);
    assert.match(await rows.first().innerText(), /4 项上下文/);
    assert.equal(await rows.first().locator('[data-team-set-relay]').count(), 0);
    assert.equal(await rows.first().locator('[data-team-continue]').innerText(), '接力');
    await checkAlignment();
    if (process.env.SCREENSHOT_DIR) await page.screenshot({ animations: 'disabled', path: `${process.env.SCREENSHOT_DIR}/shared-projects-desktop.png` });
    await page.setViewportSize({ width: 1080, height: 680 });
    await checkAlignment();
    const actionBox = await rows.first().locator('[data-team-continue]').boundingBox();
    assert.ok(actionBox.x + actionBox.width <= 1080, 'The combined relay action remains visible at the compact desktop width');
    if (process.env.SCREENSHOT_DIR) await page.screenshot({ animations: 'disabled', path: `${process.env.SCREENSHOT_DIR}/shared-projects-compact.png` });
    await page.setViewportSize({ width: 1440, height: 900 });

    const initial = await team();
    await rows.first().locator('[data-team-shared-delete]').click();
    assert.equal(await page.locator('#drawer-title').innerText(), '删除共享项目');
    await page.locator('#drawer-actions [data-team-close]').click();
    assert.equal(await page.locator('#drawer').evaluate(node => node.classList.contains('show')), false);
    assert.equal((await team()).sharePackages.length, 1);

    await openRelayDrawer();
    assert.deepEqual(await page.locator('#team-relay-member option').allTextContents(), ['张伟', '林晓', '王宁']);
    assert.deepEqual(await page.locator('#team-relay-permission option').allTextContents(), ['只读', '可编辑']);
    assert.equal(await page.locator('#team-relay-permission').inputValue(), 'edit');
    assert.match(await page.locator('#drawer-body').innerText(), /点击下方动作时会先保存设置/);
    assert.match(await page.locator('#drawer-body').innerText(), /带入 Agent 的上下文/);
    assert.doesNotMatch(await page.locator('#drawer-body').innerText(), /来源与归属/);
    assert.doesNotMatch(await page.locator('#drawer-body').innerText(), /隐私边界/);
    assert.equal(await page.locator('#team-relay-permission-hint').count(), 0);
    assert.match(await page.locator('.team-help-tip').getAttribute('data-help'), /只读：进入共享人的 Agent 对话/);
    assert.doesNotMatch(await page.locator('#drawer-body').innerText(), /权限只作用于本次项目接力/);
    await page.locator('#team-relay-member').selectOption('user-linxiao');
    await page.locator('#team-relay-agent').selectOption('insight-agent');
    if (process.env.SCREENSHOT_DIR) await page.screenshot({ animations: 'disabled', path: `${process.env.SCREENSHOT_DIR}/relay-workflow.png` });
    const sourcePopupPromise = page.waitForEvent('popup');
    await page.locator('[data-team-relay-view-source]').click();
    const sourcePopup = await sourcePopupPromise;
    await sourcePopup.waitForURL(/relayMode=shared-agent/);
    assert.match(sourcePopup.url(), /relayPermission=edit/);
    await sourcePopup.close();
    assert.equal((await team()).sharePackages[0].relayMemberName, '林晓');
    assert.equal((await team()).sharePackages[0].targetAgentName, '客户洞察 Agent');
    assert.equal((await team()).usage.credits, initial.usage.credits);
    assert.match(await rows.first().innerText(), /接力人：林晓/);
    await page.reload();
    await openProjects();
    assert.match(await rows.first().innerText(), /接力人：林晓/);

    await openRelayDrawer();
    assert.match(await page.locator('#drawer-body').innerText(), /林晓/);
    assert.match(await page.locator('#drawer-body').innerText(), /客户洞察 Agent/);
    assert.equal(await page.locator('[data-team-relay-handoff]').isEnabled(), true);
    const handoffPopupPromise = page.waitForEvent('popup');
    await page.locator('[data-team-relay-handoff]').click();
    const handoffPopup = await handoffPopupPromise;
    await handoffPopup.waitForURL(/relayPermission=edit/);
    assert.equal(new URL(handoffPopup.url()).searchParams.get('agent'), '客户洞察 Agent');
    await handoffPopup.close();
    assert.equal((await team()).usage.credits, initial.usage.credits);

    await openRelayDrawer();
    await page.locator('#team-relay-permission').selectOption('read');
    await page.locator('#drawer-actions [data-team-close]').click();
    assert.equal((await team()).sharePackages[0].relayPermission, 'edit', 'Cancel does not apply the draft permission');
    await openRelayDrawer();
    await page.locator('#team-relay-permission').selectOption('read');
    assert.equal(await page.locator('[data-team-relay-handoff]').count(), 0);
    assert.equal(await page.locator('[data-team-relay-view-source]').innerText(), '查看共享 Agent 对话');
    await page.locator('#team-relay-permission').selectOption('edit');
    assert.equal(await page.locator('[data-team-relay-handoff]').count(), 1);
    assert.equal(await page.locator('[data-team-relay-handoff]').isEnabled(), true);
    await page.locator('#team-relay-permission').selectOption('read');
    assert.equal(await page.locator('[data-team-relay-handoff]').count(), 0);
    if (process.env.SCREENSHOT_DIR) await page.screenshot({ animations: 'disabled', path: `${process.env.SCREENSHOT_DIR}/relay-readonly-workflow.png` });
    const readPopupPromise = page.waitForEvent('popup');
    await page.locator('[data-team-relay-view-source]').click();
    const readPopup = await readPopupPromise;
    await readPopup.waitForURL(/relayPermission=read/);
    await readPopup.close();
    assert.match(await rows.first().innerText(), /林晓（只读）/);
    assert.equal(await page.locator('[data-team-shared-history="true"] .history-time').innerText(), '只读共享');
    assert.equal(await page.locator('[data-team-shared-history="true"] [data-team-shared-open]').innerText(), '查看共享');
    await page.reload();
    await openProjects();
    assert.equal((await team()).sharePackages[0].relayPermission, 'read');
    await openRelayDrawer();
    assert.equal(await page.locator('#team-relay-permission').inputValue(), 'read');
    assert.match(await page.locator('.team-help-tip').getAttribute('data-help'), /仅可查看/);
    assert.doesNotMatch(await page.locator('#drawer-body').innerText(), /仅可查看完整对话/);
    assert.equal(await page.locator('[data-team-relay-handoff]').count(), 0);
    const readOnlySnapshot = await team();
    // The execution handler still guards permission if an old hidden action is triggered.
    await page.locator('[data-team-continue-confirm]').evaluate(button => { button.disabled = false; button.click(); });
    assert.deepEqual(await team(), readOnlySnapshot, 'Read-only attempts cannot alter credits, project state, or outputs');
    await page.locator('#drawer-actions [data-team-close]').click();

    await openRelayDrawer();
    await page.locator('#team-relay-permission').selectOption('edit');
    assert.equal(await page.locator('[data-team-relay-handoff]').count(), 1);
    const editPopupPromise = page.waitForEvent('popup');
    await page.locator('[data-team-relay-handoff]').click();
    const editPopup = await editPopupPromise;
    await editPopup.waitForURL(/relayPermission=edit/);
    await editPopup.close();
    assert.equal((await team()).sharePackages[0].relayPermission, 'edit');

    await rows.first().locator('[data-team-shared-delete]').click();
    await page.locator('[data-team-shared-delete-confirm]').click();
    assert.equal(await rows.count(), 0);
    assert.equal(await page.locator('#knowledge-empty').isVisible(), true);
    assert.equal((await team()).sharePackages.length, 0);
    await page.reload();
    await openProjects();
    assert.equal(await rows.count(), 0);
    assert.deepEqual(errors, []);
    console.log('PASS: aligned shared-project columns; single relay entry; combined relay settings; read/edit permissions; source Agent and own Agent handoff actions; delete.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
