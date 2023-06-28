///このページは、部屋を作る請求がされたときの処理(他のファイルとは異なり、ajaxの非同期post通信であるところが異なる)
const express = require("express");
const sqlite3 = require("sqlite3");
const router = express.Router();
///他のファイルでも共通使用する関数はfunctionディレクトリ以下のファイルにしまっているが、その関数を使用するためには、ファイルをまず呼び出ししてくる。
const authorization_js = require("../function/authorization");

///以下の2つの関数部屋を作る際の4桁の数字を発行するための関数
///1つめの関数は、数字を作る際に作った数字がすでにdbに登録されているものと重複するものであるか、チェックするための関数
///数字の作り方は、0から1の中でランダムな数字を出力させる関数(math.random())で小数点の数を生成して、それを10000倍して、小数点切り捨てを行うことで、4桁の数を生成させている。
///したがって、math.randomで0.099...より下の数が出力された場合は数が4桁にはならない。この場合は4桁に不足分だけ0を上の桁から足していくことで対応している。(10が生成された場合、0010にして画面に表示させている)
///なお、この0を足す処理は最後の表示上だけ修正をしている。(0010とかの数字は文字列でないと処理できない。数字として処理しようとすると10にされて、処理しづらいからである。)したがって、db上では生身の数字が保存されている。(0010の場合、10とdbに保存されている)
///この関数では、かぶりがある場合はfalseを返す。適正な数字の場合はtrue
function number_check(number, db) {
  ///しかしこの生成方法では、math.randomで0.000099...以下が出力されると、値が0になり、0000となる。0000はあまりよろしくないので、はじいている。
  if (number == 0) {
    return false;
    ///値が0でない場合、dbに重複がないか確認を取る
  } else {
    ///room_numberテーブルから、番号を取得してくる
    db.all("select number from room_number", function (err, row) {
      if (err) {
        console.error(err.message);
        return true; ///厳密にいうと対策が必要。だけど、ほぼほぼerrが発生することはないし、数字被りも起きない、起きるとしても天文学的な確率なので考えない。
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

///2つめの関数は数字生成関数
function number_generate(number, db) {
  if (number_check(number, db) == true) {
    ///先ほどの関数で、数字被りがない場合は、入力された数字を返す
    return number;
    ///被りがある場合は、再度生成しなおす。
  } else {
    ///被りがなくなるまで、while処理で生成しなおす。
    while (number_check(number, db) == false) {
      var number = Math.floor(Math.random() * 10000);
    }
    return number;
  }
}

router.post("/", (req, res) => {
  ///session上ログインされていない場合は、loginページへリダイレクト。
  if (req.session.user_authorization == false) {
    req.session.destroy((err) => {
      if (err) {
        console.error(err);
      }
      return res.redirect("/login");
    });
  }
  ///部屋を作りたい請求が来たとき
  if (req.body.random == "true") {
    var number = Math.floor(Math.random() * 10000); ///初期数字を生成
    let db = new sqlite3.Database("DV.sqlite3"); ///先ほどの数字生成関数ないでdbにアクセスするため、dbをここで開ける。
    var number = number_generate(number, db); ///初期数字とdbを変数に入れて、数字生成関数へ渡す。
    ///dbを変数に入れて、外部ファイルの関数で、部屋用の識別暗号を生成してもらう。
    var authorization = authorization_js.create_authorization(
      "room_number",
      db,
      "authorization"
    );
    ///room_numberテーブル(部屋一覧db)に、4桁の番号、識別暗号、permission(permissionとは0,1,2のいずれかの数で、部屋のステータスを表す。0のときは出来立ての部屋、1はゲーム中の部屋、2はゲーム終了後の部屋の意味である)を保存。
    ///ここではpermissionには0を入れる
    db.all("select number from room_number", function (err, row) {
      if (err) {
        console.error(err.message);
        db.close();
        return res.render("error.ejs", { code: "500" });
      }

      var date = Date.now(); ///テーブル削除をするときのために、ルーム生成時間も保存しておく。
      db.serialize(() => {
        db.run(
          "INSERT INTO room_number (number,authorization,permission,finish_time) VALUES(" +
            String(number) +
            ',"' +
            authorization +
            '",0,' +
            date +
            ")",
          (err) => {
            if (err) {
              console.error(err.message);
              db.close();
              return res.render("error.ejs", { code: "500" });
            }
          }
        );
        ///部屋内のやり取りを保管するための、テーブルを生成する(テーブルの名前は部屋用識別暗号)
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
        ///部屋内のuser一覧のテーブルを生成する。(テーブルの名前は部屋用識別暗号_userslist)
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
        db.close(); ///必ず閉める
      });
    });
    ///最後に生成した4桁の数字が、999より下の場合は、0を不足分付けて、修正をする。
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
    res.send(new_number); ///そして部屋番号を送る。
  } else {
    res.send(false);
  }
});

module.exports = router;
