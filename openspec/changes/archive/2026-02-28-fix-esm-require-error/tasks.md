## 1. 修复 WorktreeManager.ts

- [x] 1.1 删除 `src/worktree/WorktreeManager.ts:85` 的 `const { renameSync } = require('node:fs');` 行
- [x] 1.2 确认顶部已有 `renameSync` 导入（第 2 行已存在）

## 2. 修复 logRotation.ts

- [x] 2.1 在 `src/state/logRotation.ts` 顶部 import 中添加 `rmdirSync`
- [x] 2.2 将第 123-124 行的 `const fs = require('node:fs'); fs.rmdirSync(fullPath);` 替换为直接调用 `rmdirSync(fullPath);`

## 3. 验证

- [x] 3.1 运行 `npm run build` 确认 TypeScript 编译成功
- [x] 3.2 运行 `maestro spawn "test"` 验证 spawn 命令正常工作
- [x] 3.3 运行 `maestro status` 验证状态查看正常
- [x] 3.4 运行 `maestro attach` 验证 TUI 界面可以启动
