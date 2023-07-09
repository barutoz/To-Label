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
const cron = require("node-cron"); ///定期実行するための、モジュール

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
const helpRouter = require("./routes/help");
const historyRouter = require("./routes/history");
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

const NGword = [
  "fuck",
  "FUCK",
  "巨乳サワー",
  "きょうにゅうさわー",
  "オカスゾ",
  "キョニュウサワー",
  "ファック",
  "ふぁっく",
  "犯すぞ",
  "おかすぞ",
  "姦",
  "まんこ",
  "マンコ",
  "けつあな",
  "けつのあな",
  "ケツアナ",
  "ケツノアナ",
  "けつ穴",
  "けつの穴",
];
const NGpop = [
  "うんこ",
  "うんち",
  "きえろ",
  "ころす",
  "しね",
  "sex",
  "SEX",
  "殺す",
  "消えろ",
  "コロス",
  "キエロ",
  "シネ",
  "セックス",
  "なにをしてんの",
  "何をしてんの",
  "ナニヲシテンノ",
  "unko",
  "UNKO",
  "UNCHI",
  "unchi",
  "ウンチ",
  "みそきん",
  "かにきん",
  "ぐろきん",
  "ひかまに",
  "ひかきん",
  "ミソキン",
  "カニキン",
  "グロキン",
  "ヒカマニ",
  "ヒカキン",
  "ばか",
  "バカ",
  "ごみ",
  "ゴミ",
  "かす",
  "カス",
  "くそ",
  "糞",
  "クソ",
  "ブス",
  "ぶす",
];

app.use(express.urlencoded({ extended: true })); ///おまじない
app.use(express.static("public"));
app.set("view engine", "ejs");

///毎日4時に実行
cron.schedule("0 0 4 * * *", function () {
  var date = Date.now(); ///現在時刻を取得
  console.log(date);
  var delete_date = date - 86400000; ///1日前の時刻を計算
  let db = new sqlite3.Database("DV.sqlite3");
  db.all("SELECT * FROM room_number", function (err, row) {
    if (err) {
      console.log(err.message);
    } else {
      for (let i = 0; i < row.length; i++) {
        ///もし、部屋の作成時間またはゲームの終了時間が、24時間前なら、
        if (row[i]["finish_time"] <= delete_date) {
          ///さらに、ゲーム中でなかったら、
          if (row[i]["permission"] !== 1) {
            db.serialize(() => {
              ///部屋の識別暗号テーブルを削除
              db.run("DROP TABLE " + row[i]["authorization"], (err) => {
                if (err) {
                  console.log(err.message);
                }
              });
              ///部屋の識別暗号_userslistを削除
              db.run(
                "DROP TABLE " + row[i]["authorization"] + "_userslist",
                (err) => {
                  if (err) {
                    console.log(err.message);
                  }
                }
              );
              ///room_numberテーブルから、部屋を削除
              db.run(
                "DELETE FROM room_number WHERE authorization='" +
                  row[i]["authorization"] +
                  "'",
                (err) => {
                  if (err) {
                    console.log(err.message);
                  }
                }
              );
              ///timeリストから、削除
              for (let x = 0; x < time.length; x++) {
                if (time[x][0] == row[i]["authorization"]) {
                  time.splice(x, 1);
                  break;
                }
              }
            });
          }
        }
      }
    }
  });
  db.close();
});

///以下socketioの処理
io.on("connection", (socket) => {
  ///フロント側とバック側でsocketioの接続が始まったことを意味する
  console.log("a user connected");

  ///クライアントがlobbyに入ったら、クライアント側から、通知を受け取る。
  socket.on("team-join", () => {
    ///クライアントのセッションに入っている、部屋の識別暗号を入手。
    var authorization = socket.request.session.authorization;
    ///クライアント側のsessionのステータスを0(lobby)に設定
    socket.request.session.status = 0;
    if (authorization) {
      ///timeリストに、部屋の識別番号が記録されているか確認していく。
      socket.request.session.entry = true;
      for (let i = 0; i < time.length; i++) {
        if (time[i][0] == authorization) {
          ///timeリストに部屋の識別暗号が記録されていたら、制限時間を入手する。
          var time_new = time[i][1];
          ///timeリストで、lobby終了後の3秒タイマーが起動していたら、3秒タイマーをクリアする。
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
      ///もし、timeリストに部屋の識別暗号が記録されていなければ、
      if (!time_new) {
        ///新しくtimeリストに部屋の識別暗号と、デフォルトの制限時間5分を追加する。
        time_new = 5;
        time[time.length] = [authorization, time_new, false];
      }
      ///socketioのroom機能を使って、部屋の識別暗号の名前を付した部屋に入室させる。
      ///さらに、他のユーザーに、入室したユーザーの情報を教える。
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

  ///lobby画面で、準備中または準備OKボタンを押したときの処理
  socket.on("prepare", (msg) => {
    ///修正が必要そう(if(complete)時の処理)
    var error;
    if (socket.request.session.authorization) {
      if (socket.request.session.status == 0) {
        ///チームの識別暗号
        var authorization = socket.request.session.authorization;
        ///ユーザーの識別暗号
        var user_authorization = socket.request.session.user_authorization;
        for (let i = 0; i < time.length; i++) {
          ///timeリストに部屋の識別暗号が記録されていたら、
          if (time[i][0] == authorization) {
            ///timeリストに3秒タイマーが起動していたら、3秒タイマーをクリアする。
            if (time[i][2]) {
              time[i][2] = false;
              clearTimeout(time[i][3]);
              break;
            }
          }
        }
        ///msg==trueつまり、ユーザーが準備できたら、
        if (msg == true) {
          ///dbに接続して、
          let db = new sqlite3.Database("DV.sqlite3");
          ///部屋の識別暗号_userslistテーブルのこのアクセスしてきた人の、permissionを1(つまり、準備できたってこと)にする。
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
            ///他の全てのユーザーのpermissionが1になっているか確認。
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
                    ///他の全てのユーザーのpermissionが1になっていて、かつユーザーの人数が2以上いるなら、(全員準備が整ったら、)
                    if (complete) {
                      var content = [user_authorization, true, true];
                      for (let i = 0; i < time.length; i++) {
                        ///timeリストの部屋の識別暗号のところに、3秒のタイマーをセットする。
                        if (time[i][0] == authorization) {
                          time[i][2] = true;
                          time[i][3] = setTimeout(function () {
                            ///3秒経過したら(特に3秒の間に、他のユーザーが部屋から離脱する、準備状況を変更するなどなければ)、room_numberテーブルの部屋の状況(permission=1)をゲーム中に切り替える。制限時間を登録する。
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
                                db.close(); ///dbは必ず閉める
                                io.to(authorization).emit("next-before", true); ///部屋のユーザーに、3秒経過して、ページを遷移することを通知する。
                              }
                            });
                          }, 3000);
                          break;
                        }
                      }
                      io.to(authorization).emit("prepre", content);
                      ///他のユーザーが準備がまだできていなかったら、とりあえず、この人は準備できたことを他のユーザーに知らせる。
                    } else {
                      var content = [user_authorization, true, false];
                      io.to(authorization).emit("prepre", content);
                    }
                  }
                }
              );
            }
          });
          ///ユーザーから準備が整っていないと、通知が来たら、
        } else {
          let db = new sqlite3.Database("DV.sqlite3");
          ///部屋の識別暗号_userslistのこの人のpermission=0(まだ準備中)にする。
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
            ///他のユーザーにまだ準備が整ってないことを知らせる。
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

  ///制限時間を変更したら、
  socket.on("time", (msg) => {
    if (socket.request.session.authorization) {
      if (socket.request.session.status == 0) {
        if (typeof msg == "number") {
          var authorization = socket.request.session.authorization;
          ///timeリストの部屋の識別暗号のところの制限時間を変更する。
          for (let i = 0; i < time.length; i++) {
            if (time[i][0] == authorization) {
              time[i][1] = msg;
              break;
            }
          }
          ///他のユーザーに新しく変更した時間を通知する。
          io.to(authorization).emit("time_update", msg);
        }
      }
    }
  });

  ///3秒経過して、ゲームをスタートさせる前に、クライアント側から、クライアントの情報について通知をもらう。
  socket.on("next-after", () => {
    var error;
    if (socket.request.session.authorization) {
      var authorization = socket.request.session.authorization;
      if (socket.request.session.status == 0) {
        socket.request.session.entry = false;
        ///ページを遷移するように、クライアントに指示する。
        io.to(socket.request.session.authorization).emit("next", true);
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

        ///ゲームの制限時間をスタートする。
        if (exist) {
          if (typeof time[ix][4] == "undefined") {
            clearTimeout(time[ix][3]);
            let limit = time[ix][1] * 60;
            time[ix][4] = setInterval(function () {
              ///timeリストにタイマー(10秒おきに定期実行タイマー)をセットする。
              limit = limit - 10; ///残り時間
              ///時間がoverしたとき
              if (limit == 0) {
                ///ゲーム終了後1日経ったら、部屋の削除を行うために、ゲームの終了時刻を取得して、room_numberテーブルに保存しておく。
                var date = Date.now(); ///現在時刻を取得
                db = new sqlite3.Database("DV.sqlite3");
                db.serialize(() => {
                  ///room_numberテーブルのpermission=2(ゲーム終了)にする。
                  db.run(
                    "UPDATE room_number SET permission=2, time=0, finish_time=" +
                      date +
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
                  ///部屋の識別暗号テーブルから、レッテルのやり取りをすべて取得して、取得したやり取りをprofile_msgテーブルに転記
                  db.all("SELECT * FROM " + authorization, function (err, row) {
                    if (err) {
                      console.log(err.message);
                    } else {
                      db.all(
                        "SELECT * FROM room_number WHERE authorization='" +
                          authorization +
                          "'",
                        function (err, row2) {
                          if (err) {
                            console.log(err.message);
                          } else {
                            var room_number = row2[0]["number"];
                            for (let i = 0; i < row.length; i++) {
                              ///部屋番号とゲームの終了時間、差出人のusername、レッテルの中身、宛名ユーザーの識別暗号を保存
                              db.run(
                                "INSERT INTO profile_msg (from_username,msg,to_user_authorization,time,room_number) VALUES(?,?,?,?,?)",
                                [
                                  row[i]["from_username"],
                                  row[i]["msg"],
                                  row[i]["player2"],
                                  date,
                                  room_number,
                                ],
                                (err) => {
                                  if (err) {
                                    console.error(err.message);
                                  }
                                }
                              );
                            }
                          }
                        }
                      );
                    }
                    db.close();
                    if (error) {
                      io.to(authorization).emit("error");
                      clearInterval(time[ix][4]);
                    } else {
                      ///部屋の参加者に、結果画面に遷移するように指示する。
                      io.to(authorization).emit("finish");
                      clearInterval(time[ix][4]);
                    }
                  });
                });
                ///10秒おきに実行
              } else {
                db = new sqlite3.Database("DV.sqlite3");
                ///room_numberテーブルの残り時間を10秒ずつ短くする。
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
            }, 10000); ///10秒おきに、処理を行う。
          }
        }
      }
    }
  });

  ///ゲームが始まったら、クライアントのセッションのstatusをゲーム中に更新する。
  socket.on("room-join", () => {
    var authorization = socket.request.session.authorization;
    if (authorization) {
      socket.request.session.status = 1;
      socket.join(authorization);
    }
  });

  ///ゲーム中クライアントがレッテルを送ったら、
  socket.on("msg_submit", (msg) => {
    var error;
    var authorization = socket.request.session.authorization;
    let hiwai;
    let gehin;
    if (authorization) {
      if (socket.request.session.status == 1) {
        if ((msg.length == 2) | (msg.length == 3)) {
          ///不適切な言葉が含まれているかチェックする。
          ///完全にアウトな言葉は、送信できないっていう表示を出す。
          for (let i = 0; i < NGword.length; i++) {
            result = msg[1].includes(NGword[i]);
            if (result) {
              hiwai = true;
              break;
            }
          }
          if (hiwai == true) {
            io.to(socket.id).emit("receive_msg", false);
          } else {
            ///まあそこまで、アウトでもないけど、一応不適切かもしれない言葉は、モーダルで警告する
            if (msg.length == 2) {
              for (let i = 0; i < NGpop.length; i++) {
                result = msg[1].includes(NGpop[i]);
                if (result) {
                  gehin = true;
                  break;
                }
              }
            }
            if (gehin == true) {
              io.to(socket.id).emit("receive_msg", true);
            } else {
              let db = new sqlite3.Database("DV.sqlite3");
              ///部屋の識別暗号_userslistから、宛先のuserの識別暗号のusernameを取得する。
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
                    ///貼ったレッテルのmsgごとの、識別暗号を生成する
                    db = new sqlite3.Database("DV.sqlite3");
                    ///外部の関数を使用する。
                    var control = authorization_js.create_authorization(
                      authorization,
                      db,
                      "control"
                    );
                    ///部屋の識別暗号のテーブルに、この人のuser識別暗号、宛名のuser識別暗号、この人のuseername、宛名のusername、レッテル、レッテル識別暗号を記録する。
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
                      db.close(); ///dbはこまめに閉める。
                    });
                    if (!error) {
                      ///レッテルは他の人にも送信
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
      }
    }
  });

  ///レッテルを編集したときの処理
  socket.on("edit_msg", (msg) => {
    var error;
    var authorization = socket.request.session.authorization;
    let hiwai;
    let gehin;
    if (authorization) {
      if (socket.request.session.status == 1) {
        if ((msg.length == 2) | (msg.length == 3)) {
          ///不適切な言葉が含まれているかチェックする。
          ///完全にアウトな言葉は、送信できないっていう表示を出す。
          for (let i = 0; i < NGword.length; i++) {
            result = msg[0].includes(NGword[i]);
            if (result) {
              hiwai = true;
              break;
            }
          }
          if (hiwai == true) {
            io.to(socket.id).emit("receive_editmsg", false);
          } else {
            ///まあそこまで、アウトでもないけど、一応不適切かもしれない言葉は、モーダルで警告する
            if (msg.length == 2) {
              for (let i = 0; i < NGpop.length; i++) {
                result = msg[0].includes(NGpop[i]);
                if (result) {
                  gehin = true;
                  break;
                }
              }
            }
            if (gehin == true) {
              io.to(socket.id).emit("receive_editmsg", true);
            } else {
              let db = new sqlite3.Database("DV.sqlite3");
              ///部屋の識別暗号のテーブルを取得する。
              db.all("select * from " + authorization, function (err, row) {
                let exist;
                if (err) {
                  console.log(err.message);
                  db.close();
                } else {
                  db.close(); ///dbはこまめに必ず閉める。
                  ///編集するレッテルと同じ識別暗号の、レッテルをテーブルから探してくる。
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
                    ///部屋の識別暗号テーブルのmsgを書き換える。
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
                      db.close(); ///dbは必ずこまめに閉める。
                    });
                    if (!error) {
                      ///処理が終わったら、部屋の他のユーザーに、編集したことを通知する。
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
      }
    }
  });

  ///レッテルを削除したときの処理
  socket.on("delete_msg", (msg) => {
    var error;
    var authorization = socket.request.session.authorization;
    if (authorization) {
      if (socket.request.session.status == 1) {
        let db = new sqlite3.Database("DV.sqlite3");
        ///まずは、部屋の識別暗号テーブルから、レッテル一覧を取得
        db.all("select * from " + authorization, function (err, row) {
          let exist;
          if (err) {
            console.log(err.message);
            db.close();
          } else {
            db.close(); ///必ずこまめに閉める。
            for (let i = 0; i < row.length; i++) {
              ///レッテル一覧に、消されたレッテルと同じ識別暗号のレッテルが存在するかチェック。
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
              ///レッテルを削除
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
                db.close(); ///必ず閉める。こまめに閉める。
              });
              if (!error) {
                ///レッテルが削除されたことを他のユーザーに知らせる。
                io.to(authorization).emit("receive_deletemsg", [to, from, msg]);
              }
            }
          }
        });
      }
    }
  });

  ///クライアントがsocket.ioから接続が切れた時の処理
  socket.on("disconnect", () => {
    var authorization = socket.request.session.authorization;
    var user_authorization = socket.request.session.user_authorization;
    if (authorization) {
      ///sessionに記載のstatusが0つまり、lobbyから接続が切れた場合
      if (socket.request.session.status == 0) {
        for (let i = 0; i < time.length; i++) {
          if (time[i][0] == authorization) {
            ///3秒タイマーが動いている場合は停止
            if (time[i][2]) {
              time[i][2] = false;
              clearTimeout(time[i][3]);
              break;
            }
          }
        }
        ///lobbyから接続が切れた場合(通常)
        if (socket.request.session.entry) {
          let db = new sqlite3.Database("DV.sqlite3");
          db.serialize(() => {
            ///部屋の識別番号_userslistテーブルから名前を抹消
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
            db.close(); ///こまめに閉める。
          });
        }
        ///lobbyから接続が切れた場合で(3秒タイマーが経過後でメンバーが確定し、次の画面遷移に映るような場面)では、先ほどの抹消処理はしない
        ///lobbyから抜けたことを他のユーザーに伝達。
        io.to(authorization).emit("leave", user_authorization);
      }
      ///sessionに記載のステータスが0以外つまり、ゲーム中の時は、何も処理しない。
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
app.use("/setting", profileRouter);
app.use("/help", helpRouter);
app.use("/random", randomRouter);
app.use("/room", roomRouter);
app.use("/room/*", room_joinRouter);
app.use("/signup", signupRouter);
app.use("/history", historyRouter);

app.use("*", notfoundRouter); ///404用、必ず一番最後に記述

server.listen(3000, "0.0.0.0", () =>
  console.log("Server is running \n port: http://localhost:3000/")
);
