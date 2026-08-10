export function createHeaderAnimation(
  onTick: () => void,
  clock = () => performance.now(),
  schedule = setInterval,
  cancel = clearInterval,
) {
  let timer: ReturnType<typeof setInterval> | undefined;
  let startedAt = 0;
  let frozenSweep = -0.3;

  const phase = () =>
    timer ? (((clock() - startedAt) % 2_200) / 2_200) * 1.6 - 0.3 : frozenSweep;

  return {
    start() {
      if (timer) cancel(timer);
      startedAt = clock();
      timer = schedule(onTick, 16);
    },
    stop() {
      frozenSweep = phase();
      if (timer) cancel(timer);
      timer = undefined;
      onTick();
    },
    dispose() {
      if (timer) cancel(timer);
      timer = undefined;
    },
    phase,
    isRunning() {
      return timer !== undefined;
    },
  };
}
