<script setup lang="ts">
import DiffViewer from "~/components/git/DiffViewer.vue";

const sampleDiff = `--- a/src/utils/auth.ts
+++ b/src/utils/auth.ts
@@ -5,10 +5,15 @@
 import { createSession } from "./session";

 export async function handleCallback(code: string) {
-  const token = await exchangeCode(code);
-  const user = await fetchUser(token);
+  const { accessToken, refreshToken } = await exchangeCode(code);
+  const user = await fetchUser(accessToken);
+
+  if (!user.email) {
+    throw new AuthError("Email is required");
+  }

   const session = await createSession(user.id);
-  return { session, user };
+  return { session, user, refreshToken };
 }`;
</script>

<template>
  <Story title="Pages / Project Git" group="pages">
    <Variant title="Status Overview">
      <div
        style="
          height: 600px;
          width: 375px;
          border: 1px solid var(--color-border);
          border-radius: 8px;
          overflow: hidden;
        "
      >
        <div class="git-page">
          <div class="git-status">
            <div class="branch-section">
              <svg
                class="branch-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <line x1="6" y1="3" x2="6" y2="15" />
                <circle cx="18" cy="6" r="3" />
                <circle cx="6" cy="18" r="3" />
                <path d="M18 9a9 9 0 0 1-9 9" />
              </svg>
              <span class="branch-name">feature/auth-fix</span>
            </div>

            <div class="changes-section">
              <h3 class="section-title">Staged Changes</h3>
              <div class="change-item">
                <span class="change-status badge-modified">modified</span>
                <span class="change-path">src/auth/callback.ts</span>
              </div>
              <div class="change-item">
                <span class="change-status badge-added">added</span>
                <span class="change-path">tests/auth.test.ts</span>
              </div>
            </div>

            <div class="changes-section">
              <h3 class="section-title">Unstaged Changes</h3>
              <div class="change-item">
                <span class="change-status badge-modified">modified</span>
                <span class="change-path">src/components/Header.vue</span>
              </div>
              <div class="change-item">
                <span class="change-status badge-untracked">untracked</span>
                <span class="change-path">src/utils/helpers.ts</span>
              </div>
              <div class="change-item">
                <span class="change-status badge-deleted">deleted</span>
                <span class="change-path">src/old-config.json</span>
              </div>
            </div>

            <div class="commits-section">
              <h3 class="section-title">Recent Commits</h3>
              <div class="commit-item">
                <div class="commit-header">
                  <code class="commit-hash">f4ec7e8</code>
                  <span class="commit-time">2h ago</span>
                </div>
                <p class="commit-message">Add design-tokens package.json to build context</p>
                <span class="commit-author">Finn</span>
              </div>
              <div class="commit-item">
                <div class="commit-header">
                  <code class="commit-hash">471e0dd</code>
                  <span class="commit-time">5h ago</span>
                </div>
                <p class="commit-message">Fix lint errors from Phase 6B merge</p>
                <span class="commit-author">Finn</span>
              </div>
              <div class="commit-item">
                <div class="commit-header">
                  <code class="commit-hash">76f0534</code>
                  <span class="commit-time">1d ago</span>
                </div>
                <p class="commit-message">Merge branch 'worktree-agent-a191dc4a'</p>
                <span class="commit-author">Finn</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Variant>

    <Variant title="Clean Working Tree">
      <div
        style="
          height: 600px;
          width: 375px;
          border: 1px solid var(--color-border);
          border-radius: 8px;
          overflow: hidden;
        "
      >
        <div class="git-page">
          <div class="git-status">
            <div class="branch-section">
              <svg
                class="branch-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <line x1="6" y1="3" x2="6" y2="15" />
                <circle cx="18" cy="6" r="3" />
                <circle cx="6" cy="18" r="3" />
                <path d="M18 9a9 9 0 0 1-9 9" />
              </svg>
              <span class="branch-name">main</span>
            </div>

            <div class="clean-state">
              <svg
                class="clean-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <p>Clean working tree</p>
            </div>

            <div class="commits-section">
              <h3 class="section-title">Recent Commits</h3>
              <div class="commit-item">
                <div class="commit-header">
                  <code class="commit-hash">f4ec7e8</code>
                  <span class="commit-time">2h ago</span>
                </div>
                <p class="commit-message">Add design-tokens package.json to build context</p>
                <span class="commit-author">Finn</span>
              </div>
              <div class="commit-item">
                <div class="commit-header">
                  <code class="commit-hash">471e0dd</code>
                  <span class="commit-time">5h ago</span>
                </div>
                <p class="commit-message">Fix lint errors from Phase 6B merge</p>
                <span class="commit-author">Finn</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Variant>

    <Variant title="Diff Viewer">
      <div
        style="
          height: 600px;
          width: 375px;
          border: 1px solid var(--color-border);
          border-radius: 8px;
          overflow: hidden;
        "
      >
        <div class="git-page">
          <DiffViewer filename="src/utils/auth.ts" :diff="sampleDiff" />
        </div>
      </div>
    </Variant>
  </Story>
</template>

<style scoped>
.git-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--color-bg);
}

.git-status {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: var(--space-7);
}

.branch-section {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--color-bg-surface);
  border-bottom: 1px solid var(--color-border);
}

.branch-icon {
  width: 20px;
  height: 20px;
  color: var(--color-accent);
  flex-shrink: 0;
}

.branch-name {
  font-family: var(--font-mono);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.changes-section,
.commits-section {
  padding-top: var(--space-4);
}

.section-title {
  padding: 0 var(--space-4) var(--space-2);
  font-family: var(--font-sans);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.change-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-4);
  min-height: var(--touch-min);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.change-item:hover {
  background: var(--color-bg-inset);
}

.change-item:active {
  background: var(--color-accent-tint);
}

.change-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  font-size: 11px;
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
  flex-shrink: 0;
  min-width: 64px;
}

.badge-added {
  background: var(--color-success-tint);
  color: var(--color-success);
}

.badge-modified {
  background: var(--color-warning-tint);
  color: var(--color-warning);
}

.badge-deleted {
  background: var(--color-danger-tint);
  color: var(--color-danger);
}

.badge-renamed {
  background: var(--color-accent-tint);
  color: var(--color-accent);
}

.badge-untracked {
  background: var(--color-accent-tint);
  color: var(--color-accent);
}

.change-path {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.clean-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-7);
  color: var(--color-text-muted);
}

.clean-state p {
  font-size: var(--font-size-sm);
}

.clean-icon {
  width: 36px;
  height: 36px;
  color: var(--color-success);
}

.commit-item {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

.commit-item:last-child {
  border-bottom: none;
}

.commit-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-1);
}

.commit-hash {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-accent);
  background: var(--color-accent-tint);
  padding: 2px 8px;
  border-radius: var(--radius-full);
  letter-spacing: 0.02em;
}

.commit-time {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.commit-message {
  font-size: var(--font-size-sm);
  color: var(--color-text);
  line-height: var(--line-height-tight);
  margin-bottom: var(--space-1);
}

.commit-author {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}
</style>
