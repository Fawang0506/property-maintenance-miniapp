# 工程师端说明

工程师端用于工程师接单、拒单、现场处理和工单完成操作。

## 功能

- 查看被分配到的工单列表
- 接单 / 拒单
- 工单状态更新为“处理中”或“已完成”
- 处理记录自动写入 `records`

## 入口

- `pages/engineer/engineer`：工程师列表页
- 云函数：`maintenance` -> `listAssigned`, `acceptTask`, `rejectTask`, `completeTask`

## 使用方式

1. 在 `settings/global` 中维护工程师 `openId` 或管理员 `adminTokens`。
2. 通过管理员后台把工单指派给工程师 `assigneeOpenId`。
3. 工程师登录后进入 `工程师端`，即可查看分配任务。
4. 接单后状态会改为“处理中”，完成后状态会改为“已完成”。

## 生产建议

- 可扩展成单独工程师小程序/小程序内入口
- 可增加 GPS 定位、签到、到场确认、现场照片上传
- 可增加 SLA 计时、风险提醒和再派单规则
