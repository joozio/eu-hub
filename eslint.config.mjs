import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Not part of the app: server-side backup copy and a stray script from the live deploy.
    "src.bak-2026-09-09/**",
    "test-implementation.js",
  ]),
  // Pre-existing in the deployed code; fixing them changes render behaviour, so they stay warnings here.
  {
    files: [
      "src/app/compare/page.tsx",
      "src/app/page.tsx",
      "src/app/stats/page.tsx",
      "src/components/AgeSelector.tsx",
      "src/components/ui/theme-toggle.tsx",
      "src/hooks/useSparklines.ts",
      "src/hooks/useTranslatedIndicators.ts",
    ],
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react/no-unescaped-entities": "warn",
    },
  },
]);

export default eslintConfig;
