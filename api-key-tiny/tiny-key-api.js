/**
  Author :  paper
  Date   :  2014-12
  Intro  :  使用 tinypng 给的key，调用 tinypng 接口 （免费版1个月只有500张图片）
  
  https://tinypng.com/developers
  https://tinypng.com/developers/subscription
  https://tinypng.com/developers/reference
  
  Copyright : https://tinypng.com/
  
  说明一下：有点慢啊。。。超时很严重。。估计是墙内的关系
*/

// from https://tinypng.com/developers/reference#node-js
var https = require("https");
var fs = require("fs");
var url = require("url");

var key = "0aCrPSnNgS6vW2FEX1p-Omm3XdYLpMXB"; // paper's key
var input = fs.createReadStream("./images/logo.png");
var output = fs.createWriteStream("./to/tiny-logo.png");

/* Uncomment below if you have trouble validating our SSL certificate.
   Download cacert.pem from: http://curl.haxx.se/ca/cacert.pem */
// var boundaries = /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----\n/g
// var certs = fs.readFileSync(__dirname + "/cacert.pem").toString()
// https.globalAgent.options.ca = certs.match(boundaries);

var options = url.parse("https://api.tinypng.com/shrink");
options.auth = "api:" + key;
options.method = "POST";

console.log(options)

var request = https.request(options, function(response) {
  
  if (response.statusCode === 201) {
    
    console.log(response.headers)
    
    /* Compression was successful, retrieve output from Location header. */
    https.get(response.headers.location, function(response) {
      response.pipe(output);
    });
  } else {
    /* Something went wrong! You can parse the JSON body for details. */
    console.log("Compression failed");
  }
});

input.pipe(request);




