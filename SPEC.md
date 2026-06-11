# 桌面证书管理器 - 技术规格说明

## 1. 项目概述

### 项目名称
CertManager - 桌面证书管理器

### 项目类型
桌面应用程序 (Electron + TypeScript)

### 核心功能概述
面向小型团队的统一证书管理工具，支持查看本机和共享目录的证书文件，提供证书分组、详情查看、到期提醒、密码保险箱和检查工具等功能。

### 目标用户
- 小型团队的技术人员
- DevOps 工程师
- 系统管理员
- 项目经理

## 2. UI/UX 规格说明

### 2.1 窗口结构

#### 主窗口
- 尺寸：1200x800 像素（最小 900x600）
- 可调整大小
- 使用自定义标题栏

#### 子窗口
- 密码保险箱窗口：500x400 像素（模态）
- 证书导入对话框：600x500 像素

#### 窗口通信
- 使用 Electron IPC 进行进程间通信
- 主进程管理所有窗口生命周期

### 2.2 布局结构

```
+------------------------------------------+
|  [Logo] 证书管理器           [_] [□] [X] |  <- 标题栏
+------------------------------------------+
|  [证书列表] [到期提醒] [检查工具] [密码箱] |  <- 导航栏
+------------------------------------------+
|                                          |
|              主内容区域                   |
|                                          |
|                                          |
+------------------------------------------+
|  状态栏：证书总数 | 本机 | 共享           |  <- 状态栏
+------------------------------------------+
```

### 2.3 视觉设计

#### 颜色方案
- 主色（Primary）：#1890ff（蓝色）
- 次色（Secondary）：#52c41a（绿色）
- 警告色（Warning）：#faad14（橙色）
- 危险色（Danger）：#ff4d4f（红色）
- 背景色：#f0f2f5
- 卡片背景：#ffffff
- 文字主色：#262626
- 文字次色：#8c8c8c
- 边框色：#d9d9d9

#### 字体规格
- 字体族：-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif
- 标题：20px, font-weight: 600
- 正文：14px, font-weight: 400
- 辅助文字：12px, font-weight: 400

#### 间距系统
- 基础单位：8px
- 页面边距：24px
- 卡片间距：16px
- 元素间距：8px

#### 视觉效果
- 卡片阴影：0 1px 2px rgba(0, 0, 0, 0.06)
- 悬停阴影：0 4px 12px rgba(0, 0, 0, 0.1)
- 圆角：6px
- 过渡动画：0.3s ease

### 2.4 组件规格

#### 导航栏
- 高度：56px
- 背景色：#ffffff
- 底部边框：1px solid #d9d9d9
- 导航项：文字 + 图标
- 激活状态：主色下划线 + 主色文字

#### 证书卡片
- 背景色：#ffffff
- 内边距：16px
- 圆角：6px
- 阴影：默认隐藏，悬停显示
- 悬停效果：阴影 + 边框主色

#### 按钮
- 主按钮：背景 #1890ff，文字白色
- 次按钮：背景白色，边框主色
- 危险按钮：背景 #ff4d4f，文字白色
- 尺寸：高度 36px，水平内边距 16px
- 圆角：4px

#### 表格
- 表头背景：#fafafa
- 斑马纹：奇数行 #ffffff，偶数行 #fafafa
- 悬停行背景：#e6f7ff
- 边框：1px solid #d9d9d9

#### 标签
- 圆角：4px
- 内边距：2px 8px
- 字体：12px

#### 颜色分级
- 紧急（0-7天）：#ff4d4f（红色）
- 警告（8-30天）：#faad14（橙色）
- 注意（31-60天）：#52c41a（绿色）
- 正常（60天以上）：#8c8c8c（灰色）

## 3. 功能规格说明

### 3.1 证书列表页

#### 功能描述
展示所有已导入的证书，支持分组、筛选、搜索和详情查看。

#### 核心功能
1. **证书导入**
   - 单个文件导入：支持 .cer, .crt, .pem, .der, .pfx, .p12 格式
   - 批量导入：选择文件夹或多个文件
   - 拖拽导入：支持拖拽文件和文件夹到列表区域
   - 扫描目录：支持扫描本机目录和 UNC 路径

2. **分组管理**
   - 按项目分组：创建、编辑、删除项目分组
   - 默认分组：未分类
   - 拖拽调整：将证书拖拽到不同分组

3. **证书信息展示**
   - 证书名称/主题
   - 颁发者（Issuer）
   - 持有人/主题（Subject）
   - 有效期（开始日期 - 结束日期）
   - 用途（Key Usage, Extended Key Usage）
   - 指纹（SHA-1, SHA-256）
   - 状态图标（有效、即将过期、已过期）

4. **搜索和筛选**
   - 全文搜索：搜索证书名称、持有人、颁发者
   - 状态筛选：全部、有效、即将过期、已过期
   - 类型筛选：按文件格式筛选
   - 分组筛选：按项目分组筛选

5. **操作功能**
   - 查看详情
   - 导出证书
   - 复制信息
   - 删除证书

#### 数据结构
```typescript
interface Certificate {
  id: string;
  name: string;
  subject: string;
  issuer: string;
  serialNumber: string;
  notBefore: Date;
  notAfter: Date;
  fingerprint: {
    sha1: string;
    sha256: string;
  };
  keyUsage: string[];
  extendedKeyUsage: string[];
  publicKeyAlgorithm: string;
  signatureAlgorithm: string;
  filePath: string;
  fileFormat: string;
  projectId: string;
  notes: string;
  responsiblePerson: string;
  importDate: Date;
  sourceType: 'local' | 'shared';
}
```

### 3.2 证书详情页

#### 功能描述
展示单个证书的完整信息，包括证书链路、指纹、备注和关联负责人。

#### 核心功能
1. **基本信息**
   - 证书名称
   - 版本号
   - 序列号
   - 颁发者
   - 持有人/主题
   - 有效期范围
   - 剩余天数

2. **证书链路**
   - 显示完整证书链（根 CA -> 中间 CA -> 终端实体证书）
   - 每个节点可点击查看详情
   - 链路验证状态

3. **技术信息**
   - 公钥算法和位数
   - 签名算法
   - 指纹信息（SHA-1, SHA-256, MD5）
   - 主题备用名称（SAN）
   - CRL 分发点
   - OCSP 服务器

4. **使用信息**
   - 密钥用途（Key Usage）
   - 扩展密钥用途（Extended Key Usage）
   - 允许的密钥用途

5. **管理信息**
   - 备注：可编辑的多行文本
   - 关联负责人：可选择的团队成员
   - 项目分组：所属项目
   - 导入时间
   - 文件路径

6. **操作功能**
   - 复制指纹
   - 导出证书信息（PDF/JSON）
   - 打开文件位置
   - 删除证书

### 3.3 到期提醒页

#### 功能描述
按剩余天数分级展示证书到期情况，支持设置续期任务和确认完成。

#### 核心功能
1. **到期概览**
   - 饼图展示：正常/即将过期/已过期 比例
   - 统计数字：总数、有效数、即将过期数、已过期数

2. **分级列表**
   - 紧急（0-7天）：红色标记
   - 警告（8-30天）：橙色标记
   - 注意（31-60天）：绿色标记
   - 正常（60天以上）：灰色标记

3. **续期任务**
   - 创建续期任务：设置任务名称、截止日期、指派人
   - 任务状态：待处理、进行中、已完成
   - 任务备注：记录续期进度
   - 任务提醒：到期前 N 天提醒

4. **操作功能**
   - 标记完成：确认续期完成，更新证书有效期
   - 跳过：标记为不再需要
   - 批量操作：批量设置提醒、批量创建任务
   - 导出提醒报告

### 3.4 密码保险箱窗口

#### 功能描述
安全存储证书相关密码，支持查看确认和保护。

#### 核心功能
1. **密码存储**
   - 添加密码：名称、密码、关联证书、备注
   - 密码加密存储（AES-256）
   - 主密码保护

2. **查看确认**
   - 点击查看需要二次确认
   - 复制密码需要确认
   - 自动隐藏密码（可配置时间）

3. **密码管理**
   - 编辑密码信息
   - 删除密码
   - 密码生成器
   - 导入/导出（加密格式）

4. **安全设置**
   - 设置主密码
   - 自动锁定时间
   - 剪贴板自动清除

### 3.5 检查工具页

#### 功能描述
验证证书各项属性，检测问题并导出盘点报告。

#### 核心功能
1. **证书验证**
   - 私钥匹配检查：验证证书是否匹配对应私钥
   - 过期检查：检查证书是否已过期
   - 重复检查：检测指纹重复的证书
   - 链信任检查：验证证书链完整性

2. **检查结果**
   - 问题列表：所有检测到的问题
   - 严重程度：严重、警告、提示
   - 修复建议：提供问题解决建议

3. **批量检查**
   - 选择要检查的证书
   - 批量执行所有检查
   - 进度显示

4. **报告导出**
   - 导出格式：JSON、CSV、PDF、HTML
   - 报告内容：检查结果、证书列表、统计信息
   - 自定义报告模板

#### 检查项说明
```typescript
interface CheckResult {
  type: 'key_match' | 'expired' | 'duplicate' | 'chain_trust';
  severity: 'error' | 'warning' | 'info';
  certificateId: string;
  message: string;
  details: string;
  suggestion: string;
}
```

## 4. 数据流和模块设计

### 4.1 模块结构
```
src/
├── main/                    # 主进程
│   ├── index.ts            # 主进程入口
│   ├── ipc-handlers.ts     # IPC 处理器
│   ├── certificate-parser.ts # 证书解析模块
│   ├── file-manager.ts     # 文件管理
│   ├── password-vault.ts   # 密码保险箱
│   └── report-generator.ts  # 报告生成
├── renderer/               # 渲染进程
│   ├── index.html         # 主页面
│   ├── renderer.ts         # 渲染进程入口
│   ├── styles/            # 样式文件
│   ├── components/        # 组件
│   └── pages/             # 页面组件
└── shared/                # 共享类型和工具
    └── types.ts           # 类型定义
```

### 4.2 核心模块

#### CertificateParser
- 职责：解析各类证书格式
- 方法：
  - `parseCertificate(filePath: string): Certificate`
  - `parseCertificateChain(filePath: string): Certificate[]`
  - `matchPrivateKey(cert: Certificate, keyPath: string): boolean`

#### FileManager
- 职责：文件操作和目录扫描
- 方法：
  - `scanDirectory(path: string): Promise<string[]>`
  - `importCertificate(filePath: string): Promise<Certificate>`
  - `batchImport(filePaths: string[]): Promise<Certificate[]>`

#### PasswordVault
- 职责：密码加密存储
- 方法：
  - `encrypt(data: string, password: string): string`
  - `decrypt(data: string, password: string): string`
  - `storePassword(entry: PasswordEntry): void`
  - `getPassword(id: string, masterPassword: string): string`

#### ReportGenerator
- 职责：生成检查报告
- 方法：
  - `generateInventoryReport(certificates: Certificate[]): Report`
  - `exportToJSON(report: Report): string`
  - `exportToCSV(report: Report): string`
  - `exportToPDF(report: Report): Buffer`

## 5. 验收标准

### 5.1 功能验收

#### 证书列表页
- [ ] 能够导入单个 .cer, .crt, .pem 格式证书
- [ ] 能够导入 .pfx, .p12 格式证书（带密码）
- [ ] 能够批量导入文件夹中的证书
- [ ] 支持拖拽导入文件和文件夹
- [ ] 证书按项目分组显示
- [ ] 支持搜索和筛选功能
- [ ] 证书信息完整展示（颁发者、持有人、有效期、用途）
- [ ] 显示指纹信息（SHA-1, SHA-256）

#### 证书详情页
- [ ] 显示完整证书信息
- [ ] 显示证书链路
- [ ] 可编辑备注和负责人
- [ ] 支持复制指纹信息
- [ ] 可导出证书信息

#### 到期提醒页
- [ ] 按天数分级标色显示
- [ ] 创建续期任务
- [ ] 标记任务完成
- [ ] 显示到期统计

#### 密码保险箱
- [ ] 添加、编辑、删除密码
- [ ] 主密码保护
- [ ] 查看密码需要确认
- [ ] 密码加密存储

#### 检查工具
- [ ] 验证私钥匹配
- [ ] 检测过期证书
- [ ] 检测重复证书
- [ ] 导出盘点报告（JSON/CSV）

### 5.2 视觉验收
- [ ] 颜色分级正确显示
- [ ] 卡片阴影和悬停效果正常
- [ ] 表格样式符合规格
- [ ] 响应式布局适配不同窗口大小

### 5.3 性能验收
- [ ] 100个证书导入时间 < 5秒
- [ ] 搜索响应时间 < 100ms
- [ ] 页面切换流畅无卡顿
