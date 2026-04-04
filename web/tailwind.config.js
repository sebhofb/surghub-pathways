/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#1a3a5c",
          50: "#eef3f8",
          100: "#d0e0ef",
          200: "#a1c1df",
          300: "#72a2cf",
          400: "#4383bf",
          500: "#1a3a5c",
          600: "#152f4a",
          700: "#102338",
          800: "#0b1826",
          900: "#060c14",
        },
        green: {
          DEFAULT: "#1a6b4a",
          50: "#eef6f2",
          100: "#cce8da",
          200: "#99d1b5",
          300: "#66ba90",
          400: "#33a36b",
          500: "#1a6b4a",
          600: "#15563b",
          700: "#10402c",
          800: "#0b2b1d",
          900: "#05150e",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
