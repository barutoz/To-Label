const express = require("express");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const multer = require("multer");
const upload = multer();
const router = express.Router();
const authorization_js = require("../function/authorization"); ///外部ファイルの関数呼び出し
const pswd_js = require("../function/pswd"); ///外部ファイルの関数呼び出し

// サインアップの POST リクエストの処理
router.post("/", upload.fields([]), (req, res) => {
  const username = req.body.username;
  const password = req.body.password;
  const received_csrfToken = req.body._csrf;
  const session_csrfToken = req.session.signup;
  const recapcha = req.body.recaptcha;
  console.log(req.body);
  console.log(username);
  ///フォームから受け取ってきたcsrfトークンとsessionのcsrfトークンが一致しているか確認
  if (received_csrfToken == session_csrfToken) {
    ///リキャプチャ確認
    // 1. application/x-www-form-urlencoded形式でPOSTする

    // 2. URLSearchParamsクラスのインスタンスを作成する
    const params = new URLSearchParams();
    params.append("secret", "6LesykIpAAAAAGMKvjChXtsxHfeOOeg5n0SLaxlj");
    params.append("response", recapcha);

    // 3. Post通信をする
    const postResponse = async () => {
      const response = await fetch(
        "https://www.google.com/recaptcha/api/siteverify",
        {
          method: "POST", // HTTP-Methodを指定する！
          body: params, // リクエストボディーにURLSearchParamsを設定
        }
      );
      const data = await response.json();
      return data;
    };

    postResponse().then((data) => {
      if (
        data["success"] == true &&
        data["hostname"] == "localhost" &&
        data["score"] > 0.5 ///精度は0.6以上を要求
      ) {
        ///登録したいパスワードをハッシュ化
        let hashed_password = bcrypt.hashSync(password, 10);
        let db = new sqlite3.Database("DV.sqlite3");
        // 既存のユーザーネームとの重複をチェック
        db.all("SELECT * FROM users", function (err, row) {
          if (err) {
            console.error(err.message);
            db.close();
            return res.render("error.ejs", { code: "500" });
          } else {
            db.close(); ///必ず閉める
            for (let i = 0; i < row.length; i++) {
              // ユーザーネーム同じものがある場合は同じusernameは認められない。
              if (row[i]["username"] == username) {
                var pswd_error = true;
                break;
              }
            }

            ///ユーザーネームが同じものがある場合
            if (pswd_error) {
              const csrfToken = pswd_js.createPassword();
              req.session.signup = csrfToken;
              ///csrfトークンを生成し直して、もう一回新しいにするよう画面に表示させる。

              var return_list = [csrfToken, false];
              res.send(return_list);
            } else {
              ///ユーザーネーム・パスワードが両方とも同じものがない場合
              // ユーザーの作成やデータベースへの保存などの処理を実装する
              db = new sqlite3.Database("DV.sqlite3");
              db.serialize(() => {
                var authorization = authorization_js.create_authorization(
                  "users",
                  db,
                  "authorization"
                );
                db.run(
                  "INSERT INTO users (username, password, authorization) VALUES (?, ?, ?)",
                  [username, hashed_password, authorization],
                  (err) => {
                    if (err) {
                      console.error(err.message);
                      db.close();
                      return res.render("error.ejs", { code: "500" });
                    }
                  }
                );
                db.close(); ///必ず閉める
              });
              ///適切に変更できたという表示をつけて、ログイン画面にリダイレクト。
              const csrfToken = pswd_js.createPassword();
              req.session.signup = csrfToken;
              var return_list = [csrfToken, true];
              res.send(return_list);
            }
          }
        });
      } else {
        ///リキャプチャで不正が疑われたら、エラーを出す。
        const csrfToken = pswd_js.createPassword();
        req.session.signup = csrfToken;
        var return_list = [csrfToken, "false1"];
        res.send(return_list);
      }
    });
    ///フォームから受け取ってきたcsrfトークンとsessionのcsrfトークンが一致していない場合
  } else {
    ///csrfトークンを再生成して、もう一回やり直すように表示させる。
    const csrfToken = pswd_js.createPassword();
    req.session.signup = csrfToken;
    var return_list = [csrfToken, false];
    res.send(return_list);
  }
});

module.exports = router;
