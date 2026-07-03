import { defineConfig } from "vite";

export default defineConfig({
  // For GitHub Pages project sites, set this to the repository name.
  // Example: if the repo is named "mortgage-calculator", use "/mortgage-calculator/".
  base: process.env.VITE_BASE_PATH ?? "/",
});
