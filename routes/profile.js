const express = require("express");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const router = express.Router();

///ここのページは、ユーザー名とパスワード書き換えページ
router.get("/", (req, res) => {
  let color;
  let login = false;
  let line;
  // セッションにログインの状態を確認
  if (
    req.session.userId &&
    req.session.username &&
    req.session.user_authorization
  ) {
    var db = new sqlite3.Database("DV.sqlite3");
    db.all("SELECT * FROM users", function (err, row) {
      ///データベース取得errorが発生した場合は、内部エラーを表示
      if (err) {
        console.error(err.message);
        db.close(); ///データベースを閉める(閉めないとエラー出ます)
        return res.render("error.ejs", { code: "500" });
      } else {
        db.close(); ///データベース閉める
        for (let i = 0; i < row.length; i++) {
          if (row[i]["authorization"] == req.session.user_authorization) {
            if (row[i]["line"] == 0) {
              login = true;
              line = false;
            } else if (row[i]["line"] == 1) {
              login = true;
              line = true;
            }
            break;
          }
        }
        if (login) {
          if (line) {
            ///lineでログインの場合
            ///重複するusernameが存在する場合、ユーザー名を変えるよう求める(詳しくは、post時の処理#1)
            if (req.session.pswd_error) {
              req.session.pswd_error = false;
              pswd_error =
                "このユーザー名は使用できません。別のものにしてください。";
              color = "danger1";
              ///入力させた昔のpswdが違う場合は今のpswdが違う表示をだす(詳しくは、post時の処理#2)
            } else if (req.session.setting_success) {
              req.session.setting_success = false;
              pswd_error = "新しいusernameとパスワードになりました。";
              color = "success";
            } else {
              pswd_error = "ユーザー名・パスワードの変更";
              color = "normal";
            }
            // ログイン済みの場合、ホームページを表示
            res.render("profile-line.ejs", {
              pswd_error: pswd_error,
              color: color,
            });
          } else {
            ///フォームログインの場合
            ///重複するusernameが存在する場合、ユーザー名を変えるよう求める(詳しくは、post時の処理#1)
            if (req.session.pswd_error) {
              req.session.pswd_error = false;
              pswd_error =
                "このユーザー名は使用できません。別のものにしてください。";
              color = "danger1";
              ///入力させた昔のpswdが違う場合は今のpswdが違う表示をだす(詳しくは、post時の処理#2)
            } else if (req.session.login_error) {
              req.session.login_error = false;
              pswd_error = "今のパスワードが違います。";
              color = "danger2";
            } else if (req.session.setting_success) {
              req.session.setting_success = false;
              pswd_error = "新しいusernameとパスワードになりました。";
              color = "success";
            } else {
              pswd_error = "ユーザー名・パスワードの変更";
              color = "normal";
            }
            // ログイン済みの場合、ホームページを表示
            res.render("profile.ejs", { pswd_error: pswd_error, color: color });
          }
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
    // ログインしていない場合、ログインページにリダイレクト
    req.session.destroy((err) => {
      if (err) {
        console.error(err);
      }
      return res.redirect("/login");
    });
  }
});

///pswdの変更が請求された場合
router.post("/", (req, res) => {
  const userId = req.session.userId; ///sessionに記憶されている、user識別番号
  let oldUserpass;
  const newUsername = req.body.username; ///user希望の新しいusername
  let newPassword;
  let line;
  let login = false;
  ///session上でログインされているか確認
  if (
    req.session.userId &&
    req.session.username &&
    req.session.user_authorization
  ) {
    ///データベースにアクセス
    var db = new sqlite3.Database("DV.sqlite3");
    ///usersテーブルから、userの一覧を取得
    db.all("SELECT * FROM users", function (err, row) {
      if (err) {
        console.error(err.message);
        db.close();
        return res.render("error.ejs", { code: "500" });
      }
      db.close(); ///かならず閉める
      for (let i = 0; i < row.length; i++) {
        ///データベース上に一致するuser識別番号があるか確認
        if (row[i]["authorization"] == req.session.user_authorization) {
          if (row[i]["authorization"] == req.session.user_authorization) {
            if (row[i]["line"] == 0) {
              login = true;
              line = false;
              oldUserpass = req.body.olduserpass; ///user入力させた昔のpswd
              newPassword = req.body.password; ///user希望の新しいpswd
              ///かつ入力させた古いpswdと一致しているか確認
              if (bcrypt.compareSync(oldUserpass, row[i]["password"])) {
                login = true;
                break;
              } else {
                login = false;
                var login_error = true;
                break;
              }
            } else if (row[i]["line"] == 1) {
              login = true;
              line = true;
            }
            break;
          }
        }
      }
      ///データベース上に一致するものがあれば、書き換え処理を行う
      if (login) {
        // その前に、同じユーザ名がいる場合を防止する。(同じユーザー名はOK)
        for (let i = 0; i < row.length; i++) {
          if (row[i]["username"] == newUsername) {
            var pswd_error = true;
            break;
          }
        }
        ///同じユーザー名かつpswdがいる場合は、ユーザー名を別のものにするよう、表示させる。#1
        if (pswd_error) {
          req.session.pswd_error = true;
          return res.redirect("/setting");
        }
        if (line) {
          db = new sqlite3.Database("DV.sqlite3");
          ///db.serializeとはjsの非同期実行をこのネスト下ではやめて、上から順に実行するために書く。特にdb処理では実行の順番が前後するため、必ず書くことが推奨される。
          db.serialize(() => {
            ///usersテーブルを書き換え
            db.run(
              "UPDATE users SET username = ? WHERE id = ?",
              [newUsername, userId],
              (err) => {
                if (err) {
                  console.error(err);
                  db.close();
                  return res.redirect("/login");
                }
              }
            );
            db.close(); ///db閉める
          });
          // ユーザーネームの更新が完了した場合はセッションも更新
          req.session.username = newUsername;
          // 関連するチームテーブルの更新も追加する。
          // 更新成功した場合はプロフィールページにリダイレクト
          req.session.setting_success = true;
          return res.redirect("/setting");
        } else {
          let hashed_password = bcrypt.hashSync(newPassword, 10);
          ///すべての条件を満たしている場合、書き換え処理を行う。まずdbにアクセス
          db = new sqlite3.Database("DV.sqlite3");
          ///db.serializeとはjsの非同期実行をこのネスト下ではやめて、上から順に実行するために書く。特にdb処理では実行の順番が前後するため、必ず書くことが推奨される。
          db.serialize(() => {
            ///usersテーブルを書き換え
            db.run(
              "UPDATE users SET username = ?, password = ? WHERE id = ?",
              [newUsername, hashed_password, userId],
              (err) => {
                if (err) {
                  console.error(err);
                  db.close();
                  return res.redirect("/login");
                }
              }
            );
            db.close(); ///db閉める
          });
          // ユーザーネームの更新が完了した場合はセッションも更新
          req.session.username = newUsername;
          // 関連するチームテーブルの更新も追加する。
          // 更新成功した場合はプロフィールページにリダイレクト
          req.session.setting_success = true;
          return res.redirect("/setting");
          ///入力させた古いpswdに間違えがあれば、古いpswdが違うよ表示を出す(#2)
        }
      } else {
        if (login_error) {
          req.session.login_error = true;
          return res.redirect("/setting");
          ///user用識別番号も違う場合(おそらく不正アクセスの場合)はsessionをさようならして、loginへリダイレクト
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
    ///session上でログインされていない場合はsessionさようならして、loginへリダイレクト
    req.session.destroy((err) => {
      if (err) {
        console.error(err);
      }
      return res.redirect("/login");
    });
  }
});

module.exports = router;
