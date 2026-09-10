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
    const initialTeam = await team();
    const sharedPackage = initialTeam.sharePackages[0];
    assert.ok(sharedPackage, 'The demo team should include a shared project');

    const openSharedAgent = async permission => {
      const params = new URLSearchParams({
        agent: sharedPackage.sourceAgentName || '销售简报 Agent',
        edition: 'personal',
        workspace: 'team',
        teamId: initialTeam.id,
        teamName: initialTeam.name,
        relayMode: 'shared-agent',
        relayProject: sharedPackage.id,
        relayPermission: permission,
        relayMember: '张伟',
        sourceMember: sharedPackage.sourceOwner || '林晓'
      });
      await page.goto(`${baseURL}/agent.html?${params.toString()}`);
      await page.waitForTimeout(80);
    };

    await openSharedAgent('read');
    assert.equal(await page.locator('.shared-conversation-intro').count(), 1);
    assert.equal(await page.locator('.shared-message').count(), 3);
    assert.equal(await page.locator('.shared-tool').count(), 1);
    assert.equal(await page.locator('#agent-input').isDisabled(), true);
    assert.match(await page.locator('#shared-permission-note').innerText(), /只读权限/);
    assert.equal(await page.locator('#task-file-list .panel-file').count(), 2);
    await page.locator('#task-file-list .panel-file').filter({ hasText: '竞品对比表.xlsx' }).click();
    assert.equal(await page.locator('.preview-table').isVisible(), true);
    assert.equal(await page.locator('#file-preview h2').innerText(), '竞品对比表.xlsx');
    await page.locator('#shared-file-preview-back').click();
    assert.equal(await page.locator('#task-file-list').isVisible(), true);

    await openSharedAgent('edit');
    assert.equal(await page.locator('#agent-input').isDisabled(), false);
    await page.locator('#agent-input').fill('请补充风险清单');
    await page.locator('#agent-send').click();
    await page.waitForTimeout(80);
    assert.equal(await page.locator('.shared-message').count(), 5);
    assert.equal(await page.locator('.shared-message.continuation').count(), 2);
    const updatedTeam = await team();
    const updatedProject = updatedTeam.sharePackages.find(item => item.id === sharedPackage.id);
    assert.equal(updatedProject.continuations.length, 1);
    assert.equal(updatedProject.sourceConversation.messages.length, 5);
    const output = updatedTeam.agentArtifacts.find(item => item.sourceSessionId === sharedPackage.id);
    assert.ok(output, 'Editable relay should create a versioned XLSX output');
    assert.equal(output.type, 'XLSX');
    assert.equal(output.version, 1);
    assert.equal(output.history[0].agent, sharedPackage.sourceAgentName || '销售简报 Agent');
    assert.deepEqual(errors, []);
    console.log('PASS: shared Agent read-only transcript, tool/artifact visibility, XLSX preview, editable continuation, and versioned output persistence.');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
