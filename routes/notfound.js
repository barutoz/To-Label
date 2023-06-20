const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  return res.render("error.ejs", { code: "404" });
});

module.exports = router;
