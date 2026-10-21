from django.urls import path
from renal_service import views

urlpatterns=[
    path('health/',views.health),
    path('api/ml/health/',views.health),
    path('api/ml/models/',views.models),
    path('api/ml/outlook/readiness/',views.outlook_readiness),
    path('api/ml/predict/<str:model_key>/',views.predict),
]
