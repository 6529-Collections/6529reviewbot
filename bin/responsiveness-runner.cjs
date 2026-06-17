#!/usr/bin/env node

"use strict";

const { parseArgs, runResponsiveness } = require("../src/responsiveness-runner.cjs");

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    printHelp();
    return 0;
  }

  const result = runResponsiveness(options);
  process.stdout.write(result.summary);
  return result.exitCode;
}

function printHelp() {
  console.log(`Usage: node bin/responsiveness-runner.cjs --target <repo> [options]

See docs/responsiveness-runner.md for the workflow and runner contract.`);
}

if (require.main === module) {
  main().then((code) => {
    process.exitCode = code;
  }).catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  });
}

module.exports = { main };
