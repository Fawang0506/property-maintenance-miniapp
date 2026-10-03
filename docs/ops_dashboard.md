# 现场处理与运营大盘说明

本次提交增加了工程师现场处理能力和运维大盘基础：

- 工程师到场签到（支持获取经纬度并写入 records）
- 工程师可在现场上传多张照片作为处理记录（存为 fileID）
- 对关键动作（签��、到场、上传、完成）记录写入 logs 集合用于审计
- 管理后台增加 Dispatch & Reports 页面，用于手动触发派单与查看近 N 天趋势与工程师负载

生产建议：

- 到场签到建议结合小程序定位精度与隐私授权，明确告知用户定位用途
- 现场图片建议在上传前压缩并限制大小，避免存储爆炸
- 审计日志应定期归档和清理，避免日志膨胀
- 报表可接入图表库（如 ECharts）获得更丰富图形展示

部署/验证步骤：

1. 在微信开发者工具部署并上传 cloudfunctions/maintenance
2. 在云数据库中确保存在 collections: maintenance, engineers, settings, logs
3. 在 `settings/global` 中配置 adminTokens
4. 在 admin 页面测试派单与报表接口

