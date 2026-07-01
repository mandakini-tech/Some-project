# AI-Powered Investment Risk Analyzer (MERN + LangChain + RAG)

An advanced multi-agent AI financial risk platform designed to evaluate stock portfolios using real-time market feeds and unstructured news. The platform implements a complete MERN stack, LangChain agents, a local Vector Store retrieval-augmented generation (RAG) pipeline, and JWT-based authentication.

---

## 🚀 Key Features

* **Multi-Agent Orchestration**:
  1. **Market Analysis Agent**: Fetches historical and current pricing from Yahoo Finance API, calculating weighted portfolio beta, standard deviation volatility, and Value-at-Risk (VaR) relative to the S&P 500 (`SPY`).
  2. **RAG Pipeline Agent**: Embeds and retrieves relevant sector/ticker disclosures and risk alerts from a vector search database to enrich qualitative evaluations.
  3. **Decision Agent**: Synthesizes the quantitative calculations and qualitative news reports to output a detailed Markdown advisory report.
* **Dual-Mode Database**: Gracefully connects to a local MongoDB instance. If MongoDB is unavailable, it automatically switches to a local file database (`database_fallback.json`) so the app is fully operational out of the box.
* **Smart Rule-Based AI Fallback**: If `OPENAI_API_KEY` is not configured in the `.env` file, the decision agent falls back to a sophisticated rule-based scoring engine to generate rich, context-aware Markdown advisory reports.
* **Premium Glassmorphic Dashboard**: A fully responsive UI featuring dark-theme glassmorphism, animated layouts, reactive pie charts (via Chart.js), and a streaming logs terminal directly tracking agent execution steps.

---

## 🛠️ Technology Stack

* **Frontend**: React (Vite), Chart.js, Lucide Icons, Vanilla CSS
* **Backend**: Node.js, Express.js, JWT, Yahoo Finance API (`yahoo-finance2`)
* **Database**: MongoDB (Mongoose) with local JSON file fallback
* **AI Orchestration**: LangChain, `@langchain/openai` with rule-based fallback

---

## 📂 Project Structure

```
├── backend/                   # Express REST API
│   ├── Config/                # Database configurations & fallbacks
│   ├── controllers/           # Auth and Portfolio controllers
│   ├── middleware/            # JWT authentication middleware
│   ├── models/                # MongoDB (Mongoose) schemas
│   ├── routes/                # Express routing endpoints
│   ├── Services/              # LangChain Multi-Agent & RAG services
│   ├── server.js              # Server entry point
│   └── .env                   # Backend environment configurations
│
├── client/                    # React Vite Frontend SPA
│   ├── public/                # Public assets
│   ├── src/
│   │   ├── components/        # Dashboard layout, metrics & charts
│   │   ├── App.jsx            # State management & routers
│   │   └── index.css          # Dark glassmorphism styles
│   └── package.json           # Client packages
│
├── package.json               # Root scripts & orchestrations
└── database_fallback.json     # Generated local file DB fallback
```

---

## 💻 Setup & Startup Instructions

### 1. Prerequisite
Ensure you have [Node.js](https://nodejs.org/) installed (v18+ recommended).

### 2. Install Dependencies
You can install dependencies for the root, backend, and frontend with a single command from the project root:
```bash
npm run install-all
```

### 3. Configure Environment Variables
Inside the `backend/` directory, locate the `.env` file and customize your settings.
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/risk-analyzer
JWT_SECRET=your_jwt_secret_token_key_here
OPENAI_API_KEY=your_openai_api_key_here # (Optional - will fall back to local rule engine if empty)
```

### 4. Run the Application
Start both the backend server and frontend client concurrently with a single command run from the **root directory**:
```bash
npm run dev
```

* **Frontend Dashboard**: [http://localhost:5173](http://localhost:5173)
* **Backend API server**: [http://localhost:5000](http://localhost:5000)

---

## ⚙️ How to Test & Verify

1. Open **[http://localhost:5173](http://localhost:5173)** in your browser.
2. Click **"Register here"** to sign up a new account (e.g. `investor1` / `password123`), then log in.
3. Add asset holdings using the input fields (e.g., Ticker: `AAPL`, Shares: `10`, Average Price: `180`).
4. Watch the **Multi-Agent AI Engine Panel** output live execution logs from the Market Analysis, RAG, and Decision agents.
5. Review your updated **Executive Portfolio Risk Analysis Report** rendered in real-time.
