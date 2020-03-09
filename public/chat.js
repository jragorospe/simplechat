var message_input = $("#message_input");
var g_nick = $("#nick");
var chatroom = $("#messages");
var nick_list = $("#nicks");
// random starting color
var g_nick_color = "#" + Math.floor(Math.random() * 16777215).toString(16);

function is_hex(hex) {
  return (
    typeof hex === "string" && hex.length === 6 && !isNaN(Number("0x" + hex))
  );
}
// https://stackoverflow.com/a/18652401
function set_cookie(key, value, expiry) {
  var expires = new Date();
  expires.setTime(expires.getTime() + expiry * 24 * 60 * 60 * 1000);
  document.cookie = key + "=" + value + ";expires=" + expires.toUTCString();
}

function get_cookie(key) {
  var keyValue = document.cookie.match("(^|;) ?" + key + "=([^;]*)(;|$)");
  return keyValue ? keyValue[2] : null;
}

function erase_cookie(key) {
  var keyValue = getCookie(key);
  setCookie(key, keyValue, "-1");
}

function help_message() {
  chatroom.append("<p>Type <i>/nick new_nick</i> to change your name, and <i>/nickcolor </i><a href=https://www.rapidtables.com/web/color/html-color-codes.html><i>RRGGBB</i></a> to change your color.</p>");
}

$(function() {
  //make connection
  var socket = io.connect(window.location.host);
  g_nick.css({ color: g_nick_color });

  // load the cookie and set the name if it exists
  var cookie_nick = get_cookie("nick");
  if (cookie_nick !== null) g_nick.text(cookie_nick);
  else g_nick.text("anon");
  socket.on("connect", function() {
    socket.emit("new_user", { nick: g_nick.text(), color: g_nick_color });
  });

  // send events
  function handle_message(message) {
    if (message.length == 0) return;

    // handle the two / commands
    if (message.toLowerCase().startsWith("/nickcolor ")) {
      var color = message.split(" ")[1];
      if (is_hex(color)) change_nick_color("#" + color);
      else chatroom.append("<p><b>color " + color + " is not valid!</b></p>");
    } else if (message.toLowerCase().startsWith("/nick ")) {
      var res = change_nick(message.split(" ")[1]);
      if (res != -1)
        chatroom.append(
          "<p><i>You are now known as: " + message.split(" ")[1] + "</i></p>"
        );
    } else send_message(message);
    message_input.val("");
  }

  function change_nick(nick) {
    if ($("li:contains('" + nick + "')").length !== 0) {
      chatroom.append("<p><b>nick " + nick + " is already taken</b></p>");
      return -1;
    }
    socket.emit("change_nick", { nick: nick });
    g_nick.text(nick);
    set_cookie("nick", nick, "100");
    return 0;
  }

  function change_nick_color(color) {
    g_nick_color = color;
    g_nick.css({ color: g_nick_color });
    socket.emit("change_color", { color: color });
    chatroom.append(
      "<p style='color:" + color + "'><b>Nick color changed</b></p>"
    );
  }

  function new_message(parsed_time, color, nick, text) {
    var template =
      "<p class='chat_message'>" +
      "<span class='time'>" +
      parsed_time +
      "</span>" +
      "<span style='color: " +
      color +
      "'>" +
      nick +
      "</span>: ";
    // if this user sent the message, bold it
    if (nick == g_nick.text()) text = "<b>" + text + "</b>";
    chatroom.append(template + text + "</p>");
  }

  function send_message(text) {
    socket.emit("send_message", {
      text: text
    });
  }

  message_input.on("keydown", function(e) {
    if (e.keyCode == 13) {
      handle_message(message_input.val());
    }
  });

  // listen for events
  socket.on("user_data", data => {
    g_nick.text(data.nick);
    g_nick.css({ color: data.color });
    set_cookie("nick", data.nick, "100");
  });
  socket.on("message_list", data => {
    // insert all existing messages on connect
    for (var index in data.messages) {
      var message = data.messages[index];
      var parsed_time = new Date(message.timestamp).toLocaleTimeString("en-US");
      new_message(parsed_time, message.color, message.nick, message.text);
    }
    $("#messages").animate(
      { scrollTop: $("#messages").prop("scrollHeight") },
      1000
    );
  });
  socket.on("user_list", data => {
    // insert all existing users on connect
    for (var index in data.users) {
      var user = data.users[index];
      nick_list.append(
        "<li style='color: " + user.color + "'>" + user.nick + "</li>"
      );
    }
  });

  socket.on("new_message", data => {
    // insert new message to the chat window
    var parsed_time = new Date(data.timestamp).toLocaleTimeString("en-US");
    new_message(parsed_time, data.color, data.nick, data.text);
    $("#messages").animate(
      { scrollTop: $("#messages").prop("scrollHeight") },
      1000
    );
  });
  socket.on("new_nick_color", data => {
    // find user in the user list and change their color
    $("li:contains('" + data.nick + "')").remove();
    nick_list.append(
      "<li style='color: " + data.color + "'>" + data.nick + "</li>"
    );
  });
  socket.on("new_nick", data => {
    chatroom.append(
      "<p>" + data.old_nick + " is now known as <b>" + data.nick + "</b></p>"
    );
    // remove the old nick and add the new one to the list of users
    $("li:contains('" + data.old_nick + "')").remove();
    nick_list.append(
      "<li style='color: " + data.color + "'>" + data.nick + "</li>"
    );
  });

  socket.on("user_join", data => {
    chatroom.append("<p><i>" + data.nick + " has joined");

    // add user to list of nicks
    nick_list.append(
      "<li style='color: " + data.color + "'>" + data.nick + "</li>"
    );
  });
  socket.on("user_leave", data => {
    chatroom.append("<p><i>" + data.nick + " has left");
    // remove leaving user
    $("li:contains('" + data.nick + "')").remove();
  });
});
