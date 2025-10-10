#!/usr/bin/env node

/**
 * Android Release Build Script
 * This script helps build and sign the Android APK for release
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const ANDROID_DIR = 'android';

console.log('🚀 Starting Android release build process...\n');

// Check if keystore exists
const keystorePath = path.join(ANDROID_DIR, 'app', 'internal-app.keystore');
if (!fs.existsSync(keystorePath)) {
    console.log('⚠️  Keystore not found. Creating a debug keystore for development...');
    console.log('📝 For production release, you need to:');
    console.log('   1. Generate a keystore: keytool -genkey -v -keystore android/app/internal-app.keystore -alias internalapp -keyalg RSA -keysize 2048 -validity 10000');
    console.log('   2. Configure credentials in capacitor.config.json');
    console.log('   3. Update build.gradle with signing config\n');droid
}

// Build the web assets
console.log('📦 Building web assets...');
try {
    execSync('npm run build', { stdio: 'inherit' });
} catch (error) {
    console.error('❌ Failed to build web assets');
    process.exit(1);
}

// Sync with Capacitor
console.log('🔄 Syncing with Capacitor...');
try {
    execSync('npx cap sync android', { stdio: 'inherit' });
} catch (error) {
    console.error('❌ Failed to sync with Capacitor');
    process.exit(1);
}

// Build APK
console.log('🔨 Building Android APK...');
try {
    // Use platform-specific gradlew command
    const isWindows = process.platform === 'win32';
    const gradlewCmd = isWindows ? 'gradlew.bat' : './gradlew';

    execSync(`${gradlewCmd} assembleDebug`, {
        cwd: ANDROID_DIR,
        stdio: 'inherit'
    });
    console.log('✅ APK built successfully!');
    console.log('📱 APK location: android/app/build/outputs/apk/debug/app-debug.apk');
} catch (error) {
    console.error('❌ Failed to build APK');
    console.log('\n💡 Make sure you have:');
    console.log('   - Android SDK installed');
    console.log('   - ANDROID_HOME environment variable set');
    console.log('   - Required Android build tools');
    console.log('\n🔧 Alternative: Open Android Studio and build manually');
    console.log('   File > Open > android/');
    console.log('   Build > Make Project');
    process.exit(1);
}

console.log('\n🎉 Build completed successfully!');
console.log('📋 Next steps for production:');
console.log('   1. Generate a production keystore');
console.log('   2. Configure signing in build.gradle');
console.log('   3. Use ./gradlew assembleRelease for production build');
console.log('   4. Test on physical devices');