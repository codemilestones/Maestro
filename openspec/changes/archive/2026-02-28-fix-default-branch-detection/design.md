## Overview

修复 Maestro CLI 的默认分支检测问题，确保在不同的 Git 仓库配置下都能正常工作。

## Architecture

### 当前问题

1. **配置硬编码**: `DEFAULT_CONFIG.worktree.defaultBase` 硬编码为 `main`
2. **sync() 警告**: `WorktreeManager.sync()` 在启动时调用，即使没有状态文件也会产生警告
3. **分支检测时机**: `getDefaultBranch()` 只在创建 worktree 时调用，但此时配置的分支可能已经不存在

### 解决方案

```
┌─────────────────────────────────────────────────────────────┐
│                    maestro init                              │
├─────────────────────────────────────────────────────────────┤
│  1. 检测 Git 仓库默认分支                                    │
│     - git remote show origin → HEAD branch                   │
│     - 回退: 检查 main/master 是否存在                        │
│  2. 写入配置文件时使用检测到的分支                           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  WorktreeManager.sync()                      │
├─────────────────────────────────────────────────────────────┤
│  改进错误处理:                                               │
│  - 状态文件不存在时静默返回（不警告）                        │
│  - 只在实际同步失败时记录警告                                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  WorktreeManager.create()                    │
├─────────────────────────────────────────────────────────────┤
│  增强分支回退逻辑:                                           │
│  1. 使用 options.base 如果提供                               │
│  2. 使用 config.worktree.defaultBase                         │
│  3. 回退到 getDefaultBranch() 自动检测                       │
│  4. 在使用前验证分支是否存在                                 │
└─────────────────────────────────────────────────────────────┘
```

## Component Design

### 1. config.ts 修改

新增函数 `detectDefaultBranch()`:
```typescript
export async function detectDefaultBranch(projectRoot?: string): Promise<string> {
  const git = createGit(projectRoot);
  return getDefaultBranch(git);
}
```

修改 `initMaestroDir()`:
- 接受可选的 `detectedBranch` 参数
- 创建配置时使用检测到的分支

### 2. WorktreeManager.ts 修改

修改 `sync()` 方法:
```typescript
async sync(): Promise<void> {
  const state = this.loadState();

  // 如果没有任何 worktree，静默返回
  if (Object.keys(state.worktrees).length === 0) {
    return;
  }

  // ... 其余逻辑
}
```

### 3. git.ts 修改

增强 `getDefaultBranch()`:
```typescript
export async function getDefaultBranch(git: SimpleGit): Promise<string> {
  // 1. 尝试从 remote 获取
  try {
    const remoteInfo = await git.raw(['remote', 'show', 'origin']);
    const match = remoteInfo.match(/HEAD branch: (.+)/);
    if (match) {
      return match[1].trim();
    }
  } catch {
    // 继续回退逻辑
  }

  // 2. 检查本地分支是否存在
  for (const name of ['main', 'master', 'develop']) {
    if (await branchExists(git, name)) {
      return name;
    }
  }

  // 3. 获取当前分支作为最后回退
  try {
    return await getCurrentBranch(git);
  } catch {
    return 'main';
  }
}
```

### 4. init.ts 修改

在初始化流程中:
```typescript
// 检测默认分支
const detectedBranch = await detectDefaultBranch(cwd);

// 初始化目录和配置
initMaestroDir(cwd, detectedBranch);

// 显示检测结果
console.log(`Detected default branch: ${detectedBranch}`);
```

## Data Flow

```
用户运行 maestro init
        │
        ▼
detectDefaultBranch()
        │
        ▼
git remote show origin
        │
   ┌────┴────┐
   │ 成功    │ 失败
   ▼         ▼
返回 HEAD  检查 main/master
 branch      是否存在
             │
        ┌────┴────┐
        │ 存在    │ 不存在
        ▼         ▼
      返回      返回当前
     该分支      分支
        │
        ▼
写入 config.yaml
worktree.defaultBase = 检测到的分支
pr.defaultBase = 检测到的分支
```

## Error Handling

| 场景 | 处理方式 |
|------|---------|
| 无 remote origin | 检查本地分支 main/master |
| 无 main/master | 使用当前分支 |
| 无任何分支 | 默认 'main' |
| sync() 无状态文件 | 静默返回，不警告 |
| worktree 创建分支不存在 | 自动检测并使用存在的分支 |

## Testing Considerations

- 测试 main 作为默认分支的仓库
- 测试 master 作为默认分支的仓库
- 测试无 remote 的本地仓库
- 测试已初始化的项目重新初始化
