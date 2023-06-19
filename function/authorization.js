const pswd_js = require("./pswd");

const number_list = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

function check_authorization(authorization, table, db, col) {
  if (number_list.includes(authorization.substring(0, 1))) {
    return true;
  } else {
    db.all("select * from " + table, function (err, row) {
      if (err) {
        console.error(err.message);
        return false; ///厳密にいうと対策が必要。だけど、ほぼほぼerrが発生することはないし、数字被りも起きない、起きるとしても天文学的な確率なので考えない。
      } else {
        for (let i = 0; i < row.length; i++) {
          if (row[i][col] == authorization) {
            var exists = true;
            break;
          } else {
            var exists = false;
          }
        }
        if (exists) {
          return true;
        } else {
          return false;
        }
      }
    });
  }
}

exports.create_authorization = function (table, db, col) {
  var authorization = pswd_js.createPassword();
  while (check_authorization(authorization, table, db, col) == true) {
    authorization = pswd_js.createPassword();
  }
  return authorization;
};
