var socket = io();
var playerID;
var $userForm = $("#userForm");
var $userFormArea = $("#userFormArea");
var $users = $("#users");
var $userName = $("#username");
var $onlineUsersArea = $("#onlineUsers");
var $gameArea = $("#gameArea");
var $game = $("#game");
var $wordToWrite = $("#wordToWrite");
var $wordInput = $("#wordInput");
var $challenges = $("#challenges");
var $messages = $("#messageContainer");
var $scores = $("#scores");
var $nameContainer = $("#nameContainer");
var $myName = $("#myName");
var $opName = $("#opName");
var $sendButton = $("#sendButton");
var myChallenges = [];
var currentGame;
var roundCount = 1;

$(document).ready(function () {
    $userFormArea.fadeIn(500);
    $onlineUsersArea.hide();
    $gameArea.hide().removeClass("hidden");
    $nameContainer.hide().removeClass("hidden");
    $('#count_num').hide();
});

$userForm.submit(function (e) {
    e.preventDefault();
    socket.emit('new user', $userName.val(), function (data) {
        if (data) {
            $userFormArea.hide();
            $onlineUsersArea.fadeIn(1000).show(100);
            $myName.append($userName.val());
        }
    });
});

socket.on('get users', function (data) {
    var html = '';
    for (var i = 0; i < data.length; i++) {
        html += '<li class="list-group-item"><button style="cursor:pointer;" class="btn btn-default"  value="' + data[i].name +
            '" onclick="sendRequest(this)">' + data[i].name;
        if (data[i].id === socket.id) {
            html += '(you)</button></li>';
        } else {
            html += '</button></li>';
        }
    }
    $users.html(html);
});

function send() {
    socket.emit('send word', {
        sentWord: $wordInput.val(),
        game: currentGame
    });
}

function sendRequest(player) {
    socket.emit('new challenge', {
        playerChallenged: player.value
    });
}

socket.on('update challenges', function (data) {
    myChallenges = [];
    var html = '';
    var challenger;
    console.log(data.length);
    console.log(data);
    if (data.length !== 0) {
        for (var i = 0; i < data.length; i++) {
            if (data[i].challengedPlayer.id === data[i].challengerPlayer.id) {
                alert("You're challenging yourself? That's pretty sad. Unfortunately you can't do that anyway.");
                socket.emit('delete challenge', data[i].challengerPlayer.name);
                return;
            }
            if (data[i].challengedPlayer.id === socket.id) {
                myChallenges.push(data[i]);
                challenger = data[i].challengerPlayer.name;
                console.log("You've been challenged by " + challenger + "!");
                html += "<li class='list-group-item'>" +
                    "You have been challenged by " + challenger + ".&emsp;" +
                    "<button onclick='acceptChallenge(\""+ challenger +"\")' class='btn btn-success'>Accept</button>" +
                    "&nbsp;<button onclick='declineChallenge(\""+ challenger +"\")' class='btn btn-warning'>Decline</button></li>";
            }
        }
        for (var j = 0; j < data.length; j++) {
            if (data[j].challengerPlayer.id === socket.id) {
                html += '<li class="list-group-item">You have challenged someone! You can wait for their response or challenge someone else</li>';
            }
        }
    } else {
        html += '<li class="list-group-item">You currently have no challenges</li>';
    }

    $challenges.html(html);
    console.log(myChallenges);
});

function findChallenge(nameToFind) {
    var challenger = _.find(myChallenges, function(challenge) { return challenge.challengerPlayer.name === nameToFind; });
    return challenger.challengerPlayer.name;
}

function acceptChallenge(nameToAccept) {
    socket.emit('start new game', findChallenge(nameToAccept));
}

function declineChallenge(nameToDelete) {
    socket.emit('delete challenge', findChallenge(nameToDelete));
}

socket.on('new game', function (data) {
    $('#count_num').fadeIn("slow");
    $onlineUsersArea.hide();
    currentGame = data;
    $wordToWrite.html('<span id="highlight">' + currentGame.currentWord + '</span>');
    if (currentGame.playerOne.id === socket.id) {
        $opName.append(currentGame.playerTwo.name);
    } else {
        $opName.append(currentGame.playerOne.name);
    }

    function endCountdown() {
        $('#count_num').hide('fast');
        $gameArea.show("slow");
        $nameContainer.show("fast");
    }

    function handleTimer() {
        if(count === 0) {
            clearInterval(timer);
            endCountdown();
        } else {
            $('#count_num').html(count);
            count--;
        }
    }

    var count = 3;
    var timer = setInterval(function() { handleTimer(count); }, 1000);

    $wordInput.keyup(function(event){
        if(event.keyCode === 13){
            $sendButton.click();
        }
    });

});

socket.on('new word', function (data) {
    currentGame = data;
    $wordInput.val('');
    $wordToWrite.html('<span id="highlight">' + currentGame.currentWord + '</span>');
    $messages.html('');
    $sendButton.prop("disabled",false);
    $wordInput.prop("disabled",false);
});

socket.on('word incorrect', function (data) {
    $messages.html(data.message);
});

socket.on('round win', function (data) {
    $messages.html(data.message);
    $sendButton.prop("disabled",true);
    $wordInput.prop("disabled",true);
});

socket.on('round loss', function (data) {
    $messages.html(data.message);
    $sendButton.prop("disabled",true);
    $wordInput.prop("disabled",true);
});

socket.on('opponent left', function (data) {
    $sendButton.prop("disabled",true);
    $wordInput.prop("disabled",true);
    $messages.html('<p>Opponent has left the game.</p><p>Please press Leave Game to return to the lobby.</p>');
});

function leaveGame() {
    socket.emit('leave game');
    $sendButton.prop("disabled",false);
    $wordInput.prop("disabled",false);
    $gameArea.hide();
    $onlineUsersArea.show();
    $nameContainer.hide();
    $opName.html('Opponent: ');
    $messages.html('');
    $scores.html('');
    roundCount = 1;
    $wordInput.off("keyup");
}

socket.on('update scores', function (data) {
    var html = '';
    html += '<li class="list-group-item"><p>Round: '+ roundCount++ +'</p>&emsp;<p>Word was: ' + data.word + '</p>&emsp;' +
        '<p>Winner: ' + data.winner + '</p>&emsp;<p>Loser: ' + data.loser + '</p></li>';
    $scores.append(html);
});
