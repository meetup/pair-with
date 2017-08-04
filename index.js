'use strict';

require('dotenv').config()

// slack api
// https://github.com/slackapi/node-slack-sdk#posting-a-message-with-web-api
const WebClient = require('@slack/client').WebClient
const IncomingWebhook = require('@slack/client').IncomingWebhook
const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
const mentiondb = require('./mentiondb.json')

// google interface
const google = require("./freebusy.js")

// fixme: may need to respond quickly or slack ui will error out

// 3 add freebusy api call including pair stations + @mentions ...

// 5 profit


// return promise resolving to
// successful message payload or string error
const command = (cmd) => {
  return new Promise((resolve, reject) => {
    const mentions = cmd.text.trim().split(/\s+/)
    const emails = mentions.reduce(
      (acc, mention) => {
        const email = mentiondb[mention]
        if (email) {
          acc.push(email)
        }
        return acc
      }, []
    )
    if (emails.length < 1) {
      resolve({
        text: `Failed to find email addresses associated with ${cmd.text}.`
      })
      return
    }
    google.bookTime(mentiondb["@" + cmd.user_name], emails)
      .then((calendarResponse) => {
        resolve({
          text: `:woman_technologist::male_technologist: you're booked at ${calendarResponse.location}`,
           attachments: [
               { text:`you can change your pair session <${calendarResponse.htmlLink}|here>` }
            ]
        })
      })
      .catch(
      (err) => {
        console.log("error")
        console.log(err)
        resolve({
          text: `failed to book a room with ${cmd.text}: ${err}`
        })
      }
      )

  })
}

// authenticate request
const authenticate = (payload) => {
  return new Promise((resolve, reject) => {
    if (process.env.SLACK_SLASH_TOKEN == payload.token) {
      resolve(payload)
    } else {
      reject("Invalid token")
    }
  })
}

// cloud function module export
module.exports.pairWith = (req, res) => {
  console.log("this request was handled in a tz with offset of " + new Date().getTimezoneOffset())
  return authenticate(req.body)
    .then((cmd) => {
      return command(cmd).then(
        (payload) => {
          console.log("responding with...")
          console.dir(payload, { depth: 4, colors: true })
          res.json(payload)
        }
      ).catch(
        (err) => {
          console.log("responding with error")
          console.dir(err, { depth: 4, colors: true })
          res.json(payload)
        }
        )
    }
    ).catch(
    (err) => {
      console.log("command failed with error")
      console.dir(err, { depth: 4, colors: true })
      res.json({ text: err })
    }
    )
}
