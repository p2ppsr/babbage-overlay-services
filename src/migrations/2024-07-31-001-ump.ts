import { KnexStorageEngine } from 'ump-services'
import Knex from 'knex'
import knexfile from 'knexfile.js'

const knex = Knex(knexfile.development)
const engine = new KnexStorageEngine({
  knex
})

exports.up = async (knex: Knex.Knex) => {
  await engine.migrations[0].up(knex)
}

exports.down = async (knex: Knex.Knex) => {
  await engine.migrations[0].down(knex)
}
