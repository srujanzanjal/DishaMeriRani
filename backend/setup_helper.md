# Setup Helper for Doc Locker Backend

## Quick Setup Steps

### 1. Install Python Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Install and Setup MySQL

**Windows:**
1. Download MySQL from [mysql.com](https://dev.mysql.com/downloads/installer/)
2. Install MySQL Server
3. Note your root password

**Mac (using Homebrew):**
```bash
brew install mysql
brew services start mysql
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install mysql-server
sudo mysql_secure_installation
```

### 3. Create Database

**Option A: Using MySQL Command Line**

```bash
mysql -u root -p
```

Then in the MySQL prompt:
```sql
CREATE DATABASE doclocker_db;
EXIT;
```

**Option B: Using MySQL Workbench**

1. Open MySQL Workbench
2. Connect to your local server
3. Run: `CREATE DATABASE doclocker_db;`

### 4. Configure Database Connection

Edit `backend/config.py`:

```python
# Update this line with your MySQL password
SQLALCHEMY_DATABASE_URI = 'mysql+pymysql://root:YOUR_PASSWORD@localhost/doclocker_db'
```

Replace `YOUR_PASSWORD` with your actual MySQL root password.

### 5. Run the Backend

```bash
cd backend
python app.py
```

The server will start on `http://localhost:5000`

### 6. Test the Backend

Open a new terminal and test the API:

**Signup:**
```bash
curl -X POST http://localhost:5000/api/signup -H "Content-Type: application/json" -d "{\"name\":\"Test User\",\"email\":\"test@example.com\",\"password\":\"test123\"}"
```

**Login:**
```bash
curl -X POST http://localhost:5000/api/login -H "Content-Type: application/json" -d "{\"email\":\"test@example.com\",\"password\":\"test123\"}"
```

## Default Credentials

- **Admin Email**: admin@doclocker.com
- **Admin Password**: admin123

⚠️ **Change these in production!**

## Troubleshooting

### MySQL Connection Error

If you get a connection error:

1. Check if MySQL is running:
   ```bash
   # Windows
   services.msc
   
   # Mac/Linux
   sudo systemctl status mysql
   ```

2. Verify your password in `config.py`

3. Try connecting manually:
   ```bash
   mysql -u root -p
   ```

### Port Already in Use

If port 5000 is already in use:

1. Edit `backend/app.py`:
   ```python
   app.run(debug=True, host='0.0.0.0', port=5001)  # Change port
   ```

2. Update `backend/config.py`:
   ```python
   CORS_ORIGINS = ["http://localhost:5173"]
   ```

### Import Errors

If you get module import errors:

1. Make sure you're in the backend directory:
   ```bash
   cd backend
   python app.py
   ```

2. Install dependencies again:
   ```bash
   pip install -r requirements.txt
   ```

### Database Table Errors

If tables don't exist:

1. Stop the server (Ctrl+C)
2. Delete existing database:
   ```sql
   DROP DATABASE doclocker_db;
   CREATE DATABASE doclocker_db;
   ```
3. Run the app again

## Next Steps

1. Backend is ready at `http://localhost:5000`
2. Start the frontend:
   ```bash
   cd ../frontend
   npm install
   npm run dev
   ```
3. Frontend will run at `http://localhost:5173`

## API Documentation

See `backend/README.md` for complete API documentation.

