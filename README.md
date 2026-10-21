# oh-my-dsh

[简体中文](README.zh.md) | English

A **configuration-only [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web Standard preset overlay**. It curbs unnecessary full-file reads without editing Harness internals or turning off read-before-edit safety.

It changes two child entries in the otherwise preserved Standard preset:

- **System prompt:** adds search-first, bounded-read, expand-when-needed source inspection guidance using \`persona.suffix\`.
- **Read tool:** sets \`tool-fs.readLimit: 160\` and \`readMaxBytes: 32768\`, limiting default **and maximum** output per \`read\` call. A longer file requires paginated \`offset\` calls.

The read-before-edit **fs-observation-policy**, sandbox permissions, and all other Standard child plugins remain intact.

## Install in DSH Web (local bundle)

Requirements: a working DSH Web installation with Creator / \`plugin_manager\` access, Git, Node.js 22+, and permission to install a local plugin bundle.

1. Clone this repository onto the **same machine running DSH**.
2. Run \`npm test\` and \`npm run check\`. Review \`cordis.patch.yml\`.
3. Switch to **Creator** in DSH Web. Ask Creator to call \`plugin_manager\` with \`action: install_bundle\` and \`target\` set to the **absolute path** of this repository. Do not ask it to replace your \`$DSH_HOME/profiles/web/cordis.patch.yml\` manually.
4. Create a **new Standard session**. Ask it to inspect code. Confirm that the \`read\` tool schema says \`Defaults to 160\` and that source search precedes large reads. Existing sessions may retain an older preset revision.

This repository ships a ready-to-install \`package.json\` and \`cordis.patch.yml\`; it is **not** an npm package requiring publication. The official DSH [editing Cordis compositions guidance](https://github.com/deepseek-ai/deepseek-harness/blob/main/packages/preset/agent-preset/skills/editing-cordis-compositions/SKILL.md) documents this bundle installation route.

### Critical compatibility note

**A preset override replaces its entire \`config.plugins\` array.** The committed overlay is generated from DSH **0.2.1-rc.2**, source commit [\`687f282\`](https://github.com/deepseek-ai/deepseek-harness/tree/687f282e8625c6b8d11ff58211a90524be2e4317). It may be incompatible with other DSH releases or preexisting Standard preset customizations. In addition, a later profile/home patch that overrides \`preset-standard\` can supersede this bundle. Verify the *effective* preset before using it.

To match another DSH version, obtain **that version's** \`packages/bundle/web-app/presets/standard.patch.yml\` (the source release or installed bundle; Desktop may store it inside \`app.asar\`). Then regenerate:

\`\`\`sh
node scripts/render.mjs --source /path/to/matching/standard.patch.yml --output cordis.patch.yml
npm test                   # pinned fixture tests; regenerate changes the golden output
\`\`\`

\`npm test\` includes a committed-golden comparison against the pinned source. With a different DSH source, that comparison is intentionally out of date: instead test your generated result using the dry-run command with the **same source**:

\`\`\`sh
node scripts/render.mjs --source /path/to/matching/standard.patch.yml --output cordis.patch.yml --check
\`\`\`

Review your diff, then reinstall/reload the bundle and start a new session. The generator preserves unknown plugin entries and \`!!js\` expressions as raw text; it **fails closed** for layouts or persona suffix formats it cannot safely update.

## Rollback

Disable or remove the **oh-my-dsh bundle** in DSH Web Plugins/Creator, then start a new Standard session. Do not remove \`fs-observation-policy\` or edit DSH's system files. The add-on does not migrate repository files, sessions, model settings, or Mahjong code.

## Why both changes?

A model can obey DSH's original \`Use the read tool\` guidance but omit the optional \`limit\`, producing up to 2000 lines. The **tool cap** limits that consequence; the **system-level preset suffix** encourages searching first and requesting only relevant ranges. This is an experiment in context discipline, **not** a guarantee of better quality or lower total tokens. Compare total returned characters, search/read order, extra pagination, context peak, and task correctness before and after.

See [Chinese usage notes](README.zh.md) and [upstream attribution](THIRD_PARTY_NOTICES.md).
