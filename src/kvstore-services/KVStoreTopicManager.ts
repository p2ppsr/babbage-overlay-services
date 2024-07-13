import { AdmittanceInstructions, TopicManager } from '@bsv/overlay'
import { Transaction } from '@bsv/sdk'
import { decode } from 'pushdrop'
import { getDocumentation } from 'src/utils/getDocumentation.js'

export class KVStoreTopicManager implements TopicManager {
  /**
   * Identify if the outputs are admissible depending on the KVStore protocol requirements
   * @param beef - The transaction data in BEEF format
   * @param previousCoins - The previous coins to consider
   * @returns A promise that resolves with the admittance instructions
   */
  async identifyAdmissibleOutputs(beef: number[], previousCoins: number[]): Promise<AdmittanceInstructions> {
    const outputsToAdmit: number[] = []
    try {
      const parsedTransaction = Transaction.fromBEEF(beef)

      for (const [i, output] of parsedTransaction.outputs.entries()) {
        try {
          const result = decode({
            script: output.lockingScript.toHex(),
            fieldFormat: 'buffer'
          })

          if (result.fields.length !== 2) {
            throw new Error(`KVStore tokens have two PushDrop fields, but this token has ${result.fields.length} fields!`)
          }

          if (result.fields[0].byteLength !== 32) {
            throw new Error(`KVStore tokens have 32-byte protected keys in their first PushDrop field, but the key for this token has ${result.fields[0].byteLength} bytes!`)
          }

          // Add the index of this output to the list of outputs to admit
          outputsToAdmit.push(i)
        } catch (error) {
          // Log the error and continue processing other outputs
          console.error('Error decoding output:', error)
          continue  // Skip invalid outputs
        }
      }

      if (outputsToAdmit.length === 0) {
        console.error('No outputs admitted!')
      }
    } catch (error) {
      console.error('Error identifying admissible outputs:', error)
    }

    return {
      outputsToAdmit,
      coinsToRetain: previousCoins // TODO: Verify this is correct
    }
  }
  // identifyNeededInputs?: ((beef: number[]) => Promise<Array<{ txid: string outputIndex: number }>>) | undefined

  /**
   * Get the documentation associated with this topic manager
   * TODO: Extract docs to external import
   * @returns A promise that resolves to a string containing the documentation
   */
  async getDocumentation(): Promise<string> {
    return await getDocumentation('./docs/KVStore/kvstore-lookup-service.md')
  }

  /**
   * Get metadata about the topic manager
   * @returns A promise that resolves to an object containing metadata
   * @throws An error indicating the method is not implemented
   */
  async getMetaData(): Promise<{
    name: string
    shortDescription: string
    iconURL?: string
    version?: string
    informationURL?: string
  }> {
    throw new Error('Method not implemented.')
  }
}
