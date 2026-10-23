#!/bin/sh
# join the parts and run the generator
cd "$(dirname "$0")"
cat 00-head.js 10-content.js 20-pages.js 90-tail.js 95-runtime.js > build.all.js
node build.all.js
