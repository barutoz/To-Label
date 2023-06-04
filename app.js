const express = require("express");
const app = express(); ////きなみともや
const multer = require("multer"); // ファイルのアップロードを処理するためのミドルウェア
const path = require("path");
const upload = multer({ dest: "public/uploads/" }); // アップロード先のディレクトリを指定
const sqlite3 = require("sqlite3");
const db = new sqlite3.Database("DV.sqlite3");
var session = require("express-session");
const http = require("http");
var server = http.createServer(app);
var io = require("socket.io")(server);

const sessionMiddleware = session({
  secret: "secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,
    maxage: 1000 * 60 * 30,
  },
});
app.use(sessionMiddleware);
io.engine.use(sessionMiddleware);

// メッセージの配列を初期化
let messages = [];

function number_check(number) {
  if ((number = 0)) {
    return false;
  } else {
    db.all("select number from room_number", function (err, row) {
      for (var ini = 0; ini < row.length; ini++) {
        if (row[ini]["number"] == number) {
          var exists = true;
        }
      }
      if (exists) {
        return false;
      } else {
        return true;
      }
    });
  }
}

function number_generate(number) {
  if (number_check(number) == true) {
    return number;
  } else {
    while (number_check(number) == false) {
      var number = Math.floor(Math.random() * 10000);
    }
    return number;
  }
}

const createPassword = () => {
  var alphabet = "abcdefghijklmnopqrstuvwxyz";
  var alphabetUpper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  var numbers = "0123456789";

  var passBase = alphabet + alphabetUpper + numbers;

  var len = 12; // 12桁
  var password = "";

  for (var i = 0; i < len; i++) {
    password += passBase.charAt(Math.floor(Math.random() * passBase.length));
  }

  return password;
};

function check_authorization(authorization) {
  db.all("select * from room_number", function (err, row) {
    for (let i = 0; i < row.length; i++) {
      if (row[i]["authorization"] == authorization) {
        return true;
      }
    }
    return false;
  });
}

function check_user(authorization) {
  db.all("select * from users", function (err, row) {
    for (let i = 0; i < row.length; i++) {
      if (row[i]["authorization"] == authorization) {
        return true;
      }
    }
    return false;
  });
}

function create_authorization() {
  var authorization = createPassword();
  if (!check_authorization(authorization)) {
    return authorization;
  } else {
    while (check_authorization(authorization) == false) {
      var authorization = createPassword();
    }
    return authorization;
  }
}

function create_user() {
  var authorization = createPassword();
  if (!check_user(authorization)) {
    return authorization;
  } else {
    while (check_user(authorization) == false) {
      var authorization = createPassword();
    }
    return authorization;
  }
}

// CSRF トークンの生成関数
function generateCSRFToken() {
  // ランダムなトークンを生成
  const token =
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15);
  return token;
}

app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");

io.on("connection", (socket) => {
  console.log("a user connected");

  socket.on("team-join", () => {
    if (socket.request.session.authorization) {
      socket.join(socket.request.session.authorization);
      io.to(socket.request.session.authorization).emit("join-join", [
        socket.request.session.user_authorization,
        socket.request.session.username,
      ]);
    }
  });

  socket.on("prepare", (msg) => {
    if (socket.request.session.authorization) {
      var authorization = socket.request.session.authorization;
      var user_authorization = socket.request.session.user_authorization;
      if (msg == true) {
        db.serialize(() => {
          db.run(
            "UPDATE " +
              authorization +
              "_userslist SET permission=1 WHERE authorization='" +
              user_authorization +
              "'"
          );
        });
        var content = [user_authorization, true];
        io.to(authorization).emit("prepre", content);
      } else {
        db.serialize(() => {
          db.run(
            "UPDATE " +
              authorization +
              "_userslist SET permission=0 WHERE authorization='" +
              user_authorization +
              "'"
          );
        });
        var content = [user_authorization, false];
        io.to(authorization).emit("prepre", content);
      }
    }
  });

  socket.on("disconnect", () => {
    var authorization = socket.request.session.authorization;
    var user_authorization = socket.request.session.user_authorization;
    if (authorization) {
      db.serialize(() => {
        db.run(
          "DELETE FROM " +
            authorization +
            "_userslist WHERE authorization='" +
            user_authorization +
            "'"
        );
      });
      io.to(authorization).emit("leave", user_authorization);
      console.log("user disconnected");
    }
  });
});

app.get("/", (req, res) => {
  res.render("index.ejs");
});

app.get("/login", (req, res) => {
  if (req.session.username) {
    return res.redirect("/home");
  } else {
    return res.render("login.ejs");
  }
});

app.post("/login", (req, res) => {
  // ユーザーの検索
  db.all("SELECT * FROM users", function (error, row) {
    for (let i = 0; i < row.length; i++) {
      if (req.body.username == row[i]["username"]) {
        if (req.body.password == row[i]["password"]) {
          var login_id = row[i]["id"];
          var authorization = row[i]["authorization"];
          var login = true;
          break;
        } else {
          var login = false;
        }
      } else {
        var login = false;
      }
    }
    if (login) {
      req.session.userId = login_id;
      req.session.username = req.body.username;
      req.session.user_authorization = authorization;
      return res.redirect("/home");
    } else {
      req.session.destroy;
      return res.render("login.ejs"), { error: true };
    }
  });
});

// サインアップページの表示
app.get("/signup", (req, res) => {
  // CSRF トークンを生成して追加
  const csrfToken = generateCSRFToken();
  req.session.signup = csrfToken;
  res.render("signup.ejs", { csrfToken });
});

// サインアップの POST リクエストの処理
app.post("/signup", (req, res) => {
  const username = req.body.username;
  const password = req.body.password;
  const received_csrfToken = req.body._csrf;
  const session_csrfToken = req.session.signup;
  if (received_csrfToken == session_csrfToken) {
    // 既存のユーザーネームとの重複をチェック
    db.all("SELECT * FROM users", function (err, row) {
      if (err) {
        console.error(err);
        req.session.destroy;
        return res.json({
          success: false,
          message: "エラーが発生しました。もう一度やり直してください。",
        });
      } else {
        for (let i = 0; i < row.length; i++) {
          // ユーザーネーム・パスワードが両方とも同じものがある場合
          if (row[i]["username"] == username) {
            if (row[i]["password"] == password) {
              var pswd_error = true;
              break;
            }
          }
        }
        // ユーザーの作成やデータベースへの保存などの処理を実装する
        if (pswd_error) {
          req.session.destroy;
          return res.json({
            success: false,
            message: "別のパスワードにしてください。",
          });
        } else {
          var authorization = create_user();
          db.serialize(() => {
            db.run(
              "INSERT INTO users (username, password, authorization) VALUES (?, ?, ?)",
              [username, password, authorization],
              (err) => {
                if (err) {
                  console.error(err.message);
                  req.session.destroy;
                  return res.json({
                    success: false,
                    message: "登録に失敗しました。もう一度やり直してください。",
                  });
                }
              }
            );
          });
          req.session.destroy;
          return res.json({ success: true, redirectUrl: "/login" });
        }
      }
    });
  } else {
    req.session.destroy;
    return redirect("/signup");
  }
});

app.get("/home", (req, res) => {
  if (req.session.username) {
    if (req.session.team_error) {
      req.session.team_error = false;
      msg = "不正な番号です。";
    } else {
      msg = "";
    }
    res.render("home.ejs", { username: req.session.username, msg: msg }); // home.ejsにusernameを渡す
  } else {
    req.session.destroy;
    return res.redirect("/login");
  }
});

app.post("/room", (req, res) => {
  if (req.session.user_authorization == false) {
    req.session.destroy;
    return res.redirect("/login");
  }
  db.all("select * from room_number", function (err, row) {
    for (let i = 0; i < row.length; i++) {
      if (row[i]["number"] == req.body.room) {
        var team_number = row[i]["id"];
        var authorization = row[i]["authorization"];
        break;
      } else {
        var team_number = false;
      }
    }
    if (team_number == false) {
      req.session.team_error = true;
      return res.redirect("/home");
    } else {
      req.session.team_number = team_number;
      req.session.authorization = authorization;
      return res.redirect("/room/" + String(team_number));
    }
  });
});

app.get("/room/*", (req, res) => {
  if (req.session.username == false) {
    req.session.destroy;
    return res.redirect("/login");
  }
  var query = req.originalUrl;
  var query_number = query.split("/");
  if (req.session.team_number == false) {
    return res.redirect("/home");
  } else {
    if (!(query_number[2] == req.session.team_number)) {
      return res.redirect("/home");
    }
    db.all("select * from room_number", function (err, row) {
      for (let i = 0; i < row.length; i++) {
        if (row[i]["id"] == req.session.team_number) {
          if (row[i]["authorization"] == req.session.authorization) {
            var password = row[i]["number"];
            var exists = true;
            break;
          } else {
            req.session.destroy;
            return res.redirect("/login");
          }
        } else {
          var exists = false;
        }
      }
      if (exists) {
        db.serialize(() => {
          db.all(
            "select * from " + req.session.authorization + "_userslist",
            function (err, row) {
              console.log(row);
              for (let i = 0; i < row.length; i++) {
                if (row[i]["user"] == req.session.username) {
                  var self_exists = true;
                  var new_i = i;
                  break;
                } else {
                  self_exists = false;
                }
              }
              if (self_exists) {
                row.splice(new_i, 1);
              } else {
                db.run(
                  "INSERT INTO " +
                    req.session.authorization +
                    "_userslist (user,permission,authorization) VALUES('" +
                    req.session.username +
                    "',0,'" +
                    req.session.user_authorization +
                    "');"
                );
              }
              for (let i = 0; i < row.length; i++) {
                row[i]["id"] = String(i + 2);
              }
              username = req.session.username;
              self_authorization = req.session.user_authorization;
              return res.render("entry.ejs", {
                username: username,
                password: password,
                user_list: row,
                self_authorization: self_authorization,
              });
            }
          );
        });
      } else {
        req.session.destroy;
        return res.redirect("/login");
      }
    });
  }
});

app.post("/random", (req, res) => {
  if (req.session.user_authorization == false) {
    req.session.destroy;
    return res.redirect("/login");
  }
  if (req.body.random == "true") {
    var number = Math.floor(Math.random() * 10000);
    var number = number_generate(number);
    var authorization = create_authorization();
    db.all("select number from room_number", function (err, row) {
      var rowrow = row.length + 1;
      db.serialize(() => {
        db.run(
          "INSERT INTO room_number (id,number,authorization,permission) VALUES(" +
            String(rowrow) +
            "," +
            String(number) +
            ',"' +
            authorization +
            '",0)'
        );
        db.run(
          'CREATE TABLE "' +
            authorization +
            '" ( "id"	INTEGER NOT NULL UNIQUE, "from"	TEXT NOT NULL, "to"	TEXT NOT NULL,  "msg"	TEXT NOT NULL, PRIMARY KEY("id" AUTOINCREMENT) );'
        );
        db.run(
          'CREATE TABLE "' +
            authorization +
            '_userslist" ("id"	INTEGER NOT NULL UNIQUE,"user"	TEXT NOT NULL,"permission"	INTEGER NOT NULL, "authorization"	TEXT NOT NULL UNIQUE, PRIMARY KEY("id" AUTOINCREMENT));'
        );
      });
    });
    if (number < 1000) {
      new_number = "0" + String(number);
      if (number < 100) {
        new_number = "0" + new_number;
        if (number < 10) {
          new_number = "0" + new_number;
        }
      }
    } else {
      new_number = String(number);
    }
    res.send(new_number);
  } else {
    res.send(false);
  }
});

app.post("/logout", (req, res) => {
  // セッションを破棄してログアウト
  req.session.destroy((err) => {
    if (err) {
      console.error(err);
    }
    return res.redirect("/");
  });
});

app.get("/profile", (req, res) => {
  // セッションにログインの状態を確認
  if (req.session.userId && req.session.username) {
    if (req.session.pswd_error) {
      req.session.pswd_error = false;
      pswd_error = "このパスワードは使用できません。";
    } else if (req.session.login_error) {
      req.session.login_error = false;
      pswd_error = "今のパスワードが違います。";
    } else {
      pswd_error = "";
    }
    // ログイン済みの場合、ホームページを表示
    res.render("profile.ejs", { pswd_error: pswd_error });
  } else {
    // ログインしていない場合、ログインページにリダイレクト
    req.session.destroy;
    return res.redirect("/login");
  }
});

app.post("/profile", (req, res) => {
  const userId = req.session.userId;
  const oldUserpass = req.body.olduserpass;
  const newUsername = req.body.username;
  const newPassword = req.body.password;
  if (req.session.userId && req.session.username) {
    db.all("SELECT * FROM users", function (error, row) {
      for (let i = 0; i < row.length; i++) {
        if (row[i]["id"] == req.session.userId) {
          if (row[i]["password"] == oldUserpass) {
            var login = true;
            break;
          } else {
            var login = false;
            var login_error = true;
            break;
          }
        } else {
          var login = false;
        }
      }
      if (login) {
        // 同じユーザ名・パスワードを防止する。(同じユーザー名はOK)
        for (let i = 0; i < row.length; i++) {
          if (row[i]["username"] == newUsername) {
            if (row[i]["password"] == newPassword) {
              var pswd_error = true;
              break;
            }
          }
        }
        if (pswd_error) {
          req.session.pswd_error = true;
          return res.redirect("/profile");
        }
        db.serialize(() => {
          db.run(
            "UPDATE users SET username = ?, password = ? WHERE id = ?",
            [newUsername, newPassword, userId],
            (err) => {
              if (err) {
                console.error(err);
                return res.redirect("/login");
              }
            }
          );
        });
        // ユーザーネームの更新が完了した場合はセッションも更新
        req.session.username = newUsername;
        // 関連するチームテーブルの更新も追加する。
        // 更新成功した場合はプロフィールページにリダイレクト
        return res.redirect("/profile");
      } else {
        if (login_error) {
          req.session.login_error = true;
          return res.redirect("/profile");
        } else {
          req.session.destroy;
          return res.redirect("/login");
        }
      }
    });
  } else {
    req.session.destroy;
    return res.redirect("/login");
  }
});

server.listen(3000, () =>
  console.log("Server is running \n port: http://localhost:3000/")
);
