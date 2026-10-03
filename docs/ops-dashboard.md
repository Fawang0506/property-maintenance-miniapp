# 运营大盘与绩效看板说明

本说明补充了运营大盘与绩效看板的作用和用法。

## 功能

- 总工单/待处理/处理中/已完成指标
- 区域分布和优先级分布
- 工程师绩效统计（工单总量、完成率、超时次数）
- 平均处理时长和 Top Engineer

## 相关接口

- `dashboard`：返回总览数据
- `performance`：返回工程师绩效

## 使用方式

1. 在云数据库中确保 `maintenance`, `engineers`, `settings` 集合已创建。
2. 在 `admin/ops_dashboard.html` 中设置真实 `ADMIN_API_BASE_URL`。
3. 通过管理员 token 登录后台，打开运营大盘页面即可查看。

## 建议增强

- 接入 ECharts / Ant Design Charts，提升图形可视化质量
- 增加时间筛选器（7 天 / 30 天 / 90 天）
- 增加超时工单、投诉率、工程师走势分析
- 增加导出 Excel / PDF 功能
