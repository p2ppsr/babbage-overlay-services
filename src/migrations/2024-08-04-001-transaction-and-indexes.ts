import { KnexStorageMigrations } from '@bsv/overlay'
import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  const transactionsTableMigration = KnexStorageMigrations.default[2]
  const indexesMigration = KnexStorageMigrations.default[3]
  await transactionsTableMigration.up(knex)
  await indexesMigration.up(knex)
}

export async function down(knex: Knex): Promise<void> {
  const transactionsTableMigration = KnexStorageMigrations.default[2]
  const indexesMigration = KnexStorageMigrations.default[3]
  await transactionsTableMigration.down(knex)
  await indexesMigration.down(knex)
}
