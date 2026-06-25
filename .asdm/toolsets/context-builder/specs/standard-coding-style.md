# Standard Coding Style

## Overview
This document defines the coding standards and style guidelines for this workspace. Consistent coding style improves readability, maintainability, and collaboration.

## General Principles

### 1. Readability First
- Code should be easy to read and understand
- Use meaningful names for variables, functions, and classes
- Write self-documenting code with clear intent

### 2. Consistency
- Follow the same patterns throughout the codebase
- Use established conventions for the language and framework
- Maintain consistency across team members

### 3. Maintainability
- Write code that is easy to modify and extend
- Keep functions and classes focused on single responsibilities
- Avoid unnecessary complexity

## Language-Specific Guidelines

### TypeScript/JavaScript

#### Naming Conventions
```typescript
// Variables and functions - camelCase
const userName = 'John';
function calculateTotal() { }

// Classes and interfaces - PascalCase
class UserService { }
interface UserData { }

// Constants - UPPER_SNAKE_CASE
const MAX_RETRY_COUNT = 3;
const API_BASE_URL = 'https://api.example.com';

// Private members - prefix with underscore (optional)
private _internalMethod() { }
```

#### Code Formatting
```typescript
// Use 2-space indentation
function example() {
  if (condition) {
    // ...
  }
}

// Use semicolons consistently
const name = 'John';

// Max line length: 80-100 characters
// Break long lines for readability

// Use single quotes for strings unless interpolation
const message = 'Hello';
const template = `Hello ${name}`;
```

#### Type Annotations
```typescript
// Always specify return types
function add(a: number, b: number): number {
  return a + b;
}

// Use explicit types over 'any'
// Bad
function process(data: any) { }

// Good
function process(data: UserData) { }

// Use interface for object shapes
interface User {
  id: number;
  name: string;
  email: string;
}
```

### Java

#### Naming Conventions
```java
// Classes and interfaces - PascalCase
public class UserService { }
public interface UserRepository { }

// Methods and variables - camelCase
public void calculateTotal() { }
private String userName;

// Constants - UPPER_SNAKE_CASE
public static final int MAX_RETRY_COUNT = 3;
private static final String API_BASE_URL = "https://api.example.com";
```

#### Code Formatting
```java
// Use 4-space indentation
public class Example {
    public void method() {
        if (condition) {
            // ...
        }
    }
}

// Opening braces on same line
public void example() {
    // ...
}

// One statement per line
// Bad
int a = 1; int b = 2;

// Good
int a = 1;
int b = 2;
```

#### Annotations and Modifiers
```java
// Standard modifier order
public static final String CONSTANT = "value";

// Use @Override annotation
@Override
public String toString() {
    return "User";
}

// Use @Nullable and @NotNull annotations
public void process(@NotNull String input) { }
```

### Python

#### Naming Conventions
```python
# Variables and functions - snake_case
user_name = 'John'
def calculate_total():
    pass

# Classes - PascalCase
class UserService:
    pass

# Constants - UPPER_SNAKE_CASE
MAX_RETRY_COUNT = 3
API_BASE_URL = 'https://api.example.com'

# Private members - prefix with underscore
def _internal_method(self):
    pass
```

#### Code Formatting (PEP 8)
```python
# Use 4-space indentation
def example():
    if condition:
        # ...
        pass

# Max line length: 79 characters
# Use backslashes or parentheses for line continuation

# Import order: standard library, third-party, local
import os
import sys

from flask import Flask
from sqlalchemy import create_engine

from .models import User
from .services import UserService
```

#### Type Hints (Python 3.5+)
```python
from typing import List, Dict, Optional

def process_users(users: List[User]) -> Dict[str, int]:
    """Process a list of users and return statistics."""
    pass

def find_user(user_id: int) -> Optional[User]:
    """Find user by ID, return None if not found."""
    pass
```

## Common Patterns

### Error Handling
```typescript
// Use try-catch for expected errors
try {
  const result = await apiCall();
} catch (error) {
  // Handle specific error types
  if (error instanceof NetworkError) {
    // Retry logic
  } else if (error instanceof ValidationError) {
    // Show user message
  }
}

// Don't swallow exceptions
// Bad
try {
  riskyOperation();
} catch (e) {
  // Empty catch block
}

// Good
try {
  riskyOperation();
} catch (e) {
  logger.error('Operation failed', e);
  throw new OperationFailedError('Failed to perform operation', e);
}
```

### Logging
```typescript
// Use appropriate log levels
logger.debug('Detailed debug information');
logger.info('General information');
logger.warn('Warning message');
logger.error('Error occurred');
logger.fatal('Fatal error');

// Include context in logs
logger.info('User login', { userId: user.id, timestamp: new Date() });

// Don't log sensitive information
// Bad
logger.info('User authenticated', { password: user.password });

// Good
logger.info('User authenticated', { userId: user.id });
```

### Comments and Documentation

#### When to Comment
- Explain "why" not "what" (code should be self-explanatory)
- Document complex algorithms or business logic
- Note workarounds or temporary solutions
- Document public APIs and interfaces

#### Comment Style
```typescript
/**
 * Calculate the total price including tax.
 * 
 * @param items - Array of items with price and quantity
 * @param taxRate - Tax rate as decimal (e.g., 0.08 for 8%)
 * @returns Total price with tax applied
 */
function calculateTotalWithTax(items: Item[], taxRate: number): number {
  // Calculate subtotal
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  // Apply tax
  return subtotal * (1 + taxRate);
}

// Inline comments for complex logic
// Using Dijkstra's algorithm to find shortest path
const shortestPath = findShortestPath(graph, start, end);
```

## Testing Standards

### Test Structure
```typescript
describe('UserService', () => {
  let userService: UserService;
  let mockRepository: jest.Mocked<UserRepository>;

  beforeEach(() => {
    mockRepository = {
      findById: jest.fn(),
      save: jest.fn(),
    };
    userService = new UserService(mockRepository);
  });

  describe('createUser', () => {
    it('should create user with valid data', async () => {
      // Arrange
      const userData = { name: 'John', email: 'john@example.com' };
      mockRepository.save.mockResolvedValue({ id: 1, ...userData });

      // Act
      const result = await userService.createUser(userData);

      // Assert
      expect(result.id).toBe(1);
      expect(result.name).toBe('John');
      expect(mockRepository.save).toHaveBeenCalledWith(userData);
    });

    it('should throw error for duplicate email', async () => {
      // Arrange
      const userData = { name: 'John', email: 'existing@example.com' };
      mockRepository.save.mockRejectedValue(new DuplicateEmailError());

      // Act & Assert
      await expect(userService.createUser(userData))
        .rejects.toThrow(DuplicateEmailError);
    });
  });
});
```

### Test Naming
- Use descriptive test names
- Follow pattern: `should [expected behavior] when [condition]`
- Example: `should return user when valid ID is provided`

## Code Review Guidelines

### What to Look For
1. **Functionality**: Does the code work as intended?
2. **Readability**: Is the code easy to understand?
3. **Testing**: Are there adequate tests?
4. **Performance**: Are there any performance issues?
5. **Security**: Are there security vulnerabilities?
6. **Maintainability**: Will this code be easy to maintain?

### Review Comments
- Be constructive and specific
- Suggest alternatives, not just criticism
- Focus on the code, not the person
- Use "we" language: "We should consider..."

## Tool Configuration

### EditorConfig
```ini
# .editorconfig
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.java]
indent_size = 4

[*.py]
indent_size = 4
max_line_length = 79
```

### ESLint/Prettier (TypeScript)
```json
// .eslintrc.json
{
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "rules": {
    "no-console": "warn",
    "@typescript-eslint/explicit-function-return-type": "error",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }]
  }
}
```

## Continuous Integration

### Pre-commit Hooks
- Run linter and formatter
- Run unit tests
- Check for security vulnerabilities
- Validate commit messages

### CI Pipeline
1. Lint and format check
2. Unit tests
3. Integration tests
4. Build verification
5. Security scan
6. Deployment to test environment

---

*These coding standards should be adapted based on the specific project requirements and team preferences. Regular reviews and updates to this document are encouraged.*