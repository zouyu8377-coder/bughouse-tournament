# Bughouse 瑞士制编排系统 — 项目日志

> 最后更新：2026-05-05（第二次）

---

## 1. 项目概述

为线下 Bughouse（联棋）国际象棋比赛设计的单机裁判编排系统。
- 纯前端应用，无需后端
- 浏览器本地存储（IndexedDB）
- 单设备操作
- 支持 <= 64 人

---

## 2. 技术栈

| 层 | 技术 |
|---|---|
| 框架 | Vue 3 (Composition API) |
| 构建 | Vite 5 |
| 状态管理 | Pinia |
| 数据库 | IndexedDB via Dexie.js |
| 拖拽 | 原生 HTML5 Drag & Drop |
| 类型 | TypeScript |

---

## 3. 已实现功能

### 3.1 比赛生命周期
- [x] 创建比赛（名称 + 选手名单表格 + 总轮次）
- [x] 保存/加载/删除历史比赛（IndexedDB）
- [x] 选手名单通过表格填入，支持拖拽/上下移动调整种子顺序

### 3.2 配对系统
- [x] **Manual（手动）**：第一轮完全手动配对，预生成空对局槽位
- [x] **SemiAuto（半自动）**：系统生成 + 人工微调（主要使用）
- [x] **Auto（自动）**：预留扩展，当前同 SemiAuto

### 3.3 瑞士制算法
- [x] 按 score 分组，优先同组配对
- [x] 队友匹配优先级：未合作过 > **种子差距大（高种子配低种子）** > 随机性
- [x] 队伍对阵：两队**总 seed** 尽量接近
- [x] 颜色分配：**优先避免连续同色**，上轮白者本轮黑，上轮黑者本轮白；无记录时高种子白方
- [x] 历史追踪：避免重复队友/对手，记录上轮颜色
- [x] 引入随机性避免固定模式
- [x] 破同分体系：**积分 > 对手分(Buchholz) > 累进分(Progressive) > 索博分(Sonneborn-Berger) > 种子号**

### 3.4 轮次控制
- [x] 每一轮必须锁定后才能进入下一轮
- [x] 已锁定轮不可修改，可解锁重新编辑
- [x] 结果录入：A胜 / B胜 / 平局
- [x] 积分自动计算（含 Buchholz 对手分破同分）

### 3.5 拖拽编排
- [x] 选手池 → 队伍拖拽分配
- [x] 移除选手、添加空对局、删除对局
- [x] 未分配选手实时显示

### 3.6 积分榜
- [x] 按积分、对手分、**累进分、索博分**、种子号排序
- [x] 展示每轮成绩（1 / ½ / 0 / -）及**执色 W/B**
- [x] **比赛结束后显示领奖台**（金银铜前三名）

### 3.7 数据持久化
- [x] Tournament / Player / Round / Match 四层表结构
- [x] Dexie.js 封装，支持事务
- [x] 数据库版本管理（当前 v4，含 totalRounds、seed、progressive、sonnebornBerger 字段）

---

## 4. 文件结构

```
src/
  domain/
    types.ts              # 核心类型定义
    pairingEngine.ts      # 纯函数配对引擎（可独立测试）
  db/
    database.ts           # Dexie.js IndexedDB 封装
  stores/
    tournament.ts         # Pinia 状态管理
  components/
    TournamentSetup.vue   # 比赛创建/加载
    PlayerManager.vue     # 选手列表
    PairingBoard.vue      # 拖拽编排 + 结果录入
    Scoreboard.vue        # 积分榜 + 领奖台
  App.vue
  main.ts
```

---

## 5. 已知问题 / 待办事项

### 5.1 高优先级
- [x] **种子系统实施**：已完成种子排序、高种子配低种子、颜色交替分配
- [ ] **队伍间选手交换/移动**：当前只能移除后重新拖拽，不支持直接在两队伍间移动
- [ ] **手动配对的颜色分配逻辑**：拖拽加入时第一个为 white 第二个为 black，需确认是否符合裁判习惯

### 5.2 中优先级
- [ ] **已保存比赛的列表展示**：当前仅显示名称，未显示人数、轮次、创建时间
- [ ] **IndexedDB 版本升级兼容性**：v3 已处理 seed 默认值，但未来 schema 变更需更完善的迁移策略
- [ ] **Buchholz 计算精度**：当前可能因浮点数导致微小差异，需确认是否影响排序

### 5.3 低优先级
- [ ] **打印友好性**：积分榜未做打印样式优化
- [ ] **导出功能**：缺乏 CSV/Excel 导出选手成绩
- [ ] **Undo/Redo**：无撤销重做机制
- [ ] **SortableJS 引入但未使用**：`package.json` 已安装但实际使用原生 HTML5 DnD，可清理
- [ ] **选手照片/头像**：无头像展示
- [ ] **多语言**：仅中文
- [ ] **PWA 离线支持**：未配置 service worker

---

## 6. 最近变更记录

### 2026-05-05（第二次）
1. **增加累进分和索博分破同分**：
   - `Player` 类型新增 `progressive`（累进分）和 `sonnebornBerger`（索博分）
   - `calculateScores` 重新实现：逐轮累计 progressive，使用最终对手分计算 Buchholz 和 SB
   - 排序逻辑：积分 > 对手分 > 累进分 > 索博分 > 种子号
   - 积分榜和选手列表新增这两列展示
   - 每轮成绩格显示 **成绩+执色**（如 `1W`、`0B`、`½W`）
   - 数据库升级到 v4

### 2026-05-05
1. **种子系统替换等级分**：
   - `Player` 类型新增 `seed: number`，`rating` 保留但不再参与配对与展示
   - 初始化页面改为表格输入，支持拖拽/上下移动调整种子顺序
   - 队友匹配改为**高种子配低种子**（seed 差距大者优先）
   - 队伍对阵改为**总 seed 接近**配对
   - 颜色分配新增历史追踪，**优先避免连续执同色**（上轮白→本轮黑，上轮黑→本轮白；无记录时高种子白方）
2. **数据库升级**：Dexie schema 从 v2 升级到 v3，PlayerRecord 新增 `seed` 字段
3. **UI 更新**：所有页面移除等级分显示，改为展示种子号

### 2026-05-02
1. **新增领奖台功能**：`Scoreboard.vue` 在所有轮次锁定后显示金银铜前三名
2. **新增总轮次设置**：`TournamentSetup.vue` 创建时可设定总轮次（1-20），存入 Tournament 类型和数据库
3. **数据库升级**：Dexie schema 从 v1 升级到 v2，新增 `totalRounds` 字段
4. **修复模板变量**：`PairingBoard.vue` 中 `currentRoundLocked` 改为 `store.currentRoundLocked`
5. **手动配对预生成空槽位**：`manual` 策略下自动创建空 Match 槽位

### 更早
- 项目初始化（Vue 3 + Vite + Pinia + Dexie）
- 瑞士制半自动配对引擎实现
- 拖拽编排 UI 实现
- 积分计算与排行榜实现

---

## 7. 后续开发计划

1. **拖拽体验优化**：支持选手在不同队伍间直接拖拽移动
2. **颜色分配控制**：允许裁判手动调整 white/black
3. **数据导出**：导出积分榜为 CSV
4. **测试覆盖**：为 `pairingEngine.ts` 编写单元测试
5. **打印样式**：优化积分榜打印输出

---

## 8. 快速启动

```bash
cd /c/bughouse
npm install
npm run dev      # 开发模式
npm run build    # 生产构建到 dist/
```

---

## 9. 关键设计决策

- **Domain 与 UI 分离**：`pairingEngine.ts` 纯函数，不依赖 Vue/Pinia，可直接单元测试
- **Pinia store 负责状态流转**：`startNewRound` / `lockCurrentRound` / `setMatchResult` 等核心操作在 store 中完成
- ** IndexedDB 作为唯一持久层**：无 localStorage，全部走 Dexie.js
- **Tournament 作为聚合根**：一次 save/load 整个 Tournament 对象，简化一致性管理
