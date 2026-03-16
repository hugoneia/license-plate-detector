const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// CONFIGURACIÓN DEFINITIVA PARA SDK 54 + RELEASE BUILDS
// Soluciona: require.context + Metro subgraph + lazy-loaded components

config.resolver = {
  ...config.resolver,
  // Bloquear archivos de test y recursos problemáticos
  blockList: [
    /.*\.test\.(js|ts|tsx)$/,
    /.*\.spec\.(js|ts|tsx)$/,
    /.*__tests__.*\.js$/,
    /.*node_modules\/.*\.test\.js$/,
  ],
  // Orden de extensiones (crítico para pnpm + Metro)
  sourceExts: ["ts", "tsx", "js", "jsx", "json"],
  // Asegurar que symlinks de pnpm se resuelven correctamente
  useWatchman: true,
};

// Transformador optimizado para release
config.transformer = {
  ...config.transformer,
  // Usar terser para minificación (más estable que uglify)
  minifierPath: "metro-minify-terser",
  minifierConfig: {
    compress: {
      // Configuración conservadora para evitar errores de bundling
      drop_console: false,
      reduce_vars: false,
      inline: 1,
      passes: 1,
    },
    mangle: {
      // Mantener nombres legibles en release para debugging
      keep_fnames: true,
    },
    output: {
      // Preservar comentarios importantes
      comments: false,
    },
  },
  // Deshabilitar optimizaciones agresivas que causan problemas
  enableBabelRCLookup: false,
};

// Configuración de watchman para pnpm
config.watchFolders = [];

// Integración con NativeWind
module.exports = withNativeWind(config, {
  input: "./global.css",
  forceWriteFileSystem: true,
});
