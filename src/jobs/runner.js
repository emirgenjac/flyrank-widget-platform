import { deliverConfirmation } from "./sideEffect.js";

function wait(ms) {
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function defaultAlert(info) {
  console.error(`side effect failed submission=${info.submissionId} attempts=${info.attempts}`);
}

export function startJobs(options = {}) {
  const attempts = options.maxAttempts ?? 3;
  const delayMs = options.delayMs ?? 25;
  const alert = options.alert ?? defaultAlert;
  const forceFail = options.forceFail ?? false;
  const send = options.send ?? ((job) => deliverConfirmation(job, { ...options, forceFail }));
  const queue = [];
  const queued = new Set();
  const settled = new Set();
  const idle = [];
  let running = false;
  let stopped = false;

  function wake() {
    if (!running && queue.length === 0) {
      const waiting = idle.splice(0);
      for (const resolve of waiting) {
        resolve();
      }
    }
  }

  async function runJob(job) {
    let lastAttempt = 0;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      if (stopped) {
        return;
      }
      lastAttempt = attempt;
      try {
        if (forceFail) {
          throw new Error("side effect forced failure");
        }
        await send(job);
        settled.add(job.idempotencyKey);
        queued.delete(job.idempotencyKey);
        return;
      } catch {
        if (attempt < attempts) {
          await wait(delayMs);
        }
      }
    }
    settled.add(job.idempotencyKey);
    queued.delete(job.idempotencyKey);
    try {
      alert({ submissionId: job.id, attempts: lastAttempt });
    } catch {
      // The alert must not escape the worker.
    }
  }

  function pump() {
    if (running) {
      return;
    }
    running = true;
    setImmediate(async () => {
      try {
        while (queue.length > 0 && !stopped) {
          const job = queue.shift();
          await runJob(job);
        }
      } finally {
        running = false;
        if (queue.length > 0 && !stopped) {
          pump();
        } else {
          wake();
        }
      }
    });
  }

  return {
    enqueue(job) {
      if (!job?.idempotencyKey || stopped) {
        return;
      }
      if (settled.has(job.idempotencyKey) || queued.has(job.idempotencyKey)) {
        return;
      }
      queued.add(job.idempotencyKey);
      queue.push(job);
      pump();
    },
    whenIdle() {
      if (!running && queue.length === 0) {
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        idle.push(resolve);
      });
    },
    stop() {
      stopped = true;
      queue.length = 0;
      wake();
    },
  };
}
