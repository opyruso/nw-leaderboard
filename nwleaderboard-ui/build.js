import { rmSync, mkdirSync, cpSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import Babel from '@babel/standalone';
import { execSync } from 'child_process';

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });

cpSync('public', 'dist', { recursive: true });
// transpile JS sources to strip JSX for browser compatibility
function transpileDir(srcDir, destDir) {
  mkdirSync(destDir, { recursive: true });
  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      transpileDir(srcPath, destPath);
    } else if (entry.name.endsWith('.js')) {
      const code = readFileSync(srcPath, 'utf8');
      const out = Babel.transform(code, { presets: ['react'] }).code;
      writeFileSync(destPath, out);
    } else {
      cpSync(srcPath, destPath);
    }
  }
}
transpileDir('js', 'dist/js');
cpSync('css', 'dist/css', { recursive: true });
cpSync('images', 'dist/images', { recursive: true });
cpSync('sounds', 'dist/sounds', { recursive: true });

const cfgDir = 'config';
if (existsSync(cfgDir)) {
  cpSync(cfgDir, 'dist/config', { recursive: true });
}

// bundle external dependencies for static hosting
mkdirSync('dist/vendor', { recursive: true });
cpSync('node_modules/@babel/standalone/babel.min.js', 'dist/vendor/babel.min.js');
cpSync('node_modules/react/umd/react.development.js', 'dist/vendor/react.development.js');
cpSync('node_modules/react-dom/umd/react-dom.development.js', 'dist/vendor/react-dom.development.js');
cpSync('node_modules/@remix-run/router/dist/router.umd.js', 'dist/vendor/router.umd.js');
cpSync('node_modules/react-router/dist/umd/react-router.development.js', 'dist/vendor/react-router.development.js');
cpSync(
  'node_modules/react-router-dom/dist/umd/react-router-dom.development.js',
  'dist/vendor/react-router-dom.development.js'
);
cpSync('node_modules/chart.js/dist/chart.umd.js', 'dist/vendor/chart.umd.js');
cpSync('node_modules/cytoscape/dist/cytoscape.umd.js', 'dist/vendor/cytoscape.umd.js');
cpSync('node_modules/layout-base/layout-base.js', 'dist/vendor/layout-base.js');
cpSync('node_modules/cose-base/cose-base.js', 'dist/vendor/cose-base.js');
cpSync('node_modules/cytoscape-cola/cytoscape-cola.js', 'dist/vendor/cytoscape-cola.js');

let version = '';
const tag = process.env.GITHUB_REF_NAME || process.env.GIT_TAG || process.env.TAG;
const base = tag || process.env.GIT_BRANCH || process.env.BRANCH_NAME || 'dev';
let build = process.env.GITHUB_RUN_NUMBER || process.env.BUILD_NUMBER;
if (!build) {
  try {
    build = execSync('git rev-list --count HEAD').toString().trim();
  } catch {
    build = '0';
  }
}
version = `${base}.${build}`;
writeFileSync('dist/version.txt', version);
const apiResourceDir = path.join(
  '..',
  'nwleaderboard-api',
  'src',
  'main',
  'resources',
  'META-INF',
  'resources'
);
mkdirSync(apiResourceDir, { recursive: true });
cpSync('dist/version.txt', path.join(apiResourceDir, 'version.txt'));
function listFiles(dir) {
  let files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(listFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

const swPath = 'dist/service-worker.js';
if (existsSync(swPath)) {
  let sw = readFileSync(swPath, 'utf8').replace(/__VERSION__/g, version);
  const images = listFiles('dist/images')
    .map((f) => '/' + path.relative('dist', f).replace(/\\/g, '/'))
    .sort();
  const imageLines = images.map((i) => `  '${i}',`).join('\n');
  sw = sw.replace(/^\s*\/\/ __IMAGES__$/m, imageLines);

  const sounds = listFiles('dist/sounds')
    .map((f) => '/' + path.relative('dist', f).replace(/\\/g, '/'))
    .sort();
  const soundLines = sounds.map((s) => `  '${s}',`).join('\n');
  sw = sw.replace(/^\s*\/\/ __SOUNDS__$/m, soundLines);
  writeFileSync(swPath, sw);
}
