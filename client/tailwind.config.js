/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        montserrat: ["Montserrat", "sans-serif"],
      },
    },
  },
  plugins: [
    function ({ addUtilities }) {
      addUtilities({
        ".scrollbar-none": {
          /* For Chrome, Safari, Edge */
          "&::-webkit-scrollbar": {
            display: "none",
          },
          /* For Firefox */
          "scrollbar-width": "none",
          /* For IE/Edge Legacy */
          "-ms-overflow-style": "none",
        },
      });
    },
  ],
};
