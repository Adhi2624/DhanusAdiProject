from flask import Flask, redirect, url_for, session, request, jsonify, send_file
from flask_sqlalchemy import SQLAlchemy
from authlib.integrations.flask_client import OAuth
import os
import requests
import datetime
import json
import io
import logging
from flask_cors import CORS

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "your_secret_key")
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///users.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)
oauth = OAuth(app)
CORS(app, allow_origins=["*"], supports_credentials=True)

# OAuth Configuration
google = oauth.register(
    name='google',
    client_id=os.getenv("GOOGLE_CLIENT_ID"),
    client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
    access_token_url='https://oauth2.googleapis.com/token',
    authorize_url='https://accounts.google.com/o/oauth2/auth',
    api_base_url='https://www.googleapis.com/oauth2/v3/',
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={'scope': 'openid email profile https://www.googleapis.com/auth/drive'}
)

onedrive = oauth.register(
    name='onedrive',
    client_id=os.getenv("ONEDRIVE_CLIENT_ID"),
    client_secret=os.getenv("ONEDRIVE_CLIENT_SECRET"),
    access_token_url='https://login.microsoftonline.com/common/oauth2/v2.0/token',
    authorize_url='https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    api_base_url='https://graph.microsoft.com/v1.0/',
    jwks_uri= 'https://login.microsoftonline.com/common/discovery/v2.0/keys',
    client_kwargs={'scope': 'openid email profile Files.ReadWrite'}
)


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(150), unique=True, nullable=False)
    google_token = db.Column(db.JSON)
    onedrive_token = db.Column(db.JSON,nullable=True)

@app.route('/')
def home():
    return "Cloud File Manager API"

# Google authentication routes
@app.route('/login/google')
def login_google():
    return google.authorize_redirect(url_for('authorize_google', _external=True, _scheme="https"))

@app.route('/authorize/google')
def authorize_google():
    token = google.authorize_access_token()
    user_info = google.get('userinfo').json()
    user = User.query.filter_by(email=user_info['email']).first()
    if not user:
        user = User(email=user_info['email'], google_token=token)
        db.session.add(user)
    else:
        user.google_token = token
    db.session.commit()
    return jsonify(user_info)

# OneDrive authentication routes
@app.route('/login/onedrive')
def login_onedrive():
    return onedrive.authorize_redirect(url_for('authorize_onedrive', _external=True, _scheme="https"))

@app.route('/authorize/onedrive')
def authorize_onedrive():
    token = onedrive.authorize_access_token()
    #user_info = onedrive.get('me').json()
    
    # Use logger instead of print
    logger.info(f"Available keys in user_info: {token.keys()}")
    
    # Try different possible email field names
    email = token.get('userinfo', {}).get('email')
        
        # If email is not found, try preferred_username as fallback
    if not email:
        email = token.get('userinfo', {}).get('preferred_username')
    
    
    if not email:
        # If no email field is found, use an alternative identifier or return an error
        logger.error(f"No email field found in OneDrive user info: {'sc'}")
        return jsonify({"error": 'user_info'}), 400
    
    user = User.query.filter_by(email=email).first()
    if not user:
        user = User(email=email, onedrive_token=token)
        db.session.add(user)
    else:
        user.onedrive_token = token
    
    db.session.commit()
    return jsonify({"success": True, "message": "Logged in successfully", "email": email})

# Google Drive operations
@app.route('/files/google')
def list_google_files():
    user = User.query.first()
    if not user or not user.google_token:
        logger.warning("User not authenticated with Google")
        return jsonify({"error": "User not authenticated with Google"}), 401
    
    # Check if token needs refresh
    if 'expires_at' in user.google_token and datetime.datetime.fromtimestamp(user.google_token['expires_at']) < datetime.datetime.now():
        logger.info("Refreshing Google token")
        token = google.refresh_token(user.google_token['refresh_token'])
        user.google_token = token
        db.session.commit()
        
    headers = {'Authorization': f'Bearer {user.google_token["access_token"]}'}
    response = requests.get('https://www.googleapis.com/drive/v3/files', headers=headers).json()
    return jsonify(response)

@app.route('/upload/google', methods=['POST'])
def upload_google():
    user = User.query.first()
    if not user or not user.google_token:
        logger.warning("User not authenticated with Google")
        return jsonify({"error": "User not authenticated with Google"}), 401
    
    # Check if token needs refresh
    if 'expires_at' in user.google_token and datetime.datetime.fromtimestamp(user.google_token['expires_at']) < datetime.datetime.now():
        logger.info("Refreshing Google token")
        token = google.refresh_token(user.google_token['refresh_token'])
        user.google_token = token
        db.session.commit()
    
    if 'file' not in request.files:
        logger.warning("No file provided in request")
        return jsonify({"error": "No file provided"}), 400
    
    file = request.files['file']
    if file.filename == '':
        logger.warning("Empty filename provided")
        return jsonify({"error": "No file selected"}), 400
    
    logger.info(f"Uploading file to Google Drive: {file.filename}")
    metadata = {'name': file.filename}
    files = {
        'metadata': ('metadata', json.dumps(metadata), 'application/json'),
        'file': (file.filename, file.read(), 'application/octet-stream')
    }
    headers = {'Authorization': f'Bearer {user.google_token["access_token"]}'}
    response = requests.post('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', headers=headers, files=files)
    return response.json()

@app.route('/download/google/<file_id>', methods=['GET'])
def download_google(file_id):
    user = User.query.first()
    if not user or not user.google_token:
        logger.warning("User not authenticated with Google")
        return jsonify({"error": "User not authenticated with Google"}), 401
    
    # Check if token needs refresh
    if 'expires_at' in user.google_token and datetime.datetime.fromtimestamp(user.google_token['expires_at']) < datetime.datetime.now():
        logger.info("Refreshing Google token")
        token = google.refresh_token(user.google_token['refresh_token'])
        user.google_token = token
        db.session.commit()
    
    headers = {'Authorization': f'Bearer {user.google_token["access_token"]}'}
    
    # Get file metadata to get name
    logger.info(f"Getting metadata for Google Drive file: {file_id}")
    metadata_response = requests.get(f'https://www.googleapis.com/drive/v3/files/{file_id}?fields=name', headers=headers)
    if metadata_response.status_code != 200:
        logger.error(f"File not found on Google Drive: {file_id}")
        return jsonify({"error": "File not found"}), 404
    
    file_name = metadata_response.json().get('name', 'downloaded_file')
    
    # Download file content
    logger.info(f"Downloading file from Google Drive: {file_name} ({file_id})")
    response = requests.get(f'https://www.googleapis.com/drive/v3/files/{file_id}?alt=media', headers=headers, stream=True)
    if response.status_code != 200:
        logger.error(f"Failed to download file from Google Drive: {file_id}")
        return jsonify({"error": "Failed to download file"}), 500
    
    return send_file(
        io.BytesIO(response.content),
        mimetype=response.headers.get('Content-Type', 'application/octet-stream'),
        as_attachment=True,
        download_name=file_name
    )

@app.route('/delete/google/<file_id>', methods=['DELETE'])
def delete_google(file_id):
    user = User.query.first()
    if not user or not user.google_token:
        logger.warning("User not authenticated with Google")
        return jsonify({"error": "User not authenticated with Google"}), 401
    
    # Check if token needs refresh
    if 'expires_at' in user.google_token and datetime.datetime.fromtimestamp(user.google_token['expires_at']) < datetime.datetime.now():
        logger.info("Refreshing Google token")
        token = google.refresh_token(user.google_token['refresh_token'])
        user.google_token = token
        db.session.commit()
    
    headers = {'Authorization': f'Bearer {user.google_token["access_token"]}'}
    logger.info(f"Deleting file from Google Drive: {file_id}")
    response = requests.delete(f'https://www.googleapis.com/drive/v3/files/{file_id}', headers=headers)
    
    if response.status_code == 204:
        logger.info(f"Successfully deleted file from Google Drive: {file_id}")
        return jsonify({"success": True, "message": "File deleted successfully"})
    else:
        logger.error(f"Failed to delete file from Google Drive: {file_id}, status: {response.status_code}")
        return jsonify({"error": "Failed to delete file", "status": response.status_code}), response.status_code

# OneDrive operations
@app.route('/files/onedrive')
def list_onedrive_files():
    user = User.query.first()
    if not user or not user.onedrive_token:
        logger.warning("User not authenticated with OneDrive")
        return jsonify({"error": "User not authenticated with OneDrive"}), 401
    
    # Check if token needs refresh
    if 'expires_at' in user.onedrive_token and datetime.datetime.fromtimestamp(user.onedrive_token['expires_at']) < datetime.datetime.now():
        logger.info("Refreshing OneDrive token")
        token = onedrive.refresh_token(user.onedrive_token['refresh_token'])
        user.onedrive_token = token
        db.session.commit()
    
    headers = {'Authorization': f'Bearer {user.onedrive_token["access_token"]}'}
    response = requests.get('https://graph.microsoft.com/v1.0/me/drive/root/children', headers=headers).json()
    return jsonify(response)

@app.route('/upload/onedrive', methods=['POST'])
def upload_onedrive():
    user = User.query.first()
    if not user or not user.onedrive_token:
        logger.warning("User not authenticated with OneDrive")
        return jsonify({"error": "User not authenticated with OneDrive"}), 401
    
    # Check if token needs refresh
    if 'expires_at' in user.onedrive_token and datetime.datetime.fromtimestamp(user.onedrive_token['expires_at']) < datetime.datetime.now():
        logger.info("Refreshing OneDrive token")
        token = onedrive.refresh_token(user.onedrive_token['refresh_token'])
        user.onedrive_token = token
        db.session.commit()
    
    if 'file' not in request.files:
        logger.warning("No file provided in request")
        return jsonify({"error": "No file provided"}), 400
    
    file = request.files['file']
    if file.filename == '':
        logger.warning("Empty filename provided")
        return jsonify({"error": "No file selected"}), 400
    
    file_content = file.read()
    file_name = file.filename
    logger.info(f"Uploading file to OneDrive: {file_name} ({len(file_content)} bytes)")
    
    # For OneDrive, we need to use a different approach compared to Google Drive
    # First, create an upload session for large files
    headers = {
        'Authorization': f'Bearer {user.onedrive_token["access_token"]}',
        'Content-Type': 'application/json'
    }
    
    # For small files (less than 4MB), we can use simple upload
    if len(file_content) < 4 * 1024 * 1024:
        logger.info(f"Using simple upload for small file: {file_name}")
        upload_url = f'https://graph.microsoft.com/v1.0/me/drive/root:/{file_name}:/content'
        headers = {
            'Authorization': f'Bearer {user.onedrive_token["access_token"]}',
            'Content-Type': 'application/octet-stream'
        }
        response = requests.put(upload_url, headers=headers, data=file_content)
        return response.json()
    
    # For larger files, create an upload session
    else:
        logger.info(f"Using session upload for large file: {file_name}")
        create_session_url = f'https://graph.microsoft.com/v1.0/me/drive/root:/{file_name}:/createUploadSession'
        session_response = requests.post(create_session_url, headers=headers)
        upload_session = session_response.json()
        
        # If we got an upload URL, use it to upload the file in chunks
        if 'uploadUrl' in upload_session:
            upload_url = upload_session['uploadUrl']
            total_size = len(file_content)
            chunk_size = 320 * 1024  # 320 KB chunks
            
            # Upload file in chunks
            for i in range(0, total_size, chunk_size):
                chunk = file_content[i:i + chunk_size]
                chunk_end = min(i + chunk_size - 1, total_size - 1)
                
                logger.info(f"Uploading chunk {i}-{chunk_end}/{total_size} for file: {file_name}")
                headers = {
                    'Content-Length': str(len(chunk)),
                    'Content-Range': f'bytes {i}-{chunk_end}/{total_size}'
                }
                
                response = requests.put(upload_url, headers=headers, data=chunk)
                
                # Final chunk will return the complete file metadata
                if i + chunk_size >= total_size:
                    logger.info(f"Upload completed for file: {file_name}")
                    return response.json()
        
        logger.error(f"Failed to create upload session for file: {file_name}")
        return jsonify({"error": "Failed to create upload session"}), 500

@app.route('/download/onedrive/<file_id>', methods=['GET'])
def download_onedrive(file_id):
    user = User.query.first()
    if not user or not user.onedrive_token:
        logger.warning("User not authenticated with OneDrive")
        return jsonify({"error": "User not authenticated with OneDrive"}), 401
    
    # Check if token needs refresh
    if 'expires_at' in user.onedrive_token and datetime.datetime.fromtimestamp(user.onedrive_token['expires_at']) < datetime.datetime.now():
        logger.info("Refreshing OneDrive token")
        token = onedrive.refresh_token(user.onedrive_token['refresh_token'])
        user.onedrive_token = token
        db.session.commit()
    
    headers = {'Authorization': f'Bearer {user.onedrive_token["access_token"]}'}
    
    # Get file metadata
    logger.info(f"Getting metadata for OneDrive file: {file_id}")
    metadata_response = requests.get(f'https://graph.microsoft.com/v1.0/me/drive/items/{file_id}', headers=headers)
    if metadata_response.status_code != 200:
        logger.error(f"File not found on OneDrive: {file_id}")
        return jsonify({"error": "File not found"}), 404
    
    file_name = metadata_response.json().get('name', 'downloaded_file')
    
    # Download file content
    logger.info(f"Downloading file from OneDrive: {file_name} ({file_id})")
    response = requests.get(f'https://graph.microsoft.com/v1.0/me/drive/items/{file_id}/content', headers=headers, stream=True)
    if response.status_code != 200:
        logger.error(f"Failed to download file from OneDrive: {file_id}")
        return jsonify({"error": "Failed to download file"}), 500
    
    return send_file(
        io.BytesIO(response.content),
        mimetype=response.headers.get('Content-Type', 'application/octet-stream'),
        as_attachment=True,
        download_name=file_name
    )

@app.route('/delete/onedrive/<file_id>', methods=['DELETE'])
def delete_onedrive(file_id):
    user = User.query.first()
    if not user or not user.onedrive_token:
        logger.warning("User not authenticated with OneDrive")
        return jsonify({"error": "User not authenticated with OneDrive"}), 401
    
    # Check if token needs refresh
    if 'expires_at' in user.onedrive_token and datetime.datetime.fromtimestamp(user.onedrive_token['expires_at']) < datetime.datetime.now():
        logger.info("Refreshing OneDrive token")
        token = onedrive.refresh_token(user.onedrive_token['refresh_token'])
        user.onedrive_token = token
        db.session.commit()
    
    headers = {'Authorization': f'Bearer {user.onedrive_token["access_token"]}'}
    logger.info(f"Deleting file from OneDrive: {file_id}")
    response = requests.delete(f'https://graph.microsoft.com/v1.0/me/drive/items/{file_id}', headers=headers)
    
    if response.status_code == 204:
        logger.info(f"Successfully deleted file from OneDrive: {file_id}")
        return jsonify({"success": True, "message": "File deleted successfully"})
    else:
        logger.error(f"Failed to delete file from OneDrive: {file_id}, status: {response.status_code}")
        return jsonify({"error": "Failed to delete file", "status": response.status_code}), response.status_code

@app.route('/logout', methods=['POST'])
def logout():
    logger.info("User logged out")
    session.clear()
    return jsonify({"success": True, "message": "Logged out successfully"})

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    logger.info("Starting Cloud File Manager API server")
    app.run(debug=True,host='0.0.0.0',port=5000)