const express = require("express"); ///おまじない
const bcrypt = require("bcrypt");
const router = express.Router(); ///おまじない
const sqlite3 = require("sqlite3"); ///loginされたときに、データベースを参照する必要があるため、sqlite3のモジュールをインポート

router.get("/", (req, res) => {
  ///sessionが生き残っている場合には、ログインショートカット
  if (req.session.username) {
    return res.redirect("/home");
  } else {
    ///signupに成功した場合は、signupに成功した文章を表示させる
    if (req.session.signup_error) {
      req.session.signup_error = false;
      return res.render("login.ejs", { error: false, error2: true });
    }
    ///通常のloginページへのアクセスの場合
    return res.render("login.ejs", { error: false, error2: false });
  }
});

router.post("/", (req, res) => {
  ///ログインしてくるアクセスがあった場合、まずデータベースにアクセス。
  const db = new sqlite3.Database("DV.sqlite3");
  ///usersテーブルから、user一覧を取得
  db.all("SELECT * FROM users", function (err, row) {
    ///データベース取得errorが発生した場合は、内部エラーを表示
    if (err) {
      console.error(err.message);
      db.close(); ///データベースを閉める(閉めないとエラー出ます)
      return res.render("error.ejs", { code: "500" });
    } else {
      db.close(); ///データベース閉める
      for (let i = 0; i < row.length; i++) {
        ///送られてきたユーザー・pswdがデータベースに一致しているか確認していく。
        if (req.body.username == row[i]["username"]) {
          ///下のコード:送られてきたpswdとdb上のハッシュ値pswdを比較
          ///ハッシュ化とは?
          ///平文を解読されないようにするために、平文をランダムな文字列にする技術。
          ///一番の特徴としては、一度ハッシュ値を作成すると、ランダムな文字列(ハッシュ値)から平文に解読することができない。
          ///不可逆性が挙げられる。pswdの保存にはもってこい。
          ///また、ハッシュ化の特徴として、同じ文字列は必ず同じハッシュ値になるという性質がある。
          ///これをpswdに使おうとすると、まずsignup時に、db上にハッシュ化されたpswdを保存。
          ///login時には、クライアントから受け取ったpswdを一度ハッシュ値にして、そのハッシュ値とdb上のハッシュ値が一致して入れば、ログインできる。
          ///このプログラムでもそのやり方を採用している。詳しくは調べてね。
          if (bcrypt.compareSync(req.body.password, row[i]["password"])) {
            ///ユーザーとpswdが一致していたら、user用識別番号idとauthorizationをもらう。
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
      ///sessionに、user用識別番号idとauthorizationを保存、/homeにリダイレクト
      if (login) {
        req.session.userId = login_id;
        req.session.username = req.body.username;
        req.session.user_authorization = authorization;
        return res.redirect("/home");
      } else {
        ///それ以外の場合は、sessionを破壊して、loginページをお見舞い、不正な番号だと表示をだす。
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

module.exports = router; ///おまじない
