/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")], // <-- A magia da versão 4 está aqui!
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#ebf5ea",
          100: "#d0ead0",
          200: "#a9d9aa",
          500: "#49a738",
          600: "#3A922A",
          700: "#2d7a1f",
          800: "#25601b",
        },
        indigo: {
          50: "#ebf5ea",
          100: "#d0ead0",
          200: "#a9d9aa",
          500: "#49a738",
          600: "#3A922A",
          700: "#2d7a1f",
          800: "#25601b",
        },
      },
    },
  },
  plugins: [],
}
