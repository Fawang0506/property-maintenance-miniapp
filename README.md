# 物业维护微信小程序

这是一个可直接运行的微信小程序模板，适合物业、社区报修、维修工单管理等场景，包含：

- 报修列表页
- 新增报修页
- 报修详情页
- 状态更新（管理员可用）
- 统一请求封装
- 本地 mock 数据模式，可无需后端直接调试

## 项目结构

- `app.js`：应用入口
- `app.json`：小程序配置
- `app.wxss`：全局样式
- `project.config.json`：微信开发者工具配置
- `pages/index/index.*`：报修列表页
- `pages/create/create.*`：新增报修页
- `pages/detail/detail.*`：详情页
- `utils/request.js`：接口请求封装
- `utils/fakeApi.js`：本地 mock 数据，便于本地开发和演示

## 快速开始

1. 在微信开发者工具中打开本项目。
2. 确认 `app.json`、`project.config.json` 中的内容正常。
3. 若已有后端接口，可在 `app.js` 中设置 `baseUrl`：
   ```js
   globalData: {
     baseUrl: 'https://api.example.com',
     mockEnabled: false
   }
   ```
4. 若没有后端，可保持 `mockEnabled: true`，它会自动使用本地模拟数据。
5. 点击“编译”即可调试。

## 接口约定

默认支持以下接口：

- `GET /maintenance`：获取报修列表
- `POST /maintenance`：新增报修
- `GET /maintenance/:id`：获取单条报修
- `PUT /maintenance/:id`：更新报修状态

## 说明

本模板可直接作为开发起点，后续仍可扩展：

- 用户登录认证
- 图片上传
- 设备定位
- 工单分派与处理流程
- 管理后台
- 微信支付 / 费用结算

如果你需要，我还可以继续帮你扩展成：

- 微信云开发版（云函数 + 云数据库）
- 完整的物业管理后台
- Node.js / Express 后端接口
- 真实部署到服务器的版本
