import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {
  constructor(private configService: ConfigService) {}

  getHello() {
    const host = this.configService.get<string>('app.host');
    const port = this.configService.get<number>('app.port', 3000);
    return `Hello World! ${host}:${port}`;
  }
}
