// assuming cpen322-tester.js is in the same directory as server.js
const cpen322 = require('./cpen322-tester.js');

const path = require('path');
const fs = require('fs');
const express = require('express');
const ws = require('ws');
const Database = require('./Database.js');
const { rejects } = require('assert');
const SessionManager = require('./SessionManager.js');
const crypto = require('crypto');

var broker = new ws.Server({ port: 8000 });
var db = new Database("mongodb://localhost:27017", "cpen322-messenger");
var sessionManager = new SessionManager();

function logRequest(req, res, next){
	console.log(`${new Date()}  ${req.ip} : ${req.method} ${req.path}`);
	next();
}

var isCorrectPassword = function(password, saltedHash){
	var sha256 = crypto.createHash('sha256');
	var input_hash = sha256.update(password + saltedHash.slice(0,20)).digest('base64');
	if (input_hash == saltedHash.slice(20)) {
		return true;
	} else {
		return false;
	}
}

function errorHandler (err, req, res, next) {
	if (err instanceof SessionManager.Error) {
		if (req.get('Accept') == "application/json") {
			res.status(401).send(err);
		} else {
			res.redirect('/login');
		}
	} else {
		res.status(500).send();
	}
}

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

const host = 'localhost';
const port = 3000;
const clientApp = path.join(__dirname, 'client');

// express app
let app = express();

app.use(express.json()) 						// to parse application/json
app.use(express.urlencoded({ extended: true })) // to parse application/x-www-form-urlencoded
app.use(logRequest);							// logging for debug

/* your code */

var messages = {};
const messageBlockSize = 5;

db.getRooms().then((result) => {
	result.forEach((room) => {
		messages[room._id] = [];
	})
});

app.route('/chat')
	.get(sessionManager.middleware, (req, res, next) => {
		db.getRooms().then((rooms) => {
			rooms.forEach((room) => {
				room.messages = messages[room._id];
			});
			res.json(rooms);
		});
	})
	.post(sessionManager.middleware, (req, res, next) => {
		db.addRoom(req.body).then((result) => {
			messages[result._id] = [];
			res.status(200).send(JSON.stringify(result));
		},
		(error) => {
			res.status(400).send(error);
		});
	});

app.route('/chat/:room_id')
	.get(sessionManager.middleware, (req, res, next) => {
		db.getRoom(req.params.room_id).then(
			(room) => {
				if (room != null) {
					res.send(room);	
				} else {
					res.status(404).send("Room was not found");
				}
			}
		);
	});

app.route('/chat/:room_id/messages')
	.get(sessionManager.middleware, (req, res, next) => {
		db.getLastConversation(req.params.room_id, req.query.before).then(
			(conversation) => {
				res.send(conversation);
			}
		);
	});

app.route('/login')
	.post((req, res, next) => {
		db.getUser(req.body.username).then(
			(user) => {
				if (user == null) {
					res.redirect('/login');
				} else {
					if (isCorrectPassword(req.body.password, user.password) == true) {
						sessionManager.createSession(res, req.body.username);
						res.redirect('/');
					} else {
						res.redirect('/login');
					}
				}
			}
		);
	});

app.route('/profile')
	.get(sessionManager.middleware, (req, res, next) => {
		res.send({username: req.username});
	});

app.route('/logout')
	.get((req, res, next) => {
		sessionManager.deleteSession(req);
		res.redirect('/login');
	});

app.get('/app.js', sessionManager.middleware);
app.get('/index.html', sessionManager.middleware);
app.get('/index', sessionManager.middleware);
app.get('/', sessionManager.middleware);
app.use(errorHandler);

broker.on('connection', function connection(ws, req) {
	sessionManager.middleware(req, null, (err) => {
		if (err) {
			ws.close();
		}
	});

	ws.on('message', function message(data) {
		var room = JSON.parse(data);
		room.text = sanitize(room.text);
		messages[room.roomId].push({username: req.username, text: room.text});
		if (messages[room.roomId].length == messageBlockSize) {
			var conversation = {
				"room_id": room.roomId,
				"timestamp": Date.now(),
				"messages": messages[room.roomId]
			}

			db.addConversation(conversation).then((result) => {
				messages[room.roomId] = [];
			},
			(error) => {
				console.log(error);
			});
		}

		room.username = req.username;

		broker.clients.forEach(function each(client) {
			if (client != ws) {
				client.send(JSON.stringify(room));
			}
		})
	})
})

// serve static files (client-side)
app.use('/', express.static(clientApp, { extensions: ['html'] }));
app.listen(port, () => {
	console.log(`${new Date()}  App Started. Listening on ${host}:${port}, serving ${clientApp}`);
});

// at the very end of server.js
cpen322.connect('http://52.43.220.29/cpen322/test-a5-server.js');
cpen322.export(__filename, { app, db, messages, broker, messageBlockSize, sessionManager, isCorrectPassword });