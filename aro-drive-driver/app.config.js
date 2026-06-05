export default {
  expo: {
    name: "aro partner",
    slug: "aro-drive-driver",
    version: "1.0.1",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "arodrivedriver",
    userInterfaceStyle: "automatic",
    newArchEnabled: false,
    android: {
      package: "com.arodrivedriver",
      googleServicesFile: "./google-services.json",
      adaptiveIcon: {
        backgroundColor: "#000000",
        foregroundImage: "./assets/images/android-icon-foreground.png",
        backgroundImage: "./assets/images/android-icon-background.png",
        monochromeImage: "./assets/images/android-icon-monochrome.png",
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
        },
      },
    },
    ios: {
      bundleIdentifier: "com.arodrivedriver",
      supportsTablet: true,
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
      },
    },
    web: {
      output: "static",
      favicon: "./assets/images/favicon.png",
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#000000",
          dark: {
            backgroundColor: "#000000",
          },
        },
      ],
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission: "Izinkan ARO DRIVE Driver mengakses lokasi Anda untuk navigasi pengantaran.",
          locationWhenInUsePermission: "Izinkan ARO DRIVE Driver mengakses lokasi Anda saat aplikasi digunakan.",
        },
      ],
      [
        "expo-notifications",
        {
          "icon": "./assets/images/icon.png",
          "color": "#a3e635",
          "sounds": ["./assets/sounds/notif_driver.mp3"]
        }
      ],
      "expo-font",
      "expo-image",
      "expo-status-bar",
      "expo-web-browser",
      "expo-audio",
      [
        "expo-build-properties",
        {
          android: {
            buildArchs: ["arm64-v8a"],
            enableProguardInReleaseBuilds: false,
          },
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      eas: {
        "projectId": "7c752d5b-f444-4e9f-9232-e3ca3086d341"
      },
    },
  },
};
