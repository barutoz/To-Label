const express = require('express');
const mysql = require('mysql');
const app = express();////きなみともや
const multer = require('multer'); // ファイルのアップロードを処理するためのミドルウェア
const path = require('path');
const upload = multer({ dest: 'public/uploads/' }); // アップロード先のディレクトリを指定
const sqlite3 = require("sqlite3");
const db = new sqlite3.Database("DV.sqlite3");
var session = require('express-session');

app.use(session({
  secret: 'secret',
  resave: false,
  saveUninitialized: false,
  cookie:{
  httpOnly: true,
  secure: false,
  maxage: 1000 * 60 * 30
  }
})); 

// メッセージの配列を初期化
let messages = [];

function number_check(number){
  if(number=0){
    var exists=true;
  }else{
    db.all("select number from room_number",function(err,row){
      for(var ini=0; ini<row.length; ini++){
        if(row[ini]['number']==number){
          var exists=true;
  }}})};
  if(exists){
    return false
  }else{
    return true
  }};

  function number_generate(number){
    if(number_check(number)==true){
      return number
    }else{
    while (number_check(number)==false){
      var number=Math.floor(Math.random()*10000);
    }
    return number
  }};

  const createPassword = () => {
    var alphabet = 'abcdefghijklmnopqrstuvwxyz';
    var alphabetUpper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    var numbers = '0123456789';

    var passBase  = alphabet + alphabetUpper + numbers;

    var len = 12; // 12桁
    var password='';

    for (var i = 0; i < len; i++) {
        password += passBase.charAt(Math.floor(Math.random() * passBase.length));
    }

    return password;
}

app.use(express.urlencoded({ extended: true}))
app.use(express.static('public'));
app.set("view engine", "ejs");

const users = [
  { username: "example", password: "password" },
  { username: "example2", password: "password2" },
];

const connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "password",
  database: "list_app",
});

app.get("/", (req, res) => {
  res.render("hello.ejs");
});

app.get("/index", (req, res) => {
  res.render("index.ejs");
});

app.get("/login", (req, res) => {
  res.render("login.ejs");
});


app.post('/home', (req, res) => {
  if (users.some((user)=>user.username===req.body.username&&user.password===req.body.password)){
    username = req.body.username;
    req.session.username = username;
    return res.render('home.ejs',{msg:""});
  }
  
});

app.get('/home', (req, res) => {
  if(req.session.username){
    if(req.session.team_error){
      msg="不正な番号です。"
    }else{
      msg=""
    };
  res.render('home.ejs', { username: req.session.username ,msg:msg}); // home.ejsにusernameを渡す
}else{
  res.redirect('/login');
}});

app.post('/room',(req,res)=>{
  if(req.session.username==false){res.redirect('/login');}
  console.log(req.body.room);
  db.all("select * from room_number",function(err,row){
    for(let i=0; i<row.length; i++){
      if(row[i]["number"]==req.body.room){
        var team_number=row[i]["id"];
        var authorization=row[i]["authorization"];
        break;
      }else{
        var team_number=false;
      }
    };
    if(team_number==false){
      req.session.team_error=true;
    return res.redirect('/home');
  }else{
    req.session.team_number=team_number;
    req.session.authorization=authorization;
    return res.redirect('/room/'+String(team_number));
  }
  });
});

app.get('/room/*',(req,res)=>{
  if(req.session.username==false){res.redirect('/login');};
  var query=req.originalUrl;
  var query_number=query.split("/")
  if(req.session.team_number==false){var modal=true}else{
  if(query_number[2]==req.session.team_number){var modal=false}else{var modal=true};
  db.all("select * from room_number",function(err,row){
    for(let i=0; i<row.length; i++){
      if(row[i]["number"]==req.session.team_number){
        if(row[i]["authorization"]==req.session.authorization){
          var modal=true;
        }else{
          res.redirect('/login');
        }}}});
};
  res.render('2.ejs', { messages: messages });
})

app.post('/random',(req,res)=>{
  if(req.session.username==false){res.redirect('/login');}
  if (req.body.random=='true'){
    var number=Math.floor(Math.random()*10000);
    var number=number_generate(number);
    var authorization=createPassword();
    db.all("select number from room_number",function(err,row){
      var rowrow=row.length+1
      db.serialize(()=>{
        db.run('INSERT INTO room_number (id,number,authorization) VALUES('+String(rowrow)+','+String(number)+',"'+authorization+'")');
        db.run('CREATE TABLE "'+authorization+'" ( "id"	INTEGER NOT NULL UNIQUE, "from"	TEXT NOT NULL, "to"	TEXT NOT NULL,  "msg"	TEXT NOT NULL, PRIMARY KEY("id" AUTOINCREMENT) );')
      });});
    if(number<1000){
      new_number='0'+String(number);
      if(number<100){
        new_number='0'+new_number;
        if(number<10){
          new_number='0'+new_number;
        }
      }
    }else{
      new_number=String(number);
    }
    console.log(new_number);
    res.send(new_number);
  }else{
    res.send(false);
  };
});

// app.js

app.post('/2', (req, res) => {
  if(req.session.username==false){res.redirect('/login');}
  const message = req.body.message;
  messages.push(message); // メッセージを配列に追加
  res.redirect('/room/'+req.session.team_number); // 2.ejsにリダイレクト

});

app.post("/profile", (req, res) => {
  res.render("profile", { username: req.body.username });
});
app.get("/profile", (req, res) => {
  res.render("profile.ejs");
});

app.get("/0", (req, res) => {
  res.render("0.ejs");
});
app.get("/1", (req, res) => {
  res.render("1.ejs");
});

app.get('/3', (req, res) => {
  res.render('3.ejs', { username: username });
});

app.get("/4", (req, res) => {
  res.render("4.ejs", { username: username });
});

app.listen(3000, () =>
  console.log("Server is running \n port: http://localhost:3000/")
);
