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
var colors = require("colors");

var config = require('../config/config.defaults.js');
var util = require('./server-util.js');

function run() {
	var hostName = config.serverHost ? config.serverHost : null;
	
    if (!config.proxyServer) {
        console.error('ERROR: Proxy server not configured!');
        process.exit(1);
    }
    
    console.log('Proxy'.bold + ' listening for requests on ' + (hostName).green + ":" + ( config.proxyPort + "").cyan);
    
	httpProxy.createServer(function (req, res, proxy) {
	    var requestedFile = url.parse(req.url).pathname;
		var i, len, debug = false;
		
		len = config.proxyServer.debug.length;
		for (i = 0; i < len && !debug; i += 1) {
			debug = debug || (config.proxyServer.debug[i] === requestedFile);
		}
	
	    /* aardwolf.js needs to be served from the local filesystem */
	    if (requestedFile.toLowerCase() === '/aardwolf.js' || debug) {
	    	console.log('Local: ' + requestedFile.cyan);
			proxy.proxyRequest(req, res, {
				host: hostName,
				port: config.fileServerPort
			});
		} else if (requestedFile.indexOf('/mobile/') !== -1) {
	    	console.log('Server: ' + requestedFile.yellow);
			proxy.proxyRequest(req, res, {
				host: hostName,
				port: config.serverPort
			});
	    } else {
	    	//console.log('Remote: ' + requestedFile.yellow);
			proxy.proxyRequest(req, res, {
				host: config.proxyServer.host,
				port: config.proxyServer.port
			});
		}
	}).listen(config.proxyPort);
    
    http.createServer(DebugProxyServer).listen(config.fileServerPort, hostName, function() {
        console.log('DebugProxyServer'.bold + ' listening for requests on ' + (hostName).green + ":" + ( config.fileServerPort + "").cyan);
    });
};

function DebugProxyServer(req, res) {
    var requestedFile = url.parse(req.url).pathname;

    /* Serve the debug library from the local file system */
    if (requestedFile.toLowerCase() === '/aardwolf.js') {
        util.serveStaticFile(res, path.join(__dirname, '../js/aardwolf.js'));
    } else if (requestedFile.substr(-3) === '.js') {
		var remoteData = [];
		var options = {
			host: config.proxyServer.host,
			port: config.proxyServer.port,
			path: requestedFile
		};
    	var proxyReq = http.request(options, function (proxyRes) {
			proxyRes.setEncoding('utf8');
			proxyRes.on('data', function (chunk) {
				remoteData.push(chunk);
			});
			proxyRes.on('end', function () {
				var rewriter = require('../rewriter/jsrewriter.js');
				var fileName = requestedFile.split("/").pop();
				console.log('DebugProxyServer'.bold + ' storing & instrumenting remote file ' + (fileName).green + " for debugging");
		        fs.writeFileSync(path.join(config.fileServerBaseDir, fileName), remoteData.join(""));
				remoteData = rewriter.addDebugStatements("/" + fileName, remoteData.join(""));
		        res.writeHead(200, {
		        	'Content-Type': 'application/javascript',
		        	'Access-Control-Allow-Origin': '*',
			    	'Access-Control-Allow-Headers': 'X-Requested-With'
			    });
		        res.end(remoteData);
			});
		});
		proxyReq.on('error', function (err) {
			res.writeHead(500, {'Content-Type': 'text/plain'});
			res.end("Failed to get Remote file: " + requestedFile + "\n" + err.message);
		});
		proxyReq.end();
	} else {
	    console.log("Cannot handle file: " + requestedFile);
		res.writeHead(500, {'Content-Type': 'text/plain'});
		res.end("Cannot handle file: " + requestedFile);
	}
};

module.exports.run = run;

