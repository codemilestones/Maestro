import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execa } from 'execa';
import { AgentInfo, PROptions, PRInfo, ArchitectureContract } from '../shared/types.js';
import { getMaestroDir, TEMPLATES_DIR, loadConfig } from '../shared/config.js';
import { getLogger } from '../shared/logger.js';
import { createGit, stageAll, commit, push, hasUncommittedChanges } from '../worktree/git.js';
import { analyzeDiff } from './analyzers/diff.js';
import { analyzeInterfaceChanges } from './analyzers/interface.js';
import { analyzeDependencyChanges } from './analyzers/dependency.js';

const DEFAULT_TEMPLATE = `## 概述
{{prompt}}

## 架构契约清单

### 修改的文件
{{fileChanges}}

### 新增的依赖
{{newDependencies}}

## Agent 执行摘要
- 执行时长: {{duration}}
- 工具调用: {{toolCalls}} 次

---
> 🤖 由 Maestro Agent \`{{agentId}}\` 自动生成
`;

export class PRGenerator {
  private logger = getLogger();
  private config = loadConfig();

  async create(
    agent: AgentInfo,
    worktreePath: string,
    options: PROptions
  ): Promise<PRInfo> {
    const baseBranch = this.config.pr.defaultBase;

    // Ensure all changes are committed
    const git = createGit(worktreePath);

    if (await hasUncommittedChanges(git)) {
      this.logger.info('Committing uncommitted changes...');
      await stageAll(git);
      const commitMessage = this.generateCommitMessage(agent.prompt);
      await commit(git, commitMessage);
    }

    // Push branch
    this.logger.info('Pushing branch to remote...');
    await push(git, 'origin', agent.branch, true);

    // Analyze changes
    const contract = await this.analyzeChanges(worktreePath, baseBranch);

    // Generate PR description
    const description = this.generateDescription(agent, contract);

    // Create PR using gh CLI
    const title = options.title || this.generateTitle(agent.prompt);

    const args = ['pr', 'create', '--title', title, '--body', description, '--base', baseBranch];

    if (options.draft || this.config.pr.draft) {
      args.push('--draft');
    }

    if (options.reviewers && options.reviewers.length > 0) {
      args.push('--reviewer', options.reviewers.join(','));
    }

    const labels = this.getLabels(agent.prompt, options.labels);
    if (labels.length > 0) {
      args.push('--label', labels.join(','));
    }

    this.logger.info('Creating pull request...');

    const result = await execa('gh', args, { cwd: worktreePath });

    // Parse PR URL from output
    const prUrl = result.stdout.trim();
    const prNumber = this.extractPRNumber(prUrl);

    return {
      url: prUrl,
      number: prNumber,
      title,
      branch: agent.branch,
      baseBranch,
    };
  }

  async analyzeChanges(worktreePath: string, baseBranch: string): Promise<ArchitectureContract> {
    const [diffStats, interfaceChanges, newDependencies] = await Promise.all([
      analyzeDiff(worktreePath, baseBranch),
      analyzeInterfaceChanges(worktreePath, baseBranch),
      analyzeDependencyChanges(worktreePath, baseBranch),
    ]);

    return {
      interfaceChanges,
      newDependencies,
      fileChanges: diffStats.files,
    };
  }

  generateDescription(agent: AgentInfo, contract: ArchitectureContract): string {
    const template = this.loadTemplate();

    const duration = this.formatDuration(agent.metrics.duration || 0);

    // Format file changes
    const fileChanges = contract.fileChanges
      .map((f) => `- \`${f.path}\` (${f.type}, +${f.additions || 0}/-${f.deletions || 0})`)
      .join('\n');

    // Format new dependencies
    const newDependencies = contract.newDependencies
      .map((d) => `- \`${d.name}@${d.version}\` (${d.type})`)
      .join('\n') || '_None_';

    // Format interface changes
    const interfaceChanges = contract.interfaceChanges
      .slice(0, 20) // Limit to avoid huge PRs
      .map((i) => `- \`${i.name}\` in \`${i.file}\` (${i.type})`)
      .join('\n') || '_None_';

    return template
      .replace('{{prompt}}', agent.prompt)
      .replace('{{agentId}}', agent.id)
      .replace('{{duration}}', duration)
      .replace('{{tokensUsed}}', String(agent.metrics.tokensUsed))
      .replace('{{toolCalls}}', String(agent.metrics.toolCalls))
      .replace('{{fileChanges}}', fileChanges || '_None_')
      .replace('{{newDependencies}}', newDependencies)
      .replace('{{interfaceChanges}}', interfaceChanges);
  }

  private loadTemplate(): string {
    // Check for custom template
    const customPath = join(getMaestroDir(), TEMPLATES_DIR, 'pr-template.md');
    if (existsSync(customPath)) {
      return readFileSync(customPath, 'utf-8');
    }

    // Check template by name
    const templateName = this.config.pr.template;
    const builtinPath = join(import.meta.dirname || '', 'templates', `${templateName}.md`);
    if (existsSync(builtinPath)) {
      return readFileSync(builtinPath, 'utf-8');
    }

    return DEFAULT_TEMPLATE;
  }

  private generateCommitMessage(prompt: string): string {
    const summary = prompt.slice(0, 50).replace(/\n/g, ' ');
    const type = this.detectCommitType(prompt);
    return `${type}: ${summary}${prompt.length > 50 ? '...' : ''}`;
  }

  private generateTitle(prompt: string): string {
    const summary = prompt.slice(0, 70).replace(/\n/g, ' ');
    return summary + (prompt.length > 70 ? '...' : '');
  }

  private detectCommitType(prompt: string): string {
    const lower = prompt.toLowerCase();
    if (lower.includes('fix') || lower.includes('修复') || lower.includes('bug')) {
      return 'fix';
    }
    if (lower.includes('doc') || lower.includes('文档')) {
      return 'docs';
    }
    if (lower.includes('refactor') || lower.includes('重构')) {
      return 'refactor';
    }
    if (lower.includes('test') || lower.includes('测试')) {
      return 'test';
    }
    return 'feat';
  }

  private getLabels(prompt: string, additionalLabels?: string[]): string[] {
    const labels: string[] = additionalLabels || [];

    if (this.config.pr.autoLabels) {
      const type = this.detectCommitType(prompt);
      const mappedLabel = this.config.pr.labelMapping[type];
      if (mappedLabel && !labels.includes(mappedLabel)) {
        labels.push(mappedLabel);
      }
    }

    return labels;
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }

  private extractPRNumber(url: string): number {
    const match = url.match(/\/pull\/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }
}
