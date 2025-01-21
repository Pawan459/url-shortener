/**
 * A class that manages a queue of asynchronous tasks, ensuring that only one task is processed at a time.
 */
export class AsyncQueue {
  private queue: Array<() => Promise<void>> = [];
  private running: boolean = false;

  /**
   * Adds a new task to the queue and starts processing if not already running.
   * 
   * @param task - A function that returns a promise representing the asynchronous task to be added to the queue.
   * @returns A promise that resolves when the task is added to the queue.
   */
  public async enqueue(task: () => Promise<void>): Promise<void> {
    this.queue.push(task);

    // If not already running, start processing the queue
    void this.process();
  }

  /**
   * Processes the tasks in the queue one by one. If an error occurs during the execution of a task, it logs the error and continues with the next task.
   * 
   * @returns A promise that resolves when all tasks in the queue have been processed.
   */
  private async process(): Promise<void> {
    if (this.running) return;
    this.running = true;

    while (this.queue.length > 0) {
      const nextTask = this.queue.shift();
      if (!nextTask) break;

      try {
        await nextTask();
      } catch (error) {
        console.error("AsyncQueue Task Error:", error);
      }
    }
    this.running = false;
  }
}
