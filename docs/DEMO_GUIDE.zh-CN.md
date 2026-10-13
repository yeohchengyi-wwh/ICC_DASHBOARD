# ICC Dashboard 原型说明

这一阶段的目标是让 ICC staff 先确认页面布局、图表和到期提醒流程。页面使用 HTML、CSS、JavaScript、Chart.js 与 JSON 示例数据，之后再接入 PHP / MySQL。

## 页面构思

| 页面 | Staff 可以做什么 |
| --- | --- |
| Overview | 查看三大模块的数量、已收收入、年度创新活动、IP 分类、待处理续期和 Incubator 健康状态 |
| IP Portfolio | 按学校、申请年份和到期状态筛选，查看 IP 类型、负责人、记录详情与 review / renewal date |
| Incubator | 查看 venture 阶段、团队、Effective Date、Expiry Date，以及黄色或红色到期状态 |
| Commercialization | 查看合作伙伴、商业化阶段、已收收入趋势和协议续期日期 |
| Notifications | 查看即将到期和已过期记录，标为已读，打开相关记录并更新确认后的续期日期 |
| Reports | 按当前学校和 cohort 年份导出单个模块或全部模块的 CSV |
| Settings | 选择提醒模块，调整原型 review date，重置浏览器保存的示例变更 |

## 视觉方向

奶油白背景、陶土橙主色、浅桃色卡片细节和柔和绿色图表，形成温暖、清晰的 staff workspace。黄色表示即将到期，红色表示已过期，绿色表示仍在有效期内。状态同时显示文字，方便不依赖颜色识别。

页面提供桌面和手机布局。手机上的主导航通过菜单打开，详细记录表格可横向滑动。Overview 的续期列表在手机上优先显示记录名称和到期状态。

## 到期逻辑

Effective Date 与 Expiry Date 分别保存。不能只从 Effective Date 猜测到期日；正式系统需要确认协议期限或直接输入经核实的 Expiry Date。

- 在 `Expiry Date - 3 calendar months` 当天开始显示黄色提醒。
- 到期当天显示 `Due today`，仍属于黄色提醒。
- 到期日过后显示红色 `Expired`。
- 月末按对应月份的最后一天处理，例如非闰年 5 月 31 日到期，从 2 月 28 日开始提醒。
- 缺少或无效的日期显示 `Date missing`，不会被当成有效期内。
- 标记已读只表示 staff 已查看。只有确认并保存新的日期后，续期状态才会改变。

IP 的示例日期代表内部 review / renewal deadline。不同 IP 类型的法定保护期、维持费和授权协议期限应分别核实，正式数据库需要区分 deadline kind。

## FYP 演示流程

1. 打开 Overview，查看指标、图表和黄色提醒横幅。默认 review date 是 2026 年 10 月 13 日。
2. 使用学校和 cohort-year 筛选，观察指标、图表和导出结果同步变化。Cohort year 指记录进入该模块的年份。
3. 打开 Incubator，切换 `Expiring soon` 或 `Expired`，查看 Effective Date 与 Expiry Date。
4. 在记录详情中更新经确认的续期日期，再查看 Notifications 的变化。
5. 添加一条示例记录并刷新页面，验证浏览器本地保存；通过 Reports 下载 CSV。
6. 在 Settings 调整 review date，演示三个月提醒窗口和已过期状态。需要重新演示时选择 Reset prototype data。

## 下一阶段

当前所有记录都明确标记为虚构示例，浏览器中的新增记录和修改不会写回 Excel 或共享数据库。网页打开时会计算 in-app reminders；目前没有登录验证、后台定时任务或邮件发送。

确认 UI 后，按 [PHP / MySQL 架构说明](ARCHITECTURE.md) 接入验证后的真实数据、用户权限、共享通知已读状态和每日提醒任务。邮件通知可以再通过 SMTP outbox 加入，避免重复发送。
