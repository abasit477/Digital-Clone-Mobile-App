module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./src'],
          extensions: ['.ios.js', '.android.js', '.js', '.json'],
          alias: {
            '@': './src',
            '@screens': './src/screens',
            '@components': './src/components',
            '@navigation': './src/navigation',
            '@services': './src/services',
            '@store': './src/store',
            '@theme': './src/theme',
            '@utils': './src/utils',
            '@config': './src/config',
          },
        },
      ],
    ],
  };
};
