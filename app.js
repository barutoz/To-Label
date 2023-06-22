///app.jsの処理を細かくファイル(/routes以下のファイル)に分けました。app.jsには、主にアクセスが来たときにどのファイルに処理をさせるのか書いてあります。
///socket.ioの部分の処理は、別のファイルに切り分けられなかったので、socketioはapp.jsに記述しました。

///モジュールのimport文
const express = require("express");
const sqlite3 = require("sqlite3");
const http = require("http");
const app = express();
const server = http.createServer(app);
const io = require("socket.io")(server);
const session = require("express-session");

///処理を飛ばす先のファイル(/routes以下)
const introductionRouter = require("./routes/introduction");
const loginRouter = require("./routes/login");
const randomRouter = require("./routes/random");
const room_joinRouter = require("./routes/room_join");
const roomRouter = require("./routes/room");
const signupRouter = require("./routes/signup");
const homeRouter = require("./routes/home");
const logoutRouter = require("./routes/logout");
const profileRouter = require("./routes/profile");
const internal_errorRouter = require("./routes/internal_error");
const notfoundRouter = require("./routes/notfound");

///socketioや上の各処理で、共通利用される関数は/function以下のファイルに記述
const authorization_js = require("./function/authorization");

///sessionを設定
sessionMiddleware = session({
  secret: "secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,
    maxage: 1000 * 60 * 30,
  },
});

app.use(sessionMiddleware); ///sessionをexpressで使うと宣言
io.engine.use(sessionMiddleware); ///sessionをsocket.ioでも使うと宣言、これによりexpressとsocketioでsessionが共有される

let time = []; ///sqliteのデータベースに入れるほど、長期間保存しておく必要のない、socketioで使われるデータをここに格納

app.use(express.urlencoded({ extended: true })); ///おまじない
app.use(express.static("public"));
app.set("view engine", "ejs");

///以下socketioの処理
io.on("connection", (socket) => {
  ///フロント側とバック側でsocketioの接続が始まったことを意味する
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
          let db = new sqlite3.Database("DV.sqlite3");
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
                  db.close();
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
                    db.close();
                  } else {
                    db.close();
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
                            db = new sqlite3.Database("DV.sqlite3");
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
                                    db.close();
                                    error = true;
                                  }
                                }
                              );
                              if (!error) {
                                db.close();
                                io.to(authorization).emit("next-before", true);
                              }
                            });
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
          let db = new sqlite3.Database("DV.sqlite3");
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
                  db.close();
                }
              }
            );
            if (!error) {
              db.close();
              var content = [user_authorization, false, false];
              io.to(authorization).emit("prepre", content);
            }
          });
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
                db = new sqlite3.Database("DV.sqlite3");
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
                  db.close();
                  if (error) {
                    io.to(authorization).emit("error");
                    clearInterval(time[ix][4]);
                  } else {
                    io.to(authorization).emit("finish");
                    clearInterval(time[ix][4]);
                  }
                });
              } else {
                db = new sqlite3.Database("DV.sqlite3");
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
                  db.close();
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
          let db = new sqlite3.Database("DV.sqlite3");
          db.all(
            "select * from " + authorization + "_userslist",
            function (err, row) {
              if (err) {
                db.close();
                console.log(err.message);
              } else {
                db.close();
                let to_username;
                for (let i = 0; i < row.length; i++) {
                  if (row[i]["authorization"] == msg[0]) {
                    to_username = row[i]["user"];
                    break;
                  }
                }
                db = new sqlite3.Database("DV.sqlite3");
                var control = authorization_js.create_authorization(
                  authorization,
                  db,
                  "control"
                );
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
                  db.close();
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
          let db = new sqlite3.Database("DV.sqlite3");
          db.all("select * from " + authorization, function (err, row) {
            let exist;
            if (err) {
              console.log(err.message);
              db.close();
            } else {
              db.close();
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
                db = new sqlite3.Database("DV.sqlite3");
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
                  db.close();
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
        let db = new sqlite3.Database("DV.sqlite3");
        db.all("select * from " + authorization, function (err, row) {
          let exist;
          if (err) {
            console.log(err.message);
            db.close();
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
              db = new sqlite3.Database("DV.sqlite3");
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
                db.close();
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
          let db = new sqlite3.Database("DV.sqlite3");
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
            db.close();
          });
        }
        io.to(authorization).emit("leave", user_authorization);
      }
      console.log("user disconnected");
    }
  });
});

///ここに、ルーティングを書いていく。app.use(パス,ファイル先(最初のところで宣言したrequireのやつ))
app.use("/", introductionRouter);
app.use("/home", homeRouter);
app.use("/internal_error", internal_errorRouter);
app.use("/login", loginRouter);
app.use("/logout", logoutRouter);
app.use("/profile", profileRouter);
app.use("/random", randomRouter);
app.use("/room", roomRouter);
app.use("/room/*", room_joinRouter);
app.use("/signup", signupRouter);

app.use("*", notfoundRouter); ///404用、必ず一番最後に記述

server.listen(3000, "0.0.0.0", () =>
  console.log("Server is running \n port: http://localhost:3000/")
);
