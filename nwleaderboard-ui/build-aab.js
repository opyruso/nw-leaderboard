import { mkdirSync, writeFileSync, existsSync, readFileSync, copyFileSync } from 'fs';
import { join } from 'path';
import os from 'os';
import { execSync } from 'child_process';
import crypto from 'crypto';

const configDir = join(os.homedir(), '.bubblewrap');
const configPath = join(configDir, 'config.json');
const jdkPath = process.env.JAVA_HOME;
let androidSdkPath = process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME;

if (!androidSdkPath) {
  const defaultPath = join(os.homedir(), 'android-sdk');
  if (existsSync(defaultPath)) {
    androidSdkPath = defaultPath;
  }
}

if (!jdkPath) {
  console.error('JAVA_HOME is not set. Set it to the path of JDK 17.');
  process.exit(1);
}

if (!androidSdkPath) {
  console.error('ANDROID_SDK_ROOT or ANDROID_HOME is not set.');
  process.exit(1);
}

process.env.ANDROID_SDK_ROOT = androidSdkPath;
process.env.ANDROID_HOME = androidSdkPath;

mkdirSync(configDir, { recursive: true });
writeFileSync(configPath, JSON.stringify({ jdkPath, androidSdkPath }));

const manifestPath = join(process.cwd(), 'twa-manifest.json');

// Update version information in the TWA manifest based on environment or Git metadata
const tagEnv =
  process.env.GITHUB_REF_NAME || process.env.GIT_TAG || process.env.TAG;
let versionName;
if (tagEnv) {
  versionName = tagEnv.replace(/^v/, '');
} else {
  try {
    versionName = execSync('git describe --tags --abbrev=0')
      .toString()
      .trim()
      .replace(/^v/, '');
  } catch {
    versionName = '0.0.0';
  }
}

const codeEnv =
  process.env.GITHUB_RUN_NUMBER ||
  process.env.CI_PIPELINE_IID ||
  process.env.BUILD_NUMBER;
let versionCode;
if (codeEnv) {
  versionCode = parseInt(codeEnv, 10);
} else {
  try {
    versionCode = parseInt(
      execSync('git rev-list --count HEAD').toString().trim(),
      10,
    );
  } catch {
    versionCode = 0;
  }
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
manifest.appVersionName = versionName;
manifest.appVersion = versionName;
manifest.appVersionCode = versionCode;
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

const manifestChecksum = crypto
  .createHash('sha1')
  .update(readFileSync(manifestPath))
  .digest('hex');
writeFileSync(join(process.cwd(), 'manifest-checksum.txt'), manifestChecksum);

const keystoreSrc = '/opt/certificats/android_opyruso_official.keystore';
const keystoreDest = join(process.cwd(), 'android.keystore');

const keystorePassword = process.env.BUBBLEWRAP_KEYSTORE_PASSWORD;
const keyPassword = process.env.BUBBLEWRAP_KEY_PASSWORD;

if (!keystorePassword || !keyPassword) {
  console.error('BUBBLEWRAP_KEYSTORE_PASSWORD and BUBBLEWRAP_KEY_PASSWORD must be set.');
  process.exit(1);
}

if (!existsSync(keystoreDest)) {
  if (existsSync(keystoreSrc)) {
    copyFileSync(keystoreSrc, keystoreDest);
  } else {
    console.error(`Keystore file not found at ${keystoreSrc}`);
    process.exit(1);
  }
}

if (!existsSync('android')) {
  execSync('npx bubblewrap update --skipVersionUpgrade', { stdio: 'inherit' });
}

execSync('npx bubblewrap build', { stdio: 'inherit' });
