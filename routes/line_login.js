const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const SHA256 = require("crypto-js/sha256");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const authorization_js = require("../function/authorization");

router.get("/", (req, res) => {
  req.session.line_error2 = false;
  req.session.line_error3 = false;
  req.session.line_error1 = false;
  const encryptSha256 = async () => {
    const data = await SHA256(crypto.randomUUID());
    return data.toString();
  };
  encryptSha256().then((data) => {
    req.session.state = data;
    return res.redirect(
      "https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=2002726042&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fline_login%2Fcallback&state=" +
        data +
        "&scope=openid"
    );
  });
});

router.get("/callback", (req, res) => {
  req.session.line_error2 = false;
  req.session.line_error3 = false;
  req.session.line_error1 = false;
  if (req.session.state == req.query.state) {
    req.session.state = false;
    const params = new URLSearchParams();
    params.append("grant_type", "authorization_code");
    params.append("code", req.query.code);
    params.append("redirect_uri", "http://localhost:3000/line_login/callback");
    params.append("client_id", "2002726042");
    params.append("client_secret", "///シークレットキー");
    const postResponse = async () => {
      const response = await fetch("https://api.line.me/oauth2/v2.1/token", {
        method: "POST", // HTTP-Methodを指定する！
        body: params, // リクエストボディーにURLSearchParamsを設定
      });
      const data = await response.json();
      return data;
    };
    postResponse().then((data) => {
      if (!("error" in data)) {
        const access_token = data["access_token"];
        const id_token = data["id_token"];
        const getResponse = async () => {
          const response2 = await fetch(
            "https://api.line.me/oauth2/v2.1/verify?access_token=" +
              access_token,
            {
              method: "GET", // HTTP-Methodを指定する！
            }
          );
          const data2 = await response2.json();
          return data2;
        };
        getResponse().then((data2) => {
          if (data2["client_id"] == "2002726042" && data2["expires_in"] > 0) {
            const params3 = new URLSearchParams();
            params3.append("id_token", id_token);
            params3.append("client_id", "2002726042");
            const postResponse2 = async () => {
              const response3 = await fetch(
                "https://api.line.me/oauth2/v2.1/verify",
                {
                  method: "POST",
                  body: params3,
                }
              );
              const data3 = await response3.json();
              return data3;
            };
            postResponse2().then((data3) => {
              if (!("error" in data3)) {
                const user_ID = data3["sub"];
                var db = new sqlite3.Database("DV.sqlite3");
                db.all("SELECT * FROM users", function (err, row) {
                  ///データベース取得errorが発生した場合は、内部エラーを表示
                  if (err) {
                    console.error(err.message);
                    db.close(); ///データベースを閉める(閉めないとエラー出ます)
                    return res.render("error.ejs", { code: "500" });
                  } else {
                    db.close();
                    for (let i = 0; i < row.length; i++) {
                      if (row[i]["line"] == 1) {
                        if (bcrypt.compareSync(user_ID, row[i]["password"])) {
                          var login_id = row[i]["id"];
                          var authorization = row[i]["authorization"];
                          var username_login = row[i]["username"];
                          var login = true;
                          break;
                        } else {
                          var login = false;
                        }
                      } else if (row[i]["line"] == 2) {
                        if (bcrypt.compareSync(user_ID, row[i]["password"])) {
                          var username = row[i]["username"];
                          var login = false;
                          var mitei = true;
                          break;
                        } else {
                          var login = false;
                        }
                      } else {
                        var login = false;
                      }
                    }
                    if (login) {
                      ///ログイン成功
                      req.session.userId = login_id;
                      req.session.username = username_login;
                      req.session.user_authorization = authorization;
                      return res.redirect("/");
                    } else {
                      if (mitei) {
                        req.session.line_signup = username;
                        return res.redirect("/login");
                      } else {
                        ///今のところDBに登録がない場合は新規登録
                        ///仮ユーザー名を発行
                        var username = authorization_js.create_authorization(
                          "users",
                          db,
                          "username"
                        );
                        let hashed_password = bcrypt.hashSync(user_ID, 10);
                        req.session.line_signup = username;
                        db = new sqlite3.Database("DV.sqlite3");
                        db.serialize(() => {
                          var authorization =
                            authorization_js.create_authorization(
                              "users",
                              db,
                              "authorization"
                            );
                          db.run(
                            "INSERT INTO users (username, password, authorization, line) VALUES (?, ?, ?, 2)",
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
                          return res.redirect("/login");
                        });
                      }
                    }
                  }
                });
              } else {
                req.session.line_error1 = true;
                return res.redirect("/login");
              }
            });
          } else {
            req.session.line_error1 = true;
            return res.redirect("/login");
          }
        });
      } else {
        req.session.line_error1 = true;
        return res.redirect("/login");
      }
    });
  } else {
    req.session.state = false;
    req.session.line_error1 = true;
    return res.redirect("/login");
  }
});

router.post("/signup", (req, res) => {
  req.session.line_error2 = false;
  req.session.line_error3 = false;
  req.session.line_error1 = false;
  const received_csrfToken = req.body._csrf;
  const session_csrfToken = req.session.signup;
  const recapcha = req.body.recaptcha;
  const received_username = req.body.username;
  req.session.signup = false;
  if (req.session.line_signup) {
    if (
      received_csrfToken &&
      session_csrfToken &&
      recapcha &&
      received_csrfToken == session_csrfToken
    ) {
      const params5 = new URLSearchParams();
      params5.append("secret", "シークレットキー");
      params5.append("response", recapcha);
      const postResponse5 = async () => {
        const response5 = await fetch(
          "https://www.google.com/recaptcha/api/siteverify",
          {
            method: "POST", // HTTP-Methodを指定する！
            body: params5, // リクエストボディーにURLSearchParamsを設定
          }
        );
        const data5 = await response5.json();
        return data5;
      };

      postResponse5().then((data5) => {
        if (
          data5["success"] == true &&
          data5["hostname"] == "localhost" &&
          data5["score"] > 0.5 ///精度は0.6以上を要求
        ) {
          db = new sqlite3.Database("DV.sqlite3");
          db.serialize(() => {
            db.all("SELECT * FROM users", function (err, row) {
              ///データベース取得errorが発生した場合は、内部エラーを表示
              if (err) {
                console.error(err.message);
                db.close(); ///データベースを閉める(閉めないとエラー出ます)
                return res.render("error.ejs", { code: "500" });
              } else {
                let seiki = false;
                let seiki2 = false;
                let login_id;
                let authorization;
                for (let x = 0; x < row.length; x++) {
                  if (row[x]["username"] == received_username) {
                    seiki = false;
                    seiki2 = true;
                    break;
                  }
                  if (row[x]["line"] == 2) {
                    if (row[x]["username"] == req.session.line_signup) {
                      seiki = true;
                      login_id = row[x]["id"];
                      authorization = row[x]["authorization"];
                    }
                  }
                }
                if (seiki) {
                  ///成功
                  var db = new sqlite3.Database("DV.sqlite3");
                  db.serialize(() => {
                    db.run(
                      "UPDATE users SET username=?, line=1 WHERE username=?",
                      [received_username, req.session.line_signup],
                      (err) => {
                        if (err) {
                          console.error(err.message);
                          db.close();
                          return res.render("error.ejs", { code: "500" });
                        }
                      }
                    );
                    db.close(); ///必ず閉める
                    req.session.userId = login_id;
                    req.session.username = received_username;
                    req.session.user_authorization = authorization;
                    req.session.line_signup = false;
                    return res.redirect("/");
                  });
                } else {
                  if (seiki2) {
                    ///すでに存在するusername
                    req.session.line_error3 = true;
                    return res.redirect("/login");
                  } else {
                    ///不正?
                    req.session.signup = false;
                    req.session.line_error1 = true;
                    return res.redirect("/login");
                  }
                }
              }
            });
          });
        } else {
          req.session.line_error2 = true;
          return res.redirect("/login");
        }
      });
    } else {
      req.session.line_error2 = true;
      return res.redirect("/login");
    }
  } else {
    req.session.line_error1 = true;
    req.session.signup = false;
    return res.redirect("/login");
  }
});

module.exports = router; ///おまじない
