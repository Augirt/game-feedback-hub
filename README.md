# 迭代星图

一个面向独立游戏与小型团队的需求、灵感和玩家反馈收集页。页面部署在 GitHub Pages，使用公开仓库的 GitHub Issues 作为协作数据源。

## 功能

- 按待评估、已规划、进行中、已完成展示改动看板
- 搜索并按类型、优先级筛选
- 结构化提交灵感、需求、反馈和问题
- 自动读取公开 GitHub Issues，无需数据库或 Token
- 自动识别 GitHub Pages 所属仓库，也支持手动配置
- 桌面端与移动端自适应

## 本地开发

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
```

## GitHub 标签约定

页面会识别以下标签；若标签不存在，创建 Issue 时 GitHub 会忽略对应标签，可在仓库内按需创建：

- 类型：`type: idea`、`type: requirement`、`type: feedback`、`type: bug`
- 优先级：`priority: urgent`、`priority: high`、`priority: medium`、`priority: low`
- 状态：`status: inbox`、`status: planned`、`status: in progress`、`status: done`

关闭的 Issue 会自动显示为“已完成”。

## 部署

仓库已包含 GitHub Pages 工作流。推送到 `main` 或 `master` 后，在仓库的 **Settings → Pages → Build and deployment** 中选择 **GitHub Actions**，即可自动发布。
