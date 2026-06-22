/** offscreen lifecycle 状态快照。 */
export interface OffscreenLifecycleSnapshot {
  /** runtime message handler 是否 ready。 */
  ready: boolean;
  /** 是否已有 ensure/create 流程进行中。 */
  creating: boolean;
  /** 是否已安排 idle close。 */
  idleCloseScheduled: boolean;
}

/** offscreen lifecycle 管理器。 */
export interface OffscreenLifecycle {
  /** 读取当前状态快照。 */
  snapshot(): OffscreenLifecycleSnapshot;
  /** 标记 runtime handler ready。 */
  markReady(): OffscreenLifecycleSnapshot;
  /** 尝试进入创建流程；已 ready 或创建中时返回 false。 */
  beginCreate(): boolean;
  /** 结束创建流程。 */
  finishCreate(): OffscreenLifecycleSnapshot;
  /** 安排最小 idle close 边界。 */
  scheduleIdleClose(): OffscreenLifecycleSnapshot;
  /** 取消 idle close 边界。 */
  cancelIdleClose(): OffscreenLifecycleSnapshot;
}

/** 创建可测 offscreen lifecycle 管理器。 */
export function createOffscreenLifecycle(initialState: Partial<OffscreenLifecycleSnapshot> = {}): OffscreenLifecycle {
  let ready = initialState.ready ?? false;
  let creating = initialState.creating ?? false;
  let idleCloseScheduled = initialState.idleCloseScheduled ?? false;

  return {
    snapshot() {
      return createSnapshot(ready, creating, idleCloseScheduled);
    },
    markReady() {
      ready = true;
      creating = false;

      return createSnapshot(ready, creating, idleCloseScheduled);
    },
    beginCreate() {
      if (ready || creating) {
        return false;
      }

      creating = true;

      return true;
    },
    finishCreate() {
      creating = false;

      return createSnapshot(ready, creating, idleCloseScheduled);
    },
    scheduleIdleClose() {
      idleCloseScheduled = true;

      return createSnapshot(ready, creating, idleCloseScheduled);
    },
    cancelIdleClose() {
      idleCloseScheduled = false;

      return createSnapshot(ready, creating, idleCloseScheduled);
    }
  };
}

/** 构造不可变生命周期快照。 */
function createSnapshot(ready: boolean, creating: boolean, idleCloseScheduled: boolean): OffscreenLifecycleSnapshot {
  return {
    ready,
    creating,
    idleCloseScheduled
  };
}
