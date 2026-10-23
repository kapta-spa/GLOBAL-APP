module.exports = {
  content: [
    "./index.html",
    "./App.tsx",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          teal: '#008D96',
          cyan: '#00E5E5',
          dark: '#021B1D',
          black: '#010D0E',
        }
      },
    },
  },
  plugins: [],
}
