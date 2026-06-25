# [领域名] 服务接口

> **大小限制**：< 5KB
> **语言**：保持精简，聚焦接口签名和核心逻辑

## 1. 核心服务

### XxxService

**接口定义**：
```java
public interface XxxService {
    /**
     * [方法说明]
     */
    Result<XxxDTO> create(XxxCreateRequest request);
    
    /**
     * [方法说明]
     */
    Result<XxxDTO> update(Long id, XxxUpdateRequest request);
    
    /**
     * [方法说明]
     */
    Result<Void> delete(Long id);
    
    /**
     * [方法说明]
     */
    Result<XxxDTO> getById(Long id);
}
```

**关键实现逻辑**：

1. **create()**：
   - 校验请求参数
   - 执行[核心业务逻辑]
   - 返回结果

2. **update()**：
   - 校验实体存在性
   - 执行[核心业务逻辑]
   - 记录变更日志

## 2. 服务间调用

| 调用方 | 被调用方 | 接口 | 说明 |
|--------|----------|------|------|
| [ServiceA] | [ServiceB] | [Interface] | [说明] |

---

*本文件由 Context Builder v0.3 生成*
