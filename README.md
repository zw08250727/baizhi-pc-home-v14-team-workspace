# 百智 AI 工作台 v14 · 轻团队 Agent Workspace

在 v13 企业/个人双模式基础上，新增个人账号可自助创建的 3–30 人轻团队空间（10 / 30 固定席位）。

## 入口

- `index.html`：固定 1440×900 PC 画布，随容器等比缩放。
- `app.html`：原始响应式页面。
- `assets/team-workspace.css`：团队版视觉与布局。
- `assets/team-workspace.js`：团队创建、订阅、成员、共享和接力的本地模拟状态。
- `assets/agent-artifacts*.js` / `assets/agent-artifacts.css`：Agent 产物、知识库文件操作与销售简报任务页。
- 原有能力：我的会议、我的闪念、企业会议、知识库、AI 专家/技能/连接器、录音工作台、小智与桌面端引导。
- 企业协作：管理员按姓名、手机号、工作邮箱、部门和账号状态发送邀请邮件；个人版保留企业试用申请入口。
- 文件管理：首页录音和知识文件删除后进入 30 天回收站，支持恢复、彻底删除、个人/企业空间隔离与剩余容量展示。

## 核心演示路径

1. 选择个人登录，在左侧创建团队。
2. 选择 10/30 人套餐和月付/年付。
3. 混合配置标准、专业、卓越录音卡并查看动态价格。
4. 模拟支付成功或失败。
5. 进入团队工作台，查看共享用量并邀请成员。
6. 从个人历史任务发布 Session，再切换团队交给 Agent 接力；也可在 Agent 页保存新的 Agent 产物。
7. 在团队设置查看团队概览、成员与邀请、订阅与用量、基础设置；常驻 Agent 与硬件选配保留在创建/购买流程中。
8. 一个账号最多创建 3 个团队；创建人可在基础设置归档并解散团队，确认后团队文件与产物转入个人文件区；普通成员可主动离开团队。

## 直达预览参数

- `?edition=personal`：个人工作台。
- `?edition=enterprise`：企业工作台，兼容 v13。
- `?workspace=team`：团队工作台首页。
- `?workspace=team&teamPage=members`：成员与邀请。
- `?workspace=team&teamPage=billing`：订阅与用量。
- `?edition=personal&teamFlow=create`：创建团队与套餐选择。
- `?edition=personal&teamFlow=hardware`：硬件选配。
- `?edition=personal&teamFlow=checkout`：订单与支付。
- `?workspace=team&share=compose`：Session 共享选择。
- `?workspace=team&share=continue`：团队 Agent 接力。
- `?workspace=team&teamUpgrade=1`：团队套餐升级付费弹窗。

## 原型边界

- 团队不增加第三个登录入口，复用个人账号体系。
- 个人 Session 默认私有，只有显式选择后才生成团队资产快照。
- 本地 `localStorage` 仅用于演示；不会调用真实支付、邀请邮件、麦克风或 Agent 服务。
- 套餐价格与资源量是产品试算值，不是正式销售承诺。
- 页面中的数据、授权、连接器接入、删除和下载流程均为原型演示。
