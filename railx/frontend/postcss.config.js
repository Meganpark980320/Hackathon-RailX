// postcss.config.js
module.exports = {
  plugins: {
    "@tailwindcss/postcss": {},  // ← 이걸 사용해야 함 (v4)
    autoprefixer: {},
  },
};
