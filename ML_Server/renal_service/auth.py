import os
import time
import uuid
import jwt
from django.http import JsonResponse

ALLOWED_ROLES={'doctor','surgeon','anesthetist','super_admin'}
PUBLIC_PATHS={'/health/','/api/ml/health/'}

class ServiceJWTMiddleware:
    """Dedicated Spring-to-ML HS256 JWT; algorithm/audience/issuer are not client-selected."""
    def __init__(self,get_response): self.get_response=get_response

    def __call__(self,request):
        if request.path not in PUBLIC_PATHS:
            secret=os.environ.get('GOVCARE_RENAL_JWT_SECRET','')
            if len(secret.encode())<32:
                return JsonResponse({'error':'SERVICE_AUTHENTICATION_NOT_CONFIGURED'},status=503)
            bearer=request.headers.get('Authorization','')
            if not bearer.startswith('Bearer ') or len(bearer)>8192:
                return JsonResponse({'error':'AUTHENTICATION_REQUIRED'},status=401)
            try:
                claims=jwt.decode(bearer[7:],secret,algorithms=['HS256'],audience='govcare-renal-ml',issuer='govcare-spring',
                    options={'require':['exp','iat','nbf','sub','jti','role','hospital_id','patient_id','scopes']},leeway=2)
                for k in ('sub','hospital_id','patient_id','jti'): uuid.UUID(str(claims[k]))
                if any(isinstance(claims[k],bool) or not isinstance(claims[k],(int,float)) for k in ('exp','iat','nbf')):
                    raise ValueError('Invalid timestamp')
                if claims['exp']-claims['iat']>65 or claims['exp']<=claims['iat'] or claims['iat']>time.time()+2:
                    raise ValueError('Invalid service token lifetime')
                if str(claims['role']).lower() not in ALLOWED_ROLES or not isinstance(claims['scopes'],list) or 'renal:predict' not in claims['scopes']:
                    return JsonResponse({'error':'ROLE_OR_SCOPE_DENIED'},status=403)
                request.service_claims=claims
            except (jwt.PyJWTError,ValueError,TypeError,KeyError):
                return JsonResponse({'error':'INVALID_OR_EXPIRED_SERVICE_TOKEN'},status=401)
        response=self.get_response(request)
        response['Cache-Control']='no-store'
        return response
