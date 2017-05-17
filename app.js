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

    socket.on('new challenge', function(data) {
        var playerChallenged = _.find(users, function(user) { return user.name === data.playerChallenged; });
        var challenger = _.find(users, function(user) { return user.name === socket.username; });
        var thisChallenge = {challengedPlayer: playerChallenged, challengerPlayer: challenger};
        challenges = _.reject(challenges, thisChallenge); //reject duplicate challenges
        challenges.push(thisChallenge);
        updateChallenges();
    });
    
    socket.on('disconnect', function() {
        if (!socket.username) return;
        for (var i = 0; i < users.length; i++) {
            users.splice(users[i].name.indexOf(socket.username), 1);
        }
        updateUserNames();
        console.log('socket ' + socket.username + ' has disconnected');

        console.log("Delete challenges of user "+ socket.username);
        challenges = _.reject(challenges, function(challenge) {
            return challenge.challengedPlayer.id === socket.id || challenge.challengerPlayer.id === socket.id;
        });
        updateChallenges();

        var deleteGame = _.find(games, function(game) {
            return game.playerOne.id === socket.id || game.playerTwo.id === socket.id ;
        });

        if (deleteGame) {
            console.log("Delete game: " + deleteGame + " of user "+ socket.username);
            _.pull(games, deleteGame);
            if (deleteGame.playerOne.id === socket.id) {
                io.to(deleteGame.playerTwo.id).emit('opponent left');
            } else {
                io.to(deleteGame.playerOne.id).emit('opponent left');
            }

        }
        console.log("Users on server: " + users.length);

    });

    socket.on('new user', function(data, callback) {
        callback(true);
        socket.username = data;
        if (_.find(users, function(user) {
                return user.name === socket.username;
            })) {
            var userTemp = socket.username + Math.floor(Math.random() * 1000)
            users.push({name: userTemp, id: socket.id});
            console.log(userTemp + " has joined the server!");
        } else {
            users.push({name: socket.username, id: socket.id});
            console.log(socket.username + " has joined the server!");
        }
        console.log("Users on server: " + users.length);
        updateUserNames();
    });

    socket.on('delete challenge', function(challenger) {
        var deletion = _.find(challenges, function(challenge) {
            return challenge.challengedPlayer.id === socket.id && challenge.challengerPlayer.name === challenger;
        });

        if (deletion) {
            console.log("Deleting challenge(s) for " + deletion.challengedPlayer.username);
            _.pull(challenges, deletion);
            io.to(deletion.challengedPlayer.id).emit('message challengedPlayer', challenges);
            updateChallenges();
        }
    });

    socket.on('send word', function(data) {
        var sentWord = data.sentWord;
        var actualWord = data.game.currentWord;
        console.log("User "+ socket.username + " sent word " + sentWord + ", actual word is " + actualWord);
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

    socket.on('start new game', function (challenger) {
        var challengeExists = _.find(challenges, function(challenge) {
            return challenge.challengedPlayer.id === socket.id && challenge.challengerPlayer.name === challenger;
        });

        if (challengeExists) {
            challenges = _.reject(challenges, challengeExists);
            challenges = _.reject(challenges, function(challenge) {
                return challenge.challengedPlayer.id === socket.id || challenge.challengerPlayer.id === socket.id;
            });
            challenges = _.reject(challenges, function(challenge) {
                return challenge.challengedPlayer.name === challenger || challenge.challengerPlayer.name === challenger;
            });
            updateChallenges();
            var newGame = {playerOne: challengeExists.challengerPlayer, playerTwo: challengeExists.challengedPlayer,
            currentWord: getRandomWord()};
            games.push(newGame);
            io.to(challengeExists.challengerPlayer.id).emit('new game', newGame);
            io.to(challengeExists.challengedPlayer.id).emit('new game', newGame);
            console.log("Starting game between " + challengeExists.challengerPlayer.name +
                " & " + challengeExists.challengedPlayer.name);
        }
    });

    socket.on('leave game', function () {
        var findGame = _.find(games, function(game) {
            return game.playerOne.id === socket.id || game.playerTwo.id === socket.id;
        });
        if (findGame) {
            console.log("User " + socket.username + " left game");
            _.pull(games, findGame);
            if (findGame.playerOne.id === socket.id) {
                io.to(findGame.playerTwo.id).emit('opponent left');
            } else {
                io.to(findGame.playerOne.id).emit('opponent left');
            }
        }
    });

    function updateUserNames() {
        io.sockets.emit('get users', users);
    }

    function updateChallenges() {
        io.sockets.emit('update challenges', challenges);
        if (challenges.length > 0) {
            console.log("Active challenges: ");
        } else {
            console.log("No active challenges!");
        }
        for (var i = 0; i < challenges.length; i++) {
            console.log(challenges[i]);
        }

    }

    function getRandomWord() {
        return _.sample(wordList);
    }

    function compareWords(word1, word2) {
        return (word1 === word2);
    }

});


