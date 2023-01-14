const crypto = require('crypto');
const { clearTimeout } = require('timers');

class SessionError extends Error {};

function SessionManager (){
	// default session length - you might want to
	// set this to something small during development
	const CookieMaxAgeMs = 600000;

	// keeping the session data inside a closure to keep them protected
	const sessions = {};

	// might be worth thinking about why we create these functions
	// as anonymous functions (per each instance) and not as prototype methods
	this.createSession = (response, username, maxAge = CookieMaxAgeMs) => {
		var token = crypto.randomBytes(256).toString('hex');
		var cur_session = {username: username};
		sessions[token] = cur_session;
		var timer = setTimeout(function(){
			delete sessions[token];
			clearTimeout(timer);
		}.bind(this), maxAge);
		response.cookie('cpen322-session', token, {maxAge: maxAge});
	};

	this.deleteSession = (request) => {
		delete request.username;
		delete sessions[request.session];
		delete request.session;
	};

	this.middleware = (request, response, next) => {
		var cookieString = request.headers.cookie;
		if (cookieString == null) {
			next(new SessionError("cookie header not found"));
			return;
		}
		// Reference for cookie parser: https://www.geeksforgeeks.org/how-to-parse-http-cookie-header-and-return-an-object-of-all-cookie-name-value-pairs-in-javascript/
		var pairs = cookieString.split(";");
		var splittedPairs = pairs.map(cookie => cookie.split("="));
		var cookieObj = splittedPairs.reduce(function (obj, cookie) {
			obj[decodeURIComponent(cookie[0].trim())]
                = decodeURIComponent(cookie[1].trim());
 
            return obj;
		}, {});

		if (cookieObj['cpen322-session'] in sessions) {
			request.username = sessions[cookieObj['cpen322-session']].username;
			request.session = cookieObj['cpen322-session'];
			next();
		} else {
			next(new SessionError("current session not found"));
			return;
		}
	};

	// this function is used by the test script.
	// you can use it if you want.
	this.getUsername = (token) => ((token in sessions) ? sessions[token].username : null);
};

// SessionError class is available to other modules as "SessionManager.Error"
SessionManager.Error = SessionError;

module.exports = SessionManager;