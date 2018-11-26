'use strict';

var express = require('express');
var mongoose = require('mongoose');
var bodyParser = require('body-parser')
var cors = require('cors');
var dns = require('dns')
let {randWord:generateShortUrl} = require('rand-pick')
var app = express();


// Basic Configuration 
let urlRelschema = new mongoose.Schema({
  original_url:{type:String, required:true, unique:true}, 
  short_url:{type:String, required:true, unique:true}
})
let dbOnline = false
let UrlMap = undefined
var port = process.env.PORT || 3000;

function onSearchShortUrl(err, originalUrl, res){
  let error = {error: 'Invalid URL'}
  if(err){
    console.error('Finding shortUrl failed - ', err )
    res.json(error)
  }
  else{
    res.redirect(originalUrl)
  }
}

function onCreateShortUrl(err, short_url, {req, res, error}){
  if(err){
    console.error('Cretion shorturl failed - ', err )
    res.json(error)
  }
  else{
    console.log({original_url:req.body.url, short_url})
    res.json({original_url:req.body.url, short_url})
  }
}

function ifUrlAlreadyCreated(original_url, done){
  UrlMap.findOne({original_url}, function(_err, doc){
    if(_err) done(_err)
    else if(!doc) done('Not found')
    else done(null, doc.short_url)
  })
}

function createNewUrl(original_url, done){
  ifUrlAlreadyCreated(original_url, function (err, _short_url){
    if(err){
      let short_url = generateShortUrl()
      let newUrl = new UrlMap({original_url, short_url})
      newUrl.save(function(err){if(err) done(err); else done(null, short_url)})
    }
    else{
      done(null, _short_url)
    }
  })
}

function findOriginalUrl(short_url, done){
  UrlMap.findOne({short_url}, function(err, doc){
    if(err) done(err)
    else if(doc && doc['original_url']) done(null, doc.original_url)
    else done('No original url found')
  })
}

function onConnect(err, conn){
  if(err){
    dbOnline = false
    console.error('DB-connect-error', err)
  }
  else{
    dbOnline = true
    if(!UrlMap){
      UrlMap = mongoose.model('UrlMap', urlRelschema)
    }
  }
}

mongoose.connect(process.env.MONGO_URI,{ useMongoClient: true}, onConnect)

app.use(bodyParser.urlencoded({ extended: false }))

app.use(function(req, res, next){
  console.log(`${req.ip} | [${req.method}] ${req.path} ${req.method === 'POST'?JSON.stringify(req.body):JSON.stringify(req.params||req.query)}`)
  next()
})

app.use(function(req, res, next){
  if(dbOnline){
    next()
  }
  else{
    res.status(500).json({error:'db-offline'}).end()
  }
})

app.use(cors());

app.use('/public', express.static(process.cwd() + '/public'));

app.get('/', function(req, res){
  res.sendFile(process.cwd() + '/views/index.html');
});

app.post("/api/shorturl/new", function (req, res) {
  let error = {error: 'invalid URL'}
  if(req.body.url && /^http[s]?:\/\/\S+[.]\S+[.]\S+$/.test(req.body.url) && !(/\/{3}/.test(req.body.url))){
    let domain_name = req.body.url.split('://')[1].split('/')[0]
    dns.lookup(domain_name, function (err, add){
      if(err) { 
        console.error(err)
        res.json(error) 
      }
      else{
        createNewUrl(req.body.url, (err, data)=>onCreateShortUrl(err, data, {req, res, error}))
      }
    })
  }
  else{
    res.json(error);
  }
});

app.get("/api/shorturl/:url", function(req, res){
  findOriginalUrl(req.params.url, (err, data)=>onSearchShortUrl(err, data, res))
})

app.listen(port, function () {
  console.log('Node.js listening ...');
});