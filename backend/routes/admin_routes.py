"""
Admin routes for user management with RBAC, profile versioning, and audit logging.
"""
from flask import Blueprint, request, jsonify, session
import json
from functools import wraps
from sqlalchemy import func, or_, desc, asc
from models import db, User, Document, ProfileVersion, UserProfile, AdminEvent
from sqlalchemy import text
from routes.student_routes import generate_profile_with_gemini
import random

admin_bp = Blueprint('admin', __name__)


def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('user_id'):
            return jsonify({'success': False, 'message': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated_function


def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if session.get('user_role') != 'admin':
            return jsonify({'success': False, 'message': 'Forbidden'}), 403
        return f(*args, **kwargs)
    return decorated_function


def mask_email(email: str) -> str:
    try:
        at = email.index('@')
        return email[0] + '*' * max(0, at - 3) + email[at:]
    except Exception:
        return email


@admin_bp.route('/api/admin/users', methods=['GET'])
@login_required
@admin_required
def list_users():
    search = (request.args.get('search') or '').strip()
    status = (request.args.get('status') or '').strip()
    sort = (request.args.get('sort') or 'last_active:desc').strip()
    page = int(request.args.get('page') or 1)
    limit = min(max(int(request.args.get('limit') or 20), 1), 100)

    q = db.session.query(User)

    if status in ['active', 'locked', 'deleted']:
        q = q.filter(User.status == status)

    if search:
        like = f"%{search.lower()}%"
        q = q.filter(or_(func.lower(User.name).like(like), func.lower(User.email).like(like)))

    # Sorting
    sort_field, _, sort_dir = sort.partition(':')
    sort_col = {
        'last_active': User.last_active,
        'created_at': User.created_at,
        'name': User.name
    }.get(sort_field, User.last_active)
    q = q.order_by(desc(sort_col) if sort_dir == 'desc' else asc(sort_col))

    total = q.count()
    users = q.offset((page - 1) * limit).limit(limit).all()

    # Precompute stats per user
    results = []
    for u in users:
        files_count = db.session.query(func.count(Document.id)).filter(Document.user_id == u.id).scalar() or 0
        failed_files = db.session.query(func.count(Document.id)).filter(Document.user_id == u.id, Document.status == 'failed').scalar() or 0
        latest_version = db.session.query(func.max(ProfileVersion.version)).filter(ProfileVersion.user_id == u.id).scalar()
        results.append({
            'id': u.id,
            'name': u.name,
            'masked_email': mask_email(u.email),
            'role': u.role,
            'status': u.status,
            'created_at': u.created_at.isoformat() if u.created_at else None,
            'last_active': u.last_active.isoformat() if u.last_active else None,
            'files_count': files_count,
            'failed_files': failed_files,
            'latest_profile_version': latest_version or 0,
        })

    return jsonify({'success': True, 'data': {'total': total, 'page': page, 'limit': limit, 'users': results}}), 200


@admin_bp.route('/api/admin/users/<int:user_id>/overview', methods=['GET'])
@login_required
@admin_required
def user_overview(user_id: int):
    user = User.query.get(user_id)
    if not user:
        return jsonify({'success': False, 'message': 'User not found'}), 404

    files_total = db.session.query(func.count(Document.id)).filter(Document.user_id == user_id).scalar() or 0
    processing = db.session.query(func.count(Document.id)).filter(Document.user_id == user_id, Document.status == 'processing').scalar() or 0
    failed = db.session.query(func.count(Document.id)).filter(Document.user_id == user_id, Document.status == 'failed').scalar() or 0
    latest_version = db.session.query(func.max(ProfileVersion.version)).filter(ProfileVersion.user_id == user_id).scalar() or 0
    last_upload = db.session.query(func.max(Document.uploaded_at)).filter(Document.user_id == user_id).scalar()

    return jsonify({'success': True, 'data': {
        'id': user.id,
        'name': user.name,
        'email': user.email,
        'role': user.role,
        'status': user.status,
        'created_at': user.created_at.isoformat() if user.created_at else None,
        'last_active': user.last_active.isoformat() if user.last_active else None,
        'files_total': files_total,
        'processing': processing,
        'failed': failed,
        'latest_profile_version': latest_version,
        'last_upload': last_upload.isoformat() if last_upload else None,
    }}), 200


@admin_bp.route('/api/admin/users/<int:user_id>/profile', methods=['GET'])
@login_required
@admin_required
def user_profile(user_id: int):
    """Return current profile for admin view, resilient to missing columns."""
    # Minimal select to avoid unknown-column errors if migrations not applied
    row = db.session.execute(
        text("SELECT id, user_id, profile_json, last_updated FROM user_profile WHERE user_id = :uid LIMIT 1"),
        { 'uid': user_id }
    ).mappings().first()
    if not row:
        return jsonify({'success': True, 'data': {'profile_json': None, 'current_version': 0}}), 200

    # Check if current_version column exists
    try:
        col_exists = db.session.execute(
            text("SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_profile' AND COLUMN_NAME = 'current_version' LIMIT 1")
        ).first()
        if col_exists:
            ptr = db.session.execute(
                text("SELECT current_version FROM user_profile WHERE user_id = :uid LIMIT 1"),
                { 'uid': user_id }
            ).first()
            if ptr and ptr[0]:
                pv = ProfileVersion.query.filter_by(user_id=user_id, version=ptr[0]).first()
                if pv and pv.profile_json:
                    return jsonify({'success': True, 'data': {'current_version': ptr[0], 'profile_json': pv.profile_json}}), 200
    except Exception:
        pass

    # Fallback to non-versioned profile_json
    return jsonify({'success': True, 'data': {'current_version': 0, 'profile_json': row["profile_json"]}}), 200


@admin_bp.route('/api/admin/users/<int:user_id>/files', methods=['GET'])
@login_required
@admin_required
def user_files(user_id: int):
    page = int(request.args.get('page') or 1)
    limit = min(max(int(request.args.get('limit') or 20), 1), 100)
    q = Document.query.filter_by(user_id=user_id).order_by(Document.uploaded_at.desc())
    total = q.count()
    rows = q.offset((page - 1) * limit).limit(limit).all()
    return jsonify({'success': True, 'data': {'total': total, 'page': page, 'limit': limit, 'files': [r.to_dict() for r in rows]}}), 200


@admin_bp.route('/api/admin/users/<int:user_id>/activity', methods=['GET'])
@login_required
@admin_required
def user_activity(user_id: int):
    q = AdminEvent.query.filter_by(target_user_id=user_id).order_by(AdminEvent.created_at.desc()).limit(100)
    events = [{
        'id': e.id,
        'action': e.action,
        'actor_user_id': e.actor_user_id,
        'created_at': e.created_at.isoformat() if e.created_at else None,
        'details': e.details,
    } for e in q]
    return jsonify({'success': True, 'data': {'events': events}}), 200


def log_admin_event(actor_id: int, target_id: int, action: str, details: dict | None = None):
    evt = AdminEvent(actor_user_id=actor_id, target_user_id=target_id, action=action, details=details or {})
    db.session.add(evt)
    db.session.commit()


def next_profile_version(user_id: int) -> int:
    current = db.session.query(func.max(ProfileVersion.version)).filter(ProfileVersion.user_id == user_id).scalar()
    return (current or 0) + 1


@admin_bp.route('/api/admin/users/<int:user_id>/actions', methods=['POST'])
@login_required
@admin_required
def user_actions(user_id: int):
    payload = request.get_json(silent=True) or {}
    action_type = payload.get('type')
    details = payload.get('payload') or {}
    actor_id = session.get('user_id')

    user = User.query.get(user_id)
    if not user:
        return jsonify({'success': False, 'message': 'User not found'}), 404

    try:
        if action_type == 'LOCK':
            user.status = 'locked'
            db.session.commit()
            log_admin_event(actor_id, user_id, 'LOCK', {'reason': details.get('reason')})
            return jsonify({'success': True, 'data': {'status': user.status}}), 200
        
        if action_type == 'UNLOCK':
            user.status = 'active'
            db.session.commit()
            log_admin_event(actor_id, user_id, 'UNLOCK', {'reason': details.get('reason')})
            return jsonify({'success': True, 'data': {'status': user.status}}), 200

        if action_type == 'REGENERATE':
            # Build fresh profile from current documents using Gemini
            docs = Document.query.filter_by(user_id=user_id).all()
            combined = ' '.join([(d.extracted_text or '') for d in docs]).strip()
            if not combined or len(combined) <= 10:
                return jsonify({'success': False, 'message': 'Not enough readable text to regenerate'}), 400
            payload_json = generate_profile_with_gemini(combined, variation_seed=random.randint(1, 10_000_000)) or {}
            # Check if versioning pointer column exists
            col_exists = db.session.execute(
                text("SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_profile' AND COLUMN_NAME = 'current_version' LIMIT 1")
            ).first()
            if col_exists:
                ver = next_profile_version(user_id)
                pv = ProfileVersion(user_id=user_id, version=ver, profile_json=payload_json, profile_html=details.get('profile_html'))
                db.session.add(pv)
                up = UserProfile.query.filter_by(user_id=user_id).first()
                if not up:
                    up = UserProfile(user_id=user_id, profile_json=payload_json, current_version=ver)
                    db.session.add(up)
                else:
                    up.current_version = ver
                db.session.commit()
                log_admin_event(actor_id, user_id, 'REGENERATE', {'new_version': ver})
                return jsonify({'success': True, 'data': {'new_version': ver}}), 200
            else:
                # Fallback: update non-versioned user_profile JSON directly
                db.session.execute(
                    text("""
                        INSERT INTO user_profile (user_id, profile_json)
                        VALUES (:uid, :pj)
                        ON DUPLICATE KEY UPDATE profile_json = VALUES(profile_json), last_updated = NOW()
                    """),
                    { 'uid': user_id, 'pj': json.dumps(payload_json) }
                )
                db.session.commit()
                log_admin_event(actor_id, user_id, 'REGENERATE', {'fallback': True})
                return jsonify({'success': True, 'data': {'updated': True}}), 200

        if action_type == 'DELETE_FILE':
            file_id = details.get('file_id')
            doc = Document.query.filter_by(id=file_id, user_id=user_id).first()
            if not doc:
                return jsonify({'success': False, 'message': 'File not found'}), 404
            # documents.status enum: 'uploaded'|'processing'|'done'|'failed'
            # Use 'failed' to represent deleted in current schema
            doc.status = 'failed'
            db.session.commit()
            log_admin_event(actor_id, user_id, 'DELETE_FILE', {'file_id': file_id})
            return jsonify({'success': True, 'data': {'file_id': file_id}}), 200

        if action_type == 'REEXTRACT':
            file_id = details.get('file_id')
            doc = Document.query.filter_by(id=file_id, user_id=user_id).first()
            if not doc:
                return jsonify({'success': False, 'message': 'File not found'}), 404
            doc.status = 'processing'
            db.session.commit()
            log_admin_event(actor_id, user_id, 'REEXTRACT', {'file_id': file_id})
            return jsonify({'success': True, 'data': {'file_id': file_id, 'status': 'processing'}}), 200

        return jsonify({'success': False, 'message': 'Invalid action type'}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'Action failed: {str(e)}'}), 500

