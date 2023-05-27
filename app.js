const express = require('express');
const mysql = require('mysql');
const app = express();////きなみともや
const multer = require('multer'); // ファイルのアップロードを処理するためのミドルウェア
const path = require('path');
const upload = multer({ dest: 'public/uploads/' }); // アップロード先のディレクトリを指定
const sqlite3 = require("sqlite3");
const db = new sqlite3.Database("DV.sqlite3");

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

app.use(express.urlencoded({ extended: true}))
app.use(express.static('public'));
app.set("view engine", "ejs");

const users = [
  {username:"example",password:"password"},
  {username:"example2",password:"password2"},
]

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'password',
  database: 'list_app'
});


app.get('/', (req, res) => {
  res.render('hello.ejs');
});

app.get('/index', (req, res) => {
  res.render('index.ejs');
});

app.get('/login', (req, res) => {
  res.render('login.ejs');
});


app.post('/home', (req, res) => {
  if (users.some((user)=>user.username===req.body.username&&user.password===req.body.password)){
    username = req.body.username;
    return res.render('home.ejs');
  }
  
});

app.get('/home', (req, res) => {
  res.render('home.ejs', { username: username }); // home.ejsにusernameを渡す
});

app.post('/room',(req,res)=>{
  console.log(req.body.room);
  return res.render('room.ejs')
});

app.post('/random',(req,res)=>{
  if (req.body.random=='true'){
    var number=Math.floor(Math.random()*10000);
    var number=number_generate(number);
    db.all("select number from room_number",function(err,row){
      var rowrow=row.length+1
      db.serialize(()=>{
        db.run('INSERT INTO room_number VALUES('+String(rowrow)+','+String(number)+')');
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
    return false
  };
});

// app.js

// メッセージの配列を初期化
let messages = [];

app.post('/2', (req, res) => {
  const message = req.body.message;
  messages.push(message); // メッセージを配列に追加
  res.redirect('/2'); // 2.ejsにリダイレクト
});

app.get('/2', (req, res) => {
  res.render('2.ejs', { messages: messages });
});

app.post('/profile', (req, res) => {
  res.render('profile', { username: req.body.username });
});
app.get('/profile', (req, res) => {
  res.render('profile.ejs');
});



app.get('/0', (req, res) => {
  res.render('0.ejs');
});
app.get('/1', (req, res) => {
  res.render('1.ejs');
});
app.get('/2', (req, res) => {
  res.render('2.ejs');
});
app.get('/3', (req, res) => {
  res.render('3.ejs', { username: username });
});
app.get('/4', (req, res) => {
  res.render('4.ejs', { username: username });
});




app.listen(3000, () =>
console.log("Server is running \n port: http://localhost:3000/")
  );