const express = require("express"); ///おまじない
const sqlite3 = require("sqlite3");
const router = express.Router(); ///おまじない

///app,getじゃなくてrouter.get注意　またパスも"/"なので注意。もし"/home"にした場合、/home(app.jsに書き込んだパス)/home(個々で書き込んだパス)がつながった形になってしまう。
router.get("/", (req, res) => {
  ///ログイン済みかチェックする
  if (req.session.username) {
    ///間違った番号で部屋に」入室しようとしている場合には、不正な番号です表示をださせる。(詳しくはroom.jsへ)
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
    ///home画面に表示するレッテルのために、dbにアクセス。
    let db = new sqlite3.Database("DV.sqlite3");
    ///profile_msg(今までのレッテルを全部記録しているテーブル)にアクセスして、user識別暗号と一致するレッテルを集めてくる。
    db.all(
      "SELECT * FROM profile_msg WHERE to_user_authorization='" +
        req.session.user_authorization +
        "'",
      function (err, row) {
        if (err) {
          console.log(err.message);
          db.close();
          return res.render("error.ejs", { code: 500 });
        } else {
          db.close(); ///必ず閉める。
          ///今までのレッテルがない(ゲーム未プレイの場合)は、まだレッテルがないよ、表示を出させる。
          if (row.length == 0) {
            return res.render("home.ejs", {
              username: req.session.username,
              msg: msg,
              your_msg: row,
              exists: false,
            }); // home.ejsにusername・msgを渡す
          } else {
            ///レッテルがある場合で、レッテルの数が3つ以下の場合は、すべてのレッテルを画面に表示させる。
            if (row.length <= 3) {
              return res.render("home.ejs", {
                username: req.session.username,
                msg: msg,
                your_msg: row,
                exists: true,
              }); // home.ejsにusername・msgを渡す
              ///4つ以上レッテルをもらったことがある場合は、レッテルの中から3つをランダムで選んで、画面に表示させる。
            } else {
              let your_msg = [];
              for (x = 0; x <= 2; x++) {
                let number = Math.floor(Math.random() * row.length);
                your_msg.push(row[number]);
                row.splice(number, 1);
              }
              return res.render("home.ejs", {
                username: req.session.username,
                msg: msg,
                your_msg: your_msg,
                exists: true,
              }); // home.ejsにusername・msgを渡す
            }
          }
        }
      }
    );
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
