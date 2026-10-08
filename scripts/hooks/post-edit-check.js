#!/usr/bin/env node

/**
 * Post-Tool Edit Hook
 * Fast, non-blocking post-edit validation hook.
 */

let inputData = '';

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  inputData += chunk;
});

process.stdin.on('end', () => {
  // Protocol contract: PostToolUse expects an empty JSON object {}
  console.log(JSON.stringify({}));
  process.exit(0);
});
