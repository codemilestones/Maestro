# Specs: fix-esm-require-error

此变更是一个 bug 修复，不涉及任何规范级别的变更。

## 说明

- **无新增能力**: 不引入新功能
- **无修改能力**: 不改变现有功能的对外行为
- **实现层面修复**: 将 CommonJS `require()` 替换为 ES Module `import`

## 相关现有规范

修复影响以下规范的实现，但不改变其规范内容：

- `worktree-management`: WorktreeManager.saveState() 的内部实现
- `state-persistence`: logRotation.cleanupOldLogs() 的内部实现
