"""
Database models for the Doc Locker application.
"""
from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()


class User(db.Model):
    """User model for both students and admins."""
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='user')  # 'user' or 'admin'
    status = db.Column(db.String(20), nullable=False, default='active')  # 'active'|'locked'|'deleted'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_active = db.Column(db.DateTime, nullable=True)
    
    # Relationship with documents
    documents = db.relationship('Document', backref='user', lazy=True, cascade='all, delete-orphan')
    
    def __init__(self, name, email, password, role='user'):
        self.name = name
        self.email = email
        self.set_password(password)
        self.role = role
    
    def set_password(self, password):
        """Store the password in plain text (no hashing)."""
        self.password = password
    
    def check_password(self, password):
        """Plain text password comparison."""
        return self.password == password
    
    def to_dict(self):
        """Convert user object to dictionary."""
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'role': self.role,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
    
    def __repr__(self):
        return f'<User {self.email}>'


class Document(db.Model):
    """Document model for storing uploaded files."""
    __tablename__ = 'documents'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    filename = db.Column(db.String(255), nullable=False)
    mime_type = db.Column(db.String(100), nullable=True)
    size_bytes = db.Column(db.BigInteger, nullable=True)
    filepath = db.Column(db.String(500), nullable=False)
    extracted_text = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), nullable=False, default='uploaded')  # 'uploaded'|'processing'|'done'|'failed'
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        """Convert document object to dictionary."""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'filename': self.filename,
            'mime_type': self.mime_type,
            'size_bytes': self.size_bytes,
            'filepath': self.filepath,
            'extracted_text': self.extracted_text,
            'status': self.status,
            'uploaded_at': self.uploaded_at.isoformat() if self.uploaded_at else None
        }
    
    def __repr__(self):
        return f'<Document {self.filename}>'


class UserProfile(db.Model):
    """Stores AI-generated profile JSON per user."""
    __tablename__ = 'user_profile'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, unique=True)
    profile_json = db.Column(db.JSON, nullable=True)
    current_version = db.Column(db.Integer, nullable=True)
    last_updated = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = db.relationship('User', backref=db.backref('ai_profile', uselist=False, cascade='all, delete-orphan'))

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'profile_json': self.profile_json,
            'current_version': self.current_version,
            'last_updated': self.last_updated.isoformat() if self.last_updated else None
        }


class ProfileVersion(db.Model):
    __tablename__ = 'profile_versions'

    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), primary_key=True)
    version = db.Column(db.Integer, primary_key=True)
    profile_json = db.Column(db.JSON, nullable=True)
    profile_html = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class AdminEvent(db.Model):
    __tablename__ = 'admin_events'

    id = db.Column(db.BigInteger, primary_key=True)
    actor_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    target_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    action = db.Column(db.String(32), nullable=False)  # 'LOCK'|'UNLOCK'|'REGENERATE'|'DELETE_FILE'|'REEXTRACT'
    details = db.Column(db.JSON, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

