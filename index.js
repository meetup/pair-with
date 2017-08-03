'use strict';

require('dotenv').config()

// return promise resolving to
// successful message payload or string error
const command = (cmd) => {
  return new Promise((resolve, reject) => {
    resolve({
      text: `Well hello there ${cmd.user_name}. Looks like you figured this much out. Go <https://api.slack.com/slash-commands|here> next`
    })
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
  return authenticate(req.body)
    .then((cmd) => {
        command(cmd).then(
          (payload) => res.json(payload)
        )
    }).catch(
      (err) => res.json({ text: err })
    )
}
