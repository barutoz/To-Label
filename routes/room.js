const express = require("express");
const sqlite3 = require("sqlite3");
const router = express.Router();

router.post("/", (req, res) => {
  if (req.session.user_authorization == false) {
    req.session.destroy((err) => {
      if (err) {
        console.error(err);
      }
      return res.redirect("/login");
    });
  }
  if (req.body.room.length !== 4) {
    req.session.team_error = true;
    return res.redirect("/home");
  }
  let db = new sqlite3.Database("DV.sqlite3");
  db.all("select * from room_number", function (err, row) {
    if (err) {
      console.error(err.message);
      db.close();
      return res.render("error.ejs", { code: "500" });
    } else {
      db.close();
      for (let i = 0; i < row.length; i++) {
        if (row[i]["number"] == req.body.room) {
          var team_number = row[i]["id"];
          var authorization = row[i]["authorization"];
          var permission = row[i]["permission"];
          break;
        } else {
          var team_number = false;
        }
      }
      if (team_number == false) {
        req.session.team_error = true;
        return res.redirect("/home");
      } else {
        if (permission !== 0) {
          db = new sqlite3.Database("DV.sqlite3");
          db.all(
            "select * from " + authorization + "_userslist",
            function (err, row) {
              if (err) {
                console.error(err.message);
                db.close();
                return res.render("error.ejs", { code: "500" });
              }
              db.close();
              for (let i = 0; i < row.length; i++) {
                if (row[i]["authorization"] == req.session.user_authorization) {
                  var redirecting = false;
                  break;
                } else {
                  var redirecting = true;
                }
              }
              if (redirecting) {
                req.session.team_error2 = true;

                return res.redirect("/home");
              } else {
                req.session.team_number = team_number;
                req.session.authorization = authorization;
                return res.redirect("/room/" + String(team_number));
              }
            }
          );
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
