const { BasicAccount } = require("../core");
const { APP_PROFILE } = require("./constants");
const {
  buildAppCookie,
  buildWebCookie,
  decodePkeyToUserId,
  parseCookieMap,
} = require("./cookie");

// hkey 服务要求 os_version 为纯数字系统版本字符串（如 "14" 或 "14.0.0"），
// 抓包得到的值可能是 "Android 14" 之类的格式，服务端会直接拒绝，
// 这里统一兜底：非纯数字版本串时回退到 "14"。
function normalizeOsVersion(value) {
  const text = String(value || "").trim();
  return /^\d+(\.\d+)*$/.test(text) ? text : "14";
}

class HeyboxAccount extends BasicAccount {
  constructor(rawData) {
    super(rawData);
    const heyboxId = decodePkeyToUserId(rawData);
    if (!heyboxId) throw new Error("无法从pkey解析heybox_id");
    this.heyboxId = heyboxId;
    this.name = heyboxId;
    const fields = parseCookieMap(rawData);
    this.imei = fields.get("imei") || "";
    this.deviceInfo = fields.get("device_info") || "";
    this.appProfile = {
      ...APP_PROFILE,
      device_info: this.deviceInfo,
      os_version: normalizeOsVersion(fields.get("os_version")),
      dw: fields.get("dw") || "",
      channel: fields.get("channel") || "",
    };
    this.appCookie = buildAppCookie(rawData);
    this.appClientCookie = `${this.appCookie};x_pkey=${fields.get("pkey")};x_heybox_id=${heyboxId}`;
    this.webCookie = buildWebCookie(rawData, heyboxId);
  }
}

module.exports = {
  HeyboxAccount,
};
