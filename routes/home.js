const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  if (req.session.username) {
    if (req.session.team_error) {
      req.session.team_error = false;
      msg = "不正な番号です。";
    } else if (req.session.team_error2) {
      req.session.team_error2 = false;

      msg = "このセッションは締め切られてます。";
    } else {
      msg = "";
    }
    res.render("home.ejs", { username: req.session.username, msg: msg }); // home.ejsにusernameを渡す
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
