const express = require("express"); ///おまじない
const bcrypt = require("bcrypt");
const router = express.Router(); ///おまじない
const sqlite3 = require("sqlite3"); ///loginされたときに、データベースを参照する必要があるため、sqlite3のモジュールをインポート
const pswd_js = require("../function/pswd"); ///外部ファイルの関数呼び出し

router.get("/", (req, res) => {
  ///sessionが生き残っている場合には、ログインショートカット
  if (req.session.username) {
    return res.redirect("/");
  } else {
    if (req.session.line_signup) {
      // CSRF トークンを生成して追加
      const csrfToken = pswd_js.createPassword(); ///csrfトークンは外部ファイルの関数使って生成
      ///CSRFトークンはsessionにも保存、画面に送りもする。
      req.session.signup = csrfToken;
      ///lineのloginでusernameの打ち込み時へのアクセスの場合
      if (req.session.line_error2) {
        return res.render("login.ejs", {
          csrfToken: csrfToken,
          error: 0,
          line_signup: true,
          line_error: 1,
          line: false,
        });
      }
      if (req.session.line_error3) {
        return res.render("login.ejs", {
          csrfToken: csrfToken,
          error: 0,
          line_signup: true,
          line_error: 2,
          line: false,
        });
      }
      return res.render("login.ejs", {
        csrfToken: csrfToken,
        error: 0,
        line_signup: true,
        line_error: 0,
        line: false,
      });
    } else if (req.session.line_error1) {
      // CSRF トークンを生成して追加
      const csrfToken = pswd_js.createPassword(); ///csrfトークンは外部ファイルの関数使って生成
      ///CSRFトークンはsessionにも保存、画面に送りもする。
      req.session.signup = csrfToken;
      ///通常のloginページへのアクセスの場合
      return res.render("login.ejs", {
        csrfToken: csrfToken,
        error: 4,
        line_signup: false,
        line: false,
        line_error: 0,
      });
    } else {
      // CSRF トークンを生成して追加
      const csrfToken = pswd_js.createPassword(); ///csrfトークンは外部ファイルの関数使って生成
      ///CSRFトークンはsessionにも保存、画面に送りもする。
      req.session.signup = csrfToken;
      ///通常のloginページへのアクセスの場合
      return res.render("login.ejs", {
        csrfToken: csrfToken,
        error: 0,
        line_signup: false,
        line: false,
        line_error: 0,
      });
    }
  }
});

router.post("/", (req, res) => {
  const received_csrfToken = req.body._csrf;
  const session_csrfToken = req.session.signup;
  const recapcha = req.body.recaptcha;
  req.session.line_error2 = false;
  req.session.line_error3 = false;
  req.session.line_error1 = false;
  req.session.line_signup = false;
  if (received_csrfToken != session_csrfToken) {
    // CSRF トークンを生成して追加
    const csrfToken = pswd_js.createPassword(); ///csrfトークンは外部ファイルの関数使って生成
    ///CSRFトークンはsessionにも保存、画面に送りもする。
    req.session.signup = csrfToken;
    ///通常のloginページへのアクセスの場合
    return res.render("login.ejs", {
      csrfToken: csrfToken,
      error: 2,
      line_signup: false,
      line: false,
      line_error: 0,
    });
  }
  ///リキャプチャ確認
  // 1. application/x-www-form-urlencoded形式でPOSTする

  // 2. URLSearchParamsクラスのインスタンスを作成する
  const params = new URLSearchParams();
  params.append("secret", "しーくれっと");
  params.append("response", recapcha);

  // 3. Post通信をする
  const postResponse = async () => {
    const response = await fetch(
      "https://www.google.com/recaptcha/api/siteverify",
      {
        method: "POST", // HTTP-Methodを指定する！
        body: params, // リクエストボディーにURLSearchParamsを設定
      }
    );
    const data = await response.json();
    return data;
  };

  postResponse().then((data) => {
    if (
      data["success"] == true &&
      data["hostname"] == "kinami-mori-koyama.com" &&
      data["score"] > 0.5 ///精度は0.6以上を要求
    ) {
      ///ログインしてくるアクセスがあった場合、まずデータベースにアクセス。
      const db = new sqlite3.Database("DV.sqlite3");
      ///usersテーブルから、user一覧を取得
      db.all("SELECT * FROM users WHERE line=0", function (err, row) {
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
            return res.redirect("/");
          } else {
            // CSRF トークンを生成して追加

            const csrfToken = pswd_js.createPassword(); ///csrfトークンは外部ファイルの関数使って生成
            ///CSRFトークンはsessionにも保存、画面に送りもする。
            req.session.signup = csrfToken;
            ///それ以外の場合は、sessionを破壊して、loginページをお見舞い、不正な番号だと表示をだす。
            return res.render("login.ejs", {
              csrfToken: csrfToken,
              error: 2,
              line_signup: false,
              line: false,
              line_error: 0,
            });
          }
        }
      });
    } else {
      // CSRF トークンを生成して追加
      const csrfToken = pswd_js.createPassword(); ///csrfトークンは外部ファイルの関数使って生成
      ///CSRFトークンはsessionにも保存、画面に送りもする。
      req.session.signup = csrfToken;
      ///それ以外の場合は、sessionを破壊して、loginページをお見舞い、不正な番号だと表示をだす。
      return res.render("login.ejs", {
        csrfToken: csrfToken,
        error: 3,
        line_signup: false,
        line: false,
        line_error: 0,
      });
    }
  });
});

module.exports = router; ///おまじない
