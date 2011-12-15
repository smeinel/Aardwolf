/*
 * debug-proxy-server.js: a debug proxy server for aardwolf
 * 
 * Copyright (c) 2011 Steve Meinel, Aleksander Kmetec
 * 
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 * 
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

'use strict';

var http = require('http');
var httpProxy = require('http-proxy');
var path = require('path');
var fs = require('fs');
var url = require('url');

var config = require('../config/config.defaults.js');
var util = require('./server-util.js');

function run() {
	var hostName = config.serverHost ? config.serverHost : null;
	
    if (!config.proxyServer) {
        console.error('ERROR: Proxy server not configured!');
        process.exit(1);
    }
    
	httpProxy.createServer(function (req, res, proxy) {
	    var requestedFile = url.parse(req.url).pathname;
		var i, len, debug = false;
		
		len = config.proxyServer.debug.length;
		console.log("There are " + len + " debug items")
	    console.log(requestedFile);
		console.log("")
		for (i = 0; i < len; i += 1) {
			debug = debug || (config.proxyServer.debug[i] === requestedFile);
		}
	
	    /* alias for serving the debug library */
	    if (requestedFile.toLowerCase() === '/aardwolf.js' || debug) {
	    	console.log("forwarding to local")
			proxy.proxyRequest(req, res, {
				host: hostName,
				port: config.fileServerPort
			});
	    } else {
	    	console.log("forwarding to remote")
			proxy.proxyRequest(req, res, {
				host: config.proxyServer.host,
				port: config.proxyServer.port
			});
		}
	}).listen(10000);
    
    http.createServer(DebugProxyServer).listen(config.fileServerPort, hostName, function() {
        console.log('DebugProxyServer listening for requests on ' + hostName + ":" + config.fileServerPort);
    });
};

function DebugProxyServer(req, res) {
    var requestedFile = url.parse(req.url).pathname;

    /* alias for serving the debug library */
    if (requestedFile.toLowerCase() === '/aardwolf.js') {
        util.serveStaticFile(res, path.join(__dirname, '../js/aardwolf.js'));
    } else {
	    console.log(req.url);
	    console.log(requestedFile);
	    
		res.writeHead(404, {'Content-Type': 'text/plain'});
		res.end('NOT FOUND');
	}
};

module.exports.run = run;

