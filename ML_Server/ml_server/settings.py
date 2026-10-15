import os
from pathlib import Path

BASE_DIR=Path(__file__).resolve().parent.parent
# No Django admin/session/auth database is used in this stateless inference service.
SECRET_KEY=os.environ.get('DJANGO_SECRET_KEY','stateless-renal-service-no-session-cookies')
DEBUG=False
ALLOWED_HOSTS=[s.strip() for s in os.environ.get('RENAL_ML_ALLOWED_HOSTS','localhost,127.0.0.1').split(',') if s.strip()]
ROOT_URLCONF='ml_server.urls'
INSTALLED_APPS=[]
MIDDLEWARE=['django.middleware.security.SecurityMiddleware','renal_service.auth.ServiceJWTMiddleware']
WSGI_APPLICATION='ml_server.wsgi.application'
DATABASES={}
USE_TZ=True
TIME_ZONE='Asia/Colombo'
DATA_UPLOAD_MAX_MEMORY_SIZE=262144
SECURE_CONTENT_TYPE_NOSNIFF=True
X_FRAME_OPTIONS='DENY'
LOGGING={'version':1,'disable_existing_loggers':False,
         'handlers':{'console':{'class':'logging.StreamHandler'}},
         'root':{'handlers':['console'],'level':'WARNING'}}
