# 🗞️ NewsIntel — AI-Powered News Intelligence Platform

> Real-time NLP analysis of global news from **trusted sources**. Built with FastAPI, HuggingFace Transformers, Google Gemini, and React.

![NewsIntel](https://img.shields.io/badge/version-3.0-blue?style=flat-square)
![NLP](https://img.shields.io/badge/NLP-HuggingFace-yellow?style=flat-square)
![AI](https://img.shields.io/badge/AI-Gemini%202.0-purple?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

---

## 🧠 NLP Pipeline

This is a **full NLP (Natural Language Processing) project** that uses 4 AI/ML models:

| Model | Task | Framework |
|-------|------|-----------|
| **distilBART** (sshleifer/distilbart-cnn-12-6) | Text Summarization | HuggingFace Transformers |
| **RoBERTa** (cardiffnlp/twitter-roberta-base-sentiment) | Sentiment Analysis | HuggingFace Transformers |
| **BERT-NER** (dslim/bert-base-NER) | Named Entity Recognition | HuggingFace Transformers |
| **Gemini 2.0 Flash** | Topic Intelligence & Risk Analysis | Google GenAI |

### How It Works

```
User Query → RSS Scraping → Article Extraction → NLP Pipeline → AI Analysis → Frontend
                                                    ↓
                                        ┌──────────────────────┐
                                        │  Summarization       │
                                        │  Sentiment Analysis  │
                                        │  Entity Recognition  │
                                        │  Gemini Intelligence │
                                        └──────────────────────┘
```

## ✨ Features

- **🗞️ Newspaper-style headline** — Top story displayed prominently with editorial layout
- **📰 Scrolling news ticker** — Live-style headline scroll like news channels
- **🔍 Trusted source prioritization** — Reuters, BBC, NYT, Guardian, etc. ranked higher
- **🌍 14+ country support** — Multi-region news with country selector
- **📊 Analytics dashboard** — Sentiment distribution, entity mentions, source breakdown
- **🔗 Clickable articles** — All links open the actual source article
- **⚡ Real-time processing** — Async pipeline processes 8 curated articles in parallel
- **🎨 Premium dark theme** — Glassmorphism, gradient mesh, scroll animations

## 🏗️ Tech Stack

### Backend
- **FastAPI** — Async REST API
- **HuggingFace Inference API** — NLP models (summarization, sentiment, NER)
- **Google Gemini** — AI-powered topic intelligence
- **feedparser** — RSS feed parsing
- **newspaper3k** — Article text extraction
- **httpx** — Async HTTP client

### Frontend
- **React 19** — UI framework
- **Vite** — Build tool
- **Recharts** — Analytics charts
- **Lucide React** — Icons
- **Vanilla CSS** — Premium design system

## 🚀 Quick Start

### Backend
```bash
cd backend
pip install -r requirements.txt
# Create .env with HF_TOKEN and GEMINI_API_KEY
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Environment Variables
Create `backend/.env`:
```
HF_TOKEN=your_huggingface_token
GEMINI_API_KEY=your_gemini_api_key
```

## 📁 Project Structure

```
NewsIntel/
├── backend/
│   ├── main.py              # FastAPI server + NLP pipeline
│   ├── requirements.txt     # Python dependencies
│   └── Dockerfile          # Docker deployment
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Main app with newspaper layout
│   │   ├── App.css          # Premium design system
│   │   ├── index.css        # Global styles & animations
│   │   ├── api.js           # Backend API client
│   │   └── components/
│   │       ├── SearchBar.jsx     # Search with region selector
│   │       ├── TopicOverview.jsx # AI intelligence brief
│   │       ├── ArticleCard.jsx   # Article display card
│   │       ├── EntityChart.jsx   # NER entity mentions
│   │       ├── SentimentPie.jsx  # Sentiment distribution
│   │       └── SourceChart.jsx   # News source breakdown
│   └── package.json
└── README.md
```

## 📜 License

MIT License — Built by Yogender
