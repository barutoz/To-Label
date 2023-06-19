const express = require("express");
const sqlite3 = require("sqlite3");
const router = express.Router();
const authorization_js = require("../function/authorization");
const pswd_js = require("../function/pswd");

// サインアップページの表示
router.get("/", (req, res) => {
  // CSRF トークンを生成して追加
  const csrfToken = pswd_js.createPassword();
  req.session.signup = csrfToken;
  res.render("signup.ejs", { csrfToken: csrfToken, error: false });
});

// サインアップの POST リクエストの処理
router.post("/", (req, res) => {
  const username = req.body.username;
  const password = req.body.password;
  const received_csrfToken = req.body._csrf;
  const session_csrfToken = req.session.signup;
  if (received_csrfToken == session_csrfToken) {
    let db = new sqlite3.Database("DV.sqlite3");
    // 既存のユーザーネームとの重複をチェック
    db.all("SELECT * FROM users", function (err, row) {
      if (err) {
        console.error(err.message);
        db.close();
        return res.render("error.ejs", { code: "500" });
      } else {
        db.close();
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
          const csrfToken = pswd_js.createPassword();
          req.session.signup = csrfToken;
          return res.render("signup.ejs", {
            csrfToken: csrfToken,
            error: true,
          });
        } else {
          db = new sqlite3.Database("DV.sqlite3");
          db.serialize(() => {
            var authorization = authorization_js.create_authorization(
              "users",
              db,
              "authorization"
            );
            db.run(
              "INSERT INTO users (username, password, authorization) VALUES (?, ?, ?)",
              [username, password, authorization],
              (err) => {
                if (err) {
                  console.error(err.message);
                  db.close();
                  return res.render("error.ejs", { code: "500" });
                }
              }
            );
            db.close();
          });
          req.session.signup_error = true;
          return res.redirect("/login");
        }
      }
    });
  } else {
    const csrfToken = pswd_js.createPassword();
    req.session.signup = csrfToken;
    return res.render("signup.ejs", {
      csrfToken: csrfToken,
      error: true,
    });
  }
});

module.exports = router;
