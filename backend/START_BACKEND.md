# How to Start the Backend Server

## Quick Start

### 1. Navigate to backend folder
```bash
cd backend
```

### 2. Install dependencies (if not already installed)
```bash
pip install -r requirements.txt
```

### 3. Make sure MySQL is running
- Start MySQL service on your system
- Verify database exists: `doclocker_db`
- Update password in `config.py` if needed

### 4. Start the Flask server
```bash
python app.py
```

You should see:
```
==================================================
Doc Locker Backend Server
==================================================
Server running on: http://localhost:5000
Upload folder: uploads
CORS enabled for: http://localhost:5173, http://localhost:8080
==================================================
```

## Troubleshooting

### Connection Refused Error

If you see `ECONNREFUSED` in the frontend:

1. **Check if backend is running:**
   - Open a terminal
   - Navigate to `backend` folder
   - Run `python app.py`
   - You should see the server startup message

2. **Check if port 5000 is available:**
   - Windows: `netstat -ano | findstr :5000`
   - Mac/Linux: `lsof -i :5000`
   - If port is in use, stop the process using it

3. **Verify database connection:**
   - Check MySQL is running
   - Verify `config.py` has correct database credentials
   - Make sure `doclocker_db` database exists

4. **Test backend directly:**
   - Open browser: `http://localhost:5000/api/verify` (should get 401 if not logged in, but server responds)

## Common Issues

### Issue: "Module not found"
**Solution:** Run `pip install -r requirements.txt`

### Issue: "MySQL connection failed"
**Solution:** 
- Check MySQL is running
- Update `SQLALCHEMY_DATABASE_URI` in `config.py`
- Create database: `CREATE DATABASE doclocker_db;`

### Issue: "Port 5000 already in use"
**Solution:**
- Find process: `netstat -ano | findstr :5000` (Windows)
- Kill process or change port in `app.py`

## Running Both Frontend and Backend

**Terminal 1 (Backend):**
```bash
cd backend
python app.py
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm run dev
```

Both servers must be running for the app to work!

