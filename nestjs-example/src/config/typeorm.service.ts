import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export function TypeormConfigService(configService: ConfigService) {
  const option: TypeOrmModuleOptions = {
    ...configService.get('db'),
    // // 마이그레이션 이력을 관리할 테이블 설정(마이그레이션 관련 옵션들)
    // migrationsRun: false, // 서버 구동 시 작성된 마이그레이션 파일을 기반으로 마이그레이션을 수행하게 할지 설정하는 옵션. false로 설정하여 직접 CLI로 마이그레이션 수행
    // migrations: [__dirname + '/**/migrations/*.js}'], // 마이그레이션을 수행할 파일이 관리되는 경로 설정
    // migrationsTableName: 'migrations', // 마이그레이션 이력이 기록되는 테이블 이름 설정
  };
  return option;
}
