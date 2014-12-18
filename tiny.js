/**
  Author : paper
  Date : 2014-12
  
  Copyright : https://tinypng.com/
*/

var https = require('https');
var fs = require('fs');
var path = require("path");

// tinypng 官网说的 （不可配置）
var maxSize = 5 * 1024 * 1024; // max 5MB each
var maxLen = 20;  //每次20个

// 图片下载地址数组
// 因为tinypng的服务器不是很稳定，经常下载失败
// 你可以从动态生成的txt里面取出路径，批量放到迅雷去下载
var imagesUrl = []; //只有url
var imagesUrlMix = []; //有url 和 url对应的file

// 发送图片的请求时间间隔 2秒
var requestInterval = 2 * 1000;

// 请求图片的超时时间，30秒
var requestTimeout = 30 * 1000;

// 下载图片的超时时间，30秒
var downloadTimeout = 30 * 1000;

// 需要配置的地方
var config = {
  // 目标目录(可修改)，后面记得加个 "/"
  fromPath : "./images/",

  // 默认 只压缩png图片
  // 如果关闭，jpg也会上传压缩
  onlyPng : true,
  
  // 压缩后的文件所放到的目录(没有这个目录，会动态创建)
  toPath : "./tinypng-images/"
}

var httpOptions = {
  host: "tinypng.com",
  method: "post",
  path: "/web/shrink",

  headers: {
    "Accept" : "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Encoding" : "gzip, deflate",
    "Accept-Language" : "zh-cn,zh;q=0.8,en-us;q=0.5,en;q=0.3",
    "Cache-Control" : "no-cache",
    "Connection"  : "keep-alive",
    "Host" : "tinypng.com",
    "Pragma" : "no-cache",
    "Cookie" : "_ga=GA1.2.1201006353.1418720682",
    "Referer" : "https://tinypng.com/",
    "User-Agent" : "Mozilla/5.0 (Windows NT 6.1; WOW64; rv:31.0) Gecko/20100101 Firefox/31.0"
  }
}//end options

//获取Mime
var getMime = function (file) {
  var mimes = {
    '.png' : 'image/png',
    '.jpg' : 'image/jpeg'
  };
  
  return mime = mimes[path.extname(file)];
}

function getToPath(){
  
  if (!fs.existsSync(config.toPath)) {
    fs.mkdirSync(config.toPath);
  }
  
  return config.toPath;
}

function checkFile(file){
  //console.log( file.indexOf(".png") > -1 );
  //console.log( !config.onlyPng && file.indexOf(".jpg") > -1 );
  
  if( file.indexOf(".png") > -1 ) return true;
  if( !config.onlyPng && file.indexOf(".jpg") > -1 ) return true;
  
  return false;
}

var filesLength = 0;

// 获取图片
function getImages( callback ){
  var files = [];
  
  fs.readdir(config.fromPath, function(err, list){
    if (err){
      console.log( "错误: 图片文件夹地址错误" );
      return;
    }
    
    var len = list.length;
    
    if( !len || len > maxLen ){
      console.log( "警告: 图片文件夹为空 或 图片个数大于20个" );
      return;
    }
    
    list.forEach(function(file){
      if( checkFile(file) ){
        var stat = fs.statSync( config.fromPath + file );
        if( stat.size < maxSize ){
          files.push( file );
        }
      }
    });
    
    if( files.length == 0 ){
       console.log( "警告: 没有满足条件的图片(png or jpg, 小于 5MB)" );
       return;
    }
    
    console.log("等待压缩的图片：");
    console.log(files);
    
    filesLength = files.length;
    
    callback && callback(files);
  });
  
}//end getImages


// 上传图片，并发运行
function uploadImage(files, callback){
    
  files.forEach(function(file, i){
    var filePath = config.fromPath + file;
    
    setTimeout(function(){
    
      var reqTime = null;
      var data = "";
      
      httpOptions.headers["Content-Length"] = fs.statSync(filePath).size;
      httpOptions.headers["Content-Type"] = getMime(file);
      
      var req = https.request(httpOptions, function(res){
      
        res.on('data', function (chunk) {
          data += chunk;
        });
        
        res.on("end", function () {
          clearTimeout(reqTime);
          
          filesLength--;
          callback && callback(data, file);
        });
       
      }).on('error', function(e){
        console.log("错误: "+ file +" 请求服务器发生错误");
        
        filesLength--;
        callback && callback(data, file);
      });
      
      //req.setHeader('Content-Length', fs.statSync(filePath).size);
      //req.setHeader('Content-Type', getMime(file));
      //req.write(fs.readFileSync(filePath));

      var fileStream = fs.createReadStream(filePath, { bufferSize: 4 * 1024 });
      fileStream.pipe(req, {end: false});
      
      fileStream.on('end', function() {
        req.end();
      });
 
      console.log("发送"+ file +"中...等待响应...");
      
      reqTime = setTimeout(function(){
        req.abort();
        console.log("发送"+ file +"数据请求超时失败");
        
        filesLength--;
        callback && callback(data, file);
      }, requestTimeout);
      
    }, requestInterval * i);
    
  });
}//end uploadImage

// 下载图片
function downloadImage(data, file){
  console.log( "---------------------------" );
  console.log( "服务器响应了 "+ file +" ，得到返回的数据：" );
  console.log( data );
  
  try{
    var imgUrl = JSON.parse(data).output.url;
  }catch(e){
    console.log("错误: 没有等到返回的 "+ file +" 图片地址");
    
    // 当全部获取到了图片时，再一个一个下载，官网有限制。
    if( filesLength == 0 ){
      downloadImageOnByOne();
    }
    
    return;
  }
  
  imgUrl = imgUrl + "/" + file;
  
  var toPath = getToPath() + "/";
  
  //把图片地址，存到目标目录下
  imagesUrl.push( imgUrl );
  imagesUrlMix.push( [imgUrl, file] );
  
  fs.writeFile(toPath + 'tinypng_imagesUrl.txt', imagesUrl.join("\r\n"), function(){} ); 
  
  // 当全部获取到了图片时，再一个一个下载，官网有限制。
  if( filesLength == 0 ){
    downloadImageOnByOne();
  }
  
  // 一个一个下载图片
  function downloadImageOnByOne(){
    if( imagesUrlMix.length == 0 ) return;
    
    var img = imagesUrlMix.pop();
    var imgUrl = img[0];
    var file = img[1];
    
    console.log("正在下载图片: " + imgUrl);

    var reqTime = null;
   
    var req = https.get(imgUrl, function (res) {
      var imgData = "";
      res.setEncoding("binary");
      
      res.on("data", function (chunk) {
        imgData += chunk;
      });
      
      res.on("end", function () {
        
        clearTimeout(reqTime);
        console.log("得到了 "+ file +" 图片数据");
        
        fs.writeFile(getToPath() + file, imgData, "binary", function (err) {
          if (err) {
            console.log("写入 "+ file +" 失败");
          } else {
            console.log("写入 "+ file +" 成功");
          }
          
          downloadImageOnByOne();
        });
      });
    }).on('error', function(e){
      console.log("下载 "+ file +" 失败");
      
      downloadImageOnByOne();
    });
    
    reqTime = setTimeout(function(){
      req.abort();
      console.log("下载 "+ file +"超时失败，请选择迅雷下载");
      
      downloadImageOnByOne();
    }, downloadTimeout);
      
  }//end downloadImageOnByOne
  
}//end downloadImage

// let's go
function letsgo(){

  getImages(function(files){
    uploadImage(files, function(data, file){
      downloadImage(data, file);
    });
  });
  
}//end letsgo


letsgo();


