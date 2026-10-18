"""把签到结果通过 QQ 邮箱 SMTP 推送给用户。

依赖的环境变量：
  QQ_USER        发件/收件邮箱，例如 12345678@qq.com
  QQ_PASS        QQ 邮箱「授权码」（不是登录密码）
  JOB_STATUS     GitHub Actions 的 job.status
  RUN_URL        本次运行的链接
可选：
  LOG_PATH       日志文件路径，默认 sign.log
"""

import datetime
import os
import smtplib
import ssl
import sys
from email.message import EmailMessage

SMTP_HOST = "smtp.qq.com"
SMTP_PORT = 465
MAX_BODY_CHARS = 4000


def main():
    user = os.environ.get("QQ_USER", "").strip()
    password = os.environ.get("QQ_PASS", "").strip()
    if not user or not password:
        print("未配置 QQ_USER / QQ_PASS，跳过邮件通知")
        return 0

    status = os.environ.get("JOB_STATUS", "unknown").strip()
    run_url = os.environ.get("RUN_URL", "").strip()
    log_path = os.environ.get("LOG_PATH", "sign.log")

    try:
        with open(log_path, encoding="utf-8", errors="replace") as handle:
            log = handle.read()
    except OSError:
        log = "(没有找到日志文件)"

    ok = status == "success"
    now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8)))
    subject = "【小黑盒签到】{} {}".format(
        "全部完成" if ok else "有任务未完成", now.strftime("%Y-%m-%d %H:%M")
    )
    body = "状态：{}\n时间：{}\n运行记录：{}\n\n{}\n{}".format(
        "成功" if ok else "失败",
        now.strftime("%Y-%m-%d %H:%M:%S"),
        run_url or "(无)",
        "-" * 40,
        log[-MAX_BODY_CHARS:],
    )

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = "小黑盒签到 <{}>".format(user)
    message["To"] = user
    message.set_content(body)

    try:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=context, timeout=30) as client:
            client.login(user, password)
            client.send_message(message)
        print("邮件已发送至 {}".format(user))
    except Exception as error:  # 邮件失败不应该影响签到任务的结论
        print("邮件发送失败: {}: {}".format(type(error).__name__, error))
        return 0
    return 0


if __name__ == "__main__":
    sys.exit(main())
