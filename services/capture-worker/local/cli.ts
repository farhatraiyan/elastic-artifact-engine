import * as readline from 'readline';
import { Worker } from '../src/core/Worker.js';
import { LocalQueueAdapter } from './adapters/LocalQueueAdapter.js';
import { MockMetadataAdapter, StatusUpdate } from './adapters/MockMetadataAdapter.js';
import { CaptureJob, CaptureType } from '@render-engine/shared-types';

export class LocalCLI {
  private rl: readline.Interface;
  private worker: Worker;
  private queue: LocalQueueAdapter;
  private metadata: MockMetadataAdapter;

  constructor(worker: Worker, queue: LocalQueueAdapter, metadata: MockMetadataAdapter) {
    this.worker = worker;
    this.queue = queue;
    this.metadata = metadata;

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: 'render-engine > ',
    });

    this.setupListeners();
  }

  private setupListeners() {
    this.metadata.on('statusUpdate', (update: StatusUpdate) => {
      this.log(`[Job ${update.jobId}] -> ${update.status}${update.outputUrl ? ` (URL: ${update.outputUrl})` : ''}${update.error ? ` (Error: ${update.error})` : ''}`);
    });

    this.rl.on('line', async (line) => {
      const parts = line.trim().split(/\s+/);
      const command = parts[0].toLowerCase();
      const args = parts.slice(1);

      switch (command) {
        case 'add':
          await this.handleAdd(args);
          break;
        case 'list':
          await this.handleList();
          break;
        case 'clear':
          await this.queue.clear();
          this.log('Queue cleared.');
          break;
        case 'help':
          this.showHelp();
          break;
        case 'exit':
        case 'quit':
          this.rl.close();
          break;
        case '':
          break;
        default:
          this.log(`Unknown command: ${command}. Type 'help' for available commands.`);
          break;
      }
      this.rl.prompt();
    });

    this.rl.on('close', () => {
      this.log('Exiting...');
      this.worker.stop();
      process.exit(0);
    });
  }

  private log(message: string) {
    // Clear current line to not mess up the prompt
    process.stdout.write('\r\x1b[K');
    // eslint-disable-next-line no-console
    console.log(message);
    this.rl.prompt(true);
  }

  private async handleAdd(args: string[]) {
    if (args.length < 1) {
      this.log('Usage: add <url> [type] (type defaults to pdf)');
      return;
    }

    const url = args[0];
    const type = (args[1] as CaptureType) || 'pdf';

    const job: CaptureJob = {
      id: `job-${Date.now()}`,
      url,
      type,
      options: {
        width: 1280,
        height: 800,
      },
      retryCount: 0,
    };

    await this.queue.enqueue(job);
    this.log(`✅ Job enqueued: ${job.id} for ${url} (${type})`);
    this.log(`   (Waiting for worker to pick up...)`);
  }

  private async handleList() {
    const queue = await this.queue.list();
    if (queue.length === 0) {
      this.log('Queue is empty.');
      return;
    }

    this.log('Current Queue:');
    queue.forEach((msg, i) => {
      const job = msg.body;
      this.log(`${i + 1}. [${job.id}] ${job.url} (${job.type}) - Retries: ${job.retryCount}`);
    });
  }

  private showHelp() {
    this.log('Available commands:');
    this.log('  add <url> [type]   Enqueue a new job (type: pdf | screenshot)');
    this.log('  list               Show jobs currently in the queue');
    this.log('  clear              Remove all jobs from the queue');
    this.log('  help               Show this help message');
    this.log('  exit               Shutdown the worker and exit');
  }

  start() {
    // eslint-disable-next-line no-console
    console.log('--- Render Engine Local Worker CLI ---');
    this.log('Type "help" for a list of commands.');
    this.rl.prompt();
  }
}
