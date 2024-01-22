export default () => {
  console.log('process.env.MARIADB_HOST22', process.env.MARIADB_HOST);

  const env = process.env.NODE_ENV;
  const synchronize = process.env.DB_SYNCHRONIZE === 'true';
  const logging = process.env.DB_LOGGING === 'true';
  const DB_TYPE: 'mariadb' | null = 'mariadb';
  return {
    app: {
      port: parseInt(process.env.PORT, 10) || 3000,
    },
    db: {
      type: DB_TYPE,
      host: process.env.MARIADB_HOST,
      port: parseInt(process.env.MARIADB_PORT) || 3306,
      username: process.env.MARIADB_USERNAME,
      password: process.env.MARIADB_PASSWORD,
      database: process.env.MARIADB_DATABASE,
      entities: [__dirname + '/../**/*.entity.{js,ts}'],
      synchronize: env === 'production' ? false : synchronize,
      logging,
      retryAttempts: env === 'production' ? 10 : 1,
    },
  };
};
