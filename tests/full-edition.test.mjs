import assert from "node:assert/strict";
import test from "node:test";
import { coverageWindow } from "../scripts/newsroom/time.mjs";

test("full edition uses the exact daylight-saving Pacific window", () => {
  assert.deepEqual(coverageWindow("2026-08-19"), {
    coverageStartsAt: "2026-08-18T13:00:00.000Z",
    coverageEndsAt: "2026-08-19T12:59:59.999Z",
  });
});

test("full edition uses the exact standard-time Pacific window", () => {
  assert.deepEqual(coverageWindow("2026-12-10"), {
    coverageStartsAt: "2026-12-09T14:00:00.000Z",
    coverageEndsAt: "2026-12-10T13:59:59.999Z",
  });
});
