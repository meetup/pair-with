var WebClient = require('@slack/client').WebClient
var slack = new WebClient(process.env.SLACK_BOT_TOKEN);

//
slack.users.list((err, data) => {
    const mappings = data.members.reduce((acc, member) => {
        acc["@" + member.name] = member.profile.email
        return acc
    }, {});
    console.log(JSON.stringify(mappings))
})