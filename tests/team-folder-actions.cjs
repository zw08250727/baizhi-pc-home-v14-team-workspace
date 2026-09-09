const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const baseURL = process.env.PROTOTYPE_URL || 'http://127.0.0.1:4173';
const storageKey = 'baizhi-v14-team-workspace';

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    // Isolated browser storage: never change the user's demo data.
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${baseURL}/app.html?workspace=team`);
    const root = page.locator('[data-team-tree-toggle="team-demo"]');
    const menu = page.locator('[data-team-file-actions="team-demo"]');
    const input = page.locator('#team-folder-name');
    const dialog = page.locator('#team-folder-dialog');
    const savedTeam = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)).teams.find(team => team.id === 'team-demo'), storageKey);
    const openAction = async action => {
      await root.hover();
      await page.locator('[data-team-file-menu="team-demo"]').click();
      await menu.locator(`[data-team-file-action="${action}"]`).click();
      assert.equal(await dialog.isVisible(), true);
    };

    assert.equal(await root.getAttribute('aria-expanded'), 'false');
    const originalTeam = await savedTeam();
    await openAction('child');
    await page.locator('#team-folder-save').click();
    assert.match(await page.locator('#team-folder-error').innerText(), /请输入/);
    await input.fill('团队共享项目');
    await input.press('Enter');
    assert.match(await page.locator('#team-folder-error').innerText(), /同名/);
    await input.fill('项目资料');
    await input.press('Enter');
    assert.equal(await dialog.isVisible(), false);
    assert.equal(await page.locator('[data-team-custom-folder]').count(), 1);
    assert.equal(await root.getAttribute('aria-expanded'), 'true');
    assert.equal(await page.locator('#knowledge-folder-title').innerText(), '项目资料');
    assert.equal(await page.locator('#knowledge-file-list > *').count(), 0);
    assert.equal(await page.locator('#knowledge-empty').isVisible(), true);

    await openAction('child');
    await input.fill(' 项目资料 ');
    await input.press('Enter');
    assert.match(await page.locator('#team-folder-error').innerText(), /同名/);
    await dialog.getByRole('button', { name: '取消', exact: true }).click();
    assert.equal((await savedTeam()).fileFolders.length, 1);

    await openAction('rename');
    assert.equal(await input.inputValue(), '产品共创组的团队文件');
    await input.fill('取消更名');
    await input.press('Escape');
    assert.equal(await dialog.isVisible(), false);
    assert.equal((await savedTeam()).filesRootName, undefined);
    await openAction('rename');
    await input.fill('产品项目库');
    if (process.env.SCREENSHOT_DIR) await page.screenshot({ animations: 'disabled', path: `${process.env.SCREENSHOT_DIR}/rename-desktop.png` });
    await input.press('Enter');
    assert.equal(await root.locator('.tree-folder-name').innerText(), '产品项目库');
    assert.equal(await page.locator('#knowledge-folder-title').innerText(), '产品项目库');
    assert.equal(await page.locator('#knowledge-breadcrumb-current').innerText(), '产品项目库');
    const updatedTeam = await savedTeam();
    assert.equal(updatedTeam.name, originalTeam.name);
    assert.deepEqual(updatedTeam.sharePackages, originalTeam.sharePackages);
    assert.deepEqual(updatedTeam.agentArtifacts, originalTeam.agentArtifacts);
    const expectedRows = originalTeam.sharePackages.length + originalTeam.artifacts.length + originalTeam.agentArtifacts.length;
    assert.equal(await page.locator('.team-knowledge-row').count(), expectedRows);

    await page.reload();
    assert.equal(await root.locator('.tree-folder-name').innerText(), '产品项目库');
    assert.equal(await root.getAttribute('aria-expanded'), 'false');
    await root.click();
    assert.equal(await page.locator('.team-knowledge-row').count(), expectedRows);
    await page.locator('[data-team-custom-folder]').click();
    assert.equal(await page.locator('#knowledge-folder-title').innerText(), '项目资料');

    await openAction('child');
    await page.evaluate(() => { window.originalStorageSetItem = Storage.prototype.setItem; Storage.prototype.setItem = () => { throw new Error('Test quota error'); }; });
    await input.fill('未保存的目录');
    await input.press('Enter');
    assert.match(await page.locator('#team-folder-error').innerText(), /保存失败/);
    await page.evaluate(() => { Storage.prototype.setItem = window.originalStorageSetItem; });
    await input.press('Escape');
    assert.equal((await savedTeam()).fileFolders.length, 1);

    await openAction('child');
    await page.setViewportSize({ width: 1080, height: 680 });
    const box = await dialog.boundingBox();
    assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= 1080 && box.y + box.height <= 680);
    if (process.env.SCREENSHOT_DIR) await page.screenshot({ animations: 'disabled', path: `${process.env.SCREENSHOT_DIR}/create-compact.png` });
    await input.press('Escape');
    await page.setViewportSize({ width: 1440, height: 900 });
    await root.hover();
    await page.locator('[data-team-file-menu="team-demo"]').click();
    if (process.env.SCREENSHOT_DIR) await page.screenshot({ animations: 'disabled', path: `${process.env.SCREENSHOT_DIR}/menu-compact.png` });
    assert.equal(await menu.getByRole('button', { name: '新建下级目录', exact: true }).count(), 1);
    assert.equal(await menu.getByRole('button', { name: '重命名', exact: true }).count(), 1);

    await page.locator('#team-workspace-switcher-button').click();
    await page.locator('[data-workspace-target="personal"]').click();
    assert.equal(await page.locator('body').getAttribute('data-workspace'), 'personal');
    assert.equal(await page.locator('#artifact-tree-personal').isVisible(), false);
    assert.equal(await page.locator('#knowledge-side-list [data-knowledge-folder="应用数据"]:visible, #knowledge-side-list .artifact-root:visible').count(), 0);
    assert.equal(await page.locator('[data-knowledge-folder="我的文件"]').isVisible(), true);
    await page.goto(`${baseURL}/app.html?edition=personal`);
    assert.equal(await page.locator('#artifact-tree-personal').isVisible(), false);
    await page.goto(`${baseURL}/app.html?edition=enterprise`);
    assert.equal(await page.locator('#artifact-tree-enterprise').isVisible(), true);
    assert.equal(await page.locator('#artifact-tree-personal').isVisible(), false);
    await page.goto(`${baseURL}/app.html?workspace=team`);
    assert.equal(await page.locator('.team-app-data-group:visible').count(), 1);
    assert.deepEqual(errors, []);
    console.log('PASS: create, validation, cancel, rename, content preservation, persistence, storage failure, responsive dialogs, and workspace visibility.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
