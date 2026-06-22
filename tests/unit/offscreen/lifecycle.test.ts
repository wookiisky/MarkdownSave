import { describe, expect, it } from "vitest";

import { createOffscreenLifecycle } from "../../../src/offscreen/lifecycle";

describe("offscreen lifecycle", () => {
  it("ready 后拒绝重复创建", () => {
    const lifecycle = createOffscreenLifecycle();

    expect(lifecycle.beginCreate()).toBe(true);
    expect(lifecycle.beginCreate()).toBe(false);

    lifecycle.markReady();

    expect(lifecycle.beginCreate()).toBe(false);
    expect(lifecycle.snapshot()).toEqual({
      ready: true,
      creating: false,
      idleCloseScheduled: false
    });
  });

  it("记录最小 idle close 边界", () => {
    const lifecycle = createOffscreenLifecycle({ ready: true });

    expect(lifecycle.scheduleIdleClose().idleCloseScheduled).toBe(true);
    expect(lifecycle.cancelIdleClose().idleCloseScheduled).toBe(false);
  });
});
