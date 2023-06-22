const express = require("express");
const sqlite3 = require("sqlite3");
const router = express.Router();

///ここのページは、ユーザー名とパスワード書き換えページ
router.get("/", (req, res) => {
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
    req.session.destroy((err) => {
      if (err) {
        console.error(err);
      }
      return res.redirect("/login");
    });
  }
});

router.post("/", (req, res) => {
  const userId = req.session.userId;
  const oldUserpass = req.body.olduserpass;
  const newUsername = req.body.username;
  const newPassword = req.body.password;
  ///session上でログインされているか確認
  if (req.session.userId && req.session.username) {
    ///データベースにアクセス
    let db = new sqlite3.Database("DV.sqlite3");
    ///usersテーブルから、userの一覧を取得
    db.all("SELECT * FROM users", function (err, row) {
      if (err) {
        console.error(err.message);
        db.close();
        return res.render("error.ejs", { code: "500" });
      }
      db.close(); ///かならず閉める
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
        db = new sqlite3.Database("DV.sqlite3");
        db.serialize(() => {
          db.run(
            "UPDATE users SET username = ?, password = ? WHERE id = ?",
            [newUsername, newPassword, userId],
            (err) => {
              if (err) {
                console.error(err);
                db.close();
                return res.redirect("/login");
              }
            }
          );
          db.close();
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
          req.session.destroy((err) => {
            if (err) {
              console.error(err);
            }
            return res.redirect("/login");
          });
        }
      }
    });
  } else {
    req.session.destroy((err) => {
      if (err) {
        console.error(err);
      }
      return res.redirect("/login");
    });
  }
});

module.exports = router;
