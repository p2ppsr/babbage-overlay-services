import { Collection, Db } from 'mongodb'
import { KVStoreRecord, UTXOReference } from '../types.js'

// Implements a Lookup StorageEngine for KVStore
export class KVStoreStorage {
  private readonly records: Collection<KVStoreRecord>

  /**
   * Constructs a new KVStoreStorage instance
   * @param {Db} db - connected mongo database instance
   */
  constructor(private readonly db: Db) {
    this.records = db.collection<KVStoreRecord>('kvStoreRecords')
    // Optionally create an index if needed for specific fields
    // this.records.createIndex({ "protectedKey": "text" })
  }

  /**
   * Stores a KVStore record
   * @param {string} txid - transaction id
   * @param {number} outputIndex - index of the UTXO
   * @param {string} protectedKey - KVStore key
   * @param {string} value - value associated with the protectedKey
   */
  async storeRecord(txid: string, outputIndex: number, protectedKey: string, value: string): Promise<void> {
    await this.records.insertOne({
      txid,
      outputIndex,
      protectedKey,
      value,
      createdAt: new Date()
    })
  }

  /**
   * Deletes a matching KVStore record
   * @param {string} txid - transaction id
   * @param {number} outputIndex - index of the UTXO
   */
  async deleteRecord(txid: string, outputIndex: number): Promise<void> {
    await this.records.deleteOne({ txid, outputIndex })
  }

  /**
   * Finds matching records by protected key
   * @param {string} protectedKey - key used in the KVStore protocol
   * @returns {Promise<UTXOReference[]>} - returns matching UTXO references
   */
  async findByProtectedKey(protectedKey: string): Promise<UTXOReference[]> {
    if (!protectedKey) {
      return []
    }

    return this.records.find({ protectedKey })
      .project<UTXOReference>({ txid: 1, outputIndex: 1 })
      .toArray()
      .then(results => results.map(record => ({
        txid: record.txid,
        outputIndex: record.outputIndex
      })))
  }

  /**
   * Returns all records tracked by the overlay
   * @returns {Promise<UTXOReference[]>} - returns all UTXO references
   */
  async findAll(): Promise<UTXOReference[]> {
    return this.records.find({})
      .project<UTXOReference>({ txid: 1, outputIndex: 1 })
      .toArray()
      .then(results => results.map(record => ({
        txid: record.txid,
        outputIndex: record.outputIndex
      })))
  }
}