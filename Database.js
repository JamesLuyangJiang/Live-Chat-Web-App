const { response } = require('express');
const { MongoClient, ObjectID, ObjectId } = require('mongodb');	// require the mongodb driver

/**
 * Uses mongodb v4.2+ - [API Documentation](http://mongodb.github.io/node-mongodb-native/4.2/)
 * Database wraps a mongoDB connection to provide a higher-level abstraction layer
 * for manipulating the objects in our cpen322 app.
 */
function Database(mongoUrl, dbName){
	if (!(this instanceof Database)) return new Database(mongoUrl, dbName);
	this.connected = new Promise((resolve, reject) => {
		MongoClient.connect(
			mongoUrl,
			{
				useNewUrlParser: true
			},
			(err, client) => {
				if (err) reject(err);
				else {
					console.log('[MongoClient] Connected to ' + mongoUrl + '/' + dbName);
					resolve(client.db(dbName));
				}
			}
		)
	});
	this.status = () => this.connected.then(
		db => ({ error: null, url: mongoUrl, db: dbName }),
		err => ({ error: err })
	);
}

Database.prototype.getRooms = function(){
	return this.connected.then(db =>
		new Promise((resolve, reject) => {
			var result = db.collection("chatrooms").find().toArray();
			resolve(result);
		})
	)
}

Database.prototype.getRoom = function(room_id){
	return this.connected.then(db =>
		new Promise((resolve, reject) => {
			var objectid;
			var stringid;
			var result;

			if (typeof(room_id) == 'string'){
				if (ObjectId.isValid(room_id)) {
					objectid = ObjectId(room_id);
					result = db.collection("chatrooms").findOne({_id: objectid});
				}

				if (result == null) {
					result = db.collection("chatrooms").findOne({_id: room_id});
				}
			}
			
			if (typeof(room_id) != 'string') {
				result = db.collection("chatrooms").findOne({_id: room_id});
				if (result == null) {
					stringid = room_id.toHexString();
					result = db.collection("chatrooms").findOne({_id: stringid});
				}
			}

			resolve(result);
		})
	)
}

Database.prototype.addRoom = function(room){
	return this.connected.then(db => 
		new Promise((resolve, reject) => {
			db.collection("chatrooms").insertOne(room);

			if (room.name == null) {
				reject(new Error("name of the room undefined"));
			} else {
				resolve(room);
			}
		})
	)
}

Database.prototype.getLastConversation = function(room_id, before){
	return this.connected.then(db =>
		new Promise((resolve, reject) => {
			if (before == undefined) {
				before = Date.now();
			}

			db.collection("conversations").find().toArray().then((results) => {
				var maxdiff = before;
				var result;

				results.forEach(conversation => {
					if (conversation.room_id == room_id && conversation.timestamp < before) {
						if (before - conversation.timestamp < maxdiff) {
							result = conversation;
							maxdiff = before - conversation.timestamp;
						}
					}
				})

				resolve(result);
			})
		})
	)
}

Database.prototype.addConversation = function(conversation){
	return this.connected.then(db =>
		new Promise((resolve, reject) => {
			db.collection("conversations").insertOne(conversation);

			if (conversation.room_id == undefined || conversation.timestamp == undefined || conversation.messages == undefined) {
				reject(new Error("fields of conversation undefined"));
			} else {
				resolve(conversation);
			}
		})
	)
}

Database.prototype.getUser = function(username){
	return this.connected.then(db =>
		new Promise((resolve, reject) => {
			var result;
			result = db.collection("users").findOne({username: username});

			resolve(result);
		})
	)
}

module.exports = Database;