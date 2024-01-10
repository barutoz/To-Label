///ここは、ホーム画面で部屋番号を入力して、room.jsで処理が成された後、つれてこられるところ。
const express = require("express");
const sqlite3 = require("sqlite3");
const router = express.Router();

router.get("/", (req, res) => {
  ///sessionでログインされているか確認
  if (req.session.username == false) {
    ///ログインされていない場合は、ログイン画面へリダイレクト。
    req.session.destroy((err) => {
      if (err) {
        console.error(err);
      }
      return res.redirect("/login");
    });
  }
  ///以下2文で、/room/{部屋の通し番号}の部屋の通し番号を取得している。
  var query = req.originalUrl;
  var query_number = query.split("/");
  ///sessionに保存されているteamの通し番号が在るか確認。
  ///ない場合は、ホーム画面へリダイレクト
  if (req.session.team_number == false) {
    return res.redirect("/");
    ///ある場合
  } else {
    ///sessionに保存されている通し番号と、urlから取得された通し番号が一致しているか確認。
    ///一致していない場合はホーム画面へリダイレクト
    if (!(query_number[2] == req.session.team_number)) {
      return res.redirect("/");
    }
    let db = new sqlite3.Database("DV.sqlite3");
    ///room_numberテーブルにアクセスして、部屋の一覧を取得してくる。
    db.all("select * from room_number", function (err, row) {
      if (err) {
        console.error(err.message);
        db.close();
        return res.render("error.ejs", { code: "500" });
      }
      db.close(); ///必ず閉める
      for (let i = 0; i < row.length; i++) {
        ///sessionに保存されている通し番号と、チームの識別暗号が両方ともテーブル上の情報と一致していたら、
        if (row[i]["id"] == req.session.team_number) {
          if (row[i]["authorization"] == req.session.authorization) {
            ///チームの4桁番号・状況・ゲームしている場合は経過時間・制限時間を取得
            var password = row[i]["number"];
            var permission = row[i]["permission"];
            var time = row[i]["time"];
            var original_time = row[i]["original_time"];
            var exists = true;
            break;
            ///一致しなければ、不正アクセスと思われるので、ログイン画面へリダイレクト
          } else {
            req.session.destroy((err) => {
              if (err) {
                console.error(err);
              }
              return res.redirect("/login");
            });
          }
        } else {
          var exists = false;
        }
      }
      if (exists) {
        ///部屋の状況がプレイヤー募集中(permission=0)であれば
        if (permission == 0) {
          db = new sqlite3.Database("DV.sqlite3");
          db.serialize(() => {
            /// 部屋の識別暗号_userslistテーブルから部屋の参加者一覧を取得
            db.all(
              "select * from " + req.session.authorization + "_userslist",
              function (err, row) {
                if (err) {
                  console.error(err.message);
                  db.close();
                  return res.render("error.ejs", { code: "500" });
                }
                for (let i = 0; i < row.length; i++) {
                  ///部屋の参加者一覧に、アクセスしてきた人がいれば、
                  if (
                    row[i]["authorization"] == req.session.user_authorization
                  ) {
                    var self_exists = true;
                    var new_i = i;
                    break;
                    ///まだ名前がなければ、
                  } else {
                    self_exists = false;
                  }
                }
                if (self_exists) {
                  db.close(); ///必ず閉める
                  row.splice(new_i, 1);
                  ///まだ名前がなければ、
                } else {
                  ///テーブルにこの人のuser識別暗号,username,準備状況を0つまり準備中(もうゲームを始められる状況にあるか)を登録
                  db.run(
                    "INSERT INTO " +
                      req.session.authorization +
                      "_userslist (user,permission,authorization) VALUES(?,?,?);",
                    [req.session.username, 0, req.session.user_authorization],
                    (err) => {
                      if (err) {
                        console.error(err.message);
                        db.close();
                        return res.render("error.ejs", { code: "500" });
                      }
                    }
                  );
                  db.close(); ///必ず閉める
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
                ///entry.ejsつまりlobby画面を渡す。
                return res.render("entry.ejs", {
                  ///この人のusername
                  username: username,
                  ///部屋の4桁の番号
                  password: password,
                  ///他の部屋の参加者
                  user_list: row,
                  ///この人のuser識別暗号も埋め込んで送る。
                  self_authorization: self_authorization,
                });
              }
            );
          });
          ///部屋の状況がプレイヤー募集中でない場合は
        } else {
          let user_list;
          let other_users = [];
          let other_users_authorization;
          let other_users_user;
          let redirecting = true;
          let msg_list = [];
          let your_msg_list = [];
          let other_msg_list = [];
          let color; ///プレイヤーのカラーを取得
          db = new sqlite3.Database("DV.sqlite3");
          ///部屋の識別暗号_userslistテーブルから、部屋の参加者一覧を取得
          db.all(
            "select * from " + req.session.authorization + "_userslist",
            function (err, row) {
              if (err) {
                console.error(err.message);
                db.close();
                return res.render("error.ejs", { code: "500" });
              }
              db.close(); ///必ず閉める
              user_list = row;
              for (let i = 0; i < row.length; i++) {
                ///この人が参加者一覧に存在することを確認
                if (row[i]["authorization"] == req.session.user_authorization) {
                  redirecting = false;
                  color = row[i]["color"];
                  ///加えて、この人を除く他の参加者リストも作成(他の参加者のusernameとuser識別暗号を取得)
                } else {
                  other_users_user = row[i]["user"];
                  other_users_authorization = row[i]["authorization"];
                  other_users_color = row[i]["color"];
                  other_users.push({
                    user: other_users_user,
                    authorization: other_users_authorization,
                    color: other_users_color,
                  });
                }
              }
              ///この人が参加者一覧になければ、
              if (redirecting) {
                ///もうこのセッションは締め切られている表示とともに、ホーム画面へリダイレクト
                req.session.team_error2 = true;
                return res.redirect("/");
                ///この人が参加者一覧にいるなら、
              } else {
                db = new sqlite3.Database("DV.sqlite3");
                ///部屋の識別暗号テーブルから、部屋内のやりとり(to-label)一覧を取得
                db.all(
                  "select * from " + req.session.authorization,
                  function (err, row) {
                    if (err) {
                      console.error(err.message);
                      db.close();
                      return res.render("error.ejs", { code: "500" });
                    }
                    db.close(); ///必ず閉める。こまめに閉める。
                    msg_list = row;
                    ///部屋がゲーム中の場合
                    if (permission == 1) {
                      for (let i = 0; i < msg_list.length; i++) {
                        ///部屋のやりとり一覧の送り元が、この人のuser識別暗号に一致している場合は
                        if (
                          msg_list[i]["player1"] ==
                          req.session.user_authorization
                        ) {
                          ///your_msg_listにそのやりとりを加える。
                          your_msg_list.push(msg_list[i]);
                          ///部屋のやりとり一覧の送り元・宛名ともに、この人のuser識別番号でなければ(つまり、第三者間のやりとりなら)
                        } else if (
                          msg_list[i]["player1"] !==
                            req.session.user_authorization &&
                          msg_list[i]["player2"] !==
                            req.session.user_authorization
                        ) {
                          ///other_msg_listにそのやりとりを加える
                          other_msg_list.push(msg_list[i]);
                        }
                      }

                      ///ゲーム画面に、他のユーザー一覧・your_msg_list・other_msg_list・この人のuser識別暗号・ゲームの経過時間・制限時間を埋め込んで送る。
                      return res.render("room.ejs", {
                        other_users: other_users,
                        your_msg_list: your_msg_list,
                        other_msg_list: other_msg_list,
                        self_authorization: req.session.user_authorization,
                        time: time,
                        original_time: original_time,
                        color: color,
                      });
                      ///部屋がゲーム終了後のときは
                    } else if ((permission = 2)) {
                      for (let i = 0; i < msg_list.length; i++) {
                        ///部屋のやりとり一覧の宛名がこの人のuser識別暗号なら、
                        if (
                          msg_list[i]["player2"] ==
                          req.session.user_authorization
                        ) {
                          ///your_msg_listにそのやりとりを入れる
                          for (let y = 0; y < other_users.length; y++) {
                            if (
                              msg_list[i]["player1"] ==
                              other_users[y]["authorization"]
                            ) {
                              msg_list[i]["color"] = other_users[y]["color"];
                              break;
                            }
                          }
                          your_msg_list.push(msg_list[i]);
                        }
                      }
                      ///他の人へのレッテルをかき集めてくる。
                      for (let x = 0; x < other_users.length; x++) {
                        let msg_for_particular_player = [];
                        for (let i = 0; i < msg_list.length; i++) {
                          if (
                            msg_list[i]["player2"] ==
                            other_users[x]["authorization"]
                          ) {
                            for (let k = 0; k < user_list.length; k++) {
                              if (
                                msg_list[i]["player1"] ==
                                user_list[k]["authorization"]
                              ) {
                                msg_list[i]["color"] = user_list[k]["color"];
                                break;
                              }
                            }

                            msg_for_particular_player.push(msg_list[i]);
                          }
                        }
                        other_msg_list.push([
                          other_users[x]["user"],
                          other_users[x]["color"],
                          msg_for_particular_player,
                        ]);
                      } ///ゲームの結果画面に、your_msg_listとこの人のusernameを埋め込んで送る。

                      return res.render("result.ejs", {
                        your_msg_list: your_msg_list,
                        username: req.session.username,
                        color: color,
                        other_msg_list: other_msg_list,
                        other_users: other_users,
                      });
                    }
                  }
                );
              }
            }
          );
        }
      } else {
        req.session.destroy((err) => {
          if (err) {
            console.error(err);
          }
          return res.redirect("/login");
        });
      }
    });
  }
});

module.exports = router;
