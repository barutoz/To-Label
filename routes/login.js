const express = require("express");
const router = express.Router();
const sqlite3 = require("sqlite3");

router.get("/", (req, res) => {
  if (req.session.username) {
    return res.redirect("/home");
  } else {
    if (req.session.signup_error) {
      req.session.signup_error = false;
      return res.render("login.ejs", { error: false, error2: true });
    }
    return res.render("login.ejs", { error: false, error2: false });
  }
});

router.post("/", (req, res) => {
  const db = new sqlite3.Database("DV.sqlite3");
  db.all("SELECT * FROM users", function (err, row) {
    if (err) {
      console.error(err.message);
      db.close();
      return res.render("error.ejs", { code: "500" });
    } else {
      db.close();
      for (let i = 0; i < row.length; i++) {
        if (req.body.username == row[i]["username"]) {
          if (req.body.password == row[i]["password"]) {
            var login_id = row[i]["id"];
            var authorization = row[i]["authorization"];
            var login = true;
            break;
          } else {
            var login = false;
          }
        } else {
          var login = false;
        }
      }
      if (login) {
        req.session.userId = login_id;
        req.session.username = req.body.username;
        req.session.user_authorization = authorization;
        return res.redirect("/home");
      } else {
        req.session.destroy((err) => {
          if (err) {
            console.error(err);
          }
          return res.render("login.ejs", { error: true, error2: false });
        });
      }
    }
  });
});

module.exports = router;
