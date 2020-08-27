module.exports = {
  type: 'mysql',
  host: 'localhost',
  port: 3306,
  username: 'root',
  password: '123456',
  database: 'community',
  timezone: 'Z',
  // FIXME: this config can not working on cli migration.
  entities: [
    'lib/db/entities/**/*.js'
  ],
  migrations: [
    'lib/db/migrations/**/*.js'
  ],
  subscribers: [
    'lib/db/subscribers/**/*.js'
  ],
  cli: {
    entitiesDir: 'src/db/entities',
    migrationsDir: 'src/db/migrations',
    subscribersDir: 'src/db/subscribers'
  }
}
