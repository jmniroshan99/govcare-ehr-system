import json
import logging
import os
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .inference import KEYS,InvalidInput,predict as infer,registry

logger=logging.getLogger(__name__)

def health(request):
    if request.method!='GET': return JsonResponse({'error':'METHOD_NOT_ALLOWED'},status=405)
    configured=len(os.environ.get('GOVCARE_RENAL_JWT_SECRET','').encode())>=32
    return JsonResponse({'status':'ready' if configured else 'degraded','service':'GovCare Sri Lankan renal research inference',
        'version':'1.0.0','authentication_configured':configured,'clinical_prediction_ready':False,
        'clinical_validation':'NOT_COMPLETED','dataset_permission_status':'UNVERIFIED'})

def models(request):
    if request.method!='GET': return JsonResponse({'error':'METHOD_NOT_ALLOWED'},status=405)
    return JsonResponse({'models':registry(),'clinical_validation':'NOT_COMPLETED'})

@csrf_exempt
def predict(request,model_key):
    if request.method!='POST': return JsonResponse({'error':'METHOD_NOT_ALLOWED'},status=405)
    if model_key not in KEYS: return JsonResponse({'error':'UNKNOWN_MODEL'},status=404)
    if request.content_type!='application/json': return JsonResponse({'error':'JSON_REQUIRED'},status=415)
    try:
        if len(request.body)>262144: return JsonResponse({'error':'INPUT_TOO_LARGE'},status=413)
        payload=json.loads(request.body,parse_constant=lambda _:(_ for _ in ()).throw(ValueError('Nonfinite JSON')))
        result=infer(model_key,payload)
        return JsonResponse(result,json_dumps_params={'allow_nan':False})
    except (json.JSONDecodeError,InvalidInput,ValueError):
        # Do not echo a submitted clinical body or raw exception into logs/errors.
        return JsonResponse({'error':'INVALID_CLINICAL_INPUT','message':'Use verified chronological measurements with explicit supported units and maintenance-hemodialysis context.'},status=422)
    except Exception:
        logger.warning('Renal artifact unavailable for model=%s',model_key)
        return JsonResponse({'error':'MODEL_UNAVAILABLE','model_key':model_key,'status':'NOT_AVAILABLE','requires_clinician_review':True},status=503)
