import { defineConfig } from "@lingui/cli";

export default defineConfig({
  sourceLocale: "vi",
  locales: ["vi", "en"],
  catalogs: [
    {
      path: "<rootDir>/src/locales/{locale}/messages",
      include: ["<rootDir>/src"]
    }
  ]
});
