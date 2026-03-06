import antfu from "@antfu/eslint-config";

export default antfu(
  {
    vue: true,
    typescript: true,

    stylistic: false, // We use Prettier for formatting

    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.output/**",
      "**/.nuxt/**",
      "**/.nitro/**",
      "**/.cache/**",
      "**/scaffolds/**",
      "**/deploy/**",
      "docs/plans/**",
    ],

    rules: {
      "no-console": "off",
      "node/prefer-global/process": "off",
      "unused-imports/no-unused-imports": "warn",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      // Disable formatting rules that conflict with Prettier
      "vue/singleline-html-element-content-newline": "off",
      "vue/html-self-closing": "off",
      "vue/html-closing-bracket-newline": "off",
      "unicorn/number-literal-case": "off",
    },
  },
  {
    files: ["**/*.ts", "**/*.vue"],
    rules: {
      "ts/consistent-type-imports": [
        "warn",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
    },
  },
  {
    files: ["**/*.md"],
    rules: {
      "markdown/fenced-code-language": "off",
    },
  },
);
