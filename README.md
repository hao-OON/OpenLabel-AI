# OpenLabel AI

开源的 AI 数据标注、人工审核与数据质量分析平台（V1 版本）。

## 功能（V1）

- **数据集管理**：项目 / 数据集的创建、删除、查看
- **数据导入**：CSV、Excel (.xlsx)、JSONL，自动清洗（去空、去重、去 URL、规范化空白）
- **AI 标注**：情感 / 文本分类。兼容 OpenAI API 格式的大模型，未配置 Key 时自动回退到本地启发式模式
- **人工审核**：确认、修改、标记异常；低置信度样本优先进入审核队列；完整审核历史
- **质量检测**：重复样本、文本过短、低置信度、标签异常、AI/人工不一致、标签分布失衡
- **数据分析**：AI/人工标签分布、审核统计、AI/人工一致率
- **数据导出**：CSV / JSONL（可选人工标签或 AI 标签）

## 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Python 3.11+ / FastAPI / SQLAlchemy / Pandas |
| 前端 | React 18 + TypeScript + Tailwind CSS + Recharts |
| 数据库 | SQLite（默认，可切换 PostgreSQL） |
| 测试 | Pytest |

## 快速开始

### 后端

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8011
```

可选：配置大模型（OpenAI 兼容格式），在 `backend/` 下创建 `.env`：

```
LLM_API_KEY=sk-xxx
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

未配置时使用本地启发式标注，开箱可用。

### 前端

```bash
cd frontend
npm install
npm run dev
```

打开 http://localhost:5173 （Vite 已代理 `/api` 到 8011 端口）。

### 测试

```bash
cd backend
pip install -r requirements.txt
pytest tests -v
```

### 示例数据

`backend/samples/reviews.csv` 提供了 10 条中文商品评论样例，可直接在 Datasets 页面导入体验完整流程。

## API 概览

| 方法 | 路径 | 说明 |
|---|---|---|
| GET/POST/DELETE | `/api/projects` | 项目管理 |
| GET/POST/DELETE | `/api/datasets` | 数据集管理 |
| POST | `/api/datasets/{id}/import` | 导入文件 |
| GET | `/api/datasets/{id}/export` | 导出 CSV/JSONL |
| GET | `/api/datasets/{id}/records` | 样本列表（支持 status 过滤） |
| POST | `/api/annotations/run` | 批量 AI 标注 |
| POST | `/api/annotations/review` | 人工审核（approve/modify/flag） |
| GET | `/api/records/{id}/history` | 审核历史 |
| POST | `/api/quality/{id}/check` | 运行质量检测 |
| GET | `/api/quality/{id}/issues` | 质量问题列表 |
| GET | `/api/analytics/dashboard` | 总览 |
| GET | `/api/analytics/datasets/{id}` | 数据集分析 |

## 设计说明

AI 标签与人工最终标签分开存储（`annotations.ai_label` / `annotations.human_label`），
每次人工操作写入 `review_logs`，从而支持计算 AI/人工一致率与模型标注表现。

## Roadmap

- V2：自定义提示词、批量标注、多模型对比、双人标注一致性
- V3：多人协作、主动学习、数据集版本管理、插件系统
