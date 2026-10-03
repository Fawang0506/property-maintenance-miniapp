# 物业维护微信云开发版

这份代码是适配微信云开发的物业维修小程序版本，适合用于：

- 物业报修
- 社区维修工单
- 设备故障上报
- 维修状态跟踪

## 功能说明

- 用户可以提交报修单
- 用户可查看自己的报修记录
- 管理员可查看并更新维修状态
- 工程师可接单、拒单、签到、上传现场照片、完工
- 运营后台可查看派单、区域分布、优先级分布和工程师绩效
- 数据存储在云数据库 `maintenance`、`engineers`、`settings`、`logs` 集合中
- 后端逻辑由云函数 `maintenance` 和 `adminApi` 提供

## 目录结构

- `app.js`：初始化云开发
- `app.json`：小程序配置
- `pages/index/index.*`：报修列表
- `pages/create/create.*`：新增报修
- `pages/detail/detail.*`：报修详情和状态更新
- `pages/engineer/engineer.*`：工程师端页面
- `admin/ops_dashboard.html`：运营大盘页
- `cloudfunctions/maintenance/`：维修云函数
- `cloudfunctions/adminApi/`：管理员后台接口
- `cloudfunctions/notify/`：通知云函数
- `docs/`：隐私、审核、工程师、运营手册

## 关键 API

- `dashboard`：返回总览指标、区域分布、优先级分布、工程师绩效
- `performance`：返回工程师绩效与超时工单情况
- `dispatchOrder`：按策略自动派单单个工单
- `batchDispatchArea`：按区域批量派单
- `reportDetailed`：返回时间序列与工程师近 30 天统计

## 生产建议

- 继续接入 ECharts 或 Ant Design Charts 来增强图形化运营
- 对 `settings/global` 中的 `adminTokens` 做机密管理，不要提交到公开仓库
- 为工程师增加签到 GPS 与现场照片审批流程
- 增加 SLA、超时工单提醒和自动再派规则
