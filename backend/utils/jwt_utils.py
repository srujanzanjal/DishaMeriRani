"""
JWT utility functions for token handling.
"""
import os
import jwt
import datetime
from functools import wraps
from flask import request, jsonify
from models import User

def create_access_token(user_id, role):
    """Generate a JWT access token."""
    payload = {
        'user_id': user_id,
        'role': role,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(days=1),  # Token expires in 1 day
        'iat': datetime.datetime.utcnow(),
    }
    return jwt.encode(payload, os.getenv('JWT_SECRET_KEY', 'your-secret-key'), algorithm='HS256')

def decode_token(token):
    """Decode and verify JWT token."""
    try:
        payload = jwt.decode(
            token,
            os.getenv('JWT_SECRET_KEY', 'your-secret-key'),
            algorithms=['HS256']
        )
        return payload
    except jwt.ExpiredSignatureError:
        return None  # Token has expired
    except jwt.InvalidTokenError:
        return None  # Invalid token

def token_required(f):
    """Decorator to protect routes that require authentication."""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Check for token in Authorization header
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]
        
        if not token:
            return jsonify({
                'success': False,
                'message': 'Token is missing!'
            }), 401

        # Verify token
        payload = decode_token(token)
        if not payload:
            return jsonify({
                'success': False,
                'message': 'Invalid or expired token!'
            }), 401

        # Add user info to request context
        request.user_id = payload['user_id']
        request.role = payload['role']
        
        return f(*args, **kwargs)
    return decorated

def admin_required(f):
    """Decorator to protect admin-only routes."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if not hasattr(request, 'role') or request.role != 'admin':
            return jsonify({
                'success': False,
                'message': 'Admin access required!'
            }), 403
        return f(*args, **kwargs)
    return decorated
