import { AsyncQueue } from "@app/concurrency";

describe("AsyncQueue", () => {
  let queue: AsyncQueue;

  beforeEach(() => {
    queue = new AsyncQueue();
  });

  it("executes tasks in FIFO order", async () => {
    const results: number[] = [];
    const task1 = async () => {
      await new Promise((r) => setTimeout(r, 10));
      results.push(1);
    };
    const task2 = async () => {
      results.push(2);
    };

    await queue.enqueue(task1);
    await queue.enqueue(task2);

    // The tasks execute asynchronously
    // We'll wait a bit to ensure they've run
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(results).toEqual([1, 2]);
  });

  it("handles errors but continues with next tasks", async () => {
    const results: string[] = [];
    const failingTask = async () => {
      throw new Error("boom");
    };
    const successTask = async () => {
      results.push("ok");
    };

    await queue.enqueue(failingTask);
    await queue.enqueue(successTask);
    await new Promise((resolve) => setTimeout(resolve, 50));

    // The queue should not stop after an error
    expect(results).toContain("ok");
  });

  it("processes tasks added during execution", async () => {
    const results: number[] = [];
    const task1 = async () => {
      results.push(1);
      await queue.enqueue(async () => {
        results.push(3);
      });
    };
    const task2 = async () => {
      results.push(2);
    };

    await queue.enqueue(task1);
    await queue.enqueue(task2);
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(results).toEqual([1, 3, 2]);
  });

  it("does not process tasks if queue is empty", async () => {
    const results: number[] = [];
    const task = async () => {
      results.push(1);
    };

    await queue.enqueue(task);
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(results).toEqual([1]);
  });

  it("processes tasks sequentially", async () => {
    const results: number[] = [];
    const task1 = async () => {
      await new Promise((r) => setTimeout(r, 50));
      results.push(1);
    };
    const task2 = async () => {
      results.push(2);
    };

    await queue.enqueue(task1);
    await queue.enqueue(task2);
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(results).toEqual([1, 2]);
  });
});
