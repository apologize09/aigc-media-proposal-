# 5. 系统架构、目录、数据与 API

本篇是实现前的设计基线。表字段若标成合理假设，确认前可以改名或删减，但不要在未确认时加进业务规则（税率、审批链、服务目录）。

## 5.1 逻辑架构

```text
浏览器（内部人员）
    │  HTTPS，会话 Cookie
    ▼
Web 应用（页面 + HTTP API）
    │
    ├── PostgreSQL        业务数据、会话、审计
    ├── 对象存储          客户素材、冻结 HTML、可选缩略图
    ├── Redis             队列
    └── Worker            分析、检索、生成、渲染
            │
            └── 火山方舟 Responses API（doubao-seed-evolving）
                    ├── 分析与模块生成
                    └── 同一次调用中的 web_search
                          转存只下载该工具结果里的地址

浏览器（客户）
    │  HTTPS，仅分享令牌
    ▼
Web 应用的公开阅读路由
    └── 只读取已交付快照的 HTML 与其允许公开的资源
```

内部 API 与公开阅读路由分属不同鉴权。公开路由不能复用「已登录就能读项目」的查询。

Worker 不对外监听业务端口。它只从队列取任务并调用 `src/server` 中的同一套领域函数。

## 5.2 提案如何变成 HTML

```text
HTML/CSS 模板 + 豆包填入的内容
        │
        ▼
GrapesJS 工程 JSON（草稿源数据）
        │  导出并消毒
        ▼
HTML + CSS ──发布──▸ 对象存储中的快照
        │
        └─ 同一份快照打印 ──▸ PDF
```

导出前，服务端用报价表重写报价节点，用素材表重写图片和视频地址。导出结果里不出现成本、利润、任务和内部备注。分享页读取已发布的 HTML 与 CSS，不在请求里重新跑 GrapesJS。

模块类型（MVP）：

| type | 内容要点 | 依据 |
| --- | --- | --- |
| `cover` | 项目标题、客户显示名、日期、版本号 | 合理假设 |
| `understanding` | 需求理解正文 | 合理假设 |
| `concept` | 创意正文 | 已确认 |
| `style` | 风格说明、参考图引用 | 已确认 |
| `cases` | 案例条目列表 | 已确认 |
| `storyboard` | 分镜条目列表 | 已确认 |
| `process` | 有序步骤 | 已确认 |
| `quote` | 无独立金额；渲染时读报价行 | 已确认内容，编辑方式是 R-A7 |
| `schedule` | 阶段名称、说明、起止日期（可空） | 已确认 |

案例条目字段：展示标题、编辑说明、媒体类型（图片 / 视频 / 创意链接）、来源名称、来源 URL、授权状态、引用的素材 ID。展示使用已转存的副本；转存未成功时该条目不能进入已发布快照。授权状态枚举：`client_provided`、`unknown`、`licensed`。不增加「默认为已授权」。网络案例在转存前的授权状态用 `unknown`。

分镜条目字段：顺序、画面描述、文案、时长说明（文本，不换算工时）、可选参考图。时长不做排期计算。

正文在 GrapesJS 里编辑。导出后只保留段落、标题、列表、强调和链接。链接协议只允许 `http` 与 `https`。

## 5.3 目录结构

磁盘上的现状、哪些目录已有占位、哪些仍待实现，以 [11-oss-and-build-plan.md](./11-oss-and-build-plan.md) 为准。下面是目标布局：

```text
docs/planning/          本规划
prisma/                 Prisma 迁移与表定义
src/app/                路由、页面、路由处理函数
src/components/         shadcn/ui 后台界面。GrapesJS 只在提案编辑页客户端加载
src/proposal/templates/ HTML/CSS 提案模板
src/server/ai/          统一模型适配层。本期仅火山方舟实现，含 web_search 结果提取
src/server/auth/        会话、口令、权限检查
src/server/projects/    项目、客户、成员
src/server/assets/      上传与对象存储
src/server/search/      转存。不接第二家搜索 API
src/server/pricing/     成本、报价、利润（公式外置）
src/server/tasks/       执行任务
src/server/review/      快照、审核、交付
src/server/audit/       审计写入
src/worker/             队列消费者。含把快照 HTML/CSS 打成 PDF
tests/unit/
tests/integration/
tests/e2e/
docker-compose.yml
.env.example            只有键名和空值，无真实密钥
```

`src/proposal` 不引用数据库客户端，方便用固定 JSON 做渲染测试。

## 5.4 表关系

```text
users 1 ── * sessions
users * ── * projects            经由 project_members
clients 1 ── * projects
projects 1 ── * assets
projects 1 ── * ai_jobs
projects 1 ── * analyses
projects 1 ── * search_runs 1 ── * search_hits
projects 1 ── 1 proposal_drafts 1 ── * proposal_blocks
projects 1 ── * proposal_snapshots 1 ── * snapshot_blocks（或快照内 JSON）
projects 1 ── 1 cost_sheets 1 ── * cost_lines
projects 1 ── * quote_lines
projects 1 ── * work_tasks
proposal_snapshots 1 ── * reviews
proposal_snapshots 1 ── * deliveries
users 1 ── * audit_logs
```

一个项目一个草稿（R-A11）。一个项目多份快照。交付和审核只指向快照。

金额列使用 `numeric(14,2)`。币种列可空。本期没有默认币种，也没有汇率。

### users

| 列 | 说明 |
| --- | --- |
| id | 主键 |
| email | 登录名，唯一 |
| name | 显示名 |
| password_hash | 口令哈希，不可逆 |
| status | `active` / `disabled` |
| finance_access | 能否查看和编辑成本、报价与利润区。已确认 |
| created_at / updated_at | |

职责用 `user_roles`：`admin`、`editor`、`reviewer`。一个人可多条。这组枚举是假设。

### clients

最小集：id、name、contact_name、contact_email、contact_phone、internal_notes、created_by、created_at。联系人字段可空。不假设客户编号规则。

### projects

| 列 | 说明 |
| --- | --- |
| id, client_id, title | |
| brief | 需求正文 |
| status | 第 3 篇状态机。枚举待那篇假设确认后写入 |
| owner_user_id | 需求负责人 |
| archived_at | 空表示未归档 |
| created_by, created_at, updated_at | |

### project_members

project_id、user_id、created_at。参与关系就是隔离边界：用户不是该项目成员、也不是管理员时，列表和详情都不可见。不再按项目拆一套不同的角色。

### assets

| 列 | 说明 |
| --- | --- |
| id, project_id | |
| origin | `client_upload` / `web_reference` / `manual_link` |
| media_type | `image` / `video` / `document` / `link` |
| storage_key | 对象存储键，外链可空 |
| source_url | 原始地址，客户上传可空 |
| filename, mime, size_bytes | |
| license_status | 见 5.2 |
| attribution | 来源说明 |
| created_by, created_at | |

### ai_jobs

id、project_id、type（`analyze` / `search_plan` / `draft_proposal` / `regenerate_block` / `transfer_asset`）、status（`queued` / `running` / `succeeded` / `failed` / `cancelled`）、input、output、error、provider、model、usage（可空 JSON）、created_by、时间戳。

没有 `suggest_tasks`。任务以手工为主。`draft_proposal` 和 `regenerate_block` 调用豆包并打开 `web_search`。`transfer_asset` 只处理这些工具结果里的地址，以及编辑手工补上的链接。

`input` / `output` 只存定位和已校验摘要。客户素材二进制不进该列。是否保存完整提示词等 Q14。

### analyses

id、project_id、ai_job_id、version_no、is_current、payload、confirmed_by、confirmed_at、created_at。同一项目最多一条 `is_current`。

`payload` 使用下面的最小字段。已确认不按行业模板扩展：

- summary
- objectives：字符串数组
- audience：字符串，可空
- deliverable_notes：字符串，可空
- style_notes：字符串，可空
- constraints：字符串数组
- open_questions：字符串数组
- search_queries：字符串数组

### search_runs / search_hits

search_runs：id、project_id、query、provider、status、created_by、created_at。

search_hits：id、search_run_id、media_type、title、url、thumbnail_url、snippet、rank、selection（`candidate` / `selected` / `dismissed`）、asset_id（选用后若形成素材行则填写）。

### proposal_drafts / proposal_blocks

proposal_drafts：id、project_id 唯一、based_on_snapshot_id 可空、updated_at。

proposal_blocks：id、draft_id、type、position、visible、content JSON、updated_by、updated_at。

`updated_at` 用于乐观锁。

### proposal_snapshots

id、project_id、version_no、document JSON（发布时的模块副本）、quote_snapshot JSON（当时对客报价行副本）、html_storage_key、created_by、created_at。

不设「修改快照」的更新接口。新版本是新行。

### cost_sheets / cost_lines / quote_lines

cost_sheets：id、project_id 唯一、currency（可空，本期不填默认值）、updated_by、updated_at。

cost_lines：id、cost_sheet_id、label、quantity、unit（文本，可空）、unit_amount、line_amount、note、position。

quote_lines：id、project_id、label、quantity、unit、unit_amount、line_amount、visible_in_proposal、cost_line_id 可空、position、updated_at。

line_amount 在保存时由数量和单价计算并存储，同时保留单价和数量，避免只剩一个无法复核的总数。若人只填总额、没有单价，则 unit_amount 为空、line_amount 为录入值。两种录入方式都允许，因为报价习惯未确认。

本期不建利润公式表，也不预留一条 enabled 的公式。利润接口对有财务可见的项目成员返回未配置，不返回比率。以后若要计算，另开一次变更，不在本期塞进默认表达式。

### work_tasks

id、project_id、snapshot_id 可空、title、detail、status（`draft` / `confirmed` / `cancelled`；进行中和完成等执行跟踪是否需要，见 Q9）、assignee_user_id 可空、start_on、end_on、position。

任务全部由人创建。本期没有 `suggested` 来源，也没有按行业生成的接口。不建任务依赖图。若 Q9 要求前置任务或工时，再加字段。

### reviews / deliveries

reviews：id、snapshot_id、reviewer_id、decision（`approved` / `changes_requested`）、comment、created_at。单人审核：该快照最新一条结论就是结论。退回后再次送审会新增一条，不覆盖历史。不做会签，也不要求多名审核人都通过。

deliveries：id、snapshot_id、token_hash、expires_at 可空、revoked_at 可空、created_by、created_at。明文令牌只在创建响应里出现一次。

### audit_logs

id、actor_user_id 可空、action、entity_type、entity_id、project_id 可空、metadata JSON、created_at。metadata 不写密钥、口令、完整分享令牌。

## 5.5 API 清单

前缀 `/api`。除特别说明外都要登录。写操作校验权限（第 6 篇，其中矩阵仍是假设）。列表接口需要分页：`limit` 与游标，避免一次拉出全部候选。

### 会话

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/auth/login` | 邮箱与口令 |
| POST | `/api/auth/logout` | 使当前会话失效 |
| GET | `/api/auth/me` | 当前用户与职责 |

### 账号（管理员）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET, POST | `/api/users` | 列表、开通 |
| PATCH | `/api/users/:id` | 改职责、财务可见、停用 |

不开通「用户自助注册」接口。

### 客户与项目

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET, POST | `/api/clients` | |
| GET, PATCH | `/api/clients/:id` | |
| GET, POST | `/api/projects` | 创建时带 client、title、brief |
| GET, PATCH | `/api/projects/:id` | 更新需求正文、归档 |
| POST | `/api/projects/:id/members` | 添加参与人 |
| DELETE | `/api/projects/:id/members/:userId` | 移除参与人 |

### 素材

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET, POST | `/api/projects/:id/assets` | POST 为上传 |
| GET | `/api/assets/:id/content` | 经权限检查后的短期访问，不把存储桶设为公开列举 |
| DELETE | `/api/assets/:id` | 被模块引用时拒绝 |

### 分析与任务状态

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/projects/:id/analysis` | 入队分析 |
| GET | `/api/projects/:id/analysis` | 当前版与确认状态 |
| PATCH | `/api/projects/:id/analysis` | 人工改正当前未确认稿 |
| POST | `/api/projects/:id/analysis/confirm` | 确认 |
| GET | `/api/jobs/:id` | 任务状态 |

### 搜索

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/projects/:id/searches` | 某次生成里豆包联网搜索留下的查询和来源 |
| POST | `/api/search-hits/:id/dismiss` | 从草稿模块移除这条匹配 |
| POST | `/api/projects/:id/references` | 手工补链并入队转存 |

### 提案

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/projects/:id/proposal/draft` | 若无草稿则按已确认分析入队生成；已有草稿则拒绝覆盖，除非 body 明示 `mode=replace` 且人已确认 |
| GET | `/api/projects/:id/proposal/draft` | 模块列表 |
| PATCH | `/api/proposal-blocks/:id` | 更新内容、visible；带 `updated_at` |
| POST | `/api/projects/:id/proposal/blocks` | 新增模块 |
| POST | `/api/projects/:id/proposal/reorder` | 排序 |
| DELETE | `/api/proposal-blocks/:id` | 删除模块。七类已确认模块是否允许删光，见 Q11；默认允许隐藏，删除需确认 |
| POST | `/api/proposal-blocks/:id/regenerate` | 入队。结果先放在 job output，人确认后再写回模块 |
| GET | `/api/projects/:id/proposal/preview` | 返回预览 HTML |
| POST | `/api/projects/:id/proposal/publish` | 渲染并写快照 |
| GET | `/api/projects/:id/snapshots` | 版本列表 |
| GET | `/api/snapshots/:id` | 只读快照 |

### 成本、报价、利润、任务

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET, PUT | `/api/projects/:id/cost-sheet` | PUT 整体保存行，或拆成行级 POST/PATCH/DELETE。实现时选一种，不两套并存 |
| GET, PUT | `/api/projects/:id/quote-lines` | 含 `visible_in_proposal` |
| GET | `/api/projects/:id/profit` | 本期固定返回未配置；无财务可见或非项目成员则 403 |
| GET, POST | `/api/projects/:id/tasks` | 手工创建。没有按模板生成的接口 |
| PATCH | `/api/tasks/:id` | 含确认、取消 |

### 审核与交付

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/snapshots/:id/submit` | 送审 |
| POST | `/api/snapshots/:id/reviews` | 通过或退回 |
| POST | `/api/snapshots/:id/deliveries` | 仅最新结论为通过时成功；返回一次性明文令牌 |
| POST | `/api/deliveries/:id/revoke` | 撤销 |
| GET | `/p/:token` | 非 `/api`。校验哈希、过期、撤销后返回冻结 HTML |

### 审计与健康

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/projects/:id/audit-logs` | 仅管理员。管理员可见全部项目的审计 |
| GET | `/api/health` | 进程存活。不返回依赖密钥 |

## 5.6 队列任务

| 任务 | 输入 | 成功时写入 | 失败时 |
| --- | --- | --- | --- |
| analyze | 项目 id | 新的 analysis 版本，不自动 confirm | 只更新 ai_job |
| search | 随 draft_proposal 或 regenerate_block 发生 | 把 web_search 的查询、标题、摘要、来源写入 search_hits，并关联到模型引用的模块 | 搜索工具失败时，生成任务失败，不写入半截模块 |
| draft_proposal | 项目 id | 仅当草稿为空，或 job 明确允许替换 | 不改现有模块 |
| regenerate_block | 模块 id | 只写 job output，等确认接口落模块 | 不改模块 |
| transfer_asset | 工具结果或手工链接中的地址 | 对象存储副本和 asset 行。授权状态保持 unknown | 地址不在工具结果或手工补链中则拒绝。限制未配置时任务失败。失败的媒体不进入已发布快照；文字来源可以留下 |
| publish_render | 快照 id | html_storage_key；失败则删除未完成快照行或标发布失败且不可交付。推荐：事务提交快照前渲染到临时键，成功后再提交记录 | 草稿不变。引用了转存未成功的案例时拒绝发布 |

同一项目的 `draft_proposal` 与 `regenerate_block` 不要并行写同一草稿。入队时若已有进行中的写草稿任务，拒绝新的写任务。

## 5.7 关键序列：发布与交付

1. 编辑调用发布。服务端读取 GrapesJS 工程与 `visible_in_proposal` 的报价行。
2. 用报价表和素材表重写对应节点，导出 HTML 与 CSS，再消毒。
3. 上传对象存储。需要 PDF 时，worker 用这份 HTML/CSS 打印并另存。
4. 插入快照行（工程 JSON、quote_snapshot、html_storage_key、css_storage_key、pdf_storage_key 可空、version_no）。
5. 送审只记录「该快照待审」，不复制第二份 HTML。
6. 审核通过写 review。
7. 创建 delivery：生成高熵令牌，库存哈希，响应返回明文一次。
8. 客户请求 `/p/:token`：比对哈希，检查过期与撤销，读 html_storage_key，设置禁止嵌入到非预期场景的响应头（第 6 篇）。不查 cost_lines。

草稿在第 4 步之后的修改不影响第 8 步。
