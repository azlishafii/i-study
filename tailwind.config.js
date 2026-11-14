/** Tailwind v3. Compile with: npm run build:css  (output tailwind.css is committed) */
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './app.js', './tools-far2.js'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'] },
      boxShadow: { soft: '0 1px 2px rgba(15,23,42,.05), 0 8px 24px -8px rgba(15,23,42,.10)' }
    }
  },
  plugins: []
};
