/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        base:     "#1a2236",
        surface:  "#222e45",
        surface2: "#2c3a56",
        border:   "#3c5070",
        accent:   "#5ba3f5",
      },
    },
  },
  plugins: [],
};
