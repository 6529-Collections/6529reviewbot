#!/usr/bin/env node

"use strict";

require("../src/review-bot.cjs").main("i18n").catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
