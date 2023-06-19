const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  // セッションを破棄してログアウト
  req.session.destroy((err) => {
    if (err) {
      console.error(err);
    }
    return res.redirect("/");
  });
});

router.post("/", (req, res) => {
  // セッションを破棄してログアウト
  req.session.destroy((err) => {
    if (err) {
      console.error(err);
    }
    return res.redirect("/");
  });
});

module.exports = router;
