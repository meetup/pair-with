# 👩‍💻 Pair With 👨‍💻 [![Build Status](https://travis-ci.org/meetup/pair-with.svg?branch=master)](https://travis-ci.org/meetup/pair-with)

a slack slash command for scheduling pair station time

### Useage
```
/pair-with @friend @stranger
```

### Local development set

I install node dependencies

```bash
$ npm install
```

Generate a local json database of @mention handles to email addresses

```bash
$ SLACK_BOT_TOKEN=tokenvalue node mentiondb-gen.js > mentiondb.json
```

create a json file called stationdb.json containing a json object with pairing station calendar ids to pairing station names

Copyright (c) 2017 Meetup
