module.exports = {
  plugins: [
    require('tailwindcss/postcss7-compat'),
    require('postcss-flexbugs-fixes'),
    require('postcss-preset-env')({
      autoprefixer: {
        flexbox: 'no-2009'
      },
      stage: 3
    }),
    require('autoprefixer')
  ]
};