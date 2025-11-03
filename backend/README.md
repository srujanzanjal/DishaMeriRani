# Doc Locker - Backend

Flask backend for Doc Locker - Smart Document Vault with Auto-Updating Profile.

## 🚀 Quick Start

### Prerequisites

- Python 3.8+
- MySQL 5.7+ or MySQL 8.0
- Git

### Installation

1. **Install Python dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Set up MySQL Database**:
   
   Login to MySQL:
   ```bash
   mysql -u root -p
   ```
   
   Create the database:
   ```sql
   CREATE DATABASE doclocker_db;
   EXIT;
   ```

3. **Configure Database Connection**:
   
   Edit `config.py` and update the `SQLALCHEMY_DATABASE_URI` if needed:
   ```python
   SQLALCHEMY_DATABASE_URI = 'mysql+pymysql://root:YOUR_PASSWORD@localhost/doclocker_db'
   ```

4. **Run the application**:
   ```bash
   python app.py
   ```

   The server will start on `http://localhost:5000`

### Default Admin Credentials

- Email: `admin@doclocker.com`
- Password: `admin123`

⚠️ **Change these credentials in production!**

## 📂 Project Structure

```
backend/
├── app.py                 # Main Flask application
├── config.py             # Configuration settings
├── models.py             # Database models
├── requirements.txt      # Python dependencies
├── routes/
│   ├── auth_routes.py    # Authentication endpoints
│   ├── student_routes.py # Student endpoints
│   └── admin_routes.py   # Admin endpoints
├── uploads/              # File storage directory
└── __init__.py
```

## 🔌 API Endpoints

### Authentication (`/api/*`)

- `POST /api/signup` - Register new user
  - Body: `{ name, email, password }`
  - Returns: User object + JWT token

- `POST /api/login` - Login user
  - Body: `{ email, password }`
  - Returns: User object + JWT token

- `POST /api/logout` - Logout user
  - Headers: `Authorization: Bearer <token>`
  
- `GET /api/verify` - Verify JWT token
  - Headers: `Authorization: Bearer <token>`
  - Returns: Current user info

### Student Routes (`/api/*`)

- `GET /api/profile` - Get student profile and documents
  - Headers: `Authorization: Bearer <token>`
  
- `POST /api/upload` - Upload document
  - Headers: `Authorization: Bearer <token>`
  - Body: Form-data with `document` file
  
- `GET /api/documents` - List all student documents
  - Headers: `Authorization: Bearer <token>`
  
- `GET /api/document/<id>` - Get document details
  - Headers: `Authorization: Bearer <token>`

- `GET /api/document/<id>/download` - Download document
  - Headers: `Authorization: Bearer <token>`

### Admin Routes (`/api/admin/*`)

- `GET /api/admin/students` - Get all students (admin only)
  - Headers: `Authorization: Bearer <token>`
  
- `GET /api/admin/student/<id>` - Get student details (admin only)
  - Headers: `Authorization: Bearer <token>`
  
- `DELETE /api/admin/student/<id>` - Delete student (admin only)
  - Headers: `Authorization: Bearer <token>`

## 🔐 Authentication

All protected routes require a JWT token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

## 📄 File Uploads

- **Allowed extensions**: PDF, PNG, JPG, JPEG
- **Max file size**: 16MB
- **Storage**: Files are saved in `/uploads` folder
- **Naming**: Files are prefixed with user_id for organization

## 🗄️ Database Schema

### Users Table

| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| name | VARCHAR(100) | User's full name |
| email | VARCHAR(120) | Unique email |
| password | VARCHAR(255) | Hashed password |
| role | VARCHAR(20) | 'student' or 'admin' |
| created_at | TIMESTAMP | Account creation time |

### Documents Table

| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| user_id | INT | Foreign key to users |
| filename | VARCHAR(255) | Original filename |
| filepath | VARCHAR(500) | Full file path |
| uploaded_at | TIMESTAMP | Upload time |

## 🧪 Testing

### Using cURL

**Signup**:
```bash
curl -X POST http://localhost:5000/api/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","email":"john@example.com","password":"password123"}'
```

**Login**:
```bash
curl -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","password":"password123"}'
```

**Get Profile** (replace TOKEN):
```bash
curl -X GET http://localhost:5000/api/profile \
  -H "Authorization: Bearer <TOKEN>"
```

### Using Postman

1. Import the collection
2. Set up environment variables
3. Run requests in sequence (signup/login first)

## 🔧 Configuration

Edit `config.py` to customize:

- Database connection
- JWT secret keys
- CORS origins
- Upload folder settings
- Allowed file types

## 🚨 Security Notes

- Change `SECRET_KEY` in `config.py` for production
- Change `JWT_SECRET_KEY` for production
- Use environment variables for sensitive data
- Enable HTTPS in production
- Regularly update dependencies

## 📞 Support

For issues or questions, check the main project README.

