"""
Admin routes for managing students and viewing all student data.
"""
from flask import Blueprint, request, jsonify, session
from models import db, User, Document
from functools import wraps

admin_bp = Blueprint('admin', __name__)


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


def is_admin():
    """Check if current user is an admin."""
    return session.get('user_role') == 'admin'


@admin_bp.route('/api/admin/students', methods=['GET'])
@login_required
def get_all_students():
    """Get all student profiles with document counts (admin only)."""
    try:
        # Check if user is admin
        if not is_admin():
            return jsonify({
                'success': False,
                'message': 'Unauthorized: Admin access required'
            }), 403
        
        # Get all students
        students = User.query.filter_by(role='student').all()
        
        # Build student list with document counts
        students_data = []
        for student in students:
            doc_count = Document.query.filter_by(user_id=student.id).count()
            students_data.append({
                'id': student.id,
                'name': student.name,
                'email': student.email,
                'created_at': student.created_at.isoformat() if student.created_at else None,
                'document_count': doc_count
            })
        
        return jsonify({
            'success': True,
            'data': {
                'students': students_data
            }
        }), 200
    
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Failed to fetch students: {str(e)}'
        }), 500


@admin_bp.route('/api/admin/student/<int:student_id>', methods=['GET'])
@login_required
def get_student_details(student_id):
    """Get specific student's details and their document list (admin only)."""
    try:
        # Check if user is admin
        if not is_admin():
            return jsonify({
                'success': False,
                'message': 'Unauthorized: Admin access required'
            }), 403
        
        # Get student
        student = User.query.get(student_id)
        
        if not student:
            return jsonify({
                'success': False,
                'message': 'Student not found'
            }), 404
        
        if student.role != 'student':
            return jsonify({
                'success': False,
                'message': 'User is not a student'
            }), 400
        
        # Get all documents for the student
        documents = Document.query.filter_by(user_id=student_id).order_by(Document.uploaded_at.desc()).all()
        
        return jsonify({
            'success': True,
            'data': {
                'student': student.to_dict(),
                'documents': [doc.to_dict() for doc in documents],
                'document_count': len(documents)
            }
        }), 200
    
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Failed to fetch student details: {str(e)}'
        }), 500


@admin_bp.route('/api/admin/student/<int:student_id>', methods=['DELETE'])
@login_required
def delete_student(student_id):
    """Delete a student account (admin only)."""
    try:
        # Check if user is admin
        if not is_admin():
            return jsonify({
                'success': False,
                'message': 'Unauthorized: Admin access required'
            }), 403
        
        # Get student
        student = User.query.get(student_id)
        
        if not student:
            return jsonify({
                'success': False,
                'message': 'Student not found'
            }), 404
        
        if student.role != 'student':
            return jsonify({
                'success': False,
                'message': 'User is not a student'
            }), 400
        
        # Delete student (cascade will delete documents)
        db.session.delete(student)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Student deleted successfully'
        }), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': f'Failed to delete student: {str(e)}'
        }), 500

