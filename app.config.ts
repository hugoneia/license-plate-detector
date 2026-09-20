// Load environment variables with proper priority (system > .env)
import "./scripts/load-env.js";
import type { ExpoConfig } from "expo/config";


// Stable application identity.
// Keep this independent from the old MANUS-generated identifiers so the app
// can evolve as its own application while preserving the possibility of
// reconnecting to MANUS-related infrastructure in the future.
const appIdentity = {
  appName: "Detector de Matrículas",
  appSlug: "license-plate-detector",
  scheme: "licenseplatedetector",
  bundleId: "com.hugoneia.licenseplatedetector",
};

const env = {
  // App branding - update these values directly (do not use env vars)
  appName: appIdentity.appName,
  appSlug: appIdentity.appSlug,
  // S3 URL of the app logo - set this to the URL returned by generate_image when creating custom logo
  // Leave empty to use the default icon from assets/images/icon.png
  logoUrl: "https://d2xsxph8kpxj0f.cloudfront.net/310519663365537754/Ud5snizNRz92fEWKncTfDW/icon-ed5Sudz2NwuC28pj6RX9SL.webp",
  scheme: appIdentity.scheme,
  iosBundleId: appIdentity.bundleId,
  androidPackage: appIdentity.bundleId,
};

const config: ExpoConfig = {
  name: env.appName,
  slug: env.appSlug,
  version: "2.2.3",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: env.scheme,
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: env.iosBundleId,
    "infoPlist": {
        "ITSAppUsesNonExemptEncryption": false
      }
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    versionCode: 20203,
    package: env.androidPackage,
    permissions: ["POST_NOTIFICATIONS", "READ_EXTERNAL_STORAGE", "WRITE_EXTERNAL_STORAGE"],
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          {
            scheme: env.scheme,
            host: "*",
          },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    [
      "expo-camera",
      {
        cameraPermission: "Permitir a $(PRODUCT_NAME) acceder a tu cámara para detectar matrículas",
      },
    ],
    [
      "expo-location",
      {
        locationAlwaysAndWhenInUsePermission: "Permitir a $(PRODUCT_NAME) acceder a tu ubicación para geolocalizar las matrículas",
      },
    ],
    [
      "expo-audio",
      {
        microphonePermission: "Allow $(PRODUCT_NAME) to access your microphone.",
      },
    ],
    [
      "expo-video",
      {
        supportsBackgroundPlayback: true,
        supportsPictureInPicture: true,
      },
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        resizeMode: "cover",
        backgroundColor: "#FFFFFF",
        dark: {
          backgroundColor: "#FFFFFF",
        },
      },
    ],
    [
      "expo-build-properties",
      {
        android: {
          buildArchs: ["armeabi-v7a", "arm64-v8a"],
          minSdkVersion: 24,
          compileSdkVersion: 35,
          targetSdkVersion: 35,
        },
      },
    ],
  ],
  extra: {
    cartoApiKey: process.env.CARTO_API_KEY || process.env.EXPO_PUBLIC_CARTO_API_KEY || "",
    eas: {
      projectId: "22d7bff5-3aa9-4ba3-a274-675425cb9a32",
    },
  },
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;
