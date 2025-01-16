import { IWorker } from './interface/media-resources.interfaces';
import { Injectable, OnModuleInit } from '@nestjs/common';
import * as mediasoup from 'mediasoup';
import * as os from 'os';

@Injectable()
export class MediasoupService implements OnModuleInit {
  private nextWorkerIndex = 0;
  private workers: IWorker[] = [];

  constructor() {}

  /**
   * create mediasoup workers on module init
   */
  public async onModuleInit() {
    const numWorkers = os.cpus().length;
    for (let i = 0; i < numWorkers; ++i) {
      await this.createWorker();
    }
  }

  private async createWorker() {
    console.log('[createWorker1]');
    const worker = await mediasoup
      .createWorker({
        rtcMinPort: 2000,
        rtcMaxPort: 2020,
        logLevel: 'debug',
        logTags: [
          'info',
          'ice',
          'dtls',
          'rtp',
          'srtp',
          'rtcp',
          'rtx',
          'bwe',
          'score',
          'simulcast',
          'svc',
          'sctp',
        ],
        dtlsCertificateFile: '',
        dtlsPrivateKeyFile: '',
      })
      .then((worker) => {
        console.log('[createWorker2]', worker?.pid);

        worker.on('died', () => {
          console.error('mediasoup worker has died');
          setTimeout(() => process.exit(1), 2000);
        });

        this.workers.push({ worker, routers: new Map() });
        return worker;
      })
      .catch((err) => {
        console.error('error in create worker');
        console.error(err);
      });
    return worker;
  }

  public getWorker() {
    const worker = this.workers[this.nextWorkerIndex].worker;
    this.nextWorkerIndex = (this.nextWorkerIndex + 1) % this.workers.length;
    return worker;
  }
}
