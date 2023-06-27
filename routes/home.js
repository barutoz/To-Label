const express = require("express"); ///おまじない
const router = express.Router(); ///おまじない

///app,getじゃなくてrouter.get注意　またパスも"/"なので注意。もし"/home"にした場合、/home(app.jsに書き込んだパス)/home(個々で書き込んだパス)がつながった形になってしまう。
router.get("/", (req, res) => {
  ///ログイン済みかチェックする
  if (req.session.username) {
    ///間違った番号でログインしている場合には、不正な番号です表示をださせる。(詳しくはroom.jsへ)
    if (req.session.team_error) {
      req.session.team_error = false;
      msg = "不正な番号です。";
      ///部屋に入室しようとしたとき、その部屋がすでにゲームが始まっている場合は、閉め切られてます表示をだす(詳しくはroom_join.jsへ)
    } else if (req.session.team_error2) {
      req.session.team_error2 = false;
      msg = "このセッションは締め切られてます。";
    } else {
      ///それ以外の場合(つまり、通常通り/homeにアクセスしてきた場合は、msgは出させない)
      msg = "";
    }
    res.render("home.ejs", { username: req.session.username, msg: msg }); // home.ejsにusername・msgを渡す
  } else {
    ///ログインがなされていない場合は、sessionを破壊して、/loginへリダイレクト
    req.session.destroy((err) => {
      if (err) {
        console.error(err);
      }
      return res.redirect("/login");
    });
  }
});

module.exports = router; ///おまじない
