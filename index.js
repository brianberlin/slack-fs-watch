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

fs.watch(process.env.WATCH_DIRECTORY, { recursive: true }, event)

const process = async () => {
  console.log("Start")
  if (!files.length) return
  console.log("There are files.")
  const id = uuid()
  let text = files.map(x => `${x.filename} *${x.eventType}*`)

  try {
    await s3.putObject({
      Bucket: process.env.AWS_BUCKET,
      Key: id,
      Body: text.join('\n'),
      ContentType: 'text/html'
    }).promise()
    console.log("File Uploaded")

    const url = await s3.getSignedUrl('getObject', {
      Bucket: process.env.AWS_BUCKET,
      Key: id,
      Expires: 60 * 60 * 24 * 30
    })
    console.log("Signed URL")

    const json = {
      attachments: [{
        pretext: `${process.env.WEBSITE}\n\t${text.slice(0, 4).join('\n\t')}`,
        title: 'FSWatch',
        title_link: url
      }]
    }

    await axios.post(process.env.WEBHOOK_URL, json)
    console.log("Message Sent")
  } catch (e) {
    console.log("Error")
    console.log(e)
  }


  files.length = 0
}

setTimeout(process, 1000 * 10)
setInterval(process, 1000 * 60 * 30)
