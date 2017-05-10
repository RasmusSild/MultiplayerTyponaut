var express = require('express');
var app = express();
var serv = require('http').Server(app);

app.get('/', function(req, res) {
    res.sendFile(__dirname + '/client/index.html');
});
app.use('/client', express.static(__dirname + '/client'));

serv.listen(8080);
console.log("Server started at port 8080");

var SOCKET_LIST = {};

var io = require('socket.io')(serv,{});
io.sockets.on('connection', function(socket) {
    socket.id = Math.floor(Math.random() * 1000);
    console.log('socket ' + socket.id + ' connected');
    SOCKET_LIST[socket.id] = socket;
    
    socket.emit('newplayer', {
        player: socket.id
    })
    
    socket.on('test', function(data) {
        console.log(data.player + 'is correct!');
    });
    
    socket.on('disconnect', function() {
        console.log('socket ' + socket.id + ' has disconnected');
        delete SOCKET_LIST[socket.id];
    })
})
