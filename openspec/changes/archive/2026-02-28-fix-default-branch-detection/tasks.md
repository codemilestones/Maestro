## Implementation Tasks

### Task 1: 增强 git.ts 的 getDefaultBranch 函数
**File**: `src/worktree/git.ts`

**Changes**:
- 增强 `getDefaultBranch()` 函数，增加 develop 分支作为回退选项
- 添加当前分支作为最后的回退选项
- 确保函数在各种场景下都能返回有效分支

**Acceptance Criteria**:
- [x] 优先从 remote origin 获取 HEAD branch
- [x] 如果无法从 remote 获取，检查 main/master/develop 本地分支
- [x] 如果都不存在，使用当前分支
- [x] 最终回退到 'main'

---

### Task 2: 修改 config.ts 添加分支检测功能
**File**: `src/shared/config.ts`

**Changes**:
- 新增 `detectDefaultBranch()` 导出函数
- 修改 `initMaestroDir()` 接受可选的 `detectedBranch` 参数
- 创建配置时使用检测到的分支而非硬编码的 'main'

**Acceptance Criteria**:
- [x] `detectDefaultBranch()` 函数可被 init 命令调用
- [x] `initMaestroDir()` 支持传入检测到的分支
- [x] 配置文件中 worktree.defaultBase 和 pr.defaultBase 使用检测到的分支

---

### Task 3: 改进 WorktreeManager.sync() 错误处理
**File**: `src/worktree/WorktreeManager.ts`

**Changes**:
- 修改 `sync()` 方法，当没有 worktree 或状态文件不存在时静默返回
- 移除不必要的警告日志

**Acceptance Criteria**:
- [x] 无 worktree 记录时不产生警告
- [x] 状态文件不存在时不产生警告
- [x] 只在实际同步失败时记录警告

---

### Task 4: 修改 init 命令集成分支检测
**File**: `src/cli/commands/init.ts`

**Changes**:
- 在初始化流程中调用 `detectDefaultBranch()`
- 将检测到的分支传递给 `initMaestroDir()`
- 显示检测到的默认分支

**Acceptance Criteria**:
- [x] 初始化时自动检测默认分支
- [x] 配置文件使用检测到的分支
- [x] 用户可以看到检测结果

---

### Task 5: 增强 WorktreeManager.create() 分支回退逻辑
**File**: `src/worktree/WorktreeManager.ts`

**Changes**:
- 在创建 worktree 前验证 base 分支是否存在
- 如果配置的分支不存在，自动调用 `getDefaultBranch()` 获取有效分支

**Acceptance Criteria**:
- [x] 使用前验证分支存在性
- [x] 分支不存在时自动回退到有效分支
- [x] 记录使用的实际分支

---

## Testing

手动测试场景：
1. 在使用 `master` 作为默认分支的仓库中运行 `maestro init`
2. 在使用 `main` 作为默认分支的仓库中运行 `maestro init`
3. 在无 remote 的本地仓库中运行 `maestro init`
4. 运行 `maestro run "test"` 验证 worktree 创建正常
