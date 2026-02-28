## Context

Maestro 项目使用 TypeScript + ES Module 配置:
- `package.json`: `"type": "module"`
- `tsconfig.json`: `"module": "NodeNext"`

但两处代码使用了 CommonJS 的 `require()` 语法:
1. `src/worktree/WorktreeManager.ts:85` - 在 `saveState()` 方法中使用 `require('node:fs')` 获取 `renameSync`
2. `src/state/logRotation.ts:123` - 在 `cleanupOldLogs()` 方法中使用 `require('node:fs')` 获取 `rmdirSync`

这导致编译后的 ES Module 代码在运行时抛出 "require is not defined" 错误。

## Goals / Non-Goals

**Goals:**
- 修复 ESM 兼容性问题，使 CLI 正常运行
- 保持原有功能行为不变
- 确保构建和类型检查通过

**Non-Goals:**
- 不重构其他代码
- 不添加新功能
- 不修改项目配置或构建流程

## Decisions

### 决策 1: 使用文件顶部已有的 import 声明

**选择**: 直接使用已存在的 `import { renameSync } from 'node:fs'` 导入

**理由**:
- `WorktreeManager.ts` 顶部已经有 `import { ..., renameSync } from 'node:fs'` 声明
- 代码中的 `require` 是冗余的，可能是快速修复时的疏忽
- 最小化改动，降低风险

**替代方案**:
- 使用 `createRequire()` 创建 CJS require 函数 → 不推荐，增加复杂性
- 改为动态 `import()` → 不必要，同步操作用静态 import 更合适

### 决策 2: 对 logRotation.ts 添加必要的 import

**选择**: 在文件顶部添加 `import { rmdirSync } from 'node:fs'`

**理由**:
- 保持与项目其他文件一致的 ES Module 风格
- `rmdirSync` 是同步操作，适合静态 import

## Risks / Trade-offs

**[风险] 可能存在其他类似的 require 调用**
→ 缓解: 在修复后进行全面测试，运行所有 CLI 命令验证

**[风险] rmdirSync 已被 Node.js 标记为 deprecated**
→ 缓解: 这是 bug 修复，不是重构。功能保持原样，后续可单独处理 deprecation
