"""
Student routes for profile management and document uploads.
"""
import os
import json
from flask import Blueprint, request, jsonify, send_from_directory, session
from werkzeug.utils import secure_filename
from models import db, User, Document, UserProfile, ProfileVersion
from sqlalchemy import text
from config import Config
from functools import wraps
import google.generativeai as genai
import re


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
        
        if ext == '.pdf':
            if PdfReader is None:
                print("Warning: PyPDF2 not available, cannot extract text from PDF")
                return ''
            
            text_parts = []
            try:
                with open(filepath, 'rb') as f:
                    reader = PdfReader(f)
                    num_pages = len(reader.pages)
                    print(f"PDF has {num_pages} pages")
                    
                    for i, page in enumerate(reader.pages):
                        try:
                            page_text = page.extract_text()
                            if page_text:
                                text_parts.append(page_text)
                                print(f"Extracted {len(page_text)} characters from page {i+1}")
                        except Exception as e:
                            print(f"Error extracting text from page {i+1}: {str(e)}")
                            continue
                    
                    extracted = '\n'.join(text_parts).strip()
                    print(f"Total extracted text length: {len(extracted)} characters")
                    return extracted
            except Exception as e:
                print(f"Error reading PDF file {filepath}: {str(e)}")
                return ''
        
        elif ext in ('.png', '.jpg', '.jpeg'):
            if pytesseract is None or Image is None:
                print("Warning: pytesseract or PIL not available, cannot extract text from image")
                return ''
            
            try:
                img = Image.open(filepath)
                extracted = pytesseract.image_to_string(img)
                if extracted:
                    extracted = extracted.strip()
                    print(f"Extracted {len(extracted)} characters from image using OCR")
                return extracted
            except Exception as e:
                print(f"Error extracting text from image {filepath}: {str(e)}")
                return ''
        else:
            print(f"Unsupported file extension: {ext}")
            return ''
            
    except Exception as e:
        print(f"Unexpected error in extract_text_from_file: {str(e)}")
        import traceback
        traceback.print_exc()
        return ''


def generate_profile_with_gemini(extracted_text: str, variation_seed: int | None = None) -> dict:
    seed_note = f"\nRegenerate a different variation if asked. Variation seed: {variation_seed}\n" if variation_seed is not None else "\n"
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
    {seed_note}
    """
    try:
        # Use the latest model
        model = genai.GenerativeModel("gemini-2.5-flash")
        response = model.generate_content(prompt)

        # Try standard .text first
        raw = (getattr(response, 'text', '') or '').strip()

        # Fallback: attempt to reconstruct text from candidates/parts if .text missing
        if not raw:
            try:
                parts = []
                for cand in getattr(response, 'candidates', []) or []:
                    for part in getattr(cand, 'content', {}).get('parts', []):
                        if isinstance(part, dict) and 'text' in part:
                            parts.append(part['text'])
                raw = '\n'.join(parts).strip()
            except Exception:
                pass

        if not raw:
            return {}

        # Extract JSON block if wrapped in code fences
        fence_match = re.search(r"```json\s*([\s\S]*?)\s*```", raw, re.IGNORECASE)
        if fence_match:
            raw_json = fence_match.group(1).strip()
        else:
            raw_json = raw

        # Cleanup common artifacts and parse
        raw_json = raw_json.strip()
        try:
            return json.loads(raw_json)
        except Exception:
            # Try to find the first { ... } JSON object in the text
            obj_match = re.search(r"\{[\s\S]*\}", raw_json)
            if obj_match:
                return json.loads(obj_match.group(0))
            return {}
    except Exception as e:
        print(f"Gemini generation failed: {str(e)}")
        return {}


@student_bp.route('/api/ai-test', methods=['GET'])
@student_bp.route('/api/test-ai', methods=['GET'])
@login_required
def ai_test():
    """Simple endpoint to verify Gemini connectivity/model works."""
    try:
        test_prompt = "Return JSON: {\n  \"ok\": true,\n  \"model\": \"gemini-2.5-flash\"\n}"
        model = genai.GenerativeModel("gemini-2.5-flash")
        resp = model.generate_content(test_prompt)
        text = (getattr(resp, 'text', '') or '').strip()
        return jsonify({
            'success': True,
            'data': {
                'raw_text': text[:500]
            }
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'message': f'AI test failed: {str(e)}'}), 500


@student_bp.route('/api/profile/regenerate', methods=['POST'])
@login_required
def regenerate_profile_self():
    """Allow the current user to regenerate and persist their profile from existing documents."""
    try:
        uid = get_current_user_id()
        # Combine all extracted texts for this user
        docs = Document.query.filter_by(user_id=uid).all()
        combined = ' '.join([(d.extracted_text or '') for d in docs]).strip()
        if not combined or len(combined) <= 10:
            return jsonify({'success': False, 'message': 'Not enough readable text in documents to generate profile'}), 400
        import random
        generated = generate_profile_with_gemini(combined, variation_seed=random.randint(1, 10_000_000))
        if not generated or not isinstance(generated, dict) or len(generated) == 0:
            return jsonify({'success': False, 'message': 'Profile generation returned empty'}), 500
        # Upsert into user_profile
        db.session.execute(
            text("""
                INSERT INTO user_profile (user_id, profile_json)
                VALUES (:uid, :pj)
                ON DUPLICATE KEY UPDATE profile_json = VALUES(profile_json), last_updated = NOW()
            """),
            { 'uid': uid, 'pj': json.dumps(generated) }
        )
        db.session.commit()
        return jsonify({'success': True, 'data': {'profile': {'user_id': uid, 'profile_json': generated}}}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'Failed to regenerate profile: {str(e)}'}), 500


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
        
        # Get absolute path to upload folder
        upload_dir = Config.UPLOAD_FOLDER
        
        # Ensure upload folder exists
        if not os.path.exists(upload_dir):
            os.makedirs(upload_dir)
        
        # Save file with absolute path
        filepath = os.path.join(upload_dir, filename_with_prefix)
        file.save(filepath)
        
        # Extract text from the uploaded file (use absolute path for extraction)
        extracted = extract_text_from_file(filepath)
        
        # Log extraction result for debugging
        if extracted:
            print(f"Text extracted: {len(extracted)} characters")
        else:
            print(f"Warning: No text extracted from file: {filename}")

        # Create document record (store filename with prefix in DB)
        document = Document(
            user_id=user_id,
            filename=filename,
            filepath=filename_with_prefix,  # Store just the filename for easier access
            extracted_text=extracted
        )
        
        db.session.add(document)
        db.session.commit()

        # Generate or update AI profile (non-blocking - don't fail upload if this fails)
        profile_dict = None
        try:
            # Combine all extracted texts for this user
            user_docs = Document.query.filter_by(user_id=user_id).all()
            combined_text = ' '.join([(d.extracted_text or '') for d in user_docs]).strip()

            if combined_text and len(combined_text) > 10:  # Ensure we have meaningful text
                print(f"Generating profile from {len(combined_text)} characters of combined text")
                profile_json = generate_profile_with_gemini(combined_text)
                
                # Only save profile if generation was successful and returned data
                if profile_json and isinstance(profile_json, dict) and len(profile_json) > 0:
                    profile = UserProfile.query.filter_by(user_id=user_id).first()
                    
                    if profile is None:
                        profile = UserProfile(user_id=user_id, profile_json=profile_json)
                        db.session.add(profile)
                    else:
                        profile.profile_json = profile_json
                    db.session.commit()
                    
                    profile_dict = profile.to_dict()
                    print(f"Profile generated and saved successfully")
                else:
                    print(f"Warning: Profile generation returned empty or invalid data")
            else:
                print(f"Warning: Not enough text extracted to generate profile (length: {len(combined_text) if combined_text else 0})")
        except Exception as profile_error:
            # If profile generation fails, don't fail the upload
            import traceback
            print(f"Warning: Profile generation failed: {str(profile_error)}")
            print(f"Traceback: {traceback.format_exc()}")
            db.session.rollback()
        
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
        
        # Check if document belongs to the user (admins can view any)
        requester_role = session.get('user_role')
        if document.user_id != user_id and requester_role != 'admin':
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
        
        # Check if document belongs to the user (admins can download any)
        requester_role = session.get('user_role')
        if document.user_id != user_id and requester_role != 'admin':
            return jsonify({
                'success': False,
                'message': 'Unauthorized access'
            }), 403
        
        # Get absolute path for file serving
        upload_dir = Config.UPLOAD_FOLDER
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


@student_bp.route('/api/document/<int:doc_id>', methods=['DELETE'])
@login_required
def delete_document(doc_id):
    """Delete a document file and its database record."""
    try:
        user_id = get_current_user_id()
        requester_role = session.get('user_role')
        
        document = Document.query.get_or_404(doc_id)
        
        # Check if document belongs to the user (admins can delete any)
        if document.user_id != user_id and requester_role != 'admin':
            return jsonify({
                'success': False,
                'message': 'Unauthorized access'
            }), 403
        
        # Delete physical file from disk
        upload_dir = Config.UPLOAD_FOLDER
        file_basename = os.path.basename(document.filepath)
        file_path = os.path.join(upload_dir, file_basename)
        
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception as e:
                print(f"Warning: Could not delete physical file {file_path}: {str(e)}")
        
        # Delete database record
        db.session.delete(document)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Document deleted successfully'
        }), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': f'Failed to delete document: {str(e)}'
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

        # Backward-compatible fetch that works with or without current_version column
        # Avoid ORM selecting non-existent columns by using a raw, minimal SELECT
        row = db.session.execute(
            text("SELECT id, user_id, profile_json, last_updated FROM user_profile WHERE user_id = :uid LIMIT 1"),
            { 'uid': user_id }
        ).mappings().first()

        if not row:
            # No profile row yet: try on-demand generation from existing docs
            try:
                docs = Document.query.filter_by(user_id=user_id).all()
                combined = ' '.join([(d.extracted_text or '') for d in docs]).strip()
                if combined and len(combined) > 10:
                    generated = generate_profile_with_gemini(combined)
                    if generated and isinstance(generated, dict) and len(generated) > 0:
                        try:
                            db.session.execute(
                                text("""
                                    INSERT INTO user_profile (user_id, profile_json)
                                    VALUES (:uid, :pj)
                                    ON DUPLICATE KEY UPDATE profile_json = VALUES(profile_json), last_updated = NOW()
                                """),
                                { 'uid': user_id, 'pj': json.dumps(generated) }
                            )
                            db.session.commit()
                            return jsonify({'success': True, 'data': {'profile': {'user_id': user_id, 'profile_json': generated}}}), 200
                        except Exception:
                            db.session.rollback()
            except Exception as e:
                print(f"On-demand profile generation (no row) failed: {str(e)}")
            return jsonify({'success': True, 'data': {'profile': None}, 'message': 'No profile generated yet.'}), 200

        # Try to use versioned profile if available, otherwise fallback to user_profile.profile_json
        profile_json = None
        try:
            # Only attempt versioned read if the table likely exists
            current_pointer = db.session.execute(
                text("SELECT current_version FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_profile' AND COLUMN_NAME = 'current_version'")
            ).first()
            if current_pointer:
                # If column exists, read pointer and fetch versioned row
                ptr_row = db.session.execute(
                    text("SELECT current_version FROM user_profile WHERE user_id = :uid LIMIT 1"),
                    { 'uid': user_id }
                ).first()
                if ptr_row and ptr_row[0]:
                    pv = ProfileVersion.query.filter_by(user_id=user_id, version=ptr_row[0]).first()
                    if pv and pv.profile_json:
                        profile_json = pv.profile_json
        except Exception:
            pass

        if profile_json is None:
            profile_json = row["profile_json"]

        # If still empty, attempt on-demand generation from existing documents
        if not profile_json or (isinstance(profile_json, dict) and len(profile_json) == 0):
            try:
                docs = Document.query.filter_by(user_id=user_id).all()
                combined = ' '.join([(d.extracted_text or '') for d in docs]).strip()
                if combined and len(combined) > 10:
                    generated = generate_profile_with_gemini(combined)
                    if generated and isinstance(generated, dict) and len(generated) > 0:
                        # Persist result to user_profile (non-versioned fallback)
                        try:
                            db.session.execute(
                                text("""
                                    INSERT INTO user_profile (user_id, profile_json)
                                    VALUES (:uid, :pj)
                                    ON DUPLICATE KEY UPDATE profile_json = VALUES(profile_json), last_updated = NOW()
                                """),
                                { 'uid': user_id, 'pj': json.dumps(generated) }
                            )
                            db.session.commit()
                        except Exception:
                            db.session.rollback()
                        profile_json = generated
            except Exception as e:
                print(f"On-demand profile generation failed: {str(e)}")

        if not profile_json or (isinstance(profile_json, dict) and len(profile_json) == 0):
            return jsonify({'success': True, 'data': {'profile': None}, 'message': 'Profile exists but is empty.'}), 200

        return jsonify({'success': True, 'data': {'profile': {'user_id': user_id, 'profile_json': profile_json}}}), 200
    except Exception as e:
        import traceback
        print(f"Error fetching profile: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")
        return jsonify({'success': False, 'message': f'Failed to fetch profile: {str(e)}'}), 500

