# URL Shortener

A **URL Shortener** service that provides asynchronous delivery of shortened URLs using **WebSockets**. It also offers **persistent** message queueing, supports **multi-user** scenarios through a `clientId`, and can handle **unstable connections** via exponential backoff and acknowledgment logic.

## Table of Contents

1. [Overview](#overview)  
2. [Key Features](#key-features)  
3. [Prerequisites](#prerequisites)  
4. [Getting Started](#getting-started)  
5. [Project Structure](#project-structure)  
6. [Architecture](#architecture)  
7. [API Endpoints](#api-endpoints)  
8. [WebSocket Workflow](#websocket-workflow)  
9. [Testing](#testing)  
10. [Future Scopes](#future-scopes)  
11. [License](#license)

---

## 1. Overview

This project provides a **URL-shortening** service in which the **HTTP** request that shortens a URL **does not** return the shortened URL in the response. Instead, it’s delivered asynchronously through a **WebSocket** connection.  

- The server stores **URL mappings** in both **in-memory** and **file-based** storages using a **composite** approach.  
- A **persistent message queue** manages undelivered messages to handle **client restarts** or **network issues**.  
- **Exponential backoff** ensures repeated delivery attempts until acknowledged.

---

## 2. Key Features

- **Shorten URLs** with random 10-character codes.  
- **Async result** delivered via **WebSocket** (not in the HTTP response).  
- **In-memory + file-based** storage for URL mappings.  
- **Persistent message queue** that re-sends messages if client doesn’t acknowledge.  
- **Automatic purging** of stale messages (optional logic).  
- **Graceful shutdown** to stop intervals and close I/O processes.  
- **Integration tests** covering HTTP + WebSocket flows.  

---

## 3. Prerequisites

- **Node.js** v18+ or v22+ (recommended).  
- **npm** or **yarn** for dependency management.  
- **TypeScript** knowledge if you want to make changes to the source code.  

---

## 4. Getting Started

1. **Clone** the repository:

   ```bash
   git clone https://github.com/<username>/url-shortener.git
   cd url-shortener
   ```

2. **Install dependencies**:

   ```bash
   npm install
   # or
   yarn
   ```

3. **Build** the project:

   ```bash
   npm run build
   # or
   yarn build
   ```

4. **Start** the server:

   ```bash
   npm start
   # or
   yarn start
   ```

   By default, it listens on `PORT=3000`. If you want a different port:

   ```bash
   PORT=4000 npm start
   ```

---

## 5. Project Structure

Below is a typical layout (simplified):

```
.
├── src
│   ├── concurrency
│   │   └── AsyncQueue.ts           // File concurrency queue
│   ├── config
│   │   └── index.ts                // Configuration settings
│   ├── controller
│   │   └── UrlController.ts        // Express routes
│   ├── message
│   │   ├── MessageQueue.ts         // Persistent queue with exponential backoff
│   │   ├── PurgePolicy.ts          // Optional message purging logic
│   │   └── WebSocketService.ts     // WebSocket logic
│   ├── services
│   │   └── UrlShortenerService.ts  // Short code generation + storage
│   ├── storage
│   │   ├── FileUrlStorage.ts       // File-based storage
│   │   ├── InMemoryUrlStorage.ts   // In-memory storage
│   │   └── CompositeUrlStorage.ts
│   ├── server.ts                   // Main server entry
│   └── __tests__                   // Test files
├── package.json
├── tsconfig.json
└── README.md
```

---

## 6. Architecture

1. **Storage Layer**  
   - **InMemoryUrlStorage**: Stores mappings in an in-memory hash.  
   - **FileUrlStorage**: Persists mappings to a JSON file, writing through a concurrency queue to avoid race conditions.  
   - **CompositeUrlStorage**: Combines multiple storages so that if one fails or is missing, the other can still respond.

2. **Service Layer**  
   - **UrlShortenerService**: Generates random short codes, checks for collisions, and normalizes URLs (e.g., adding `http://` if missing).

3. **Controller**  
   - **UrlController**: Express endpoints for:
     - `POST /url`: Accepts `url` param (and optionally `clientId`) and queues a message for WebSocket delivery.  
     - `GET /:code`: Resolves the short code to the original URL.

4. **Messaging Layer**  
   - **MessageQueue**: A persistent queue that loads from a JSON file, storing messages with nextAttempt, retryCount, etc.  
   - **PurgePolicy**: Optional logic to remove stale messages (e.g., after 24 hours).
   - **WebSocketService**: Maintains `(clientId -> WebSocket)` map, re-sends messages until acknowledged.

5. **Concurrency**  
   - **AsyncQueue**: Serializes read/write tasks to avoid corrupting the file.

6. **Main Server** (`server.ts`)  
   - Creates storages, services, queue, WebSocket server, etc.  
   - Listens on the specified port, sets up graceful shutdown.

---

## 7. API Endpoints

1. **POST `/url`**  
   - **Body**:

     ```json
     {
       "url": "https://example.com",
       "clientId": "optional-client-id"
     }
     ```

   - **Response**:

     ```json
     {
       "status": "Shortening in progress. Check WebSocket for result.",
       "messageId": "msg_1689782_321"
     }
     ```

   - **Behavior**: Instead of returning the shortened URL, it queues a message for **WebSocket** delivery.

2. **GET `/:code`**  
   - **Path Param**: `code` (the short code)  
   - **Response** (if found):

     ```json
     {
       "url": "https://example.com"
     }
     ```

   - **404** if code not found.

---

## 8. WebSocket Workflow

1. **Client** connects to `ws://<host>:<port>?clientId=<some-id>`.  
2. If `clientId` is missing, the server closes the connection (code 1008).  
3. If connected, the server:
   - **Stores** `(clientId -> WebSocket)` in a map.  
   - Delivers any pending messages for that client with exponential backoff.  
4. **Delivery** message format:

   ```json
   {
     "type": "DELIVERY",
     "id": "msg_1689782_321",
     "payload": {
       "shortenedURL": "http://localhost:3000/aBcD1234"
     }
   }
   ```

5. **Client** acknowledges with:

   ```json
   {
     "type": "ACK",
     "id": "msg_1689782_321"
   }
   ```

   so the server knows it can remove the message from the queue.

---

## 9. Testing

### 9.1 Unit Tests

- Each module (e.g., `AsyncQueue`, `MessageQueue`, `UrlShortenerService`) is tested in isolation with **Jest** and **mocks** for dependencies.  

### 9.2 Integration Tests

- A suite (`server.test.ts` or similar) uses **SuperTest** + **ws** to:  
  - **POST** a URL => expect `202`.  
  - **Connect** WebSocket => wait for `DELIVERY`.  
  - **GET** the shortened code => expect `200` with the original.  

Run with:

```bash
npm run test
```

(Make sure you have installed `ts-jest` and other dev dependencies.)

---

## 10. Future Scopes

Below are **additional features** or **scalability** improvements you might consider:

1. **Database Support**: Instead of file-based storage, integrate **Redis**, **MongoDB**, or **PostgreSQL** for more robust data persistence at large scale.  
2. **Multi-Node** / **Clustering**: For high availability or horizontal scaling, run multiple instances with a shared queue (like **RabbitMQ** or **Kafka**).  
3. **Expiration**: Provide time-based expiration for short URLs or messages.  
4. **Authentication**: Restrict access to certain endpoints or require user login for advanced usage.  
5. **Rate Limiting**: Throttle `POST /url` to prevent spamming or malicious usage.  
6. **Custom Short Codes**: Let users specify a custom alias if it’s available.  
7. **Analytics**: Track click counts, referrers, or other stats for shortened URLs.  
8. **UI**: Provide a front-end interface to manage short URLs, see usage stats, handle WebSocket connections visually.  
9. **Message Expiration**: If a client never connects, you might eventually discard messages from the queue.

---

## 11. License

```
BSD 3-Clause License

Copyright (c) 2025, Pawan

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its
   contributors may be used to endorse or promote products derived from
   this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

---

## Contributing

Feel free to **open issues** or **pull requests** if you find improvements or bugs. This README aims to help you get started quickly with the core logic, testing, and future enhancements.

Enjoy building your **URL Shortener** service with robust, asynchronous WebSocket-based delivery!
