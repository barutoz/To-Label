///ただただ、ランダムな12桁の文字列を生み出す関数
///exports.を頭につけてやると外部ファイルから呼び出せる。
exports.createPassword = function () {
  var alphabet = "abcdefghijklmnopqrstuvwxyz";
  var alphabetUpper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  var numbers = "0123456789";

  var passBase = alphabet + alphabetUpper + numbers;

  var len = 12; // 12桁
  var password = "";

  for (var i = 0; i < len; i++) {
    password += passBase.charAt(Math.floor(Math.random() * passBase.length));
  }

  return password;
};
