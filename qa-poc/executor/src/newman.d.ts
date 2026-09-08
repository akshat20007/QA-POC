declare module 'newman' {
  import type { EventEmitter } from 'node:events';

  export interface NewmanRunOptions {
    collection: unknown;
    environment?: unknown;
    reporters?: string | string[];
    bail?: boolean;
    timeout?: number;
  }

  export interface NewmanAssertionError {
    name: string;
    message: string;
    test?: string;
  }

  export interface NewmanAssertion {
    assertion: string;
    skipped: boolean;
    error?: NewmanAssertionError;
  }

  export interface NewmanExecution {
    item: { name: string };
    request?: { method?: string; url?: { toString(): string } | string };
    response?: { code?: number; status?: string };
    assertions: NewmanAssertion[];
  }

  export interface NewmanRunSummary {
    run: {
      executions: NewmanExecution[];
      stats: {
        assertions: { total: number; failed: number };
        requests: { total: number; failed: number };
      };
    };
  }

  export interface NewmanRunCallback {
    (err: Error | null, summary: NewmanRunSummary): void;
  }

  export interface NewmanRunEventEmitter extends EventEmitter {
    on(event: 'assertion', listener: (err: NewmanAssertionError | null, assertion: NewmanAssertion) => void): this;
    on(event: 'request', listener: (err: Error | null, args: unknown) => void): this;
    on(event: 'done', listener: (err: Error | null, summary: NewmanRunSummary) => void): this;
  }

  function run(options: NewmanRunOptions, callback: NewmanRunCallback): NewmanRunEventEmitter;

  export default { run };
}
