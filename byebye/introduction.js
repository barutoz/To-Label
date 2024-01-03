const express = require("express"); ///おまじない
const router = express.Router(); ///おまじない

///大智が作成した最初のTo-Label紹介ページを表示させる。
router.get("/", (req, res) => {
  res.render("index.ejs");
});

module.exports = router; ///おまじない
