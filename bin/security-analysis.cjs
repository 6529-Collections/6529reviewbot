#!/usr/bin/env node

"use strict";

const { safeErrorLine } = require("../src/diagnostics.cjs");

require("../src/review-bot.cjs").main("security").catch((error) => {
  console.error(safeErrorLine(error));
  process.exit(1);
});
