/**
  Author : paper
  Date : 2014-12
  
  Copyright : https://tinypng.com/
  Intro : 纯粹模拟浏览器的行为，上传图片并下载图片
          如果使用 官网提供的 key-api 方式，免费用户，每个月限制是500张，也不稳定
          https://tinypng.com/developers
  
  2014-12-19
    研究发现，在没有vpn的情况下，不太稳定
    所以改为：一张一张图上传，然后一张一张下载
    
  2015-02-04
    注释上传图片时传的cookie
    下载图片时，模拟浏览器下载
*/

var https = require('https');
var fs = require('fs');
var path = require("path");
var url = require('url');

// tinypng 官网说的 （不可配置）
var maxSize = 5 * 1024 * 1024; // max 5MB each
var maxLen = 20;  //每次20个

// 图片下载地址数组
// 因为tinypng的服务器不是很稳定，经常下载失败
// 你可以从动态生成的txt里面取出路径，批量放到迅雷去下载
var imagesUrl = []; //只有url
var imagesUrlMix = []; //有url 和 url对应的file

// 上传的文件集合
var files = [];

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
  // 如果设置为 false，jpg也会上传压缩
  onlyPng : true,
  
  // 压缩后的文件所放到的目录(没有这个目录，会动态创建)
  toPath : "./images-by-tinypng-paper/"
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
    //"Cookie" : "_ga=GA1.2.1201006353.1418720682",
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
  
  return mimes[path.extname(file)];
}

// 得到目标路径，如果没有就动态创建
function getToPath(){
  
  if (!fs.existsSync(config.toPath)) {
    fs.mkdirSync(config.toPath);
  }
  
  return config.toPath;
}

// 判断上传文件类型
function checkFile(file){
  if( file.indexOf(".png") > -1 ) return true;
  if( !config.onlyPng && file.indexOf(".jpg") > -1 ) return true;
  
  return false;
}

// 打log
function showLog(msg, title){
 
  if( title ){
    console.log("*** "+ title +" ***");
  }
  
  console.log(msg);
  console.log("---------------------------------");
}

// 获取图片
function getImages( callback ){
  
  fs.readdir(config.fromPath, function(err, list){
    if (err){
      showLog("错误: 图片文件夹地址错误");
      return;
    }
    
    var len = list.length;
    
    if( !len || len > maxLen ){
      showLog("警告: 图片文件夹为空 或 图片个数大于20个");
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
      showLog("警告: 没有满足条件的图片(png or jpg, 小于 5MB)")
      return;
    }
    
    showLog(files, "等待压缩的图片：");
    
    callback && callback();
  });
  
}//end getImages


// 上传图片
// 好像不能并发上传，并发很容易超时，尝试一个一个上传
function uploadImage(callback){
  
  // 判断是不是全部上传完毕
  function checkUploadAllOver(){    
    if( files.length == 0 ){
      showLog("提醒: 图片已经全部上传");
      
      callback && callback();
    }else{
      uploadOneByOne();
    }
  }
  
  // 某个文件上传完成
  function uploadEnd(data, file){

    try{
      var imgUrl = JSON.parse(data).output.url;
    }catch(e){
      showLog("错误: 没有得到返回的 "+ file +" 图片地址");
      
      checkUploadAllOver();
      return;
    }
    
    showLog("服务器响应了 "+ file +" ，得到返回的数据 data：" + data );
    
    imgUrl = imgUrl + "/" + file;
    
    var toPath = getToPath() + "/";
    
    //把图片地址，存到目标目录下
    imagesUrl.push( imgUrl );
    imagesUrlMix.push( [imgUrl, file] );
    
    fs.writeFile(toPath + 'tinypng_imagesUrl.txt', imagesUrl.join("\r\n"), function(){} ); 
    
    checkUploadAllOver();
  }
  
  function uploadOneByOne(){
    
    var file = files.pop();
    var filePath = config.fromPath + file;
    
    var reqTime = null;
    var data = "";
    
    showLog(filePath, "文件路径");
    
    httpOptions.headers["Content-Length"] = fs.statSync(filePath).size;
    httpOptions.headers["Content-Type"] = getMime(file);
    
    var req = https.request(httpOptions, function(res){
    
      res.on('data', function (chunk) {
        data += chunk;
      });
      
      res.on("end", function () {
        clearTimeout(reqTime);
        uploadEnd(data, file);
      });
     
    }).on('error', function(e){
      showLog("错误: "+ file +" 请求服务器发生错误");
      
      clearTimeout(reqTime);
      uploadEnd(data, file);
    });
    
    //req.setHeader('Content-Length', fs.statSync(filePath).size);
    //req.setHeader('Content-Type', getMime(file));
    //req.write(fs.readFileSync(filePath));

    var fileStream = fs.createReadStream(filePath);
    fileStream.pipe(req, {end: false});
    
    fileStream.on('end', function() {
      req.end();
    });
    
    showLog("发送"+ file +"中...等待响应...");
    
    // 超时判断
    reqTime = setTimeout(function(){
      req.abort();
      showLog("发送"+ file +"数据请求超时失败");
      
      uploadEnd(data, file);
    }, requestTimeout);

  }//end uploadOneByOne
  
  uploadOneByOne();
  
}//end uploadImage

// 上传完毕后，下载图片
function downloadImage(){

  // 一个一个下载图片
  function downloadImageOnByOne(){
    if( imagesUrlMix.length == 0 ){
      return;
    }
    
    var img = imagesUrlMix.pop();
    var imgUrl = img[0];
    var file = img[1];
    
    showLog("正在下载图片: " + imgUrl);

    var reqTime = null;
   
    //var req = https.get(imgUrl, function (res) {
    var req = https.get({
      host: 'tinypng.com',
      path: url.parse(imgUrl).path,
      method: 'GET',
      headers: {
        'Connection': 'keep-alive',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.95 Safari/537.36',
        'Accept-Encoding': 'gzip, deflate, sdch',
        'Accept-Language': 'zh-CN,zh;q=0.8,en;q=0.6'
      }
    }, function (res) {
      var imgData = "";
      
      res.setEncoding("binary");
      
      res.on("data", function (chunk) {
        imgData += chunk;
      });
      
      res.on("end", function () {
        
        clearTimeout(reqTime);
        showLog("得到了 "+ file +" 图片数据");
        
        fs.writeFile(getToPath() + file, imgData, "binary", function (err) {
          if (err) {
            showLog("写入 "+ file +" 失败");
          } else {
            showLog("写入 "+ file +" 成功！");
          }
          
          downloadImageOnByOne();
        });
      });
    }).on('error', function(e){
      showLog("下载 "+ file +" 失败，请选择迅雷下载");
      
      clearTimeout(reqTime);
      downloadImageOnByOne();
    });
    
    reqTime = setTimeout(function(){
      req.abort();
      showLog("下载 "+ file +"超时失败，请选择迅雷下载");
      
      downloadImageOnByOne();
    }, downloadTimeout);
      
  }//end downloadImageOnByOne
  
  downloadImageOnByOne();
  
}//end downloadImage

// let's go
function letsgo(){

  getImages(function(){
    uploadImage(function(){
      downloadImage();
    });
  });
  
}//end letsgo


letsgo();


