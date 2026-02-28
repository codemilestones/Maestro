## Why

Maestro CLI 在启动时总是显示 `Failed to sync worktree state` 警告，并且在创建 worktree 时因为默认分支检测失败而报错 `fatal: invalid reference: main`。这是因为：
1. 配置硬编码默认分支为 `main`，但很多项目使用 `master`
2. WorktreeManager.sync() 方法在启动时被调用但错误处理不当
3. 初始化时没有自动检测并设置正确的默认分支

## What Changes

- 初始化时自动检测 Git 仓库的默认分支（main/master）
- 改进 WorktreeManager.sync() 的错误处理，避免不必要的警告
- 在 worktree 创建时，如果配置的默认分支不存在，自动回退到检测到的分支

## Capabilities

### New Capabilities
无

### Modified Capabilities
- `worktree-management`: 增强默认分支检测逻辑，改进错误处理
- `cli-commands`: 初始化命令自动检测并配置正确的默认分支

## Impact

- 修改文件：
  - `src/shared/config.ts` - 初始化时检测默认分支
  - `src/worktree/WorktreeManager.ts` - 改进 sync() 错误处理
  - `src/worktree/git.ts` - 增强 getDefaultBranch() 可靠性
  - `src/cli/commands/init.ts` - 初始化时设置检测到的默认分支
- 无破坏性变更
- 无新依赖
