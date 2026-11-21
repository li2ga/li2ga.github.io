// Run with research-node and the already installed MIT Three.js source directory.
const path = require('path');
const esbuild = require('esbuild');
const three = process.argv[2];
if (!three) throw new Error('Usage: research-node tools/golden_lotus/build.cjs <three-source-directory>');
esbuild.buildSync({
  entryPoints: [path.join(__dirname, 'runtime.js')], bundle: true, format: 'iife',
  target: 'es2022', minify: true, legalComments: 'inline',
  alias: {three: path.join(three, 'build/three.module.js')},
  outfile: path.join(__dirname, '../../assets/entrance/golden-lotus-v1.js')
});
