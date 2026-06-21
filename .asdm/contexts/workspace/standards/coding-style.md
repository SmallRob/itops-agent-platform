# 代码风格规范

## 1. TypeScript 规范

### 命名规范
- **变量/函数**: camelCase (`getUserById`, `isValid`)
- **类/接口**: PascalCase (`UserService`, `IConfig`)
- **常量**: UPPER_SNAKE_CASE (`MAX_RETRY_COUNT`)
- **文件名**: camelCase.ts (服务/工具) 或 PascalCase.tsx (组件)

### 类型定义
```typescript
// 优先使用 interface
interface User {
  id: string;
  name: string;
  email: string;
}

// 复杂类型使用 type
type UserRole = 'admin' | 'user' | 'viewer';
```

## 2. React 组件规范

```typescript
// 函数组件 + TypeScript
const UserCard: React.FC<UserCardProps> = ({ user, onSelect }) => {
  // hooks 在顶部
  const [isSelected, setIsSelected] = useState(false);
  
  // 事件处理函数
  const handleClick = () => {
    onSelect(user.id);
  };
  
  // 返回 JSX
  return (
    <div onClick={handleClick}>
      {user.name}
    </div>
  );
};
```

## 3. API 路由规范

```typescript
// 路由定义
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await service.getById(id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

## 4. 数据库操作规范

```typescript
// 使用参数化查询防止SQL注入
const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
const user = stmt.get(id);

// 事务操作
const insertMany = db.transaction((users) => {
  for (const user of users) {
    insertStmt.run(user.name, user.email);
  }
});
```
