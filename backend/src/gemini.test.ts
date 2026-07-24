import assert from "node:assert";
import { formatContacts, formatAreas } from "./data.js";
import { checkAndIncrement } from "./rateLimit.js";

const contacts = formatContacts();
assert.ok(contacts.includes("112"), "formatContacts should include emergency number");

const allAreas = formatAreas();
assert.ok(allAreas.includes("Example area"), "formatAreas() with no filter should list all areas");

const filtered = formatAreas("example");
assert.ok(filtered.includes("Example area"), "formatAreas filter should be case-insensitive");

const noMatch = formatAreas("nonexistent-zzz");
assert.ok(noMatch.includes("No area info found"), "formatAreas should report no match");

const rlId = "test-user";
for (let i = 0; i < 50; i++) {
  assert.ok(checkAndIncrement(rlId), `request ${i + 1} should be allowed within daily limit`);
}
assert.ok(!checkAndIncrement(rlId), "51st request should be blocked");
assert.ok(checkAndIncrement("other-user"), "a different id should have its own separate limit");

console.log("All checks passed.");
