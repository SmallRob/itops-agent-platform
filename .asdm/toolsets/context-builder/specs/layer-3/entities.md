# [领域名] 实体定义

> **大小限制**：< 5KB
> **语言**：保持精简，使用表格和关键代码片段

## 1. 核心实体

### EntityA

**表/Collection**：`table_a`

**字段定义**：

| 字段 | 类型 | 说明 | 约束 |
|------|------|------|------|
| id | BIGINT | 主键 | PK, AUTO_INCREMENT |
| name | VARCHAR(100) | 名称 | NOT NULL |
| status | TINYINT | 状态 | DEFAULT 1 |
| created_at | DATETIME | 创建时间 | NOT NULL |
| updated_at | DATETIME | 更新时间 | NOT NULL |

**关键代码**：
```java
// 关键代码片段，展示核心逻辑
@Entity
@Table(name = "table_a")
public class EntityA {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    private String name;
    private Integer status;
    
    // 关键业务逻辑引用
    // 详见: src/main/java/com/xxx/entity/EntityA.java
}
```

---

*本文件由 Context Builder v0.3 生成*
