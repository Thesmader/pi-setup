import assert from "node:assert/strict";
import { test } from "node:test";
import { createHeaderAnimation } from "./header-animation.ts";

test("header animation starts, freezes, and clears timers", async () => {
  let ticks = 0;
  const animation = createHeaderAnimation(() => {
    ticks += 1;
  });

  animation.start();
  assert.equal(animation.isRunning(), true);

  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.ok(ticks > 0);

  animation.stop();
  const frozen = animation.phase();
  const stoppedTicks = ticks;

  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(ticks, stoppedTicks);
  assert.equal(animation.phase(), frozen);

  animation.dispose();
  assert.equal(animation.isRunning(), false);
});
