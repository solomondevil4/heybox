const crypto = require("crypto");
const { BasicAccount } = require("../core");
const { APP_PROFILE } = require("./constants");
const {
  buildAppCookie,
  buildWebCookie,
  decodePkeyToUserId,
  parseCookieMap,
} = require("./cookie");

// hkey 服务要求 os_version 为纯数字系统版本字符串，抓包值可能是
// "Android 14" 之类格式会被拒，缺省时回退 "12"（旧版本长期使用且可用的值）。
function normalizeOsVersion(value) {
  const text = String(value || "").trim();
  return /^\d+(\.\d+)*$/.test(text) ? text : "12";
}

// imei 旧版逻辑：pkey 的 md5 前 16 位（凭证派生值）。
function makeImei(pkey) {
  return crypto.createHash("md5").update(String(pkey), "utf8").digest("hex").slice(0, 16);
}

class HeyboxAccount extends BasicAccount {
  constructor(rawData) {
    super(rawData);
    const heyboxId = decodePkeyToUserId(rawData);
    if (!heyboxId) throw new Error("无法从pkey解析heybox_id");
    this.heyboxId = heyboxId;
    this.name = heyboxId;
    const fields = parseCookieMap(rawData);
    const pkey = fields.get("pkey") || "";
    // App 请求字段：cookie 里没有时按旧版默认值生成，保证最简 cookie 也能跑。
    this.imei = fields.get("imei") || makeImei(pkey);
    this.deviceInfo = fields.get("device_info") || "HBP-AL00";
    this.appProfile = {
      ...APP_PROFILE,
      device_info: this.deviceInfo,
      os_version: normalizeOsVersion(fields.get("os_version")),
      dw: fields.get("dw") || "360",
      channel: fields.get("channel") || "heybox",
    };
    this.appCookie = buildAppCookie(rawData);
    this.appClientCookie = `${this.appCookie};x_pkey=${fields.get("pkey")};x_heybox_id=${heyboxId}`;
    this.webCookie = buildWebCookie(rawData, heyboxId);
  }
}

module.exports = {
  HeyboxAccount,
};
