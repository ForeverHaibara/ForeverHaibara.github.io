import { afterEach, expect, it, vi } from 'vitest';
import { ConstructionRefreshScheduler } from './constructionRefreshScheduler';

afterEach(() => vi.useRealTimers());

it('reads only after a native scratch add/remove and final output burst settles', async () => {
  vi.useFakeTimers();
  let insideNativeCallback = true;
  const read = vi.fn(async () => { expect(insideNativeCallback).toBe(false); });
  const scheduler = new ConstructionRefreshScheduler(read);
  scheduler.request(0);
  scheduler.request(); scheduler.request(); scheduler.request();
  await Promise.resolve();
  expect(read).not.toHaveBeenCalled();
  insideNativeCallback = false;
  await vi.advanceTimersByTimeAsync(200);
  expect(read).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
  scheduler.dispose();
});

it('discards stale reads, serializes retries and yields instead of spinning in microtasks', async () => {
  vi.useFakeTimers();
  let finish!: () => void;
  const current: Array<() => boolean> = [];
  const read = vi.fn(async (isCurrent: () => boolean) => {
    current.push(isCurrent);
    await new Promise<void>((resolve) => { finish = resolve; });
  });
  const scheduler = new ConstructionRefreshScheduler(read);
  scheduler.request(0);
  await vi.advanceTimersByTimeAsync(0);
  scheduler.request();
  expect(current[0]()).toBe(false);
  await vi.advanceTimersByTimeAsync(300);
  expect(read).toHaveBeenCalledOnce();
  finish(); await Promise.resolve(); await Promise.resolve();
  expect(read).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(200);
  expect(read).toHaveBeenCalledTimes(2);
  expect(current[1]()).toBe(true);
  scheduler.dispose();
  expect(current[1]()).toBe(false);
  finish();
  await vi.advanceTimersByTimeAsync(1000);
  expect(read).toHaveBeenCalledTimes(2);
  expect(vi.getTimerCount()).toBe(0);
});

it('cancels queued reads on dragging or disposal and can refresh after a drag', async () => {
  vi.useFakeTimers();
  const read = vi.fn(async () => undefined);
  const scheduler = new ConstructionRefreshScheduler(read);
  scheduler.request(); scheduler.cancel();
  await vi.advanceTimersByTimeAsync(200);
  expect(read).not.toHaveBeenCalled();
  scheduler.request(0);
  await vi.advanceTimersByTimeAsync(0);
  expect(read).toHaveBeenCalledOnce();
  scheduler.request(); scheduler.dispose(); scheduler.request(0);
  await vi.advanceTimersByTimeAsync(1000);
  expect(read).toHaveBeenCalledOnce();
});
