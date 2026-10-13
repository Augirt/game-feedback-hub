# 迭代星图 · Day 工作流（v1.1.1）

[打开需求中心](https://augirt.github.io/game-feedback-hub/) · [机器读取约定](https://augirt.github.io/game-feedback-hub/automation.json)

GitHub Pages 页面以 `Augirt/game-feedback-hub` 的公开 Issues 为唯一需求源。保留灵感、需求、反馈、问题四种类型；新增 Day、目标版本、负责角色、验收条件、按批次筛选与全量 JSON 导出。

## 提交一次 Day 需求

1. 点击「新建需求」，填写标题和详细描述。
2. 填写 Day（1–999999）、目标版本（例如 `v0.3.0`）、角色和验收条件。
3. 范围确认后勾选「已确认，允许团队开始」，在 GitHub 登录并完成创建。此选项生成 `status: planned`；不勾选则进入待评估。
4. 同一个 Day 可以提交多个 Issue；Day 是需求批次，版本是交付编号。修订已有需求时编辑原 Issue，保留其编号。

自动执行候选必须由用户在开发团队中确认的提交账号创建（账号名单保存在本地开发配置中），状态为已规划且批次、版本和验收条件完整。其他参与者的反馈供策划评估，不自动成为开发指令。`Role` 是主责角色，不妨碍跨角色协作。

所有内容保存在公开 GitHub Issues，请勿填写密钥或私密内容。表单只打开 GitHub 的草稿确认页，不会在网页保存 Token，也不会自动替用户发布 Issue。

## 状态与数据

- `status: inbox` 待评估；`status: planned` 已规划。
- `status: in progress` 进行中；`status: testing` 待验收；`status: blocked` 受阻。
- `status: done` 已完成；`status: cancelled` 已取消。
- GitHub 以 `completed` 原因关闭才映射为已完成；以 `not_planned` 关闭映射为已取消。缺少关闭原因的历史条目按取消处理，避免虚报完成。
- 标签类型：`type: idea/requirement/feedback/bug`；优先级：`priority: urgent/high/medium/low`。

读取完整分页并排除 PR。未配置仓库时明确显示示例；连接后初始为空；失败持续提示并禁止导出，不将示例或部分抓取结果冒充真实数据。JSON 导出始终包含全量真实条目，不受当前筛选影响。

## 无人值守读取

不依赖浏览器保持打开。在登录 GitHub CLI 的机器上：

```bash
node scripts/export-feedback.mjs --repo Augirt/game-feedback-hub --output /tmp/feedback.json
# gh 不在 PATH 时追加 --gh /绝对路径/gh
```

输出为 `{schemaVersion, source, repository, fetchedAt, tickets}`，每条含原文、稳定编号、更新时间、状态和迭代字段。脚本与网页共用 `src/lib/protocol.mjs`。API 任一分页失败、非法响应或重复 ID 时整次失败，不输出部分数据。访问令牌由现有 `gh` 登录管理，不写入网页、JSON 或日志。

`public/automation.json` 是读取约定，不是后台刷新的快照。网页本身不会定时唤醒开发团队；本地 Codex 定期任务负责读取、去重、派发和记录。提取成功不代表需求完成；完成必须有版本、验收和发布证据。

Markdown 结构保存在 `.github/ISSUE_TEMPLATE/day-requirement.md`。标签优先于正文类型和优先级；Day、Version、Role 读取自 `## 迭代信息`，验收读取自 `## 验收条件`。旧 Issue 没有迭代字段时仍显示，留待补充。

## 开发与部署

Node.js 24（最低 22.12），使用锁文件安装：

```bash
npm ci
npm test
npm run dev
npm run build
```

GitHub Actions 在 main/master 推送后运行测试和生产构建，部署到既有 GitHub Pages。根目录是需求页源码；游戏源码及本地开发台账不属于本仓库，不应一起上传。

没有标签设置权限的提交者：页面也将开工确认保存到迭代信息的 `Ready: yes`。没有显式状态标签且Day、版本、验收完整时，读取为已规划；显式状态标签（包括待评估）始终优先。后台仍独立检查本地已确认账号，不因任意访客填写Ready而自动执行。
