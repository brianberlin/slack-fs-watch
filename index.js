require('dotenv').config()
const fs = require('fs')
const AWS = require('aws-sdk')
const axios = require('axios')
const uuid = require('uuid').v4

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey:process.env.AWS_SECRET_ACCESS_KEY,
  apiVersion: '2006-03-01'
})

const files = []

const event = (eventType, filename) => {
  files.push({ eventType, filename })
}

fs.watch(`${__dirname}/`, { recursive: true }, event)

setInterval(async () => {
  if (!files.length) return

  const id = uuid()

  let text = files.map(x => `${x.filename} *${x.eventType}*`)

  try {
    await s3.putObject({
      Bucket: process.env.AWS_BUCKET,
      Key: id,
      Body: text.join('\n'),
      ContentType: 'text/html'
    }).promise()

    const url = await s3.getSignedUrl('getObject', {
      Bucket: process.env.AWS_BUCKET,
      Key: id,
      Expires: 60 * 60 * 24 * 30
    })

    const json = {
      attachments: [{
        pretext: `${process.env.WEBSITE}\n\t${text.slice(0, 4).join('\n\t')}`,
        title: 'FSWatch',
        title_link: url
      }]
    }

    console.log(JSON.stringify(json))
    await axios.post(process.env.WEBHOOK_URL, json)
  } catch (e) {
    console.log(e)
  }

  files.length = 0
}, 1000 * 60 * 30)
