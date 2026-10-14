# 迭代星图 · 游戏开发工作台（v1.2.0）

[打开工作台](https://augirt.github.io/game-feedback-hub/) · [机器读取约定](https://augirt.github.io/game-feedback-hub/automation.json)

工作台以 `Augirt/game-feedback-hub` 的公开 GitHub Issues 为存储，连接需求、版本交付和策划／程序／美术／测试的工作日志。游戏与需求系统分别记录版本，避免混淆。

## 日常使用

- **需求看板**：提交灵感、需求、反馈和问题，按 Day、版本、状态筛选；缺少迭代信息或受阻的事项会提示。
- **团队日志**：四个角色分别填写修改计划、实际修改点、工作日志、验证结果、阻塞与下一步；可关联需求编号，并按角色、Day、版本、项目筛选，并通过关键词检索日期与内容。
- **迭代版本**：集中查看版本目标、修改点、验收、已知问题和试玩入口。展开记录可追溯原始 Issue。

点击「写工作日志」或「记录迭代版本」，填写后「准备提交」，再到 GitHub 确认创建。返回工作台刷新即可读取。未确认的表单只是本浏览器草稿，可以继续编辑或导出备份。提交前会实时检查同一草稿是否已有记录；限流时保留草稿，不使用旧快照判断是否重复。已有记录可在 GitHub 编辑；新一篇使用「另写一条」。

角色代表团队职责，不代表四个独立登录账号。每条记录同时显示真实 GitHub 提交账号。所有内容公开，请只填写可公开的工作摘要，不填写密钥、私密材料或本地游戏源码。

## 提交一次 Day 需求

1. 点击「新建需求」，填写标题和描述。
2. 填写 Day（1–999999）、目标版本（例如 `v0.3.0`）、负责角色和验收条件。
3. 确认范围后勾选「已确认，允许团队开始」，在 GitHub 完成创建；否则进入待评估。
4. 相同 Day 可以有多个 Issue；Day 是批次，版本是交付。修改已有需求时编辑原 Issue，保留编号。

自动开工候选仍须由开发团队本地确认的账号创建，状态为已规划，且 Day、版本和验收完整。工作日志、计划摘要和版本记录不会成为新的需求指令。日志中提到一个想法，也不代表已批准开工。

无标签设置权限时，正文中的 `Ready: yes` 加上完整 Day／版本／验收可映射为已规划；显式状态标签优先。本地任务仍单独校验已确认账号。

## 状态与证据

需求状态为 `inbox/planned/in_progress/testing/blocked/done/cancelled`。GitHub 以 `completed` 关闭才映射为完成；以 `not_planned` 关闭或缺少原因则映射为取消。

工作日志支持 `planned/in_progress/blocked/done`；版本记录支持 `planned/testing/released`。已计划须有计划；已完成、待验收、已发布须有实际修改点和验证结果；受阻须说明阻塞；已发布还须有 HTTPS 交付链接。字段完整只代表记录符合协议，真实验收仍由团队负责。补录历史工作须明确标注。

## 读取、限流与导出

网页优先全量分页读取实时 GitHub Issues。网络失败或 API 限流时，可回退到 GitHub Actions 生成的公开仓库快照，明确显示「仓库快照」及北京时间更新时间；它可能落后于刚提交的记录。数据格式损坏、重复记录或来源不符时直接报告错误，不用旧快照遮盖错误。没有可用数据时不冒充空结果。

快照由推送、Issue 创建／编辑／关闭等事件触发重新部署，通常需等待构建完成。`workspace-snapshot.json` 是构建产物，不手动维护或提交。API Token 只在 Actions 或本机 `gh` 会话中使用，不进入网页、快照或日志。

- 需求 JSON（schemaVersion 1）：仅包含真实需求，兼容既有每日提取任务。
- 工作台 JSON（schemaVersion 2）：包含需求和工作记录，附数据时间及实时／快照来源；不受当前筛选影响。

无人值守读取真实需求：

```bash
node scripts/export-feedback.mjs --repo Augirt/game-feedback-hub --output /tmp/feedback.json
# gh 不在 PATH 时追加 --gh /绝对路径/gh
```

完整分页任一失败则整次失败。`public/automation.json` 是契约，不是快照。网页不会自行唤醒开发团队；本地定时任务负责提取、去重和协作，完成必须有验收及交付证据。

## 团队写入记录

团队可通过同一协议持续写日志，无需操作浏览器。网页「导出草稿」得到的 JSON 可作为输入：

```bash
node scripts/publish-record.mjs --input /tmp/worklog.json --repo Augirt/game-feedback-hub
# 默认预览，检查摘要后显式写入：
node scripts/publish-record.mjs --input /tmp/worklog.json --repo Augirt/game-feedback-hub --write
```

每条记录有稳定 `key`；相同 key 更新原记录，内容未变则跳过。重复 key、并发改动、作者不符或记录类型不符会拒绝写入。建议 key 包含项目、Day、版本、角色和日期，不要为重试生成新 key。实际作者取自当前 `gh` 登录。CLI 默认预览，不在网页保存 Token。

记录正文使用 `<!-- game-feedback-hub:record:v1 -->` 标记和 schemaVersion 1 JSON，下面附可读摘要。保留标记及结构化字段；网页按结构化数据展示。任何工作记录标记或专用类型标签（包括损坏记录）都被需求提取器排除，防止日志误触发开发。

## 开发与部署

Node.js 24（最低 22.12），使用锁文件安装：

```bash
npm ci
npm test
npm run dev
npm run build
# 本地需要验收限流回退时，先导出公开快照：
node scripts/export-workspace-snapshot.mjs --repo Augirt/game-feedback-hub --output public/workspace-snapshot.json
```

GitHub Actions 运行测试、校验并导出全量公开快照、构建及部署到既有 GitHub Pages。此仓库仅存工作台源码；游戏源码、原始素材和私密开发台账不应上传。
