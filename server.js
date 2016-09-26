var express = require('express'),
    app = express(),
    server = require("http").createServer(app),
    io = require("socket.io")(server),
    irc = require('irc'),
    mongodb = require('mongodb'),
    mongo,
    ircBot;
    
try{
    ircServerName = process.argv[2];
    channelName = "#" + process.argv[3];
    name = process.argv[4];
    ircBot = new irc.Client(ircServerName, name, { channels: [channelName]});
}
catch(e)
{
    console.log("Not connected to irc.")
    console.log("usage: node server.js ircServerName channelName nick");
}

function exitHandler(options, err) {
    if (options.cleanup){
        console.log('clean');
        mongo.close();
    }
    if (err) console.log(err.stack);
    if (options.exit) 
    {
        mongo.close();
        process.exit();
    }
}

//do something when app is closing
process.on('exit', exitHandler.bind(null,{cleanup:true}));

//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, {exit:true}));

//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, {exit:true}));


// Use connect method to connect to the Server
mongodb.MongoClient.connect("mongodb://localhost:27017/test", function (err, db) {
    if (err) 
    {
        console.log('Unable to connect to the mongoDB server. Error:', err);
    }
    else
    {
        console.log('Mongo connection established');
        mongo = db; 
    }
});

app.use(express.static(__dirname));

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});

app.get('/log', function(req, res) {
    var filepath = new Date().toDateString();
    try {
        mongo.collection("logs").find({}).toArray(function(err, result){
            if (err){
                console.log(err);
                res.send("failed to access db");   
            }
            else{
                console.log(result);
                res.send(result);
            }
            setTimeout(function(){
                log("tester", "testee", "testing, testing, I'm testing here");
            }, 2000);
        });
    } catch (e) {
        console.log(e);
        res.sendFile(__dirname + "/logs/test.txt"); 
    }
    
});

function log(from, to, message)
{
    var messageObject = 
    { 
        from: from, 
        to: to, 
        message: message, 
        date: new Date() 
    };
    
    io.emit("message", messageObject);
    mongo.collection("logs").insert(messageObject);
}
if (ircBot)
{
    ircBot.addListener('message', function (from, to, message) {
        console.log(from + ' => ' + to + ': ' + message);
        log(from, to, message);
    });

    ircBot.addListener('pm', function(nick, message) {
        console.log('Got private message from %s: %s', nick, message);
        log(nick, name, message);
    });
    ircBot.addListener('join', function(channel, who) {
        console.log('%s has joined %s', who, channel);
        log(undefined, undefined, who + " joined " + channel);
    });
    ircBot.addListener('part', function(channel, who, reason) {
        console.log('%s has left %s: %s', who, channel, reason);
        log(undefined, undefined, who + " left " + channel + ": " + reason);
    });
    ircBot.addListener('kick', function(channel, who, by, reason) {
        console.log('%s was kicked from %s by %s: %s', who, channel, by, reason);
        log(undefined, undefined, who + " was kicked from " + channel + " by " + by + ": " + reason);
    });
}

server.listen(8000);
console.log("listening on 8000");