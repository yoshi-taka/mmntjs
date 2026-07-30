import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://mmntjs.veritycost.com",
  publicDir: "./public",
  integrations: [sitemap()],
});
