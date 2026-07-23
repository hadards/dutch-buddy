import assert from "node:assert";
import { formatContacts, formatAreas } from "./data.js";

const contacts = formatContacts();
assert.ok(contacts.includes("112"), "formatContacts should include emergency number");

const allAreas = formatAreas();
assert.ok(allAreas.includes("Example area"), "formatAreas() with no filter should list all areas");

const filtered = formatAreas("example");
assert.ok(filtered.includes("Example area"), "formatAreas filter should be case-insensitive");

const noMatch = formatAreas("nonexistent-zzz");
assert.ok(noMatch.includes("No area info found"), "formatAreas should report no match");

console.log("All data.ts checks passed.");
