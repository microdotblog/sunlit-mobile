module.exports = function babel_config(api) {
  api.cache(true);

  return {
    presets: ['babel-preset-expo'],
  };
};
