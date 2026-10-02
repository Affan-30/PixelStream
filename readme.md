# PixelStream — Video & Social Platform Backend with Video-Transcript AI Q&A

PixelStream is a production-grade, production-ready backend engine that merges core **YouTube** video streaming capabilities and **Twitter (X)** micro-blogging features with an **AI-powered context-aware Video Q&A engine**.

By processing video transcripts and leveraging LLM embeddings, PixelStream allows users to ask questions about any video and receive accurate, timestamped answers directly from the video's content.

---

## Key Highlights

* **Video-Transcript AI Engine**: Automatic transcript parsing, chunking, and contextual Q&A per video.
* **Micro-blogging (Tweets)**: Full social interactions alongside video content.
* **Enterprise-Grade Architecture**: Built with JWT authentication, custom middleware pipeline, secure password hashing, and clean controller-service design patterns.
* **Scalable Asset Storage**: Cloudinary media pipeline supporting auto-upload, transformation, and stream optimization for videos and images.

---

## Architectural Overview

```
                        ┌───────────────────────────────────┐
                        │          Client Requests          │
                        └─────────────────┬─────────────────┘
                                          │
                                          ▼
                        ┌───────────────────────────────────┐
                        │      Express API Router &         │
                        │    JWT / Multer Middlewares       │
                        └─────────────────┬─────────────────┘
                                          │
                  ┌───────────────────────┼───────────────────────┐
                  ▼                       ▼                       ▼
      ┌───────────────────────┐ ┌───────────────────┐ ┌───────────────────────┐
      │   Core Media Engine   │ │ Tweet & Social    │ │   Video Transcript    │
      │  (Videos, Playlists)  │ │   Micro-Service   │ │       AI Engine       │
      └───────────┬───────────┘ └─────────┬─────────┘ └───────────┬───────────┘
                  │                       │                       │
                  ▼                       ▼                       ▼
      ┌───────────────────────┐ ┌───────────────────┐ ┌───────────────────────┐
      │  Cloudinary Pipelines │ │ MongoDB Analytics │ │  Vector / LLM Context │
      │  (Video & Image CDN)  │ │ (Aggregation Pipeline)│ (Transcript Processing)│
      └───────────────────────┘ └───────────────────┘ └───────────────────────┘

```

---

## Core Features

### 🧠 AI Video Querying ("Ask Anything")

* **Transcript Extraction & Ingestion**: Ingests video audio transcripts upon video processing.
* **Contextual Video Q&A**: Ask questions directly against a specific video's content without watching the full runtime.
* **Semantic Search**: Matches user queries with precise video timeframes and accurate contextual references.

### 🎥 Video Engine & Playlists

* **Video Upload & Streaming**: Multer stream handling integrated with Cloudinary for fast CDN delivery.
* **Playback Controls**: Visibility management (Public/Private), search, sorting, and cursor/offset pagination.
* **Playlist Management**: Custom user playlist creation, drag-and-drop order re-indexing, and dynamic video manipulation.
* **Watch History Tracking**: Automatically logs user watch activity for recommendation and history routes.

### 🐦 Tweet & Social Feed

* **Micro-blogging**: Tweet posting, media attachments, updates, and deletions.
* **Social Graph**: Follow/Subscribe mechanics across channels with live subscriber lists and feed aggregation.

### 💬 Engagement & Analytics

* **Unified Reaction System**: Expressive Likes and Unlikes across videos, comments, and tweets.
* **Nested Commenting**: Multi-level video comment threads with real-time CRUD capabilities.
* **Channel Dashboard**: Analytics reporting video views, total likes, subscriber counts, and dynamic engagement trends via MongoDB aggregation pipelines.

### 🔒 Security & User Management

* **Auth**: Dual-Token Authentication (`Access Tokens` short-lived + `Refresh Tokens` long-lived in secure `HTTP-Only` cookies).
* **Profile Management**: Dynamic avatars, channel cover art uploading, and profile customization.
* **Health Check Endpoint**: Dedicated operational health verification API endpoint for continuous integration monitoring.

---

## Tech Stack & Dependencies

* **Runtime**: Node.js
* **Framework**: Express.js
* **Database**: MongoDB (Mongoose ORM with advanced Aggregation Frameworks)
* **Media Engine**: Cloudinary API + Multer Middleware
* **Security & Auth**: JSON Web Tokens (JWT), bcrypt.js
* **AI Processing**: Transcript Parsers & LLM/Vector Context Integration

---

## Getting Started

### Prerequisites

* Node.js (`v18+` recommended)
* MongoDB instance (Local or MongoDB Atlas)
* Cloudinary Account (for video and image storage)
* OpenAI API Key (or equivalent LLM provider key for transcript Q&A)

### Installation

1. **Clone the Repository**
```bash
git clone https://github.com/Affan-30/PixelStream.git
cd PixelStream

```


2. **Install Dependencies**
```bash
npm install

```


3. **Configure Environment Variables**
Create a `.env` file in the project root directory:
```env
PORT=8000
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/pixelstream
CORS_ORIGIN=*

# JWT Tokens
ACCESS_TOKEN_SECRET=your_access_token_secret
ACCESS_TOKEN_EXPIRY=1d
REFRESH_TOKEN_SECRET=your_refresh_token_secret
REFRESH_TOKEN_EXPIRY=10d

# Cloudinary Setup
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# AI / Transcript Service
AI_SERVICE_API_KEY=your_ai_api_key

```


4. **Run the Development Server**
```bash
npm run dev

```



---

## API Architecture & Endpoints

| Category | Endpoint / Domain | Key Responsibilities |
| --- | --- | --- |
| **Auth & User** | `/api/v1/users` | Registration, Auth refresh, Profile updates, Watch history |
| **AI Q&A** | `/api/v1/ai` | Query transcripts, generate summaries, context search |
| **Videos** | `/api/v1/videos` | Stream uploads, pagination, updates, visibility |
| **Tweets** | `/api/v1/tweets` | Tweet creation, user feed, deletion |
| **Subscriptions** | `/api/v1/subscriptions` | Channel subscription toggles, subscriber lists |
| **Playlists** | `/api/v1/playlist` | Custom playlists, video additions/removals |
| **Likes** | `/api/v1/likes` | Toggle likes for videos, tweets, and comments |
| **Comments** | `/api/v1/comments` | Threaded video comments |
| **Dashboard** | `/api/v1/dashboard` | Creator analytics & engagement statistics |
| **Health** | `/api/v1/healthcheck` | Server and DB status verification |

---

## Project Structure

```
PixelStream/
├── src/
│   ├── controllers/      # Request logic & route handlers
│   ├── db/               # Database connection logic
│   ├── middlewares/      # Authentication, file upload (Multer), error handling
│   ├── models/           # Mongoose schemas (User, Video, Tweet, Transcript, etc.)
│   ├── routes/           # Express router endpoints
│   ├── services/         # AI Transcript extraction & processing engines
│   ├── utils/            # ApiError, ApiResponse, AsyncHandler, Cloudinary utils
│   ├── app.js            # Express app configuration
│   └── index.js          # Entry point & server bootstrap
├── .env.sample
├── package.json
└── README.md

```
