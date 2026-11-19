/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#d9e5ff",
          200: "#bcd2ff",
          300: "#8eb4ff",
          400: "#598aff",
          500: "#3363ff",
          600: "#1d42f5",
          700: "#1731e1",
          800: "#192bb6",
          900: "#1a2b8f",
        },
      },
    },
  },
  plugins: [],
};
