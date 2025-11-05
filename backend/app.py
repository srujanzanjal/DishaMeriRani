"""
Main Flask application for Doc Locker - Smart Document Vault.
"""
import os
from flask import Flask, jsonify, request, make_response, g, session
from flask_cors import CORS
from config import Config
import google.generativeai as genai
from models import db, User
from routes.auth_routes import auth_bp
from routes.student_routes import student_bp
from routes.admin_routes import admin_bp
from utils.jwt_utils import token_required, create_access_token, decode_token
from functools import wraps
from datetime import datetime, timedelta

def create_app():
    """Create and configure the Flask application."""
    app = Flask(__name__)
    
    # Load configuration
    app.config.from_object(Config)
    
    # Configure Gemini API
    try:
        genai.configure(api_key=os.environ.get('GEMINI_API_KEY') or "AIzaSyDL6jf-lEyHyF1iJLqqb-_gzS4oIzMpX24")
    except Exception:
        pass
    
    # Initialize extensions
    db.init_app(app)
    
    # CORS configuration
    CORS(
        app,
        resources={
            r"/*": {
                "origins": Config.CORS_ORIGINS,
                "supports_credentials": True,
                "allow_headers": ["Content-Type", "Authorization"],
                "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
            }
        }
    )
    
    # Add CORS headers to all responses
    @app.after_request
    def after_request(response):
        # Add CORS headers
        response.headers.add('Access-Control-Allow-Origin', ', '.join(Config.CORS_ORIGINS))
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        return response
    
    # Register blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(student_bp)
    app.register_blueprint(admin_bp)

    # Middleware: set g.user and update last_active on authenticated requests
    @app.before_request
    def load_current_user_and_touch_last_active():
        try:
            user_id = session.get('user_id')
            if not user_id:
                g.user = None
                return
            user = User.query.get(user_id)
            g.user = user
            if user:
                user.last_active = datetime.utcnow()
                db.session.commit()
        except Exception:
            db.session.rollback()
    
    # Route to serve uploaded files
    @app.route('/uploads/<filename>')
    def serve_upload(filename):
        """Serve uploaded files."""
        from flask import send_from_directory
        upload_dir = Config.UPLOAD_FOLDER
        return send_from_directory(upload_dir, filename)
    
    # Create uploads folder if it doesn't exist (absolute path)
    upload_dir = Config.UPLOAD_FOLDER
    if not os.path.exists(upload_dir):
        os.makedirs(upload_dir)
        print(f"Created upload directory: {upload_dir}")
    
    # Create database tables
    with app.app_context():
        db.create_all()
        
        # Create a default admin user if it doesn't exist
        if not User.query.filter_by(email='admin@doclocker.com').first():
            admin = User(
                name='Admin',
                email='admin@doclocker.com',
                password='admin123',
                role='admin'
            )
            db.session.add(admin)
            db.session.commit()
            print("Default admin user created: admin@doclocker.com / admin123")
    
    # Error handlers
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({'success': False, 'message': 'Endpoint not found'}), 404
    
    @app.errorhandler(500)
    def internal_error(error):
        return jsonify({'success': False, 'message': 'Internal server error'}), 500
    
    return app


if __name__ == '__main__':
    app = create_app()
    print("\n" + "="*50)
    print("Doc Locker Backend Server")
    print("="*50)
    print(f"Server running on: http://localhost:5000")
    print(f"Upload folder: {Config.UPLOAD_FOLDER}")
    print(f"CORS enabled for: {', '.join(Config.CORS_ORIGINS)}")
    print("="*50 + "\n")
    app.run(debug=True, host='0.0.0.0', port=5000)

