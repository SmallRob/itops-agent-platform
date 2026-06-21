# 基础设施域API定义

## 1. 认证授权API

### POST /api/auth/login
用户登录。

**请求体：**
```json
{
  "username": "用户名",
  "password": "密码"
}
```

**响应：**
```json
{
  "success": true,
  "message": "登录成功",
  "data": {
    "token": "访问token",
    "refreshToken": "刷新token",
    "user": {
      "id": "用户ID",
      "username": "用户名",
      "email": "邮箱",
      "role": "角色",
      "passwordMustChange": false
    }
  }
}
```

**错误响应：**
- 401：用户名或密码错误
- 423：账户被锁定
- 403：账户被禁用

### POST /api/auth/refresh
刷新访问token。

**请求体：**
```json
{
  "refreshToken": "刷新token"
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "token": "新访问token",
    "refreshToken": "新刷新token"
  }
}
```

### GET /api/auth/me
获取当前用户信息（需要认证）。

**响应：**
```json
{
  "success": true,
  "data": {
    "id": "用户ID",
    "username": "用户名",
    "email": "邮箱",
    "role": "角色",
    "enabled": true,
    "created_at": "创建时间"
  }
}
```

### POST /api/auth/logout
用户登出（需要认证）。

**响应：**
```json
{
  "success": true,
  "message": "退出成功"
}
```

### POST /api/auth/change-password
修改密码（需要认证）。

**请求体：**
```json
{
  "currentPassword": "当前密码",
  "newPassword": "新密码"
}
```

**响应：**
```json
{
  "success": true,
  "message": "密码修改成功"
}
```

## 2. 系统配置API

### GET /api/settings
获取所有系统配置。

**响应：**
```json
{
  "success": true,
  "data": {
    "key1": "value1",
    "key2": "value2"
  }
}
```

### PUT /api/settings
更新系统配置。

**请求体：**
```json
{
  "key1": "newValue1",
  "key2": "newValue2"
}
```

**响应：**
```json
{
  "success": true,
  "message": "Settings updated"
}
```

### GET /api/settings/api-keys
获取API密钥配置状态。

**响应：**
```json
{
  "success": true,
  "data": {
    "doubao": {
      "configured": true,
      "masked": "sk-****1234",
      "model": "doubao-4o",
      "apiBase": "https://ark.cn-beijing.volces.com/api/v3"
    },
    "openai": {
      "configured": false,
      "masked": null,
      "model": "gpt-4o",
      "apiBase": "https://api.openai.com/v1"
    },
    "localAi": {
      "configured": true,
      "masked": null,
      "model": "qwen2.5:7b",
      "apiBase": "http://host.docker.internal:11434/v1"
    }
  }
}
```

### PUT /api/settings/api-keys
保存API密钥配置。

**请求体：**
```json
{
  "doubaoApiKey": "API密钥",
  "doubaoModel": "模型ID",
  "doubaoApiBase": "API地址",
  "openaiApiKey": "API密钥",
  "openaiModel": "模型ID",
  "openaiApiBase": "API地址",
  "localAiModel": "本地模型ID",
  "localAiApiBase": "本地API地址"
}
```

**响应：**
```json
{
  "success": true,
  "message": "Settings saved"
}
```

### GET /api/settings/models
获取可用模型列表。

**响应：**
```json
{
  "success": true,
  "data": [
    {
      "id": "qwen2.5:7b",
      "name": "Qwen 2.5 7B (Ollama)",
      "provider": "local",
      "enabled": true
    },
    {
      "id": "doubao-4o",
      "name": "豆包 4o",
      "provider": "doubao",
      "enabled": true
    }
  ]
}
```

### DELETE /api/settings/api-keys/:provider
删除特定提供商的API配置。

**路径参数：**
- `provider`：提供商（doubao/openai/local）

**响应：**
```json
{
  "success": true,
  "message": "Configuration deleted"
}
```

## 3. 认证要求
- 登录、刷新token、获取模型列表等接口无需认证
- 其他接口需要认证token，通过`Authorization`头传递

## 4. 错误响应
所有API在错误时返回：
```json
{
  "success": false,
  "error": "错误信息"
}
```

**常见HTTP状态码：**
- 200：成功
- 400：请求参数错误
- 401：未认证
- 403：权限不足
- 423：账户锁定
- 500：服务器内部错误

## 5. 安全特性
- 敏感信息脱敏显示（API密钥）
- 密码强度验证
- 登录失败锁定机制
- JWT token有效期管理