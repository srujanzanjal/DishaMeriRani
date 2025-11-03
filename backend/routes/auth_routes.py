"""
Authentication routes for user signup, login, and logout.
"""
from flask import Blueprint, request, jsonify, session
from models import db, User

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/api/signup', methods=['POST'])
def signup():
    """Register a new user."""
    try:
        data = request.get_json()
        
        # Validate input
        if not data or not data.get('name') or not data.get('email') or not data.get('password'):
            return jsonify({
                'success': False,
                'message': 'Missing required fields: name, email, password'
            }), 400
        
        name = data['name'].strip()
        email = data['email'].strip().lower()
        password = data['password']
        
        # Check if user already exists
        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            return jsonify({
                'success': False,
                'message': 'Email already registered'
            }), 400
        
        # Create new user (default role is 'student')
        new_user = User(
            name=name,
            email=email,
            password=password,
            role='student'
        )
        
        db.session.add(new_user)
        db.session.commit()
        
        # Create session
        session['user_id'] = new_user.id
        session['user_email'] = new_user.email
        session['user_role'] = new_user.role
        
        return jsonify({
            'success': True,
            'message': 'User registered successfully',
            'data': {
                'user': new_user.to_dict()
            }
        }), 201
    
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': f'Registration failed: {str(e)}'
        }), 500


@auth_bp.route('/api/login', methods=['POST'])
def login():
    """Authenticate user and create session."""
    try:
        data = request.get_json()
        
        # Validate input
        if not data or not data.get('email') or not data.get('password'):
            return jsonify({
                'success': False,
                'message': 'Email and password are required'
            }), 400
        
        email = data['email'].strip().lower()
        password = data['password']
        
        # Find user
        user = User.query.filter_by(email=email).first()
        
        if not user or not user.check_password(password):
            return jsonify({
                'success': False,
                'message': 'Invalid email or password'
            }), 401
        
        # Create session
        session['user_id'] = user.id
        session['user_email'] = user.email
        session['user_role'] = user.role
        
        return jsonify({
            'success': True,
            'message': 'Login successful',
            'data': {
                'user': user.to_dict()
            }
        }), 200
    
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Login failed: {str(e)}'
        }), 500


@auth_bp.route('/api/logout', methods=['POST'])
def logout():
    """Logout user and clear session."""
    session.clear()
    return jsonify({
        'success': True,
        'message': 'Logout successful'
    }), 200


@auth_bp.route('/api/verify', methods=['GET'])
def verify():
    """Verify session and return user info."""
    user_id = session.get('user_id')
    
    if not user_id:
        return jsonify({
            'success': False,
            'message': 'Not logged in'
        }), 401
    
    user = User.query.get(user_id)
    
    if not user:
        session.clear()
        return jsonify({
            'success': False,
            'message': 'User not found'
        }), 404
    
    return jsonify({
        'success': True,
        'data': {
            'user': user.to_dict()
        }
    }), 200

