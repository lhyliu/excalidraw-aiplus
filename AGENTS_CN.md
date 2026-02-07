# AGENTS.md

本文件为在 Excalidraw monorepo 中工作的智能编码工具提供指导。

## 开发命令

### 类型检查与代码检查

- `yarn test:typecheck` - 运行 TypeScript 类型检查（严格模式）
- `yarn test:code` - 运行 ESLint（max-warnings=0）
- `yarn test:other` - 运行 Prettier 检查
- `yarn test:all` - 运行所有检查：类型检查、eslint、prettier、测试

### 运行测试

- `yarn test:app` - 运行 Vitest 测试（默认：监视模式）
- `yarn test:app --run` - 运行一次测试（非监视模式）
- `yarn test:app packages/math/tests/point.test.ts` - 运行单个测试文件
- `yarn test:app packages/math/tests/point.test.ts -t "rotate"` - 运行匹配的测试
- `yarn test:update` - 更新快照并运行一次测试

### 自动修复

- `yarn fix` - 修复所有格式和代码检查问题
- `yarn fix:code` - 修复 ESLint 问题
- `yarn fix:other` - 修复 Prettier 问题

### 构建

- `yarn build:packages` - 构建所有包
- `yarn build:common` - 构建 common 包
- `yarn build:element` - 构建 element 包
- `yarn build:math` - 构建 math 包
- `yarn build:excalidraw` - 构建主库

## 代码风格指南

### TypeScript

- 所有新代码使用 TypeScript
- 优先选择无内存分配的实现（用 CPU 换 RAM）
- 使用 `const` 和 `readonly` 实现不可变性
- 使用可选链（`?.`）和空值合并（`??`）
- 类型导入优先使用 `import type`

### 导入

导入顺序（由 ESLint 强制执行）：

1. 内置 Node 模块
2. 外部包（包括 `@excalidraw/*`）
3. 内部导入
4. 父/相对导入
5. 索引导入

```typescript
import fs from "fs";
import lodash from "lodash";

import { something } from "@excalidraw/common";

import { helper } from "./helper";
import type { Type } from "./types";
```

### 命名规范

- **PascalCase**：组件、接口、类型别名、类
- **camelCase**：变量、函数、方法、对象属性
- **UPPER_SNAKE_CASE**：常量、枚举值

### React

- 使用带 hooks 的函数式组件
- 遵循 React hooks 规则（无条件 hooks）
- 保持组件小而专注
- 使用内联样式或 CSS 变量（核心库不使用 CSS 模块）

### 类型

- **数学运算始终使用品牌类型**，来自 `@excalidraw/math/types`
- 使用 `Point`（元组 `[x: number, y: number]`）而不是 `{x, y}` 对象
- 示例：`GlobalPoint`、`LocalPoint`、`Vector`、`Line`、`Curve`

### 错误处理

- 异步操作使用 try/catch
- 使用上下文信息记录错误
- 在适当的地方提前返回错误条件
- 使用 `invariant()` 进行运行时断言

### 测试

- 修改后始终修复测试失败
- 代码更改后运行 `yarn test:app`
- 测试使用带有 jsdom 环境的 Vitest
- 使用 `describe`、`it`、`expect` 来自全局测试上下文

### 性能

- 比较距离时优先使用 `pointDistanceSq` 而不是 `pointDistance`
- 大型集合使用 Map 而不是对象
- 尽可能使用 `readonly` 数组
- 优先使用 `toIterable()` 和 `toArrow()` 以避免条目分配

### 常量

- 使用 `@excalidraw/common/constants` 中的常量（例如 `FONT_FAMILY`、`COLOR_PALETTE`）
- 使用带有 `as const` 的类型安全枚举
- 永远不要硬编码魔法数字

### 数学运算

- 从 `@excalidraw/math` 导入几何运算
- 使用适当的类型函数：`pointFrom`、`vectorScale`、`pointRotateRads` 等
- 角度：使用带有类型断言的 `Radians` 类型：`angle as Radians`

### 元素创建

- 使用来自 `@excalidraw/element/newElement` 的工厂函数：
  - `newElement()` - 通用元素
  - `newTextElement()` - 文本元素
  - `newLinearElement()` - 线/箭头
  - `newImageElement()` - 图片
  - `newFrameElement()` - 框架

## 项目结构

```
packages/
  common/      - 共享工具、常量、类型
  element/     - 元素类型、渲染、操作
  math/        - 几何、向量数学、品牌类型
  utils/       - 导出/导入工具
  excalidraw/  - 主 React 组件库

excalidraw-app/ - 完整的 Web 应用程序

examples/       - 集成示例
```

## 类型安全说明

- 启用严格 TypeScript 模式
- 为 `@excalidraw/*` 导入配置路径别名
- 使用品牌类型实现类型安全（例如 `Point`、`Vector`、`Radians`）
- 在 `packages/*/global.d.ts` 中定义全局类型

## 常见模式

### 元素迭代

```typescript
import { toIterable } from "@excalidraw/common/utils";

for (const element of toIterable(elements)) {
  // element 被正确类型化
}
```

### 类型保护

```typescript
import { isTextElement } from "@excalidraw/element/typeChecks";

if (isTextElement(element)) {
  // TypeScript 知道 element 是 ExcalidrawTextElement
}
```

### 品牌类型的数学运算

```typescript
import { pointFrom, pointRotateRads } from "@excalidraw/math/point";
import type { Radians, GlobalPoint } from "@excalidraw/math/types";

const point: GlobalPoint = pointFrom(10, 20);
const angle: Radians = (Math.PI / 2) as Radians;
const rotated = pointRotateRads(point, center, angle);
```
