#!/usr/bin/env node
const express = require("express");
var http = require('http');
var app = express();

//middlewares
app.use(express.static("public"));

//routes
app.get("/", (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

//Listen on port 3111
server = app.listen(3111);

//socket.io instantiation
const io = require("socket.io")(server);
var messages = [];
var existing_users = [];
var used_nicks = [];
//listen on every connection
io.on("connection", socket => {
  //default username
  socket.nick = "anon";
  socket.color = "#000000";

  // fired as soon as a user connects
  socket.on("new_user", data => {
    console.log("New user connected");
    socket.nick = "anon";
    socket.color = data.color;

    // generate a new nick
    var genned_nick = "anon" + Math.round(Math.random() * 1000);
    var same = true;
    while (same) {
      same = false;
      for (var index in used_nicks) {
        var user = used_nicks[index];
        if (user != genned_nick) {
          continue;
        } else {
          same = true;
          break;
        }
      }
    }
    used_nicks.push(genned_nick);

    // create user, if no cookie then use the generated nick
    if (data.nick == socket.nick) {
      socket.nick = used_nicks[used_nicks.length - 1];
    } else {
      // if we do have a cookie, make sure no one stole the nick in the meantime
      socket.nick = data.nick;
      for (var index in existing_users) {
        var user = existing_users[index];
        if (user.nick == data.nick) {
          socket.nick = used_nicks[used_nicks.length - 1];
          break;
        }
      }
    }
    // notify other users of the join
    socket.broadcast.emit("user_join", {
      nick: socket.nick,
      color: socket.color
    });
    // send the client all users and messages
    socket.emit("user_data", { nick: socket.nick, color: socket.color });
    socket.emit("user_list", { users: existing_users });
    socket.emit("message_list", { messages: messages });
    // add to list of users
    existing_users.push({ nick: socket.nick, color: socket.color });
  });

  // user requested a nick change
  socket.on("change_nick", data => {
    console.log(socket.nick + " requested a nick change: " + data.nick);
    // update list of users
    existing_users = existing_users.filter(function(el) {
      return el.nick != socket.nick;
    });
    // notify all other users of the change
    socket.broadcast.emit("new_nick", {
      nick: data.nick,
      old_nick: socket.nick,
      color: socket.color
    });
    existing_users.push({ nick: data.nick, color: socket.color });
    socket.nick = data.nick;
  });

  // user requested a color change
  socket.on("change_color", data => {
    console.log(socket.nick + " requested a color change: " + data.color);
    socket.color = data.color;
    // notify all other users of the change
    socket.broadcast.emit("new_nick_color", {
      nick: socket.nick,
      color: socket.color
    });
    // update list of users
    existing_users = existing_users.filter(function(el) {
      return el.nick != socket.nick;
    });
    existing_users.push({ nick: socket.nick, color: socket.color });
  });

  // user sent a message
  socket.on("send_message", data => {
    // only store 200 messages
    if (messages.length == 200) messages.shift();
    console.log("new message: " + data.text);
    message = {
      timestamp: Date.now(),
      color: socket.color,
      nick: socket.nick,
      text: data.text
    };
    messages.push(message);
    //broadcast to all users
    io.sockets.emit("new_message", message);
  });

  // user left the chat
  socket.on("disconnect", function() {
    console.log("Got disconnect!");
    // remove from active users and notify other users
    existing_users = existing_users.filter(function(el) {
      return el.nick != socket.nick;
    });
    io.sockets.emit("user_leave", {
      nick: socket.nick
    });
  });
});
