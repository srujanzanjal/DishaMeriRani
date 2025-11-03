# Doc Locker - Quick Start Guide

## ⚠️ Connection Refused Error?

**This error means the backend server is not running!**

You need to start BOTH the backend and frontend servers.

---

## 🚀 Starting the Application

### Step 1: Start Backend Server

**Windows:**
```bash
cd backend
python app.py
```

Or double-click: `backend/start_backend.bat`

**Mac/Linux:**
```bash
cd backend
python3 app.py
```

Or run: `bash backend/start_backend.sh`

**You should see:**
```
==================================================
Doc Locker Backend Server
==================================================
Server running on: http://localhost:5000
```

**Keep this terminal open!** The backend must keep running.

---

### Step 2: Start Frontend Server

**Open a NEW terminal window** and run:

```bash
cd frontend
npm run dev
```

**You should see:**
```
VITE ready in XXX ms
➜  Local:   http://localhost:8080/
```

---

### Step 3: Open the App

Open your browser and go to:
- **Frontend:** http://localhost:8080
- **Backend API:** http://localhost:5000

---

## ✅ Verification Checklist

- [ ] Backend terminal shows "Server running on: http://localhost:5000"
- [ ] Frontend terminal shows VITE server running
- [ ] No `ECONNREFUSED` errors in browser console
- [ ] Can access http://localhost:8080 in browser
- [ ] MySQL database `doclocker_db` exists and is running

---

## 🔧 Troubleshooting

### Backend won't start?

1. **Check Python:** `python --version` (needs 3.8+)
2. **Install dependencies:** `cd backend && pip install -r requirements.txt`
3. **Check MySQL:** Make sure MySQL is running and database exists
4. **Check port 5000:** Make sure nothing else is using port 5000

### Frontend shows connection errors?

1. **Backend running?** Check Terminal 1 shows "Server running"
2. **Wrong port?** Backend must be on port 5000
3. **Proxy issue?** Check `frontend/vite.config.ts` has correct proxy settings

### Database connection error?

1. **MySQL running?** Start MySQL service
2. **Database exists?** Run: `CREATE DATABASE doclocker_db;`
3. **Correct password?** Update `backend/config.py` with your MySQL password

---

## 📝 First Time Setup

1. **Install Python dependencies:**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. **Setup MySQL database:**
   ```sql
   CREATE DATABASE doclocker_db;
   ```

3. **Update database password** in `backend/config.py`:
   ```python
   SQLALCHEMY_DATABASE_URI = 'mysql+pymysql://root:YOUR_PASSWORD@localhost/doclocker_db'
   ```

4. **Start backend:** `python backend/app.py`

5. **Start frontend:** `cd frontend && npm run dev`

---

## 🎯 Default Login

After starting, you can use:
- **Email:** admin@doclocker.com
- **Password:** admin123

Or register a new account!

---

**Need more help?** Check `backend/START_BACKEND.md` for detailed backend troubleshooting.

