# 小黑盒每日签到 · GitHub Actions 部署说明

目标：**公开仓库 + 全自动**，每天自动完成签到 / 每日分享任务，并输出 H 币信息，结果通过 GitHub 通知你。

---

## 一、整体链路

```
cron 08:00(北京) ──► Actions 启动 ubuntu runner
                      ├─ npm ci
                      ├─ node heybox_sign.js   ← 签到 + 分享任务 + H币统计
                      ├─ Step Summary          ← Actions 页面直接看结果
                      ├─ Artifact              ← 完整日志留 7 天
                      └─ Issue 日报            ← 触发 GitHub 通知（邮件/App）
                      
keepalive job ──────► 每天重置「60 天不活跃」计数器，防止定时任务被停用
```

`heybox_sign.js` 一个脚本就覆盖了你要的三件事：

| 需求 | 脚本里的实现 |
|---|---|
| 每日签到 | `GET /task/sign_v3/sign` → 查 `get_sign_state`，输出 `+H币 +经验 连签N天` |
| 每日分享任务 | 分享任意帖子 / 分享游戏详情 / 分享游戏评价（拉流 → 上报 view_time → 上报分享事件 → 回查 state） |
| H 币信息输出 | 日志里的 `当前总H币: N` 和 `任务汇总: 完成X个…当前H币=N` |

---

## 二、部署步骤

### 1. 准备仓库

把 <https://github.com/yowiv08/heybox> fork 到你自己的账号（或 clone 后推到你的新仓库），确认根目录有：

```
heybox_sign.js
package.json
package-lock.json
src/core/...
src/heybox/...
```

> `package-lock.json` 必须一起带上，否则工作流会回退到 `npm install`（也能跑，只是慢一点）。

### 2. 放入工作流文件

把本仓库的 [`.github/workflows/sign.yml`](.github/workflows/sign.yml) 放到你仓库的同一路径：

```
.github/workflows/sign.yml
```

提交到 **默认分支**（`main` 或 `master`）。`schedule` 只在默认分支上生效。

### 3. 配置 Cookie

仓库页 → `Settings` → `Secrets and variables` → `Actions` → `New repository secret`

| Name | Secret |
|---|---|
| `HEYBOX_CK` | `pkey=xxx;x_xhh_tokenid=xxx;` |

**多账号**：Secret 支持多行，直接换行分隔；或者用 `&` 分隔：

```
pkey=A;x_xhh_tokenid=A;&pkey=B;x_xhh_tokenid=B;
```

⚠️ 这个值等价于账号密码。**只放 Secret，永远不要写进代码、README、Issue 或截图。** 公开仓库的 Secrets 不会明文出现在日志里，脚本自己也会把 `pkey=` / `x_xhh_tokenid=` / `hkey=` 打码。

### 4. 启用并手动验证一次

1. 进 `Actions` 标签页
2. 若顶部出现提示，点 **I understand my workflows, go ahead and enable them**（fork 的仓库工作流默认是关闭的）
3. 左侧选 `heybox-daily` → 右侧 **Run workflow** → 绿色按钮确认
4. 等 1~2 分钟，点开这次运行，看日志里是否出现：

```
当前版本: 1.3.xxx build=xxxx
账号=昵称 黑盒ID=123456 IMEI=xxxxxxxx
签到: 已完成 (+20经验 +20H币 ...)
分享任意帖子到社交平台: 已完成
当前总H币: 123
任务汇总: 完成N个，当前H币=123
完成: 1/1
```

看到 `完成: 1/1` 就说明通了。

### 5. 开启 GitHub 通知

GitHub 只对「失败」的运行默认发邮件，成功不会打扰你。两层都要设：

**a) 账号通知设置**

头像 → `Settings` → `Notifications` → 找到 **Actions** 一节：

- 勾选邮件通知
- 至少保留「失败的工作流运行」这一项

**b) 关注自己的仓库**

仓库页右上角 `Watch` → `Participating and @mentions`（或 `All Activity`）。
工作流里的「写入日报 Issue」会每天在 `小黑盒签到日报` 这个 Issue 下追加一条评论，你作为作者会收到通知。首次运行会自动创建这个 Issue。

---

## 三、日常表现

| 位置 | 你会看到 |
|---|---|
| 每天 08:00 左右 | 自动跑一次（GitHub 定时任务可能延迟 3~15 分钟，属正常） |
| Actions 页面 | 绿勾 = 全部任务完成；红叉 = 有账号任务未完成或接口异常 |
| 运行详情 → Summary | 一张表 + 完整签到日志 |
| Issue `小黑盒签到日报` | 每天一条结果评论（同时触发通知） |
| Artifacts | `sign-log-<run_id>`，保留 7 天 |

**退出码语义**（决定红绿）：

- `0`：所有账号的每日任务都完成
- `1`：有账号任务未完成 / 初始化失败 / 脚本异常

所以红叉不一定是你配置错了，可能只是「今天有个分享任务没结算成功」。

---

## 四、排查表

| 现象 | 原因 | 处理 |
|---|---|---|
| 日志只有 `共读取到0个账号` | Secret 没配或名字不是 `HEYBOX_CK` | 检查 Secret 名称（大小写敏感） |
| `缺少 secret HEYBOX_CK` 直接报错 | 同上 | 工作流已内置这道检查，属于预期报错 |
| `hkey接口失败` / `hkey接口未返回hkey` | 第三方 `hkey.qcciii.com` 挂了，或在拦机房 IP | 稍后重试；连续多天失败说明服务不可用，App 通道全废 |
| 某任务 `未完成` | 接口延迟结算 / 规则变了 / 需要 App 原生行为 | 看 `(…)` 括号里的原因；偶发可忽略，连续发生说明脚本要更新 |
| 定时不触发 | 工作流被 60 天规则停用 / 不在默认分支 / fork 未 Enable | 检查 `keepalive` job 是否在跑 |
| 收不到通知 | Actions 通知没开 / 没 Watch 仓库 | 回到步骤 5 |
| `通知发送失败: sendNotify.js not found` | 脚本会尝试加载青龙的 `sendNotify.js`，仓库里没有 | **无害**，已被捕获，不影响任务；通知走 Issue 那条链路 |

---

## 五、几个必须知道的前提

1. **Actions 的 cron 不准**。延迟 3~15 分钟是常态，整点更严重。签到无所谓，但 `heybox_rush.js`（定时抢券）**不要**用 Actions，精度不够。
2. **60 天规则针对公开仓库**。`keepalive` job 每天调 API 重置计数器，所以你不用手动 commit 保活、也不用定期去点按钮。前提是它必须跑在 `schedule` 触发里——一旦被停用，定时不再触发，keepalive 也救不回来，只能手动去 Actions 页面 Enable 一次。
3. **Cookie 会过期**。表现为日志里 `请登录` / 登录态失效，重新抓一次 Cookie 更新 Secret 即可。
4. **公开仓库的可见性**。仓库是 public，那么 Actions 日志、Summary、那个 Issue 全部公开。脚本自身做了打码（`pkey` / `x_xhh_tokenid` / `hkey` / `nonce`），但**昵称和 H 币数量是明文**，介意就把仓库改私有（私有仓库不受 60 天规则限制，2000 分钟/月免费额度足够）。
5. **合规风险**。伪造设备指纹、伪造分享与浏览行为刷任务，违反平台用户协议，账号被风控或封禁是合理预期。自己决定是否承担。
