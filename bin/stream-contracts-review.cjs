#!/usr/bin/env node

"use strict";

const { safeErrorLine } = require("../src/diagnostics.cjs");

require("../src/review-bot.cjs").main("stream-contracts").catch((error) => {
  console.error(safeErrorLine(error));
  process.exit(1);
});
