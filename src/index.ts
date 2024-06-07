import { getModelForClass, prop } from '@typegoose/typegoose'
import { Base } from '@typegoose/typegoose/lib/defaultClasses'
import { createWriteStream } from 'fs'
import * as jsontocsv from 'json-to-csv-stream'
import { LoremIpsum } from 'lorem-ipsum'
import { Types, connect } from 'mongoose'
import * as path from 'path'
import { Readable, Transform, pipeline } from 'stream'
import { promisify } from 'util'

const output = path.join(__dirname, 'output', 'output.csv')

const pipelineAsync = promisify(pipeline)

connect('mongodb://127.0.0.1:27017/poc-csv-to-s3')

class Msg implements Base {
  _id: Types.ObjectId
  id: string

  @prop()
  mobile: string

  @prop()
  body: string
}

const MsgModel = getModelForClass(Msg)

const findStream = new Transform({
  async transform(chunk, encoding, callback) {
    try {
      const docs = await MsgModel.find({}).lean()
      docs.forEach(doc => this.push(JSON.stringify(doc)))
      callback()
    } catch (err) {
      callback(err)
    }
  },
})

const generateDataStream = new Transform({
  async transform(chunk, encoding, callback) {
    try {
      const arr = Array.from({ length: 100000 }, (_, index) =>
        new LoremIpsum().generateSentences(1),
      )

      arr.forEach(doc => this.push(doc.toString()))
      callback()
    } catch (err) {
      callback(err)
    }
  },
})

const saveStream = new Transform({
  async transform(chunk, encoding, callback) {
    const msg = new MsgModel({
      mobile: '5551993650349',
      body: chunk.toString(),
    })

    await msg.save()
    callback()
  },
})

const readableStream = Readable.from(['start'])

const finalStream = createWriteStream(output)

async function createCsv() {
  console.time('csv')
  try {
    console.log(process.memoryUsage())
    await pipelineAsync(readableStream, findStream, jsontocsv(), finalStream)
    console.log(process.memoryUsage())
  } catch (e) {
    console.log(e)
  }
  console.timeEnd('csv')
}

async function createData() {
  console.time('createData')
  await pipelineAsync(Readable.from(['start']), generateDataStream, saveStream)
  console.timeEnd('createData')
}

async function run() {
  console.log('starting')

  setInterval(() => process.stdout.write('.'), 1000).unref()

  await createData()
  //await createCsv()

  process.exit()
}

run()
