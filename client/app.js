/*---------------------------Helpers---------------------------*/
// Removes the contents of the given DOM element (equivalent to elem.innerHTML = '' but faster)
function emptyDOM (elem){
    while (elem.firstChild) elem.removeChild(elem.firstChild);
}

// Creates a DOM element from the given HTML string
function createDOM (htmlString){
    let template = document.createElement('template');
    template.innerHTML = htmlString.trim();
    return template.content.firstChild;
}

// Source for sanitization: https://stackoverflow.com/a/48226843
function sanitize(string) {
  const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '"',
      "'": '&#x27;',
      '/': '/',
  };
  const reg = /[&<>"'/]/ig;
  return string.replace(reg, (match)=>(map[match]));
}

var profile = {username : "Alice"};

var Service = {
  origin : window.location.origin,

  getAllRooms : function() {
    var request = new XMLHttpRequest();
    request.open("GET", this.origin + "/chat");
    var result = new Promise((resolve, reject) => {
      request.onload = function() {
        if (request.status == 200) {
          resolve(JSON.parse(request.responseText));
        } else {
          reject(new Error (request.responseText));
        }
      };

      request.onerror = function(error) {
        reject(new Error (error));
      };
    });
    request.send();
    return result;
  },

  addRoom : function(data) {
    var request = new XMLHttpRequest();
    request.open("POST", this.origin + "/chat");
    request.setRequestHeader('Content-Type', 'application/json');
    var result = new Promise((resolve, reject) => {
      request.onload = function() {
        if (request.status == 200) {
          resolve(JSON.parse(request.responseText));
        } else {
          reject(new Error (request.responseText));
        }
      };

      request.onerror = function(error) {
        reject(new Error (error));
      };
    });
    request.send(JSON.stringify(data));
    return result;
  },

  getLastConversation : function(roomId, before) {
    var request = new XMLHttpRequest();
    request.open("GET", this.origin + "/chat/"+ roomId +"/messages?before="+ before);
    
    var result = new Promise((resolve, reject) => {
      request.onload = function() {
        if (request.status == 200) {
          resolve(JSON.parse(request.responseText));
        } else {
          reject(new Error (request.responseText));
        }
      };

      request.onerror = function(error) {
        reject(new Error (error));
      };
    });
    request.send(null);
    return result;
  },

  getProfile : function() {
    var request = new XMLHttpRequest();
    request.open("GET", this.origin + "/profile");
    
    var result = new Promise((resolve, reject) => {
      request.onload = function() {
        if (request.status == 200) {
          resolve(JSON.parse(request.responseText));
        } else {
          reject(new Error (request.responseText));
        }
      };

      request.onerror = function(error) {
        reject(new Error (error));
      };
    });
    request.send(null);
    return result;
  }
}

function* makeConversationLoader(room) {
  var lastTime = room.timestamp;
  while (room.canLoadConversation) {
    room.canLoadConversation = false;

    yield new Promise((resolve, reject) => {
      Service.getLastConversation(room.id, lastTime).then((conversation) => {
        if (conversation != null) {
          lastTime = conversation.timestamp;
          room.addConversation(conversation);
          room.canLoadConversation = true;
          resolve(conversation);
        } else {
          resolve(null);
        }},
        (error) => {
          console.log(error);
        });
    });
  }
}

/*---------------------------Classes---------------------------*/
class LobbyView {
  constructor(lobby) {
    let that = this;

    this.elem = createDOM(
    `<div class = "content">
      <ul class = "room-list">
        <li>
          <a href="#/chat/room-1"><img src="/assets/everyone-icon.png">Everyone in CPEN322</a>
        </li>
        <li>
          <a href="#/chat/room-1"><img src="/assets/bibimbap.jpg">Foodies Only</a>
        </li>
        <li>
          <a href="#/chat/room-1"><img src="/assets/minecraft.jpg">Gamers Unite</a>
        </li>
        <li>
          <a href="#/chat/room-1"><img src="/assets/canucks.png">Canuks Fans</a>
        </li>
      </ul>
      <div class = "page-control">
        <input type="text" placeholder = "Room Title">
        <button>Create Room</button>
      </div>
    </div>`);
    this.listElem = this.elem.querySelector("ul.room-list");
    this.inputElem = this.elem.querySelector("input");
    this.buttonElem = this.elem.querySelector("button");
    this.lobby = lobby;
    this.lobby.onNewRoom = function(room) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      var roomName = document.createTextNode(room.name);
      var image = document.createElement("img");
      image.src = room.image;
      a.appendChild(roomName);
      a.insertBefore(image, a.firstChild);
      a.href = "#/chat/" + room.id;
      li.appendChild(a);
      that.listElem.appendChild(li);
    };

    this.redrawList();

    this.buttonElem.addEventListener('click', function(){
      var roomTitle = that.inputElem.value;
      Service.addRoom({name: roomTitle, image: "assets/bibimbap.jpg"})
      .then((result) => {
        that.lobby.addRoom(result._id, result.name);
        that.inputElem.value = "";
      },
      (error) => {
        reject(error);
      });
    })
  }

  redrawList() {
    emptyDOM(this.listElem);

    for (var key in this.lobby.rooms) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      var roomName = document.createTextNode(this.lobby.rooms[key].name);
      var image = document.createElement("img");
      image.src = this.lobby.rooms[key].image;
      a.appendChild(roomName);
      a.insertBefore(image, a.firstChild);
      a.href = "#/chat/" + this.lobby.rooms[key].id;
      li.appendChild(a);
      this.listElem.appendChild(li);
    }
  }
}

class ChatView {
  constructor(socket) {
    this.elem = createDOM(
    `<div class = "content">
      <h4 class = "room-name">
          Everyone in CPEN322
      </h4>
      <div class = "message-list">
          <div class = "message my-message">
              <span class = "message-user">James</span>
              <span class = "message-text">Hi guys!</span>
          </div>
          <div class = "message">
              <span class = "message-user">Eason</span>
              <span class = "message-text">How is everyone doing today?</span>
          </div>
          <div class = "message my-message">
            <span class = "message-user">James</span>
            <span class = "message-text">Not bad! I just started my project though.</span>
          </div>
          <div class = "message">
            <span class = "message-user">Patrick</span>
            <span class = "message-text">I finished all of them days ago.</span>
          </div>
          <div class = "message">
            <span class = "message-user">Eason</span>
            <span class = "message-text">That's nice! No worries James, you can do this!</span>
          </div>
          <div class = "message my-message">
            <span class = "message-user">James</span>
            <span class = "message-text">Yeah, thank you!</span>
          </div>
      </div>
      <div class = "page-control">
          <textarea></textarea>
          <button>Send</button>
      </div>
    </div>`);
    this.titleElem = this.elem.querySelector("h4");
    this.chatElem = this.elem.querySelector("div.message-list");
    this.inputElem = this.elem.querySelector("textarea");
    this.buttonElem = this.elem.querySelector("button");
    this.room = null;
    this.socket = socket;

    var self = this;

    this.buttonElem.addEventListener('click', function() {
      self.sendMessage();
    });
    this.inputElem.addEventListener('keyup', function(event) {
      if (event.keyCode == 13 && !event.shiftKey) {
        self.sendMessage();
      }
    });

    this.chatElem.addEventListener('wheel', function(event) {
      if (self.chatElem.scrollTop <= 0 && event.deltaY < 0 && self.room.canLoadConversation == true) {
        self.room.getLastConversation.next();
      }
    });
  }

  sendMessage() {
    var msg = this.inputElem.value;
    if (this.room != null) {
      this.room.addMessage(profile.username, msg);
      this.socket.send(JSON.stringify({roomId:this.room.id, text:msg}));
      this.inputElem.value = "";
    }
  }

  setRoom(room) {
    this.room = room;
    this.titleElem.innerText = room.name;
    emptyDOM(this.chatElem);
    let that = this;

    this.room.messages.forEach(element => {
      var div = document.createElement("div");
      var span_user = document.createElement("span");
      var span_text = document.createElement("span");
      var txt_user = document.createTextNode(element.username);
      var txt_text = document.createTextNode(element.text);
      span_user.appendChild(txt_user);
      span_text.appendChild(txt_text);
      span_user.className = "message-user";
      span_text.className = "message-text";
      div.appendChild(span_text);
      div.insertBefore(span_user, div.firstChild);
      if (element.username != profile.username) {
        div.className = "message";
      } else {
        div.className = "message my-message";
      }
      that.chatElem.appendChild(div);
    });

    this.room.onNewMessage = function(message) {
      var div = document.createElement("div");
      var span_user = document.createElement("span");
      var span_text = document.createElement("span");
      var txt_user = document.createTextNode(message.username);
      var txt_text = document.createTextNode(message.text);
      span_user.appendChild(txt_user);
      span_text.appendChild(txt_text);
      span_user.className = "message-user";
      span_text.className = "message-text";
      div.appendChild(span_text);
      div.insertBefore(span_user, div.firstChild);
      if (message.username != profile.username) {
        div.className = "message";
      } else {
        div.className = "message my-message";
      }
      that.chatElem.appendChild(div);
    }

    this.room.onFetchConversation = function(conversation) {
      var downward = that.chatElem.scrollHeight;

      conversation.messages.slice().reverse().forEach((message) => {
        var div = document.createElement("div");
        var span_user = document.createElement("span");
        var span_text = document.createElement("span");
        var txt_user = document.createTextNode(message.username);
        var txt_text = document.createTextNode(message.text);
        span_user.appendChild(txt_user);
        span_text.appendChild(txt_text);
        span_user.className = "message-user";
        span_text.className = "message-text";
        div.appendChild(span_text);
        div.insertBefore(span_user, div.firstChild);
        if (message.username != profile.username) {
          div.className = "message";
        } else {
          div.className = "message my-message";
        }

        that.chatElem.insertBefore(div, that.chatElem.firstChild);
      })

      var upward = that.chatElem.scrollHeight;
      that.chatElem.scrollTop = upward - downward;
    }
  }
}

class ProfileView {
  constructor() {
    this.elem = createDOM(
    `<div class = "content">
      <div class = "profile-form">
          <div class = "form-field">
              <label>Username</label>
              <input type = "text">
          </div>
          <div class = "form-field">
              <label>Password</label>
              <input type = "password">
          </div>
          <div class = "form-field">
              <label>Avatar Image</label>
              <img src = "/assets/profile-icon.png">
              <input type = "file">
          </div>
          <div class = "form-field">
              <label>About</label>
              <textarea></textarea>
          </div>
      </div>
      <div class = "page-control">
          <button>Save</button>
      </div>
    </div>`);
  }
}

class Room {
  constructor(id, name, image, messages) {
    this.id = id;
    this.name = name;
    this.timestamp = Date.now();
    if (image == undefined) {
      this.image = "assets/everyone-icon.png";
    } else {
      this.image = image;
    }

    if (messages == undefined) {
      this.messages = [];
    } else {
      this.messages = messages;
    }

    this.getLastConversation = makeConversationLoader(this);
    this.canLoadConversation = true;
  }

  addMessage(username, text) {
    if (text.trim() == "") {
      return;
    } else {
      this.messages.push({username:username, text:text});
    }

    if(this.onNewMessage != undefined) {
      this.onNewMessage({username:username, text:text});
    }
  }

  addConversation(conversation) {
    conversation.messages.slice().reverse().forEach((message) => {
      this.messages.unshift(message);
    })

    this.onFetchConversation(conversation);
  }
}

class Lobby {
  constructor() {
    // var room1 = new Room(1, "Everyone in CPEN322", "assets/everyone-icon.png", []);
    // var room2 = new Room(2, "Foodies Only", "assets/bibimbap.jpg", []);
    // var room3 = new Room(3, "Gamers Unite", "assets/minecraft.jpg", []);
    // var room4 = new Room(4, "Canuks Fans", "assets/canucks.png", []);

    // this.rooms = {1:room1, 2:room2, 3:room3, 4:room4};
    this.rooms = {};
  }

  getRoom(roomId) {
    if (!(roomId in this.rooms)) {
      return;
    } else {
      return this.rooms[roomId];
    }
  }

  addRoom(id, name, image, messages) {
    var room = new Room(id, name, image, messages);
    this.rooms[id] = room;

    if(this.onNewRoom != undefined) {
      this.onNewRoom(room);
    }
  }
}

/*---------------------------Main Function---------------------------*/
function main() {
  var lobby = new Lobby();
  var lobbyView = new LobbyView(lobby);
  var socket = new WebSocket('ws://localhost:8000');
  var chatView = new ChatView(socket);
  var profileView = new ProfileView();

  Service.getProfile().then((result) => {
    profile = result;
  }, (error) => {
    console.log(error);
  });
  
  function renderRoute() {
    var URL = window.location.hash;
    if (URL == "#/") {
      var page_view = document.getElementById("page-view");
      emptyDOM(page_view);
      var content = lobbyView.elem;
      page_view.appendChild(content);
    } else if (URL.startsWith("#/chat")) {
      var room = lobby.getRoom(URL.split("/")[URL.split("/").length - 1]);
      if (room != null) {
        chatView.setRoom(room);
      }
      var page_view = document.getElementById("page-view");
      emptyDOM(page_view);
      var content = chatView.elem;
      page_view.appendChild(content);
    } else if (URL == "#/profile") {
      var page_view = document.getElementById("page-view");
      emptyDOM(page_view);
      var content = profileView.elem;
      page_view.appendChild(content);
    }
  }

  function refreshLobby() {
    Service.getAllRooms().then(
      (result) => {
        result.forEach((room) => {
          if (room._id in lobby.rooms) {
            lobby.rooms[room._id].name = room.name;
            lobby.rooms[room._id].image = room.image;
          } else {
            lobby.addRoom(room._id, room.name, room.image, room.messages);
          }
        })
      },
      (error) => {
        console.log(error);
      }
    );
  }

  refreshLobby();
  renderRoute();

  setInterval(refreshLobby, 6000);
  window.addEventListener('popstate', renderRoute);

  socket.addEventListener('message', function(message){
    var msg = JSON.parse(message.data);
    var room = lobby.getRoom(msg.roomId);
    msg.text = sanitize(msg.text);
    room.addMessage(msg.username, msg.text);
  });

  cpen322.export(arguments.callee, {renderRoute, lobbyView, chatView, profileView, lobby, refreshLobby, socket});
}

window.addEventListener('load', main);