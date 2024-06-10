import 'dotenv/config'
import type { Knex } from 'knex'

const config: Knex.Config = {
  client: 'mysql2',
  connection: process.env.KNEX_DB_CONNECTION !== undefined
    ? JSON.parse(process.env.KNEX_DB_CONNECTION)
    : undefined,
  useNullAsDefault: true,
  migrations: {
    directory: './src/migrations'
  },
  pool: {
    min: 0,
    max: 7,
    idleTimeoutMillis: 15000
  }
}

const knexfile: { [key: string]: Knex.Config } = {
  development: config,
  staging: config,
  production: config
}

export default knexfile
