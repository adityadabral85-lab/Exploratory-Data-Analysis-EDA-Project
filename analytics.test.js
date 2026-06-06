"use strict";
const assert = require("assert");
const { analyze, parseCSV, sampleData } = require("../src/analytics");

const parsed = parseCSV('name,value,note\nAlpha,12,"hello, world"\nBeta,,ok');
assert.equal(parsed.length, 2);
assert.equal(parsed[0].note, "hello, world");

const result = analyze(sampleData(), "Test");
assert.equal(result.meta.rows, 620);
assert(result.meta.numeric >= 5);
assert(result.correlations.strongest.length > 0);
assert(result.quality.score > 90);
console.log("Analytics tests passed.");
