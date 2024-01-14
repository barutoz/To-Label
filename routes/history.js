const express = require("express");
const sqlite3 = require("sqlite3");
const router = express.Router();

///ユーザーが今までにもらったレッテル一覧を表示するための、処理　(/histroy)
router.get("/", (req, res) => {
  ///ログイン済みかチェックする
  if (req.session.username && req.session.user_authorization) {
    username = req.session.username; ///username
    user_authorization = req.session.user_authorization; ///user識別暗号
    let db = new sqlite3.Database("DV.sqlite3");
    ///profile_msg(今までのレッテル一覧テーブル)にアクセスする。
    db.all("SELECT * FROM profile_msg", function (err, row) {
      if (err) {
        console.log(err.message);
        db.close();
        return res.render("error.ejs", { code: 500 });
      } else {
        db.close(); ///db閉める。
        let your_list = [];
        for (i = 0; i < row.length; i++) {
          if (row[i]["to_user_authorization"] == user_authorization) {
            your_list.push({
              from_username: row[i]["from_username"],
              msg: row[i]["msg"],
              time: row[i]["time"],
              room_number: row[i]["room_number"],
              color: row[i]["from_color"],
            });
          }
        }
        ///もし、レッテルを過去にもらったことがない場合は、レッテルないよ、表示を出す。
        if (your_list.length == 0) {
          return res.render("history.ejs", {
            username: username,
            exists: false,
            list: [],
          });
          ///レッテルの数が1この場合は、その1つのレッテルをそのまま送信する。
        } else if (your_list.length == 1) {
          var date = new Date(your_list[0]["time"]);
          your_list[0]["time"] = date.toLocaleString("ja"); ///レッテルをもらった時間はエポック秒で登録されているので、見やすい表示に変換
          return res.render("history.ejs", {
            username: username,
            exists: true,
            list: [your_list],
          });
          ///レッテルの数が2こ以上の場合は、過去のレッテルをレッテルをもらった時間順に並び替え
        } else {
          your_list.sort(function (a, b) {
            if (a.time < b.time) return 1;
            if (a.time > b.time) return -1;
            return 0;
          });
          ///レッテルの数が2つの場合
          if (your_list.length == 2) {
            var date = new Date(your_list[0]["time"]);
            your_list[0]["time"] = date.toLocaleString("ja"); ///エポック秒変換
            var date = new Date(your_list[1]["time"]);
            your_list[1]["time"] = date.toLocaleString("ja"); ///エポック秒変換
            ///レッテルをもらった時間が同一の場合(つまり、同じセッションで2つのレッテルを受け取った場合)
            ///2つのレッテルは同じ部屋でもらったものだよ表示にする
            if (your_list[0]["time"] == your_list[1]["time"]) {
              return res.render("history.ejs", {
                username: username,
                exists: true,
                list: [your_list],
              });
              ///レッテルをもらった時間が異なる場合(つまり、違うセッションで1つずつ受け取った場合)
              ///違う部屋でもらったモノだよ表示に
            } else {
              return res.render("history.ejs", {
                username: username,
                exists: true,
                list: [[your_list[0]], [your_list[1]]],
              });
            }
            ///レッテルの数が3つ以上の場合
          } else {
            let newlist = [];
            let list = [];
            for (i = 1; i < your_list.length; i++) {
              ///時間順に1番目と2番目のレッテルについて
              if (i == 1) {
                var date = new Date(your_list[0]["time"]);
                your_list[0]["time"] = date.toLocaleString("ja"); ///エポック秒変換
                var date = new Date(your_list[1]["time"]);
                your_list[1]["time"] = date.toLocaleString("ja"); ///エポック秒変換
                list.push(your_list[0]);
                ///1番目と2番目のレッテルが、同じセッション内で受け取ったモノであるときは、同じ部屋だよ表示
                if (your_list[0]["time"] == your_list[1]["time"]) {
                  list.push(your_list[1]);
                  ///違う場合は違う表示
                } else {
                  newlist.push(list);
                  list = [];
                  list.push(your_list[1]);
                }
                ///1番最新のレッテルについて
              } else if (i == your_list.length - 1) {
                var date = new Date(your_list[i]["time"]);
                your_list[i]["time"] = date.toLocaleString("ja"); ///エポック秒変換
                ///1番最新のレッテルと、時間順でその1つ前のレッテルが同じセッションで作られたモノであるときは、同じ部屋表示
                if (your_list[i - 1]["time"] == your_list[i]["time"]) {
                  list.push(your_list[i]);
                  newlist.push(list);
                  ///違う場合は違う表示
                } else {
                  newlist.push(list);
                  list = [];
                  list.push(your_list[i]);
                  newlist.push(list);
                }
                ///時間順に3番目から最新の1つ前のレッテルについて、
              } else {
                var date = new Date(your_list[i]["time"]);
                your_list[i]["time"] = date.toLocaleString("ja"); ///エポック秒変換
                ///そのレッテルと1つ前のレッテルが同じセッションで作られたモノである場合、同じ部屋表示
                if (your_list[i - 1]["time"] == your_list[i]["time"]) {
                  list.push(your_list[i]);
                  ///違う場合、違う表示
                } else {
                  newlist.push(list);
                  list = [];
                  list.push(your_list[i]);
                }
              }
            }
            console.log(newlist);
            console.log(newlist.length);
            console.log(newlist[0][0]);
            return res.render("history.ejs", {
              username: username,
              exists: true,
              list: newlist,
            });
          }
        }
      }
    });
  } else {
    ///ログインがなされていない場合は、sessionを破壊して、/loginへリダイレクト
    req.session.destroy((err) => {
      if (err) {
        console.error(err);
      }
      return res.redirect("/login");
    });
  }
});

module.exports = router;
