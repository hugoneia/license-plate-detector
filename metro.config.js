const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Optimizar bundling para release
config.resolver = {
  ...config.resolver,
  // Excluir node_modules innecesarios del bundling
  blockList: [
    /.*\.test\.js$/,
    /.*\.spec\.js$/,
  ],
  // Forzar Metro a usar el resolver correcto para react-native-webview
  sourceExts: ["ts", "tsx", "js", "jsx", "json"],
};

module.exports = withNativeWind(config, {
  input: "./global.css",
  forceWriteFileSystem: true,
});
