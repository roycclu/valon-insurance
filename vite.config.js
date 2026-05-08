import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Expose ANTHROPIC_* and OPENAI_* vars (in addition to VITE_*) to import.meta.env
  envPrefix: ["VITE_", "ANTHROPIC_", "OPENAI_"],
});
