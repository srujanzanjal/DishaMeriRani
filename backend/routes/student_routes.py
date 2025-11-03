"""
Student routes for profile management and document uploads.
"""
import os
import json
from flask import Blueprint, request, jsonify, send_from_directory, session
from werkzeug.utils import secure_filename
from models import db, User, Document, UserProfile
from config import Config
from functools import wraps
import google.generativeai as genai


def login_required(f):
    """Decorator to check if user is logged in."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({
                'success': False,
                'message': 'Please login to access this resource'
            }), 401
        return f(*args, **kwargs)
    return decorated_function


def get_current_user_id():
    """Get current user ID from session."""
    return session.get('user_id')

try:
    from PyPDF2 import PdfReader
except Exception:
    PdfReader = None

try:
    import pytesseract
    from PIL import Image
except Exception:
    pytesseract = None
    Image = None

student_bp = Blueprint('student', __name__)


def allowed_file(filename):
    """Check if file extension is allowed."""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in Config.ALLOWED_EXTENSIONS


def extract_text_from_file(filepath: str) -> str:
    """Extract text from PDF or image; returns empty string if unsupported or libs missing."""
    try:
        ext = os.path.splitext(filepath)[1].lower()
        if ext == '.pdf' and PdfReader is not None:
            text_parts = []
            with open(filepath, 'rb') as f:
                reader = PdfReader(f)
                for page in reader.pages:
                    try:
                        text_parts.append(page.extract_text() or '')
                    except Exception:
                        continue
            return '\n'.join(text_parts).strip()
        if ext in ('.png', '.jpg', '.jpeg') and pytesseract is not None and Image is not None:
            img = Image.open(filepath)
            return (pytesseract.image_to_string(img) or '').strip()
    except Exception:
        pass
    return ''


def generate_profile_with_gemini(extracted_text: str) -> dict:
    prompt = f"""
    Generate a one-page professional profile summarizing the user's skills, education,
    and achievements from this text. Return in strict JSON format:
    {{
      "name": "",
      "email": "",
      "education": "",
      "skills": [],
      "certifications": [],
      "achievements": [],
      "summary": ""
    }}

    Text: {extracted_text}
    """
    try:
        model = genai.GenerativeModel("gemini-1.5-flash")
        response = model.generate_content(prompt)
        text = (getattr(response, 'text', '') or '').strip().strip('```json').strip('```').strip()
        return json.loads(text) if text else {}
    except Exception:
        return {}


@student_bp.route('/api/profile', methods=['GET'])
@login_required
def get_profile():
    """Get current student's profile and uploaded documents."""
    try:
        user_id = get_current_user_id()
        
        user = User.query.get(user_id)
        if not user:
            return jsonify({
                'success': False,
                'message': 'User not found'
            }), 404
        
        # Get all documents for the user
        documents = Document.query.filter_by(user_id=user_id).all()
        
        return jsonify({
            'success': True,
            'data': {
                'user': user.to_dict(),
                'documents': [doc.to_dict() for doc in documents],
                'document_count': len(documents)
            }
        }), 200
    
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Failed to fetch profile: {str(e)}'
        }), 500


@student_bp.route('/api/upload', methods=['POST'])
@login_required
def upload_document():
    """Upload a document for the current student."""
    try:
        user_id = get_current_user_id()
        
        # Check if file is present
        if 'document' not in request.files:
            return jsonify({
                'success': False,
                'message': 'No file provided'
            }), 400
        
        file = request.files['document']
        
        # Check if file is empty
        if file.filename == '':
            return jsonify({
                'success': False,
                'message': 'No file selected'
            }), 400
        
        # Validate file extension
        if not allowed_file(file.filename):
            return jsonify({
                'success': False,
                'message': 'Invalid file type. Allowed: pdf, png, jpg, jpeg'
            }), 400
        
        # Secure the filename and add user_id prefix
        filename = secure_filename(file.filename)
        filename_with_prefix = f"{user_id}_{filename}"
        
        # Get absolute path to upload folder (relative to backend directory)
        upload_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), Config.UPLOAD_FOLDER)
        
        # Ensure upload folder exists
        if not os.path.exists(upload_dir):
            os.makedirs(upload_dir)
        
        # Save file with absolute path
        filepath = os.path.join(upload_dir, filename_with_prefix)
        file.save(filepath)
        
        # Store relative path in database for easier access
        relative_filepath = os.path.join(Config.UPLOAD_FOLDER, filename_with_prefix)
        
        # Extract text from the uploaded file (use absolute path for extraction)
        extracted = extract_text_from_file(filepath)

        # Create document record (store relative path in DB)
        document = Document(
            user_id=user_id,
            filename=filename,
            filepath=relative_filepath,
            extracted_text=extracted
        )
        
        db.session.add(document)
        db.session.commit()

        # Generate or update AI profile (non-blocking - don't fail upload if this fails)
        try:
            # Combine all extracted texts for this user
            user_docs = Document.query.filter_by(user_id=user_id).all()
            combined_text = ' '.join([(d.extracted_text or '') for d in user_docs]).strip()

            if combined_text:
                profile_json = generate_profile_with_gemini(combined_text)
            else:
                profile_json = {}

            profile = UserProfile.query.filter_by(user_id=user_id).first()
            
            if profile is None:
                profile = UserProfile(user_id=user_id, profile_json=profile_json)
                db.session.add(profile)
            else:
                profile.profile_json = profile_json
            db.session.commit()
            
            profile_dict = profile.to_dict()
        except Exception as profile_error:
            # If profile generation fails, don't fail the upload
            print(f"Warning: Profile generation failed: {str(profile_error)}")
            db.session.rollback()
            profile_dict = None
        
        return jsonify({
            'success': True,
            'message': 'File uploaded successfully' + (' and profile updated' if profile_dict else ''),
            'data': {
                'document': document.to_dict(),
                'profile': profile_dict
            }
        }), 201
    
    except Exception as e:
        import traceback
        db.session.rollback()
        error_trace = traceback.format_exc()
        print(f"Upload error: {str(e)}")
        print(f"Traceback: {error_trace}")
        return jsonify({
            'success': False,
            'message': f'Upload failed: {str(e)}',
            'error': str(e)
        }), 500


@student_bp.route('/api/documents', methods=['GET'])
@login_required
def get_documents():
    """Get all documents for the current student."""
    try:
        user_id = get_current_user_id()
        
        documents = Document.query.filter_by(user_id=user_id).order_by(Document.uploaded_at.desc()).all()
        
        return jsonify({
            'success': True,
            'data': {
                'documents': [doc.to_dict() for doc in documents]
            }
        }), 200
    
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Failed to fetch documents: {str(e)}'
        }), 500


@student_bp.route('/api/document/<int:doc_id>', methods=['GET'])
@login_required
def get_document(doc_id):
    """Get specific document details or download file."""
    try:
        user_id = get_current_user_id()
        
        document = Document.query.get_or_404(doc_id)
        
        # Check if document belongs to the user
        if document.user_id != user_id:
            return jsonify({
                'success': False,
                'message': 'Unauthorized access'
            }), 403
        
        return jsonify({
            'success': True,
            'data': {
                'document': document.to_dict()
            }
        }), 200
    
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Failed to fetch document: {str(e)}'
        }), 500


@student_bp.route('/api/document/<int:doc_id>/download', methods=['GET'])
@login_required
def download_document(doc_id):
    """Download a document file."""
    try:
        user_id = get_current_user_id()
        
        document = Document.query.get_or_404(doc_id)
        
        # Check if document belongs to the user
        if document.user_id != user_id:
            return jsonify({
                'success': False,
                'message': 'Unauthorized access'
            }), 403
        
        # Get absolute path for file serving
        upload_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), Config.UPLOAD_FOLDER)
        file_basename = os.path.basename(document.filepath)
        
        # Send file
        return send_from_directory(
            upload_dir,
            file_basename,
            as_attachment=True
        )
    
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Failed to download document: {str(e)}'
        }), 500


@student_bp.route('/api/profile/<int:user_id>', methods=['GET'])
@login_required
def get_ai_profile(user_id: int):
    """Return the stored AI-generated profile JSON for a user."""
    try:
        requester_id = get_current_user_id()
        requester_role = session.get('user_role')

        # Only the user themself or admin can view
        if requester_id != user_id and requester_role != 'admin':
            return jsonify({'success': False, 'message': 'Unauthorized'}), 403

        profile = UserProfile.query.filter_by(user_id=user_id).first()
        if not profile:
            return jsonify({'success': True, 'data': {'profile': {}}}), 200
        return jsonify({'success': True, 'data': {'profile': profile.to_dict()}}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': f'Failed to fetch profile: {str(e)}'}), 500

