export default {
  "*.{ts,vue,js,mjs}": ["eslint --fix", "prettier --write"],
  "*.{json,md,yaml,yml,html,css}": ["prettier --write"],
  "*.{ts,vue}": () => "bun run typecheck",
};
