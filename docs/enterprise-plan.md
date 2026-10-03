# 企业级功能与上线指南

本说明介绍如何把当前仓库的功能提升到更��近企业级物业运维平台，并包含部署建议和注意事项。

主要新增的企业特性已包含在仓库：
- 自动再派（Scheduler）：当工程师在 acceptTimeoutHours 内未接单，自动将工单重派给下一候选人；实现见 cloudfunctions/scheduler
- settings/global 初始化脚本：cloudfunctions/init_settings
- 更完善的审计日志（logs 集合）和现场记录

建议的进一步改造（短期优先级）：
1. 权限与认证：引入细粒度角色管理（运营、调度、管理员、经理、工程师），并使用 JWT / 企业微信 SSO 做统一认证。
2. 消息通知：接入模板消息、小程序订阅消息或企业微信通知，确保工单关键节点有提醒。
3. 图表引擎：管理后台接入 ECharts/Ant Design Charts，支持时间范围筛选、导出图表。
4. SLA 与规则引擎：把 SLA、优先级、区域派单规则外置成可配置规则，在 settings 中可视化编辑。
5. 流水线与事务处理：使用乐观锁字段（例如 assignVersion）避免并发派单冲突。
6. 隐私与合规：定位使用明确授权，图片存储与访问控制，日志保留策略与脱敏处理。

部署建议：
- 在微信云开发控制台创建独立生产环境并关闭匿名写权限
- 使用分支/CI（GitHub Actions）来自动部署 cloudfunctions
- 定期备份云数据库并设置监控告警

验证清单：
- [ ] settings/global 已初始化
- [ ] engineers 集合有测试工程师
- [ ] maintenance 集合有若干测试工单
- [ ] scheduler 定期运行并能够自动再派
- [ ] admin 页面可以显示运营大盘数据

