const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Configuración optimizada para SDK 54 + pnpm + release builds
config.resolver = {
  ...config.resolver,
  // Bloquear archivos que causan problemas en release
  blockList: [
    /.*\.test\.js$/,
    /.*\.spec\.js$/,
    /.*\.test\.ts$/,
    /.*\.spec\.ts$/,
    /.*node_modules\/react-native-webview\/.*\.html$/,
  ],
  // Extensiones de archivo en orden de prioridad
  sourceExts: ["ts", "tsx", "js", "jsx", "json"],
  // Asegurar que pnpm symlinks se resuelven correctamente
  useWatchman: true,
  // Ignorar directorios que causan problemas
  ignorePattern: /^(.*\/)?\..*|.*node_modules\/react-native-webview\/.*\.html$/,
};

// Transformador personalizado para release
config.transformer = {
  ...config.transformer,
  // Deshabilitar optimizaciones problemáticas en release
  minifierPath: "metro-minify-terser",
  minifierConfig: {
    compress: {
      // Reducir agresividad de compresión
      reduce_vars: false,
      passes: 1,
    },
    mangle: true,
  },
};

// Configuración de watchman para pnpm
config.watchFolders = [];

module.exports = withNativeWind(config, {
  input: "./global.css",
  forceWriteFileSystem: true,
});
