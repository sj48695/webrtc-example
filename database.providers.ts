import { DataSource } from "typeorm";

export const databaseProviders = [
  {
    provide: 'DATA_SOURCE',
    useFactory: async () => {
      const env = process.env.NODE_ENV;
      const synchronize = process.env.DB_SYNCHRONIZE === 'true';
      const logging = process.env.DB_LOGGING === 'true';
      const DB_TYPE: 'mariadb' | null = 'mariadb';
      const dataSource = new DataSource({
        type: DB_TYPE,
        host: process.env.DB_HOST || 'localhost',
        // port: process.env.DB_PORT,
        username: process.env.DB_USERNAME || 'root',
        password: process.env.DB_PASSWORD || 'root!',
        database: process.env.DB_DATABASE || 'jeoksan_test',
        entities: [__dirname + '/../**/*.entity.{js,ts}'],
        synchronize: env === 'production' ? false : synchronize,
        logging,
        // retryAttempts: env === 'production' ? 10 : 1,
      });

      return dataSource.initialize();
    },
  },
];
