const queues = {};

/**
 * Executes a task in a sequential queue based on a key (e.g., file path).
 * This acts as an asynchronous mutex lock to prevent race conditions when reading/writing files.
 * 
 * @param {string} key Identifier for the queue (usually absolute file path)
 * @param {Function} task Async function to execute sequentially
 * @returns {Promise<any>} Result of the task
 */
async function runWithMutex(key, task) {
  if (!queues[key]) {
    queues[key] = Promise.resolve();
  }

  const taskPromise = queues[key].then(() => task()).catch(err => {
    console.error(`Mutex Task Error [${key}]: ${err.message}`);
    throw err;
  });

  queues[key] = taskPromise.catch(() => {}); // Catch to not break the chain

  return taskPromise;
}

module.exports = {
  runWithMutex
};
