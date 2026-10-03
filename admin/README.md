# 物业维护后台说明

管理后台支持以下功能：

- 管理员登录（通过 admin token）
- 工单列表筛选（状态过滤、关键字搜索）
- 工单指派
- 状态更新
- 导出 CSV

## 快速开始

1. 先在云数据库 `settings` 集合中初始化 `global` 文档，并设置 `adminTokens` 数组，例如：
   ```json
   {
     "_id": "global",
     "admins": ["<openid>"],
     "adminTokens": ["replace-me-with-a-strong-token"]
   }
   ```
2. 上传并部署 `cloudfunctions/adminApi`。
3. 设置 `admin/index.html` 里的 `ADMIN_API_BASE_URL`，指向你实际的 CloudBase HTTP function 地址。
4. 打开 `admin/index.html` 即可使用后台系统。

## 典型调用示例

```
POST {ADMIN_API_BASE_URL}
{
  "action": "login",
  "adminToken": "replace-me-with-a-strong-token"
}
```

## 说明

- 这个后台是简化版的管理控制台，适合快速上线和演示。
- 如果你要做更强的权限和多角色管理，可以在 `users` 表中添加 `role` 和 `department` 字段，并扩展后端路由。
