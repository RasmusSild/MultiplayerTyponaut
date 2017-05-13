var express = require('express');
var app = express();
var serv = require('http').Server(app);
var _ = require('lodash');
var wordList =  require('./words').wordList;

app.get('/', function(req, res) {
    res.sendFile(__dirname + '/client/index.html');
});
app.use('/public', express.static(__dirname + '/public'));
app.use('/client', express.static(__dirname + '/client'));

serv.listen(8080);
console.log("Server started at port 8080");

users = [];
challenges = [];
games = [];

var io = require('socket.io')(serv,{});
io.sockets.on('connection', function(socket) {
    //socket.id = Math.floor(Math.random() * 1000);
    //console.log('socket ' + socket.id + ' connected');
    //SOCKET_LIST[socket.id] = socket;
    
    /*socket.emit('newplayer', {
        player: socket.id
    });*/
    
    socket.on('test', function(data) {
        console.log(data.player + ' is correct!');
    });

    socket.on('new challenge', function(data) {
        var playerChallenged = _.find(users, function(user) { return user.name === data.playerChallenged; });
        var challenger = _.find(users, function(user) { return user.name === socket.username; });
        var thisChallenge = {challengedPlayer: playerChallenged, challengerPlayer: challenger};
        challenges = _.reject(challenges, thisChallenge); //reject duplicate challenges
        challenges.push(thisChallenge);
        updateChallenges();
        console.log(challenges);
    });
    
    socket.on('disconnect', function() {
        if (!socket.username) return;
        for (var i = 0; i < users.length; i++) {
            users.splice(users[i].name.indexOf(socket.username), 1);
        }
        updateUserNames();
        console.log('socket ' + socket.username + ' has disconnected');
        console.log(users);
    });

    socket.on('new user', function(data, callback) {
        callback(true);
        socket.username = data;
        console.log(users.indexOf(socket.username, 0));
        if (users.indexOf(socket.username, 0) >= 0) {
            var userTemp = socket.username + Math.floor(Math.random() * 1000)
            users.push({name: userTemp, id: socket.id});
            console.log(userTemp + " has joined the server!");
        } else {
            users.push({name: socket.username, id: socket.id});
            console.log(socket.username + " has joined the server!");
        }
        console.log(users);
        updateUserNames();
    });

    socket.on('delete challenge', function(challenger) {
        //if (_.includes(challenges, data)) _.pull(challenges, data);
        var deletion = _.find(challenges, function(challenge) {
            return challenge.challengedPlayer.id === socket.id && challenge.challengerPlayer.name === challenger;
        });

        if (deletion) {
            console.log(deletion);
            _.pull(challenges, deletion);
        }

        io.to(deletion.challengedPlayer.id).emit('message challengedPlayer', challenges);
        console.log(challenges);
    });

    socket.on('get new word', function(data) {
        var word = getRandomWord();
        console.log(word);
    });

    socket.on('update scores', function(data) {

    });

    socket.on('send word', function(data) {
        var sentWord = data.sentWord;
        var actualWord = data.game.currentWord;
        console.log(sentWord);
        console.log(actualWord);
        if (compareWords(sentWord, actualWord)) {
            socket.emit('round win', {
                winner: socket.username,
                game: data.game,
                message: "You win this round!"
            });
            socket.emit('update scores', {
                winner: data.game.playerOne.id === socket.id ? socket.username : data.game.playerTwo.name,
                loser: data.game.playerOne.id !== socket.id ? data.game.playerOne.name : data.game.playerTwo.name,
                word: actualWord,
                game: data.game
            });
            if (data.game.playerOne.id === socket.id) {
                io.to(data.game.playerTwo.id).emit('round loss', {
                    winner: socket.username,
                    game: data.game,
                    message: "You lost, try to be quicker on the next one"
                });
                io.to(data.game.playerTwo.id).emit('update scores', {
                    winner: socket.username,
                    loser: data.game.playerTwo.name,
                    word: actualWord,
                    game: data.game
                });
            } else {
                io.to(data.game.playerOne.id).emit('round loss', {
                    winner: socket.username,
                    game: data.game,
                    message: "You lost, try to be quicker on the next one"
                });
                io.to(data.game.playerOne.id).emit('update scores', {
                    winner: socket.username,
                    loser: data.game.playerOne.name,
                    word: actualWord,
                    game: data.game
                });
            }
            var game = _.find(games, function(game) {
                return game.playerOne.id === socket.id || game.playerTwo.id === socket.id;
            });
            if (game) {
                game.currentWord = getRandomWord();
            }
            function sendRequests(){
                io.to(game.playerOne.id).emit('new word', game);
                io.to(game.playerTwo.id).emit('new word', game);
            }
            setTimeout(sendRequests, 3000);

        } else {
            socket.emit('word incorrect', {
                message: "Word incorrect, please try again",
                game: data.game
            });
        }
    });

    socket.on('round loss', function(data) {

    });

    socket.on('round win', function(data) {

    });

    socket.on('start new game', function (challenger) {
        var challengeExists = _.find(challenges, function(challenge) {
            return challenge.challengedPlayer.id === socket.id && challenge.challengerPlayer.name === challenger;
        });

        if (challengeExists) {
            challenges = _.reject(challenges, challengeExists);
            var newGame = {playerOne: challengeExists.challengerPlayer, playerTwo: challengeExists.challengedPlayer,
            currentWord: getRandomWord()};
            games.push(newGame);
            io.to(challengeExists.challengerPlayer.id).emit('new game', newGame);
            io.to(challengeExists.challengedPlayer.id).emit('new game', newGame);
            console.log(newGame);
        }
    });

    socket.on('new word request', function (data) {

    });

    function updateUserNames() {
        io.sockets.emit('get users', users);
    }

    function updateChallenges() {
        io.sockets.emit('update challenges', challenges);
    }

    function getRandomWord() {
        return _.sample(wordList);
    }

    function compareWords(word1, word2) {
        return (word1 === word2);
    }

});


