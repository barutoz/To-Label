const express = require("express");
const sqlite3 = require("sqlite3");
const router = express.Router();
const authorization_js = require("../function/authorization");

function number_check(number, db) {
  if ((number = 0)) {
    return false;
  } else {
    db.all("select number from room_number", function (err, row) {
      if (err) {
        console.error(err.message);
        return false; ///厳密にいうと対策が必要。だけど、ほぼほぼerrが発生することはないし、数字被りも起きない、起きるとしても天文学的な確率なので考えない。
      } else {
        for (var ini = 0; ini < row.length; ini++) {
          if (row[ini]["number"] == number) {
            var exists = true;
          }
        }
        if (exists) {
          return false;
        } else {
          return true;
        }
      }
    });
  }
}

function number_generate(number, db) {
  if (number_check(number, db) == true) {
    return number;
  } else {
    while (number_check(number, db) == false) {
      var number = Math.floor(Math.random() * 10000);
    }
    return number;
  }
}

router.post("/", (req, res) => {
  if (req.session.user_authorization == false) {
    req.session.destroy((err) => {
      if (err) {
        console.error(err);
      }
      return res.redirect("/login");
    });
  }
  if (req.body.random == "true") {
    var number = Math.floor(Math.random() * 10000);
    let db = new sqlite3.Database("DV.sqlite3");
    var number = number_generate(number, db);
    var authorization = authorization_js.create_authorization(
      "room_number",
      db,
      "authorization"
    );
    db.all("select number from room_number", function (err, row) {
      if (err) {
        console.error(err.message);
        db.close();
        return res.render("error.ejs", { code: "500" });
      }
      var rowrow = row.length + 1;
      db.serialize(() => {
        db.run(
          "INSERT INTO room_number (id,number,authorization,permission) VALUES(" +
            String(rowrow) +
            "," +
            String(number) +
            ',"' +
            authorization +
            '",0)',
          (err) => {
            if (err) {
              console.error(err.message);
              db.close();
              return res.render("error.ejs", { code: "500" });
            }
          }
        );
        db.run(
          'CREATE TABLE "' +
            authorization +
            '" ( "id"	INTEGER NOT NULL UNIQUE, "player1"	TEXT NOT NULL, "player2"	TEXT NOT NULL,  "msg"	TEXT NOT NULL, "from_username" TEXT NOT NULL,"to_username" TEXT NOT NULL, "control" TEXT NOT NULL UNIQUE, PRIMARY KEY("id" AUTOINCREMENT) );',
          (err) => {
            if (err) {
              console.error(err.message);
              db.close();
              return res.render("error.ejs", { code: "500" });
            }
          }
        );
        db.run(
          'CREATE TABLE "' +
            authorization +
            '_userslist" ("id"	INTEGER NOT NULL UNIQUE,"user"	TEXT NOT NULL,"permission"	INTEGER NOT NULL, "authorization"	TEXT NOT NULL UNIQUE, PRIMARY KEY("id" AUTOINCREMENT));',
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
    });
    if (number < 1000) {
      new_number = "0" + String(number);
      if (number < 100) {
        new_number = "0" + new_number;
        if (number < 10) {
          new_number = "0" + new_number;
        }
      }
    } else {
      new_number = String(number);
    }
    res.send(new_number);
  } else {
    res.send(false);
  }
});

module.exports = router;
