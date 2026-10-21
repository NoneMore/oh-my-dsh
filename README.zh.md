# oh-my-dsh

[English](README.md) | 简体中文

这是一个**可直接安装到 DeepSeek Harness Web 的 Standard Preset 配置 Bundle**。它在 Harness 层解决源码“先全文读取”的默认倾向，而不更改你的项目规则，也不关闭编辑前读取/版本检查。

## 改动

| 配置入口 | 内容 |
|---|---|
| \`persona.suffix\` | 注入系统级“先搜索、局部读取、按需扩展”的源码调查策略 |
| \`tool-fs.readLimit\` | 160 行：\`read\` 默认值**以及硬上限** |
| \`tool-fs.readMaxBytes\` | 32768 字节：单次读取的额外输出上限 |

局部读取可满足 DSH 的 \`fs-observation-policy\` 观察要求，但不等于已充分理解修改范围；完整契约、失败路径、安全约束和最终验收不得省略。

## 安装

1. 将 \`oh-my-dsh\` 克隆到**运行 DSH 的那台机器**。
2. 使用 Node.js 22+，执行 \`npm test\` 和 \`npm run check\`。
3. 在 DSH Web 进入 **Creator**，要求调用 \`plugin_manager\` 的 \`install_bundle\` 操作，\`target\` 填写本仓库的**绝对目录路径**。
4. 新建一个 **Standard 会话** 验证工具声明中 \`read\` 的 \`limit\` 为 \`Defaults to 160\`，并检查实际源码搜索/读取顺序。

本仓库附带 \`package.json\`、\`cordis.patch.yml\`，遵循 DSH 官方的本地 Bundle 机制。**不要**把片段手动添加到用户 Profile 顶层的 \`tool-fs\`；Web Standard 的 \`tool-fs\` 是 Preset 子插件。

## 版本与已有配置

**覆盖 \`preset-standard\` 会整体替换其 \`config.plugins\` 列表，不会自动与上游新插件合并。**

仓库默认生成结果基于 DSH **0.2.1-rc.2**（上游提交 \`687f282\`）。若 DSH 版本不同，或者你已定制过 Standard Preset，应先取得**相同版本且包含你所有定制项**的 Standard 定义 \`standard.patch.yml\`，重新生成：

\`\`\`sh
node scripts/render.mjs --source /path/to/standard.patch.yml --output cordis.patch.yml
node scripts/render.mjs --source /path/to/standard.patch.yml --output cordis.patch.yml --check
\`\`\`

\`npm test\` 包含固定上游版本的 Golden 检查；重新生成不同版本后，它与 Golden 不一致是预期行为，届时用上述 \`--check\` 验证当前源文件。更改后需检查 Diff 并重新安装/重新加载 Bundle、新建会话。

脚本使用保守的文本级生成方式，以原样保留 Cordis YAML 的 \`!!js\` 表达式；遇到不支持的 Preset 格式会停止，而不是清空现有插件。

若 Web Profile 或 Home 的更高优先级 Patch 也覆盖了 \`preset-standard\`，可能导致此 Bundle 不生效；请核对实际生效的 Preset，而非只看此仓库的文件。

## 卸载

在 DSH Plugins/Creator 禁用或移除 \`oh-my-dsh\` Bundle，并新建 Standard 会话。无需更改 \`AGENTS.md\`、OpenSpec、DSH 系统源码或任何游戏运行时代码。

## 验证指标

对照新旧会话的搜索先后、\`read\` 返回文本总量、分页次数、最大上下文、正确性和完整验收情况。160 行为试验起点，不是官方最佳值；过于严格的硬上限可能增加往返读取。若实测不理想，优先调整 \`readLimit\` 并重新生成、测试。
