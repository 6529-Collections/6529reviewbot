#!/usr/bin/env node

"use strict";

const { safeErrorLine } = require("../src/diagnostics.cjs");

require("../src/responsiveness-review.cjs").main().catch((error) => {
  console.error(safeErrorLine(error));
  process.exit(1);
});
