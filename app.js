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

// CSRF トークンの生成関数
function generateCSRFToken() {
  // ランダムなトークンを生成
  const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  return token;
}

app.use(express.urlencoded({ extended: true}))
app.use(express.static('public'));
app.set("view engine", "ejs");

app.get("/", (req, res) => {
  res.render("index.ejs");
});

app.get('/login', (req, res) => {
  if(req.session.username){
    return res.redirect('/home')
  }else{
  return res.render('login.ejs');
}});

app.post('/login', (req, res) => {
    // ユーザーの検索
    db.all('SELECT * FROM users',function(error, row){
      console.log(row)
      for(let i=0; i<row.length; i++){
        if(req.body.username==row[i]["username"]){
          if(req.body.password==row[i]["password"]){
            var login_id=row[i]["id"];
            var login=true;
            break;
          }else{
            var login=false
          }}else{
            var login=false
          }
        }
      if(login){
        req.session.userId = login_id;
        req.session.username = req.body.username;
        return res.redirect('/home');
      }else{
        req.session.destroy;
        return res.render( 'login.ejs'), { error: true };
      }})});

  // サインアップページの表示
app.get('/signup', (req, res) => {
  // CSRF トークンを生成して追加
  const csrfToken = generateCSRFToken();
  req.session.signup=csrfToken;
  res.render('signup.ejs', { csrfToken });
});

// サインアップの POST リクエストの処理
app.post('/signup', (req, res) => {
  const username = req.body.username;
  const password = req.body.password;
  const received_csrfToken=req.body._csrf;
  const session_csrfToken=req.session.signup;
  if(received_csrfToken==session_csrfToken){
  // 既存のユーザーネームとの重複をチェック
  db.all('SELECT * FROM users',function(err, row){
    if (err) {
      console.error(err);
      req.session.destroy;
      return res.json({ success: false, message: 'エラーが発生しました。もう一度やり直してください。' });
    }else{
      for(let i=0; i<row.length; i++){
        // ユーザーネーム・パスワードが両方とも同じものがある場合
        if(row[i]["username"]==username){
          if(row[i]["password"]==password){
            var pswd_error=true;
            break;
          }
        }};
      // ユーザーの作成やデータベースへの保存などの処理を実装する
      if(pswd_error){
        req.session.destroy;
        return res.json({ success: false, message: '別のパスワードにしてください。' });
      }else{
      db.serialize(()=>{
        db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, password], (err) => {
        if (err) {
          console.error(err.message);
          req.session.destroy
          return res.json({ success: false, message: '登録に失敗しました。もう一度やり直してください。' });
        }})});
          req.session.destroy;
          return res.json({ success: true, redirectUrl: '/login' });
        }}})}else{
          req.session.destroy;
          return redirect('/signup');
      }});
  
app.get('/home', (req, res) => {
  if(req.session.username){
    if(req.session.team_error){
      req.session.team_error=false;
      msg="不正な番号です。"
    }else{
      msg=""
    };
  res.render('home.ejs', { username: req.session.username ,msg:msg}); // home.ejsにusernameを渡す
}else{
  req.session.destroy;
  return res.redirect('/login');
}});

app.post('/room',(req,res)=>{
  if(req.session.username==false){
    req.session.destroy;
    return res.redirect('/login');}
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
  if(req.session.username==false){
    req.session.destroy;
    return res.redirect('/login');};
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
          req.session.destroy;
          return res.redirect('/login');
        }}}});
};
  res.render('2.ejs', { messages: messages });
})

app.post('/random',(req,res)=>{
  if(req.session.username==false){
    req.session.destroy;
    return res.redirect('/login');}
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

app.post('/logout', (req, res) => {
  // セッションを破棄してログアウト
  req.session.destroy((err) => {
    if (err) {
      console.error(err);
    }
    return res.redirect('/');
  });
});

app.get('/profile', (req, res) => {
  // セッションにログインの状態を確認
  if (req.session.userId && req.session.username) {
    if(req.session.pswd_error){
      req.session.pswd_error=false;
      pswd_error="このパスワードは使用できません。"
    }else if(req.session.login_error){
      req.session.login_error=false;
      pswd_error="今のパスワードが違います。";
    }else{
      pswd_error="";
    }
    // ログイン済みの場合、ホームページを表示
    res.render('profile.ejs',{ pswd_error: pswd_error });
  } else {
    // ログインしていない場合、ログインページにリダイレクト
    req.session.destroy;
    return res.redirect('/login');
  }
});

app.post('/profile', (req, res) => {
  const userId = req.session.userId;
  const oldUserpass=req.body.olduserpass;
  const newUsername = req.body.username;
  const newPassword = req.body.password;
  if (req.session.userId && req.session.username) {
      db.all('SELECT * FROM users',function(error, row){
        for(let i=0; i<row.length; i++){
          if(row[i]["id"]==req.session.userId){
            if(row[i]["password"]==oldUserpass){
              var login=true;
              break;
            }else{
              var login=false;
              var login_error=true;
              break;
            }
          }else{
            var login=false;
          }};
          if(login){
            // 同じユーザ名・パスワードを防止する。(同じユーザー名はOK)
            for(let i=0; i<row.length; i++){
              if(row[i]["username"]==newUsername){
                if(row[i]["password"]==newPassword){
                  var pswd_error=true;
                  break;
                }
              }
            }
            if(pswd_error){
              req.session.pswd_error=true;
              return res.redirect('/profile');
            }
            db.serialize(()=>{
            db.run('UPDATE users SET username = ?, password = ? WHERE id = ?', [newUsername, newPassword, userId], (err) => {
              if (err) {
                console.error(err);
                return res.redirect('/login');
              }})});
            // ユーザーネームの更新が完了した場合はセッションも更新
            req.session.username = newUsername;
            // 関連するチームテーブルの更新も追加する。
            // 更新成功した場合はプロフィールページにリダイレクト
            return res.redirect('/profile');
          }else{
            if(login_error){
              req.session.login_error=true;
              return res.redirect("/profile");
            }else{
              req.session.destroy;
              return res.redirect('/login');
          }}});
    }else{
      req.session.destroy;
      return res.redirect('/login');
    }
  });

app.post('/2', (req, res) => {
  if(req.session.username==false){
    req.session.destroy;
    return res.redirect('/login');}
  const message = req.body.message;
  messages.push(message); // メッセージを配列に追加
  return res.redirect('/room/'+req.session.team_number); // 2.ejsにリダイレクト
});

app.listen(3000, () =>
  console.log("Server is running \n port: http://localhost:3000/")
);