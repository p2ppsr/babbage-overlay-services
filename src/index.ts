import dotenv from 'dotenv'
import express from 'express'
import bodyparser from 'body-parser'
import { Engine, KnexStorage, STEAK, TaggedBEEF } from '@bsv/overlay'
import { WhatsOnChain, NodejsHttpClient, ARC, ArcConfig, MerklePath } from '@bsv/sdk'
import { MongoClient } from 'mongodb'
import https from 'https'
import Knex from 'knex'
import knexfile from '../knexfile.js'
import { HelloWorldTopicManager } from './helloworld-services/HelloWorldTopicManager.js'
import { HelloWorldLookupService } from './helloworld-services/HelloWorldLookupService.js'
import { HelloWorldStorage } from './helloworld-services/HelloWorldStorage.js'
import { SHIPLookupService } from './peer-discovery-services/SHIP/SHIPLookupService.js'
import { SLAPLookupService } from './peer-discovery-services/SLAP/SLAPLookupService.js'
import { SHIPStorage } from './peer-discovery-services/SHIP/SHIPStorage.js'
import { SLAPStorage } from './peer-discovery-services/SLAP/SLAPStorage.js'
import { NinjaAdvertiser } from './peer-discovery-services/NinjaAdvertiser.js'
import { Advertiser } from '@bsv/overlay/Advertiser.ts'
import { SHIPTopicManager } from './peer-discovery-services/SHIP/SHIPTopicManager.js'
import { SLAPTopicManager } from './peer-discovery-services/SLAP/SLAPTopicManager.js'
import { spawn } from 'child_process'
import { UHRPStorage } from './data-integrity-services/UHRPStorage.js'
import { UHRPTopicManager } from './data-integrity-services/UHRPTopicManager.js'
import { UHRPLookupService } from './data-integrity-services/UHRPLookupService.js'

const knex = Knex(knexfile.development)
const app = express()
dotenv.config()
app.use(bodyparser.json({ limit: '1gb', type: 'application/json' }))
app.use(bodyparser.raw({ limit: '1gb', type: 'application/octet-stream' }))

// Load environment variables
const {
  PORT,
  DB_CONNECTION,
  NODE_ENV,
  HOSTING_DOMAIN,
  MIGRATE_KEY,
  TAAL_API_KEY,
  SERVER_PRIVATE_KEY,
  DOJO_URL
} = process.env
const HTTP_PORT = NODE_ENV !== 'development'
  ? 3000
  : (PORT !== undefined ? PORT : (PORT !== undefined ? PORT : 8080))

const SLAP_TRACKERS = [`https://${NODE_ENV === 'production' ? '' : 'staging-'}overlay.babbage.systems`]
const SHIP_TRACKERS = [`https://${NODE_ENV === 'production' ? '' : 'staging-'}overlay.babbage.systems`]

// Initialization the overlay engine
let engine: Engine
let ninjaAdvertiser: Advertiser
const initialization = async () => {
  console.log('Starting initialization...')
  try {
    const mongoClient = new MongoClient(DB_CONNECTION as string)
    await mongoClient.connect()

    // Create a new overlay Engine configured with:
    // - a topic manager
    // - a lookup service, configured with MongoDB storage client
    // - the default Knex storage provider for the Engine
    // - the default chaintracker for merkle proof validation
    console.log('Initializing Engine...')
    try {
      // Configuration for ARC
      const arcConfig: ArcConfig = {
        deploymentId: '1',
        apiKey: TAAL_API_KEY,
        callbackUrl: `${HOSTING_DOMAIN as string}/arc-ingest`,
        callbackToken: 'fredFlinstones',
        httpClient: new NodejsHttpClient(https)
      }

      // Create storage instances
      const helloStorage = new HelloWorldStorage(mongoClient.db(`${NODE_ENV as string}_helloworld_lookupService`))
      const uhrpStorage = new UHRPStorage(mongoClient.db(`${NODE_ENV as string}_uhrp_lookupService`))
      const shipStorage = new SHIPStorage(mongoClient.db(`${NODE_ENV as string}_ship_lookupService`))
      const slapStorage = new SLAPStorage(mongoClient.db(`${NODE_ENV as string}_slap_lookupService`))

      ninjaAdvertiser = new NinjaAdvertiser(
        SERVER_PRIVATE_KEY as string,
        DOJO_URL as string,
        HOSTING_DOMAIN as string
      )

      engine = new Engine(
        {
          tm_helloworld: new HelloWorldTopicManager(),
          tm_uhrp: new UHRPTopicManager(),
          tm_ship: new SHIPTopicManager(),
          tm_slap: new SLAPTopicManager()
        },
        {
          ls_helloworld: new HelloWorldLookupService(helloStorage),
          ls_uhrp: new UHRPLookupService(uhrpStorage),
          ls_ship: new SHIPLookupService(shipStorage),
          ls_slap: new SLAPLookupService(slapStorage)
        },
        new KnexStorage(knex),
        new WhatsOnChain(
          NODE_ENV === 'production' ? 'main' : 'test',
          {
            httpClient: new NodejsHttpClient(https)
          }),
        HOSTING_DOMAIN as string,
        SHIP_TRACKERS,
        SLAP_TRACKERS,
        new ARC('https://arc.taal.com', arcConfig),
        ninjaAdvertiser
      )
      console.log('Engine initialized successfully')
    } catch (engineError) {
      console.error('Error during Engine initialization:', engineError)
      throw engineError
    }
  } catch (error) {
    console.error('Initialization failed:', error)
    throw error
  }
}

// This allows the API to be used everywhere when CORS is enforced
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', '*')
  res.header('Access-Control-Allow-Methods', '*')
  res.header('Access-Control-Expose-Headers', '*')
  res.header('Access-Control-Allow-Private-Network', 'true')
  if (req.method === 'OPTIONS') {
    res.sendStatus(200)
  } else {
    next()
  }
})

// Serve a static documentation site, if you have one.
app.use(express.static('public'))

// List hosted topic managers and lookup services
app.get('/listTopicManagers', (req, res) => {
  (async () => {
    try {
      const result = await engine.listTopicManagers()
      return res.status(200).json(result)
    } catch (error) {
      return res.status(400).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'An unknown error occurred'
      })
    }
  })().catch(() => {
    // This catch is for any unforeseen errors in the async IIFE itself
    res.status(500).json({
      status: 'error',
      message: 'Unexpected error'
    })
  })
})

app.get('/listLookupServiceProviders', (req, res) => {
  (async () => {
    try {
      const result = await engine.listLookupServiceProviders()
      return res.status(200).json(result)
    } catch (error) {
      return res.status(400).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'An unknown error occurred'
      })
    }
  })().catch(() => {
    res.status(500).json({
      status: 'error',
      message: 'Unexpected error'
    })
  })
})

// Host documentation for the services
app.get('/getDocumentationForTopicManager', (req, res) => {
  (async () => {
    try {
      const result = await engine.getDocumentationForTopicManager(req.query.manager)
      res.setHeader('Content-Type', 'text/markdown')
      return res.status(200).send(result)
    } catch (error) {
      return res.status(400).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'An unknown error occurred'
      })
    }
  })().catch(() => {
    res.status(500).json({
      status: 'error',
      message: 'Unexpected error'
    })
  })
})

app.get('/getDocumentationForLookupServiceProvider', (req, res) => {
  (async () => {
    try {
      const result = await engine.getDocumentationForLookupServiceProvider(req.query.lookupServices)
      return res.status(200).json(result)
    } catch (error) {
      return res.status(400).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'An unknown error occurred'
      })
    }
  })().catch(() => {
    res.status(500).json({
      status: 'error',
      message: 'Unexpected error'
    })
  })
})

// Submit transactions and facilitate lookup requests
app.post('/submit', (req, res) => {
  (async () => {
    try {
      // Parse out the topics and construct the tagged BEEF
      const topics = JSON.parse(req.headers['x-topics'] as string)
      const taggedBEEF: TaggedBEEF = {
        beef: Array.from(req.body as number[]),
        topics
      }

      // Using a callback function, we can just return once our steak is ready
      // instead of having to wait for all the broadcasts to occur.
      await engine.submit(taggedBEEF, (steak: STEAK) => {
        return res.status(200).json(steak)
      })

    } catch (error) {
      console.error(error)
      return res.status(400).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'An unknown error occurred'
      })
    }
  })().catch(() => {
    res.status(500).json({
      status: 'error',
      message: 'Unexpected error'
    })
  })
})

app.post('/lookup', (req, res) => {
  (async () => {
    try {
      const result = await engine.lookup(req.body)
      return res.status(200).json(result)
    } catch (error) {
      console.error(error)
      return res.status(400).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'An unknown error occurred'
      })
    }
  })().catch(() => {
    res.status(500).json({
      status: 'error',
      message: 'Unexpected error'
    })
  })
})

app.post('/arc-ingest', (req, res) => {
  (async () => {
    try {
      console.log('txid', req.body.txid)
      console.log('merklePath', req.body.merklePath)
      const merklePath = MerklePath.fromHex(req.body.merklePath)
      await engine.handleNewMerkleProof(req.body.txid, merklePath)
      return res.status(200)
    } catch (error) {
      console.error(error)
      return res.status(400).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'An unknown error occurred'
      })
    }
  })().catch(() => {
    res.status(500).json({
      status: 'error',
      message: 'Unexpected error'
    })
  })
})

app.post('/migrate', (req, res) => {
  (async () => {
    if (
      typeof MIGRATE_KEY === 'string' &&
      MIGRATE_KEY.length > 10 &&
      req.body.migratekey === MIGRATE_KEY
    ) {
      const result = await knex.migrate.latest()
      res.status(200).json({
        status: 'success',
        result
      })
    } else {
      res.status(401).json({
        status: 'error',
        code: 'ERR_UNAUTHORIZED',
        description: 'Access with this key was denied.'
      })
    }
  })().catch((error) => {
    console.error('ERR', error)
    res.status(500).json({
      status: 'error',
      message: 'Unexpected error'
    })
  })
})

// 404, all other routes are not found.
app.use((req, res) => {
  console.log('404', req.url)
  res.status(404).json({
    status: 'error',
    code: 'ERR_ROUTE_NOT_FOUND',
    description: 'Route not found.'
  })
})

// Start your Engines!
initialization()
  .then(() => {
    app.listen(HTTP_PORT, () => {
      console.log(`BSV Overlay Services Engine is listening on port ${HTTP_PORT}`)
      if (NODE_ENV !== 'development') {
        spawn('nginx', [], { stdio: [process.stdin, process.stdout, process.stderr] })
      }
      (async () => {
        // Make sure we have advertisements for all the topics / lookup services we support.
        try {
          await engine.syncAdvertisements()
        } catch (error) {
          console.error('Failed to sync advertisements:', error)
        }
      })().catch((error) => {
        console.error('Unexpected error occurred:', error)
      })
    })
  })
  .catch((error) => {
    console.error('Failed to initialize:', error)
    process.exit(1)
  })
