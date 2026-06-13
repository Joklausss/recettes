import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Couleurs par origine, réutilisées dans les badges
        local: "#2563eb",
        italian: "#16a34a",
        asian: "#dc2626",
        world: "#d97706",
      },
    },
  },
  plugins: [],
};

export default config;
