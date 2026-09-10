/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: "#0A111E",
        "ink-raised": "#111a2c",
        "ink-card": "#141f34",
        sun: "#FFC93C",
        "sun-soft": "#FFE29A",
        line: "#22304a",
        mist: "#8b9ab3",
      },
      fontFamily: {
        display: ["'Baloo 2'", "cursive"],
        body: ["'Satoshi'", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};
