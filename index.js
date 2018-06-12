const config = require('dotenv').config()
const watch = require('node-watch')
const AWS = require('aws-sdk')
const axios = require('axios')
const uuid = require('uuid').v4

const s3 = new AWS.S3({
  accessKeyId: config.parsed.AWS_ACCESS_KEY_ID,
  secretAccessKey:config.parsed.AWS_SECRET_ACCESS_KEY,
  apiVersion: '2006-03-01'
})

const files = []

const event = (eventType, filename) => {
  files.push({ eventType, filename })
}

watch(config.parsed.WATCH_DIRECTORY, { recursive: true }, event)

const func = async () => {
  console.log("Start", files)
  if (!files.length) return
  console.log("There are files.")
  const id = uuid()
  let text = files.map(x => `${x.filename} *${x.eventType}*`)

  try {
    await s3.putObject({
      Bucket: config.parsed.AWS_BUCKET,
      Key: id,
      Body: text.join('\n'),
      ContentType: 'text/html'
    }).promise()
    console.log("File Uploaded")

    const url = await s3.getSignedUrl('getObject', {
      Bucket: config.parsed.AWS_BUCKET,
      Key: id,
      Expires: 60 * 60 * 24 * 30
    })
    console.log("Signed URL")

    const json = {
      attachments: [{
        pretext: `${config.parsed.WEBSITE}\n\t${text.slice(0, 4).join('\n\t')}`,
        title: `FSWatch - ${config.parsed.WEBSITE}`,
        title_link: url
      }]
    }

    await axios.post(config.parsed.WEBHOOK_URL, json)
    console.log("Message Sent")
  } catch (e) {
    console.log("Error")
    console.log(e)
  }


  files.length = 0
}

setInterval(func, 1000 * Number(config.parsed.INTERVAL_IN_SECONDS))
