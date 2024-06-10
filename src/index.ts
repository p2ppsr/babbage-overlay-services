import dotenv from 'dotenv'
import express from 'express'
import bodyparser from 'body-parser'
import { Engine, KnexStorage } from '@bsv/overlay'
import { WhatsOnChain, NodejsHttpClient, ARC, ArcConfig, MerklePath } from '@bsv/sdk'
import { MongoClient } from 'mongodb'
import https from 'https'
import Knex from 'knex'
import knexfile from '../knexfile.js'
import { HelloWorldTopicManager } from './helloworld-services/HelloWorldTopicManager.js'
import { HelloWorldLookupService } from './helloworld-services/HelloWorldLookupService.js'
import { HelloWorldStorage } from './helloworld-services/HelloWorldStorage.js'
import { spawn } from 'child_process'

const knex = Knex(knexfile.development)
const app = express()
dotenv.config()
app.use(bodyparser.json({ limit: '1gb', type: 'application/json' }))
app.use(bodyparser.raw({ limit: '1gb', type: 'application/octet-stream' }))

// Load environment variables
const {
  PORT,
  DB_CONNECTION,
  DB_NAME,
  NODE_ENV,
  HOSTING_DOMAIN,
  MIGRATE_KEY,
  TAAL_API_KEY
} = process.env
const HTTP_PORT = NODE_ENV !== 'development'
  ? 3000
  : (PORT !== undefined ? PORT : (PORT !== undefined ? PORT : 8080))

// Initialization the overlay engine
let engine: Engine
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
        callbackUrl: 'https://aa47-74-51-29-58.ngrok-free.app/arc-ingest', // TODO: Replace with ${HOSTING_DOMAIN}/arc-ingest
        callbackToken: 'fredFlinstones',
        httpClient: new NodejsHttpClient(https)
      }

      engine = new Engine(
        {
          tm_helloworld: new HelloWorldTopicManager()
        },
        {
          ls_helloworld: new HelloWorldLookupService(
            new HelloWorldStorage(mongoClient.db(DB_NAME as string))
          )
        },
        new KnexStorage(knex),
        new WhatsOnChain(
          NODE_ENV === 'production' ? 'main' : 'test',
          {
            httpClient: new NodejsHttpClient(https)
          }),
        new ARC('https://arc.taal.com', arcConfig)
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
        status: 'error'
        // description: error.message
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
        status: 'error'
        // code: error.code,
        // description: error.message
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
      return res.status(200).json(result)
    } catch (error) {
      return res.status(400).json({
        status: 'error'
        // code: error.code,
        // description: error.message
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
        status: 'error'
        // code: error.code,
        // description: error.message
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
      const taggedBEEF = {
        beef: Array.from(req.body as number[]),
        topics
      }

      const result = await engine.submit(taggedBEEF)
      return res.status(200).json(result)
    } catch (error) {
      console.error(error)
      return res.status(400).json({
        status: 'error'
        // code: error.code,
        // description: error.message
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
        status: 'error'
        // code: error.code,
        // description: error.message
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
        status: 'error'
        // code: error.code,
        // description: error.message
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
  })().catch(() => {
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
    })
  })
  .catch((error) => {
    console.error('Failed to initialize:', error)
    process.exit(1)
  })
