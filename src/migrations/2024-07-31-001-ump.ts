import { KnexStorageEngine } from 'ump-services'
import mysqlKnex from 'knex'
import type { Knex } from 'knex'
import knexfile from '../../knexfile.js'

const knex = mysqlKnex(knexfile.development)
const engine = new KnexStorageEngine({
  knex
})

export async function up(knex: Knex): Promise<void> {
  await engine.migrations[0].up(knex)
}

export async function down(knex: Knex): Promise<void> {
  await engine.migrations[0].down(knex)
}