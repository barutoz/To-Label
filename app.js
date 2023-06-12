const express = require("express");
const app = express(); ////きなみともや
const multer = require("multer"); // ファイルのアップロードを処理するためのミドルウェア
const path = require("path");
const upload = multer({ dest: "public/uploads/" }); // アップロード先のディレクトリを指定
const sqlite3 = require("sqlite3");
const db = new sqlite3.Database("DV.sqlite3");
var session = require("express-session");
const http = require("http");
const { url } = require("inspector");
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

const number_list = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

function number_check(number) {
  if ((number = 0)) {
    return false;
  } else {
    db.all("select number from room_number", function (err, row) {
      if (err) {
        console.error(err.message);
        return false; ///厳密にいうと対策が必要。だけど、ほぼほぼerrが発生することはないし、数字被りも起きない、起きるとしても天文学的な確率なので考えない。
      } else {
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
  if (number_list.includes(authorization.substring(0, 1))) {
    return true;
  } else {
    db.all("select * from room_number", function (err, row) {
      if (err) {
        console.error(err.message);
        return false; ///厳密にいうと対策が必要。だけど、ほぼほぼerrが発生することはないし、数字被りも起きない、起きるとしても天文学的な確率なので考えない。
      } else {
        for (let i = 0; i < row.length; i++) {
          if (row[i]["authorization"] == authorization) {
            var exists = true;
            break;
          } else {
            var exists = false;
          }
        }
        if (exists) {
          return true;
        } else {
          return false;
        }
      }
    });
  }
}

function check_control(authorization, room) {
  if (number_list.includes(authorization.substring(0, 1))) {
    return true;
  } else {
    db.all("select * from " + room, function (err, row) {
      if (err) {
        console.error(err.message);
        return false; ///厳密にいうと対策が必要。だけど、ほぼほぼerrが発生することはないし、数字被りも起きない、起きるとしても天文学的な確率なので考えない。
      } else {
        for (let i = 0; i < row.length; i++) {
          if (row[i]["control"] == authorization) {
            var exists = true;
            break;
          } else {
            var exists = false;
          }
        }
        if (exists) {
          return true;
        } else {
          return false;
        }
      }
    });
  }
}

function check_user(authorization) {
  if (number_list.includes(authorization.substring(0, 1))) {
    return true;
  } else {
    db.all("select * from users", function (err, row) {
      if (err) {
        console.error(err.message);
        return false; ///厳密にいうと対策が必要。だけど、ほぼほぼerrが発生することはないし、数字被りも起きない、起きるとしても天文学的な確率なので考えない。
      } else {
        for (let i = 0; i < row.length; i++) {
          if (row[i]["authorization"] == authorization) {
            var exists = true;
            break;
          } else {
            var exists = false;
          }
        }
        if (exists) {
          return true;
        } else {
          return false;
        }
      }
    });
  }
}

function create_authorization() {
  var authorization = createPassword();
  while (check_authorization(authorization) == true) {
    authorization = createPassword();
  }
  return authorization;
}

function create_control(room) {
  var authorization = createPassword();
  while (check_control(authorization, room) == true) {
    authorization = createPassword();
  }
  return authorization;
}

function create_user() {
  var authorization = createPassword();
  while (check_user(authorization) == true) {
    var authorization = createPassword();
  }
  return authorization;
}

// CSRF トークンの生成関数
function generateCSRFToken() {
  // ランダムなトークンを生成
  const token =
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15);
  return token;
}

let time = [];

app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");

io.on("connection", (socket) => {
  console.log("a user connected");
  socket.on("team-join", () => {
    var authorization = socket.request.session.authorization;
    socket.request.session.status = 0;
    if (authorization) {
      socket.request.session.entry = true;
      for (let i = 0; i < time.length; i++) {
        if (time[i][0] == authorization) {
          var time_new = time[i][1];
          if (time[i][2]) {
            time[i][2] = false;
            clearTimeout(time[i][3]);
          }
          break;
        } else {
          var time_new = false;
          var status = false;
        }
      }
      if (!time_new) {
        time_new = 5;
        time[time.length] = [authorization, time_new, false];
      }
      if (!status) {
        socket.join(socket.request.session.authorization);
        io.to(socket.request.session.authorization).emit("join-join", [
          socket.request.session.user_authorization,
          socket.request.session.username,
          time_new,
          false,
        ]);
      } else {
        socket.join(socket.request.session.authorization);
        io.to(socket.request.session.authorization).emit("join-join", [
          socket.request.session.user_authorization,
          socket.request.session.username,
          time_new,
          true,
        ]);
      }
    }
  });

  socket.on("prepare", (msg) => {
    ///修正が必要そう(if(complete)時の処理)
    var error;
    if (socket.request.session.authorization) {
      if (socket.request.session.status == 0) {
        var authorization = socket.request.session.authorization;
        var user_authorization = socket.request.session.user_authorization;
        for (let i = 0; i < time.length; i++) {
          if (time[i][0] == authorization) {
            if (time[i][2]) {
              time[i][2] = false;
              clearTimeout(time[i][3]);
              break;
            }
          }
        }
        if (msg == true) {
          db.serialize(() => {
            db.run(
              "UPDATE " +
                authorization +
                "_userslist SET permission=1 WHERE authorization='" +
                user_authorization +
                "'",
              (err) => {
                if (err) {
                  console.log(err.message);
                  error = true;
                }
              }
            );
            if (!error) {
              db.all(
                "SELECT permission FROM " + authorization + "_userslist",
                function (err, row) {
                  if (err) {
                    console.error(err.message);
                  } else {
                    for (let i = 0; i < row.length; i++) {
                      if (row[i]["permission"] == 0) {
                        var complete = false;
                        break;
                      } else {
                        var complete = true;
                      }
                    }

                    if (row.length < 2) {
                      var complete = false;
                    }
                    if (complete) {
                      var content = [user_authorization, true, true];
                      for (let i = 0; i < time.length; i++) {
                        if (time[i][0] == authorization) {
                          time[i][2] = true;
                          time[i][3] = setTimeout(function () {
                            db.serialize(() => {
                              db.run(
                                "UPDATE room_number SET permission=1, time=" +
                                  time[i][1] * 60 +
                                  ", original_time=" +
                                  time[i][1] * 60 +
                                  " WHERE authorization='" +
                                  authorization +
                                  "'",
                                (err) => {
                                  if (err) {
                                    console.log(err.message);
                                    error = true;
                                  }
                                }
                              );
                            });
                            if (!error) {
                              io.to(authorization).emit("next-before", true);
                            }
                          }, 3000);
                          break;
                        }
                      }
                      io.to(authorization).emit("prepre", content);
                    } else {
                      var content = [user_authorization, true, false];
                      io.to(authorization).emit("prepre", content);
                    }
                  }
                }
              );
            }
          });
        } else {
          db.serialize(() => {
            db.run(
              "UPDATE " +
                authorization +
                "_userslist SET permission=0 WHERE authorization='" +
                user_authorization +
                "'",
              (err) => {
                if (err) {
                  console.log(err.message);
                  error = true;
                }
              }
            );
          });
          if (!error) {
            var content = [user_authorization, false, false];
            io.to(authorization).emit("prepre", content);
          }
        }
      }
    }
  });

  socket.on("time", (msg) => {
    if (socket.request.session.authorization) {
      if (socket.request.session.status == 0) {
        if (typeof msg == "number") {
          var authorization = socket.request.session.authorization;
          for (let i = 0; i < time.length; i++) {
            if (time[i][0] == authorization) {
              time[i][1] = msg;
              break;
            }
          }
          io.to(authorization).emit("time_update", msg);
        }
      }
    }
  });

  socket.on("next-after", () => {
    var error;
    if (socket.request.session.authorization) {
      var authorization = socket.request.session.authorization;
      if (socket.request.session.status == 0) {
        socket.request.session.entry = false;
        socket.emit("next", true);
        let exist;
        let ix;
        for (let i = 0; i < time.length; i++) {
          if (time[i][0] == authorization) {
            exist = true;
            ix = i;
            break;
          } else {
            exist = false;
          }
        }
        console.log(ix);
        if (exist) {
          console.log("er");
          if (typeof time[ix][4] == "undefined") {
            console.log("kinami");
            clearTimeout(time[ix][3]);
            let limit = time[ix][1] * 60;
            time[ix][4] = setInterval(function () {
              limit = limit - 10;
              if (limit == 0) {
                db.serialize(() => {
                  db.run(
                    "UPDATE room_number SET permission=2, time=0 WHERE authorization='" +
                      authorization +
                      "'",
                    (err) => {
                      if (err) {
                        console.log(err.message);
                        error = true;
                      }
                    }
                  );
                });
                if (error) {
                  io.to(authorization).emit("error");
                  clearInterval(time[ix][4]);
                } else {
                  io.to(authorization).emit("finish");
                  clearInterval(time[ix][4]);
                }
              } else {
                db.serialize(() => {
                  db.run(
                    "UPDATE room_number SET permission=1, time=" +
                      limit +
                      " WHERE authorization='" +
                      authorization +
                      "'",
                    (err) => {
                      if (err) {
                        console.log(err.message);
                      }
                    }
                  );
                });
              }
            }, 10000);
          }
        }
      }
    }
  });

  socket.on("room-join", () => {
    var authorization = socket.request.session.authorization;
    if (authorization) {
      socket.request.session.status = 1;
      socket.join(authorization);
    }
  });

  socket.on("msg_submit", (msg) => {
    var error;
    var authorization = socket.request.session.authorization;
    if (authorization) {
      if (socket.request.session.status == 1) {
        if (msg.length == 2) {
          db.all(
            "select * from " + authorization + "_userslist",
            function (err, row) {
              if (err) {
                console.log(err.message);
              } else {
                let to_username;
                for (let i = 0; i < row.length; i++) {
                  if (row[i]["authorization"] == msg[0]) {
                    to_username = row[i]["user"];
                    break;
                  }
                }
                var control = create_control(authorization);
                db.serialize(() => {
                  db.run(
                    "INSERT INTO " +
                      authorization +
                      "(player1, player2, msg, from_username, to_username, control) VALUES(?, ?, ?, ?, ?, ?)",
                    [
                      socket.request.session.user_authorization,
                      msg[0],
                      msg[1],
                      socket.request.session.username,
                      to_username,
                      control,
                    ],
                    (err) => {
                      if (err) {
                        console.error(err.message);
                        error = true;
                      }
                    }
                  );
                });
                if (!error) {
                  io.to(authorization).emit("receive_msg", [
                    socket.request.session.user_authorization,
                    msg[0],
                    msg[1],
                    socket.request.session.username,
                    to_username,
                    control,
                  ]);
                }
              }
            }
          );
        }
      }
    }
  });

  socket.on("edit_msg", (msg) => {
    var error;
    var authorization = socket.request.session.authorization;
    if (authorization) {
      if (socket.request.session.status == 1) {
        if (msg.length == 2) {
          db.all("select * from " + authorization, function (err, row) {
            let exist;
            if (err) {
              console.log(err.message);
            } else {
              for (let i = 0; i < row.length; i++) {
                if (row[i]["control"] == msg[1]) {
                  exist = true;
                  var to = row[i]["player2"];
                  var from = row[i]["player1"];
                  break;
                } else {
                  exist = false;
                }
              }
              if (exist) {
                db.serialize(() => {
                  db.run(
                    "UPDATE " +
                      authorization +
                      " SET msg='" +
                      msg[0] +
                      "' WHERE control='" +
                      msg[1] +
                      "'",
                    (err) => {
                      if (err) {
                        console.error(err.message);
                        error = true;
                      }
                    }
                  );
                });
                if (!error) {
                  io.to(authorization).emit("receive_editmsg", [
                    to,
                    from,
                    msg[0],
                    msg[1],
                  ]);
                }
              }
            }
          });
        }
      }
    }
  });

  socket.on("delete_msg", (msg) => {
    var error;
    var authorization = socket.request.session.authorization;
    if (authorization) {
      if (socket.request.session.status == 1) {
        db.all("select * from " + authorization, function (err, row) {
          let exist;
          if (err) {
            console.log(err.message);
          } else {
            for (let i = 0; i < row.length; i++) {
              if (row[i]["control"] == msg) {
                exist = true;
                var to = row[i]["player2"];
                var from = row[i]["player1"];
                break;
              } else {
                exist = false;
              }
            }
            if (exist) {
              db.serialize(() => {
                db.run(
                  "DELETE FROM " +
                    authorization +
                    " WHERE control='" +
                    msg +
                    "'",
                  (err) => {
                    if (err) {
                      console.error(err.message);
                      error = true;
                    }
                  }
                );
              });
              if (!error) {
                io.to(authorization).emit("receive_deletemsg", [to, from, msg]);
              }
            }
          }
        });
      }
    }
  });

  socket.on("disconnect", () => {
    var authorization = socket.request.session.authorization;
    var user_authorization = socket.request.session.user_authorization;
    if (authorization) {
      if (socket.request.session.status == 0) {
        for (let i = 0; i < time.length; i++) {
          if (time[i][0] == authorization) {
            if (time[i][2]) {
              time[i][2] = false;
              clearTimeout(time[i][3]);
              break;
            }
          }
        }
        if (socket.request.session.entry) {
          db.serialize(() => {
            db.run(
              "DELETE FROM " +
                authorization +
                "_userslist WHERE authorization='" +
                user_authorization +
                "'",
              (err) => {
                if (err) {
                  console.error(err.message);
                }
              }
            );
          });
        }
        io.to(authorization).emit("leave", user_authorization);
      }
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
    return res.render("login.ejs", { error: false });
  }
});

app.post("/login", (req, res) => {
  // ユーザーの検索
  db.all("SELECT * FROM users", function (err, row) {
    if (err) {
      console.error(err.message);
      return res.render("error.ejs", { code: "500" });
    }
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
        console.error(err.message);
        return res.render("error.ejs", { code: "500" });
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
                  return res.render("error.ejs", { code: "500" });
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
    } else if (req.session.team_error2) {
      req.session.team_error2 = false;

      msg = "このセッションは締め切られてます。";
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
  if (req.body.room.length !== 4) {
    req.session.team_error = true;
    return res.redirect("/home");
  }
  db.all("select * from room_number", function (err, row) {
    if (err) {
      console.error(err.message);
      return res.render("error.ejs", { code: "500" });
    } else {
      for (let i = 0; i < row.length; i++) {
        if (row[i]["number"] == req.body.room) {
          var team_number = row[i]["id"];
          var authorization = row[i]["authorization"];
          var permission = row[i]["permission"];
          break;
        } else {
          var team_number = false;
        }
      }
      if (team_number == false) {
        req.session.team_error = true;
        return res.redirect("/home");
      } else {
        if (permission !== 0) {
          db.all(
            "select * from " + authorization + "_userslist",
            function (err, row) {
              if (err) {
                console.error(err.message);
                return res.render("error.ejs", { code: "500" });
              }
              for (let i = 0; i < row.length; i++) {
                if (row[i]["authorization"] == req.session.user_authorization) {
                  var redirecting = false;
                  break;
                } else {
                  var redirecting = true;
                }
              }
              if (redirecting) {
                req.session.team_error2 = true;

                return res.redirect("/home");
              } else {
                req.session.team_number = team_number;
                req.session.authorization = authorization;
                return res.redirect("/room/" + String(team_number));
              }
            }
          );
        } else {
          req.session.team_number = team_number;
          req.session.authorization = authorization;
          return res.redirect("/room/" + String(team_number));
        }
      }
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
      if (err) {
        console.error(err.message);
        return res.render("error.ejs", { code: "500" });
      }
      for (let i = 0; i < row.length; i++) {
        if (row[i]["id"] == req.session.team_number) {
          if (row[i]["authorization"] == req.session.authorization) {
            var password = row[i]["number"];
            var permission = row[i]["permission"];
            var time = row[i]["time"];
            var original_time = row[i]["original_time"];
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
        if (permission == 0) {
          db.serialize(() => {
            db.all(
              "select * from " + req.session.authorization + "_userslist",
              function (err, row) {
                if (err) {
                  console.error(err.message);
                  return res.render("error.ejs", { code: "500" });
                }
                ///トラブル頻発エリア(rowが定義されていないエラー)
                for (let i = 0; i < row.length; i++) {
                  if (
                    row[i]["authorization"] == req.session.user_authorization
                  ) {
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
                      "');",
                    (err) => {
                      if (err) {
                        console.error(err.message);
                        return res.render("error.ejs", { code: "500" });
                      }
                    }
                  );
                }
                for (let i = 0; i < row.length; i++) {
                  row[i]["id"] = String(i + 2);
                }
                username = req.session.username;
                self_authorization = req.session.user_authorization;
                if (password < 1000) {
                  if (password < 100) {
                    if (password < 10) {
                      password = "000" + String(password);
                    } else {
                      password = "00" + String(password);
                    }
                  } else {
                    password = "0" + String(password);
                  }
                }
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
          let other_users = [];
          let other_users_authorization;
          let other_users_user;
          let redirecting = true;
          let msg_list = [];
          let your_msg_list = [];
          let other_msg_list = [];
          db.all(
            "select * from " + req.session.authorization + "_userslist",
            function (err, row) {
              if (err) {
                console.error(err.message);
                return res.render("error.ejs", { code: "500" });
              }
              for (let i = 0; i < row.length; i++) {
                if (row[i]["authorization"] == req.session.user_authorization) {
                  redirecting = false;
                } else {
                  other_users_user = row[i]["user"];
                  other_users_authorization = row[i]["authorization"];
                  other_users[i] = {
                    user: other_users_user,
                    authorization: other_users_authorization,
                  };
                }
              }
              if (redirecting) {
                req.session.team_error2 = true;
                return res.redirect("/home");
              } else {
                db.all(
                  "select * from " + req.session.authorization,
                  function (err, row) {
                    if (err) {
                      console.error(err.message);
                      return res.render("error.ejs", { code: "500" });
                    }
                    msg_list = row;
                    if (permission == 1) {
                      for (let i = 0; i < msg_list.length; i++) {
                        if (
                          msg_list[i]["player1"] ==
                          req.session.user_authorization
                        ) {
                          your_msg_list.push(msg_list[i]);
                        } else if (
                          msg_list[i]["player1"] !==
                            req.session.user_authorization &&
                          msg_list[i]["player2"] !==
                            req.session.user_authorization
                        ) {
                          other_msg_list.push(msg_list[i]);
                        }
                      }
                      return res.render("room.ejs", {
                        other_users: other_users,
                        your_msg_list: your_msg_list,
                        other_msg_list: other_msg_list,
                        self_authorization: req.session.user_authorization,
                        time: time,
                        original_time: original_time,
                      });
                    } else if ((permission = 2)) {
                      for (let i = 0; i < msg_list.length; i++) {
                        if (
                          msg_list[i]["player2"] ==
                          req.session.user_authorization
                        ) {
                          your_msg_list.push(msg_list[i]);
                        }
                      }
                      return res.render("result.ejs", {
                        your_msg_list: your_msg_list,
                        username: req.session.username,
                      });
                    }
                  }
                );
              }
            }
          );
        }
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
      if (err) {
        console.error(err.message);
        return res.render("error.ejs", { code: "500" });
      }
      var rowrow = row.length + 1;
      db.serialize(() => {
        db.run(
          "INSERT INTO room_number (id,number,authorization,permission) VALUES(" +
            String(rowrow) +
            "," +
            String(number) +
            ',"' +
            authorization +
            '",0)',
          (err) => {
            if (err) {
              console.error(err.message);
              return res.render("error.ejs", { code: "500" });
            }
          }
        );
        db.run(
          'CREATE TABLE "' +
            authorization +
            '" ( "id"	INTEGER NOT NULL UNIQUE, "player1"	TEXT NOT NULL, "player2"	TEXT NOT NULL,  "msg"	TEXT NOT NULL, "from_username" TEXT NOT NULL,"to_username" TEXT NOT NULL, "control" TEXT NOT NULL UNIQUE, PRIMARY KEY("id" AUTOINCREMENT) );',
          (err) => {
            if (err) {
              console.error(err.message);
              return res.render("error.ejs", { code: "500" });
            }
          }
        );
        db.run(
          'CREATE TABLE "' +
            authorization +
            '_userslist" ("id"	INTEGER NOT NULL UNIQUE,"user"	TEXT NOT NULL,"permission"	INTEGER NOT NULL, "authorization"	TEXT NOT NULL UNIQUE, PRIMARY KEY("id" AUTOINCREMENT));',
          (err) => {
            if (err) {
              console.error(err.message);
              return res.render("error.ejs", { code: "500" });
            }
          }
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

app.get("/logout", (req, res) => {
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
    db.all("SELECT * FROM users", function (err, row) {
      if (err) {
        console.error(err.message);
        return res.render("error.ejs", { code: "500" });
      }
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

app.get("/internal_error", (req, res) => {
  return res.render("error.ejs", { code: "500" });
});

app.get("*", (req, res) => {
  return res.render("error.ejs", { code: "404" });
});

server.listen(3000, "0.0.0.0", () =>
  console.log("Server is running \n port: http://localhost:3000/")
);
