# Android App Build Guide

## 🚀 Quick Start

### Prerequisites
1. **Android Studio** (latest version)
2. **Android SDK** (API level 22 or higher)
3. **Node.js** (v16 or higher)
4. **Java JDK** (v11 or higher)

### Environment Setup
```bash
# Set environment variables
export ANDROID_HOME=/path/to/Android/sdk
export JAVA_HOME=/path/to/java
```

### Build and Run

#### Development Build
```bash
# Build web assets
npm run build

# Sync with Capacitor
npx cap sync android

# Open in Android Studio
npx cap open android
```

#### Release Build
```bash
# Use the build script
node android-release-build.js
```

## 📱 Project Structure

```
android/
├── app/
│   ├── src/
│   │   ├── main/
│   │   │   ├── AndroidManifest.xml      # App permissions & config
│   │   │   ├── res/
│   │   │   │   ├── drawable*/          # App icons (different densities)
│   │   │   │   ├── mipmap*/            # Launcher icons
│   │   │   │   └── xml/                # Network security config
│   │   │   └── assets/                 # Web assets (synced from build/)
│   │   └── build.gradle                # App-level build config
├── build.gradle                        # Project-level build config
└── gradle.properties                   # Gradle properties
```

## 🔧 Configuration

### Capacitor Config (`capacitor.config.json`)
```json
{
  "appId": "com.bpr.internal",
  "appName": "Internal Operation System",
  "webDir": "build",
  "plugins": {
    "SplashScreen": {
      "launchShowDuration": 3000,
      "backgroundColor": "#ffffff"
    }
  }
}
```

### Android Manifest Permissions
- `INTERNET` - Network access
- `ACCESS_NETWORK_STATE` - Network state detection
- `WAKE_LOCK` - Prevent screen dimming
- `VIBRATE` - Haptic feedback

## 🎨 App Icons

### Icon Sizes Required
- **mdpi**: 48x48px
- **hdpi**: 72x72px
- **xhdpi**: 96x96px
- **xxhdpi**: 144x144px
- **xxxhdpi**: 192x192px

### Icon Files
- `ic_launcher_background.xml` - Background layer
- `ic_launcher_foreground.xml` - Foreground layer
- `ic_launcher.xml` - Adaptive icon configuration

## 🔐 Signing Configuration

### For Development
```bash
# Generate debug keystore (done automatically)
keytool -genkey -v -keystore android/app/internal-app.keystore \
  -alias internalapp -keyalg RSA -keysize 2048 -validity 10000
```

### For Production
1. Create a keystore with your production credentials
2. Update `capacitor.config.json` with keystore path
3. Configure signing in `build.gradle`

## 🚀 Deployment

### Build APK
```bash
# Debug APK
./gradlew assembleDebug

# Release APK (requires signing config)
./gradlew assembleRelease
```

### Install on Device
```bash
# Connect device via USB
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

### Test on Emulator
```bash
# List available emulators
emulator -list-avds

# Start emulator
emulator -avd YourEmulatorName

# Install app
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

## 🔍 Troubleshooting

### Common Issues

1. **Build Fails**
   - Check Android SDK installation
   - Verify JAVA_HOME and ANDROID_HOME
   - Clear Gradle cache: `./gradlew clean`

2. **App Won't Install**
   - Enable USB debugging on device
   - Accept USB debugging authorization
   - Check device compatibility

3. **Web Assets Not Loading**
   - Run `npx cap sync android` after web changes
   - Check network security config for HTTPS issues

### Performance Optimization
- Enable ProGuard for release builds
- Use `android:extractNativeLibs="false"` for faster APK installs
- Configure proper WebView settings

## 📋 Next Steps

1. **Test on Physical Devices** - Essential for production readiness
2. **Set Up Push Notifications** - Using FCM or similar service
3. **Offline Functionality** - Enhance service worker for better offline experience
4. **App Store Submission** - Prepare for Google Play Store

## 📞 Support

For issues specific to your setup:
1. Check Android Studio's Logcat for error messages
2. Verify all environment variables are set correctly
3. Ensure all prerequisites are installed and up to date

---

**Happy coding! 🎉**