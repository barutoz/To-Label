const express = require("express");
const sqlite3 = require("sqlite3");
const router = express.Router();

router.get("/", (req, res) => {
  if (req.session.username == false) {
    req.session.destroy((err) => {
      if (err) {
        console.error(err);
      }
      return res.redirect("/login");
    });
  }
  var query = req.originalUrl;
  var query_number = query.split("/");
  if (req.session.team_number == false) {
    return res.redirect("/home");
  } else {
    if (!(query_number[2] == req.session.team_number)) {
      return res.redirect("/home");
    }
    let db = new sqlite3.Database("DV.sqlite3");
    db.all("select * from room_number", function (err, row) {
      if (err) {
        console.error(err.message);
        db.close();
        return res.render("error.ejs", { code: "500" });
      }
      db.close();
      for (let i = 0; i < row.length; i++) {
        if (row[i]["id"] == req.session.team_number) {
          if (row[i]["authorization"] == req.session.authorization) {
            var password = row[i]["number"];
            var permission = row[i]["permission"];
            var time = row[i]["time"];
            var original_time = row[i]["original_time"];
            var exists = true;
            break;
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
        if (permission == 0) {
          db = new sqlite3.Database("DV.sqlite3");
          db.serialize(() => {
            db.all(
              "select * from " + req.session.authorization + "_userslist",
              function (err, row) {
                if (err) {
                  console.error(err.message);
                  db.close();
                  return res.render("error.ejs", { code: "500" });
                }
                ///トラブル頻発エリア(rowが定義されていないエラー)
                for (let i = 0; i < row.length; i++) {
                  if (
                    row[i]["authorization"] == req.session.user_authorization
                  ) {
                    var self_exists = true;
                    var new_i = i;
                    break;
                  } else {
                    self_exists = false;
                  }
                }
                if (self_exists) {
                  db.close();
                  row.splice(new_i, 1);
                } else {
                  db.run(
                    "INSERT INTO " +
                      req.session.authorization +
                      "_userslist (user,permission,authorization) VALUES('" +
                      req.session.username +
                      "',0,'" +
                      req.session.user_authorization +
                      "');",
                    (err) => {
                      if (err) {
                        console.error(err.message);
                        db.close();
                        return res.render("error.ejs", { code: "500" });
                      }
                    }
                  );
                  db.close();
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
                return res.render("entry.ejs", {
                  username: username,
                  password: password,
                  user_list: row,
                  self_authorization: self_authorization,
                });
              }
            );
          });
        } else {
          let other_users = [];
          let other_users_authorization;
          let other_users_user;
          let redirecting = true;
          let msg_list = [];
          let your_msg_list = [];
          let other_msg_list = [];
          db = new sqlite3.Database("DV.sqlite3");
          db.all(
            "select * from " + req.session.authorization + "_userslist",
            function (err, row) {
              if (err) {
                console.error(err.message);
                db.close();
                return res.render("error.ejs", { code: "500" });
              }
              db.close();
              for (let i = 0; i < row.length; i++) {
                if (row[i]["authorization"] == req.session.user_authorization) {
                  redirecting = false;
                } else {
                  other_users_user = row[i]["user"];
                  other_users_authorization = row[i]["authorization"];
                  other_users[i] = {
                    user: other_users_user,
                    authorization: other_users_authorization,
                  };
                }
              }
              if (redirecting) {
                req.session.team_error2 = true;
                return res.redirect("/home");
              } else {
                db = new sqlite3.Database("DV.sqlite3");
                db.all(
                  "select * from " + req.session.authorization,
                  function (err, row) {
                    if (err) {
                      console.error(err.message);
                      db.close();
                      return res.render("error.ejs", { code: "500" });
                    }
                    db.close();
                    msg_list = row;
                    if (permission == 1) {
                      for (let i = 0; i < msg_list.length; i++) {
                        if (
                          msg_list[i]["player1"] ==
                          req.session.user_authorization
                        ) {
                          your_msg_list.push(msg_list[i]);
                        } else if (
                          msg_list[i]["player1"] !==
                            req.session.user_authorization &&
                          msg_list[i]["player2"] !==
                            req.session.user_authorization
                        ) {
                          other_msg_list.push(msg_list[i]);
                        }
                      }
                      return res.render("room.ejs", {
                        other_users: other_users,
                        your_msg_list: your_msg_list,
                        other_msg_list: other_msg_list,
                        self_authorization: req.session.user_authorization,
                        time: time,
                        original_time: original_time,
                      });
                    } else if ((permission = 2)) {
                      for (let i = 0; i < msg_list.length; i++) {
                        if (
                          msg_list[i]["player2"] ==
                          req.session.user_authorization
                        ) {
                          your_msg_list.push(msg_list[i]);
                        }
                      }
                      return res.render("result.ejs", {
                        your_msg_list: your_msg_list,
                        username: req.session.username,
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
