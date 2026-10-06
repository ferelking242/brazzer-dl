---
name: Vite watcher scope
description: Workspace files that must stay outside the app's dev watcher and Tailwind source scan.
---

Keep the `.agents` tree, local download data, and generated build output out of Vite and Tailwind scanning.

**Why:** Tooling writes skill templates and agent assets under `.agents`; Vite treated those changes as app updates and repeatedly forced full page reloads.

**How to apply:** Preserve the exclusions in Vite's watcher and Tailwind source rules when changing the frontend toolchain. Revisit them only if the workspace layout or observed reload cause changes.
