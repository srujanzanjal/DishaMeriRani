"""
Main Flask application for Doc Locker - Smart Document Vault.
"""
import os
from flask import Flask, jsonify, session
from flask_cors import CORS
from config import Config
import google.generativeai as genai
from models import db, User
from routes.auth_routes import auth_bp
from routes.student_routes import student_bp
from routes.admin_routes import admin_bp
from functools import wraps

def create_app():
    """Create and configure the Flask application."""
    app = Flask(__name__)
    
    # Load configuration
    app.config.from_object(Config)
    # Session configuration
    app.config['SESSION_COOKIE_SAMESITE'] = 'None'
    app.config['SESSION_COOKIE_SECURE'] = False  # Set to True in production with HTTPS
    app.config['SESSION_COOKIE_HTTPONLY'] = True

    # Configure Gemini API
    try:
        genai.configure(api_key=os.environ.get('GEMINI_API_KEY') or "AIzaSyDxdIX8CGQStPBwdtIcCoWr80iyjJ_qv8g")
    except Exception:
        pass
    
    # Initialize extensions
    db.init_app(app)
    
    # Enable CORS for frontend with credentials support for sessions
    CORS(app, origins=Config.CORS_ORIGINS, supports_credentials=True)
    
    # Register blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(student_bp)
    app.register_blueprint(admin_bp)
    
    # Route to serve uploaded files
    @app.route('/uploads/<filename>')
    def serve_upload(filename):
        """Serve uploaded files."""
        from flask import send_from_directory
        upload_dir = os.path.join(os.path.dirname(__file__), Config.UPLOAD_FOLDER)
        return send_from_directory(upload_dir, filename)
    
    # Create uploads folder if it doesn't exist (absolute path)
    upload_dir = os.path.join(os.path.dirname(__file__), Config.UPLOAD_FOLDER)
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

