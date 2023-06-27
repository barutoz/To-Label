///このスクリプトは、home画面で部屋番号を入力して、部屋に参加する時まず連れてこられるところ。room_join.jsの前処理段階
const express = require("express");
const sqlite3 = require("sqlite3");
const router = express.Router();

router.post("/", (req, res) => {
  ///まずsession上でログインされているか確認
  if (req.session.user_authorization == false) {
    ///ログインされていない場合は、ログイン画面にリダイレクト
    req.session.destroy((err) => {
      if (err) {
        console.error(err);
      }
      return res.redirect("/login");
    });
  }
  ///入力された部屋番号が4桁であることをまず確認
  if (req.body.room.length !== 4) {
    ///4桁出ない場合はhome画面にリダイレクト
    req.session.team_error = true;
    return res.redirect("/home");
  }
  let db = new sqlite3.Database("DV.sqlite3"); ///dbにアクセス
  ///room_numberテーブルから、すでに存在するroomの一覧を取得
  db.all("select * from room_number", function (err, row) {
    if (err) {
      console.error(err.message);
      db.close();
      return res.render("error.ejs", { code: "500" });
    } else {
      db.close(); ///必ず閉める
      for (let i = 0; i < row.length; i++) {
        ///入力された部屋番号と一致する部屋番号があるかチェック
        if (row[i]["number"] == req.body.room) {
          ///部屋が存在すれば、部屋の通し番号(id 1,2,3...の数字)と部屋の識別暗号(authorization)と部屋の状況(permission 部屋が空いているか、ゲーム中か、ゲーム終了後か)を取得
          var team_number = row[i]["id"];
          var authorization = row[i]["authorization"];
          var permission = row[i]["permission"];
          break;
        } else {
          var team_number = false;
        }
      }
      ///入力された部屋番号と一致する部屋が存在しない場合は、ホーム画面にリダイレクト。
      if (team_number == false) {
        req.session.team_error = true;
        return res.redirect("/home");
      } else {
        ///部屋の状況が、プレイヤー募集中でなければ、(permission=0なければ)、つまり部屋が締め切られている場合、
        if (permission !== 0) {
          db = new sqlite3.Database("DV.sqlite3");
          ///部屋の識別暗号_userslistテーブルから、roomの参加者一覧を取得
          db.all(
            "select * from " + authorization + "_userslist",
            function (err, row) {
              if (err) {
                console.error(err.message);
                db.close();
                return res.render("error.ejs", { code: "500" });
              }
              db.close(); ///必ず閉める
              ///部屋の参加者リストにアクセスしてきた人が登録されているか確認
              for (let i = 0; i < row.length; i++) {
                if (row[i]["authorization"] == req.session.user_authorization) {
                  var redirecting = false;
                  break;
                } else {
                  var redirecting = true;
                }
              }
              ///部屋の参加者リストに登録されていなければ、ホーム画面にリダイレクト。部屋は閉め切られているという表示をつけて。
              if (redirecting) {
                req.session.team_error2 = true;
                return res.redirect("/home");
                ///登録されていれば、/room/{部屋の通し番号}にリダイレクト
                ///そのときsessionには、参加しようとしているteamを更新
              } else {
                req.session.team_number = team_number;
                req.session.authorization = authorization;
                return res.redirect("/room/" + String(team_number));
              }
            }
          );
          ///部屋の状況がプレイヤー募集中なら、/room/{部屋の通し番号}にリダイレクト
          ///そのときsessionには、参加しようとしているteamを更新
        } else {
          req.session.team_number = team_number;
          req.session.authorization = authorization;
          return res.redirect("/room/" + String(team_number));
        }
      }
    }
  });
});

module.exports = router;
