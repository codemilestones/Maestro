## Why

项目配置为 ES Module (`"type": "module"`)，但代码中两处使用了 CommonJS 的 `require()` 语法。这导致运行时抛出 "Error: require is not defined"，阻止了所有 CLI 命令的执行，包括 `spawn`、`cleanup` 和 TUI 界面。

## What Changes

- 将 `WorktreeManager.ts` 中的 `require('node:fs')` 替换为 ES Module `import`
- 将 `logRotation.ts` 中的 `require('node:fs')` 替换为 ES Module `import`
- 验证项目构建和运行正常

## Capabilities

### New Capabilities

无新增能力。这是一个 bug 修复。

### Modified Capabilities

无规范级别的变更。这是实现层面的 ESM 兼容性修复，不影响任何能力的对外行为。

## Impact

- **代码**:
  - `src/worktree/WorktreeManager.ts` - 修改 `saveState()` 方法中的文件操作
  - `src/state/logRotation.ts` - 修改 `cleanupOldLogs()` 方法中的目录删除
- **功能恢复**: 修复后以下功能将正常工作：
  - `maestro spawn` - Agent 创建和 worktree 管理
  - `maestro cleanup` - 清理已完成的 worktree
  - `maestro recover` - 状态恢复
  - `maestro attach` - TUI 界面（代码已实现，但因此错误无法运行）
- **依赖**: 无新增依赖
- **构建**: 需要重新编译 TypeScript
