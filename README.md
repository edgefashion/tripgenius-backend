# 🚀 TripGenius AI — Complete Setup Guide

## 📁 Folder Structure

```
tripgenius/
│
├── index.html              ← Frontend (already done ✅)
│
└── tripgenius-backend/     ← Backend (yeh folder)
    ├── server.js           ← Main entry point
    ├── package.json        ← Dependencies
    ├── .env.example        ← Environment variables template
    ├── .env                ← Aapki actual keys (create karo)
    │
    ├── models/
    │   └── index.js        ← All 10 MongoDB models
    │
    ├── routes/
    │   ├── auth.js         ← Register, Login, Profile
    │   ├── trips.js        ← Trip CRUD
    │   ├── rooms.js        ← Room listings
    │   ├── ai.js           ← AI APIs (generate trip, recommend, etc.)
    │   └── all-routes.js   ← Bookings, Restaurants, Rides, Reviews, Groups, Admin
    │
    └── middleware/
        └── auth.js         ← JWT authentication
```

---

## 🛠️ Step-by-Step Setup

### Step 1 — Node.js install karo
Download: https://nodejs.org (LTS version)
```bash
node --version  # v18 ya upar chahiye
```

### Step 2 — Backend folder mein jao
```bash
cd tripgenius-backend
```

### Step 3 — Dependencies install karo
```bash
npm install
```

### Step 4 — MongoDB Atlas setup karo (FREE)
1. Jaao: https://mongodb.com/atlas
2. Free account banao
3. "Create Cluster" → M0 (FREE) choose karo
4. Username + Password set karo (yaad rakhna!)
5. "Connect" → "Drivers" → Connection string copy karo
   Format: `mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/tripgenius`

### Step 5 — .env file banao
```bash
# .env.example ko copy karo
cp .env.example .env
```
Phir .env file open karo aur fill karo:
```env
PORT=5000
MONGODB_URI=mongodb+srv://YOUR_USER:YOUR_PASS@cluster0.xxxxx.mongodb.net/tripgenius
JWT_SECRET=koi_bhi_random_64_character_string_yahan_daalo
ANTHROPIC_API_KEY=sk-ant-api03-YOUR_KEY
CLIENT_URL=http://localhost:3000
```

### Step 6 — Anthropic API Key
1. Jaao: https://console.anthropic.com
2. "API Keys" → "Create Key"
3. Copy karo: `sk-ant-api03-xxxxx`
4. .env mein paste karo

### Step 7 — Server start karo
```bash
# Development mode (auto-restart on changes)
npm run dev

# Production mode
npm start
```

### Step 8 — Check karo kaam kar raha hai?
Browser mein open karo:
- http://localhost:5000/api/health
- http://localhost:5000/api

Agar yeh dikhta hai toh sab theek hai:
```json
{"success": true, "message": "TripGenius AI chal raha hai! 🚀"}
```

---

## 🔌 Frontend ko Backend se connect karo

`index.html` mein yeh code add karo (before closing `</script>` tag):

```javascript
// Backend API URL
const API_URL = 'http://localhost:5000/api';

// Register function
async function registerUser(name, email, password, role) {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, role })
  });
  const data = await res.json();
  if (data.success) {
    localStorage.setItem('tg_token', data.token);
    localStorage.setItem('tg_user', JSON.stringify(data.user));
  }
  return data;
}

// Login function
async function loginUser(email, password) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (data.success) {
    localStorage.setItem('tg_token', data.token);
    localStorage.setItem('tg_user', JSON.stringify(data.user));
  }
  return data;
}

// AI Trip Generation (from backend - no CORS issue!)
async function generateTripFromBackend(budget, people, days, mood) {
  const res = await fetch(`${API_URL}/ai/generate-trip`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ budget, people, days, mood })
  });
  return await res.json();
}
```

---

## 📡 All API Endpoints

### Auth
| Method | URL | Kaam |
|--------|-----|------|
| POST | /api/auth/register | Naya account |
| POST | /api/auth/login | Login |
| GET | /api/auth/me | Apna profile |
| PUT | /api/auth/update | Profile update |
| PUT | /api/auth/change-password | Password change |

### AI
| Method | URL | Kaam |
|--------|-----|------|
| POST | /api/ai/generate-trip | Full trip plan banao |
| POST | /api/ai/recommend-destinations | Top 5 destinations |
| POST | /api/ai/budget-optimize | Saving tips |
| POST | /api/ai/crowd-predict | Crowd prediction |

### Rooms (Owner)
| Method | URL | Kaam |
|--------|-----|------|
| GET | /api/rooms | Saare rooms search |
| POST | /api/rooms | New listing |
| GET | /api/rooms/:id | Room detail |
| PUT | /api/rooms/:id | Update listing |
| DELETE | /api/rooms/:id | Delete listing |
| GET | /api/rooms/my | Apni listings |
| GET | /api/rooms/owner/earnings | Earnings |

### Bookings
| Method | URL | Kaam |
|--------|-----|------|
| POST | /api/bookings | Book karo |
| GET | /api/bookings/my | Apni bookings |
| PATCH | /api/bookings/:id/status | Status update |
| PATCH | /api/bookings/:id/cancel | Cancel |

### Groups
| Method | URL | Kaam |
|--------|-----|------|
| POST | /api/groups | Group banao |
| GET | /api/groups/my | Apne groups |
| POST | /api/groups/:id/expense | Expense add |
| POST | /api/groups/:id/note | Note add |
| POST | /api/groups/:id/join | Join group |

### Admin
| Method | URL | Kaam |
|--------|-----|------|
| GET | /api/admin/stats | Platform stats |
| GET | /api/admin/users | All users |
| PATCH | /api/admin/users/:id | User manage |
| GET | /api/admin/rooms/pending | Pending approvals |
| PATCH | /api/admin/rooms/:id/approve | Approve room |

---

## 🌐 Deploy karna hai? (Render — Free)

1. GitHub pe code upload karo
2. Jaao: https://render.com
3. "New Web Service" → GitHub repo connect karo
4. Settings:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Environment:** Node
5. Environment Variables mein .env ki saari values daalo
6. Deploy! URL milega: `https://tripgenius-api.onrender.com`

---

## ❓ Common Errors & Solutions

**Error: Cannot connect to MongoDB**
→ MongoDB Atlas mein "Network Access" mein `0.0.0.0/0` allow karo

**Error: JWT invalid**
→ .env mein JWT_SECRET set karo

**Error: Anthropic 401**
→ .env mein ANTHROPIC_API_KEY sahi daalo (sk-ant-api03-...)

**Error: CORS**
→ .env mein CLIENT_URL sahi set karo

---

## 💰 Monetization (Already coded!)
- Room booking: 10% commission (auto-calculated)
- Ride booking: 15% commission (auto-calculated)
- Admin stats mein total revenue dikhta hai

---

Made with ❤️ — TripGenius AI
