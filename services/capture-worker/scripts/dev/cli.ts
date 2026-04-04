import { WebSocket } from 'ws';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as readline from 'readline';
import { CaptureJob, CaptureType, JobStatus } from '@render-engine/shared-types';

const OUTPUT_DIR = './scripts/dev/output';

interface WSMessage {
  type: string;
  payload: {
    jobId: string;
    status?: JobStatus;
    error?: string;
    filename?: string;
    data?: string;
  };
}

class DevCLI {
  private rl: readline.Interface;
  private ws: WebSocket;
  private wsUrl: string;

  constructor(wsUrl: string) {
    this.wsUrl = wsUrl;
    this.ws = new WebSocket(wsUrl);

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: 'render-dev > ',
    });

    this.setupListeners();
  }

  private setupListeners() {
    this.ws.on('open', () => {
      this.log(`[Dev CLI] Connected to ${this.wsUrl}`);
      this.rl.prompt();
    });

    this.ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        await this.handleWSMessage(message);
      } catch (error) {
        this.log(`[Dev CLI] Failed to parse message: ${error}`);
      }
    });

    this.ws.on('error', (err) => {
      this.log(`[Dev CLI] WebSocket error: ${err.message}`);
    });

    this.ws.on('close', () => {
      this.log('[Dev CLI] Disconnected');
      process.exit(0);
    });

    this.rl.on('line', async (line) => {
      const parts = line.trim().split(/\s+/);
      const command = parts[0].toLowerCase();
      const args = parts.slice(1);

      switch (command) {
        case 'add':
          await this.handleAdd(args);
          break;
        case 'help':
          this.showHelp();
          break;
        case 'exit':
        case 'quit':
          this.ws.close();
          this.rl.close();
          break;
        case '':
          break;
        default:
          this.log(`Unknown command: ${command}. Type 'help' for commands.`);
          break;
      }
      this.rl.prompt();
    });
  }

  private log(message: string) {
    // Clear current line to not mess up the prompt
    process.stdout.write('\r\x1b[K');
    // eslint-disable-next-line no-console
    console.log(message);
    this.rl.prompt(true);
  }

  private async handleWSMessage(message: WSMessage) {
    switch (message.type) {
      case 'job_status':
        this.log(`[Status] -> ${message.payload.status}${message.payload.error ? `: ${message.payload.error}` : ''}`);
        break;

      case 'job_result': {
        const { filename, data: base64Data, jobId } = message.payload;
        if (!filename || !base64Data) break;

        const buffer = Buffer.from(base64Data, 'base64');

        await fs.mkdir(OUTPUT_DIR, { recursive: true });
        const filePath = path.join(OUTPUT_DIR, filename);
        await fs.writeFile(filePath, buffer);

        this.log(`[Success] -> ${jobId} saved to ${filePath}`);
        break;
      }
    }
  }

  private async waitForOpen(): Promise<void> {
    if (this.ws.readyState === WebSocket.OPEN) return;

    return new Promise((resolve) => {
      this.ws.once('open', resolve);
    });
  }

  private async handleAdd(args: string[]) {
    if (args.length < 1) {
      this.log('Usage: add <url> [type] (type: md | pdf | png)');
      return;
    }

    await this.waitForOpen();

    const url = args[0];
    const type = (args[1] as CaptureType) || 'pdf';
    const isRaw = args.includes('--raw');

    const job: CaptureJob = {
      id: `dev-${Date.now()}`,
      url,
      type,
      options: {
        width: 1280,
        height: 800,
        raw: isRaw,
      },
      retryCount: 0,
    };

    this.ws.send(JSON.stringify({ type: 'job_submit', payload: job }));
    this.log(`[Dev CLI] Job submitted: ${job.id}`);
  }

  private showHelp() {
    this.log('Available commands:');
    this.log('  add <url> [type] [--raw]  Submit a new capture job (type: md | pdf | png)');
    this.log('                            For md: Reader Mode by default, --raw for full page.');
    this.log('  help                      Show this help message');
    this.log('  exit                      Disconnect and exit');
  }

  public start() {
    // eslint-disable-next-line no-console
    console.log('--- Render Engine Dev CLI (WebSocket) ---');
    this.log('Connecting...');
  }
}

const WS_URL = process.argv[2] || 'ws://localhost:3005';
new DevCLI(WS_URL).start();
