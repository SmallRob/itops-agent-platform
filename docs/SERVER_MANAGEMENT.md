# 主机管理增强

企业级服务器分组管理与批量运维功能，支持多级分组树形结构、JSON 批量导入和自动信息采集。

## 功能概览

### 1. 主机分组管理
- 多级树形分组结构，支持父子关系
- 按分组筛选服务器列表
- 服务器可归属多个分组
- 分组内服务器数量实时统计

### 2. 批量导入
- JSON 格式批量导入服务器
- 自动验证必填字段和 SSH 连通性
- 支持导入结果分类展示（成功/失败）
- 自动去重（基于 hostname + username）
- 失败时自动清理孤儿数据

### 3. 主机信息自动采集
- SSH 远程一键采集硬件信息
- 采集内容：OS 类型、CPU 核数、内存大小、磁盘信息、IP 地址
- 支持单个采集和批量采集
- 采集结果实时更新到服务器卡片

## 数据库设计

### server_groups 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | 分组唯一标识 |
| name | TEXT | 分组名称 |
| description | TEXT | 分组描述 |
| parent_id | TEXT | 父分组 ID（NULL 为根分组） |
| sort_order | INTEGER | 排序序号 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

### server_group_mapping 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | 映射记录唯一标识 |
| server_id | TEXT FK | 服务器 ID |
| group_id | TEXT FK | 分组 ID |
| created_at | TIMESTAMP | 创建时间 |

### servers 表（新增字段）

| 字段 | 类型 | 说明 |
|------|------|------|
| os_type | TEXT | 操作系统类型（Linux/Windows） |
| cpu_cores | INTEGER | CPU 核数 |
| memory_mb | INTEGER | 内存大小（MB） |
| disk_info | TEXT | 磁盘信息（JSON） |
| ip_address | TEXT | IP 地址 |
| last_collected_at | TIMESTAMP | 最后采集时间 |

## 使用指南

### 创建分组
1. 进入 **服务器管理** 页面
2. 点击工具栏 **"新建分组"** 按钮
3. 填写分组名称和描述
4. 选择父分组（可选）
5. 点击 **保存**

### 批量导入服务器
1. 点击工具栏 **"导入"** 按钮
2. 粘贴 JSON 格式数据：
   ```json
   {
     "servers": [
       {
         "name": "Web Server 01",
         "hostname": "192.168.1.10",
         "port": 22,
         "username": "root",
         "password": "password123",
         "tags": ["web", "production"],
         "description": "生产环境 Web 服务器"
       },
       {
         "name": "DB Server 01",
         "hostname": "192.168.1.20",
         "port": 22,
         "username": "root",
         "private_key": "-----BEGIN RSA PRIVATE KEY-----\n...",
         "use_ssh_key": true,
         "tags": ["database", "production"]
       }
     ],
     "group_id": "分组ID（可选）"
   }
   ```
3. 点击 **开始导入**
4. 等待验证完成，查看导入结果

### 采集主机信息
- **单个采集**：点击服务器卡片上的 **采集信息** 按钮
- **批量采集**：勾选多个服务器后点击工具栏 **批量采集**

## API 接口

### 分组管理

#### GET /api/server-groups
获取所有分组（树形结构）

#### POST /api/server-groups
创建分组
```json
{
  "name": "Production",
  "description": "生产环境服务器",
  "parent_id": null,
  "sort_order": 0
}
```

#### PUT /api/server-groups/:id
更新分组

#### DELETE /api/server-groups/:id
删除分组（同时删除关联映射）

#### POST /api/server-groups/:id/move
移动分组（修改父分组）
```json
{
  "parent_id": "new-parent-id"
}
```

### 服务器分组映射

#### POST /api/server-groups/mapping
添加服务器到分组
```json
{
  "server_id": "server-uuid",
  "group_id": "group-uuid"
}
```

#### DELETE /api/server-groups/mapping/:mappingId
删除分组映射

#### GET /api/server-groups/:id/servers
获取分组下的服务器列表

### 批量导入

#### POST /api/server-management/import
批量导入服务器
```json
{
  "servers": [...],
  "group_id": "group-uuid（可选）"
}
```

### 信息采集

#### POST /api/server-management/collect-info/:serverId
采集单个服务器信息

#### POST /api/server-management/batch-collect-info
批量采集服务器信息
```json
{
  "server_ids": ["uuid1", "uuid2", "uuid3"]
}
```

## 安全考虑

- 批量导入时自动去重，防止重复添加
- 导入失败时自动清理孤儿数据（servers + group_mapping）
- SSH 连通性验证使用超时机制（10 秒）
- 采集的硬件信息不包含敏感数据

## 最佳实践

### 分组命名规范
- 按环境：Production / Staging / Development
- 按功能：Web Servers / Database / Load Balancer
- 按地域：CN-East / CN-West / US-East

### 批量导入
- 导入前在测试环境验证 JSON 格式
- 大数量导入建议分批进行（每批 50-100 台）
- 导入后统一采集硬件信息

### 信息采集
- 定期采集（如每天一次）保持信息更新
- 服务器变更后及时重新采集
