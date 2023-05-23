const express = require('express');
const mysql = require('mysql');
const app = express();////きなみともや
const multer = require('multer'); // ファイルのアップロードを処理するためのミドルウェア
const path = require('path');
const upload = multer({ dest: 'public/uploads/' }); // アップロード先のディレクトリを指定


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
  console.log(req);
  if (users.some((user)=>user.username===req.body.username&&user.password===req.body.password)){
    username = req.body.username;
    return res.render('home.ejs');
  }
  return res.render('login.ejs')
});

app.get('/home', (req, res) => {
  res.render('home.ejs', { username: username }); // home.ejsにusernameを渡す
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