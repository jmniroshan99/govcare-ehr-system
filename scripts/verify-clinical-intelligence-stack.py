"""Native synthetic integration: fresh isolated PostgreSQL DB, Spring and Django.

Run with the system Python (psycopg/requests) after creating .venv-cdss312.
Credentials are read privately; only short-lived synthetic JWTs are generated.
The randomly named QA database is retained for inspection; existing DB is untouched.
"""
import base64,json,os,secrets,socket,subprocess,sys,time,uuid
from datetime import datetime,timedelta,timezone
from pathlib import Path
from urllib.parse import urlparse
import psycopg
from psycopg import sql
import requests

ROOT=Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT/'ML_Server/.venv/Lib/site-packages'))
import jwt
OUT=ROOT/'verification/clinical-intelligence-v2/native'

def uid():return str(uuid.uuid4())
def port(first):
    # Stable local development ranges avoid intermittent browser access to the
    # very low ephemeral ports assigned by this Windows environment.
    for candidate in range(first,first+50):
        try:
            with socket.socket() as s:s.bind(('127.0.0.1',candidate));return candidate
        except OSError:continue
    with socket.socket() as s:s.bind(('127.0.0.1',0));return s.getsockname()[1]
def main():
    OUT.mkdir(parents=True,exist_ok=True)
    settings=dict(line.split('=',1) for line in (ROOT/'spring-api/.env').read_text().splitlines() if '=' in line and not line.startswith('#'))
    url=urlparse(settings['DB_URL'].removeprefix('jdbc:'))
    if url.hostname not in {'localhost','127.0.0.1','::1'}:raise ValueError('Only a local PostgreSQL server is supported')
    connection={'host':url.hostname,'port':url.port or 5432,'user':settings['DB_USERNAME'],'password':settings['DB_PASSWORD']}
    database='govcare_cdss_qa_'+uuid.uuid4().hex[:10]
    with psycopg.connect(**connection,dbname='postgres',autocommit=True) as admin:
        admin.execute(sql.SQL('CREATE DATABASE {}').format(sql.Identifier(database)))
    print('Created isolated synthetic QA database',database,flush=True)
    db=psycopg.connect(**connection,dbname=database,autocommit=True)
    migrations=sorted((ROOT/'spring-api/src/main/resources/db/migration').glob('V*__*.sql'),key=lambda p:int(p.name.split('__')[0][1:]))
    for path in migrations:db.execute(path.read_text(encoding='utf-8'))
    hospital,other,doctor,nurse,ckd,hd,foreign=([uid() for _ in range(7)])
    db.execute("insert into hospitals(id,code,name) values(%s,'CDSS-SYNTHETIC','Synthetic CDSS QA'),(%s,'CDSS-OTHER','Other synthetic tenant')",(hospital,other))
    for actor,role in [(doctor,'doctor'),(nurse,'nurse')]:
        db.execute("insert into app_users(id,hospital_id,role,full_name,email,password_hash,credentials_version,must_change_password) values(%s,%s,%s,'SYNTHETIC SOFTWARE QA',%s,'NOT_A_REAL_PASSWORD',1,false)",(actor,hospital,role,actor+'@example.invalid'))
    for patient,h in [(ckd,hospital),(hd,hospital),(foreign,other)]:
        db.execute("insert into patients(id,hospital_id,patient_no,full_name,date_of_birth,gender) values(%s,%s,%s,'SYNTHETIC SOFTWARE QA - NOT A CLINICAL SUBJECT','1961-02-01','male')",(patient,h,'SYNTH-'+patient[:8]))
        if h==hospital:db.execute("insert into visits(hospital_id,patient_id,doctor_id,visit_no,visit_type) values(%s,%s,%s,%s,'outpatient')",(h,patient,doctor,'SYNTH-'+patient[:8]))
    api_port,ml_port,frontend_port=port(4402),port(8401),port(5305);secret=secrets.token_bytes(48);ml_secret=secrets.token_hex(32)
    env={**os.environ,**settings,'PORT':str(api_port),'SERVER_PORT':str(api_port),
         'DB_URL':f'jdbc:postgresql://{url.hostname}:{url.port or 5432}/{database}',
         'JWT_SECRET':base64.b64encode(secret).decode(),'GOVCARE_RENAL_JWT_SECRET':ml_secret,
         'GOVCARE_RENAL_ML_URL':f'http://127.0.0.1:{ml_port}','FLYWAY_ENABLED':'false',
         'CORS_ORIGIN':f'http://127.0.0.1:{frontend_port}',
         'LOG_FILE':str(OUT/'spring-runtime.log'),'STORAGE_ROOT':str(OUT/'storage')}
    children=[];handles=[];result={'database':database,'scope':'Synthetic software QA only; native PostgreSQL; existing database untouched','migrations':len(migrations),'checks':[]}
    try:
        for name,args,cwd in [('django',[str(ROOT/'.venv-cdss312/Scripts/python.exe'),'-u','manage.py','runserver',f'127.0.0.1:{ml_port}','--noreload'],ROOT/'ML_Server'),
                              ('spring',['cmd.exe','/d','/c','mvn.cmd','-B','spring-boot:run'],ROOT/'spring-api')]:
            stream=(OUT/(name+'.log')).open('w');handles.append(stream)
            children.append(subprocess.Popen(args,cwd=cwd,env=env,stdout=stream,stderr=subprocess.STDOUT,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0)))
        for origin,path in [(f'http://127.0.0.1:{ml_port}','/health/'),(f'http://127.0.0.1:{api_port}','/actuator/health')]:
            for _ in range(180):
                try:
                    if requests.get(origin+path,timeout=2).status_code==200:break
                except requests.RequestException:pass
                if any(p.poll() is not None for p in children):raise RuntimeError('A QA service exited; inspect retained logs')
                time.sleep(1)
            else:raise RuntimeError('QA service startup timeout')
        origin=f'http://127.0.0.1:{api_port}'
        token=lambda user:jwt.encode({'sub':user,'iat':int(time.time()),'exp':int(time.time())+1800,'credentialsVersion':1},secret,algorithm='HS384')
        doctor_token=token(doctor)
        def call(path,body=None,expected=200,bearer=doctor_token):
            r=requests.request('POST' if body is not None else 'GET',origin+path,json=body,headers={'Authorization':'Bearer '+bearer} if bearer else {},timeout=45)
            if r.status_code!=expected:raise AssertionError(f'{path}: {r.status_code} {r.text[:400]}')
            return r.json() if 'json' in r.headers.get('Content-Type','') else r
        base=lambda patient:f'/api/ai-cdss/ckd/patients/{patient}'
        call(base(ckd)+'/outlook',expected=401,bearer='')
        call(base(ckd)+'/outlook',expected=403,bearer=token(nurse))
        call(base(foreign)+'/outlook',expected=404)
        result['checks'].append('Unauthenticated, nurse and cross-hospital requests denied')
        now=datetime.now(timezone.utc)
        # Create the report's parent assessment first, with explicit dated sources.
        # Later creating an undated assessment would correctly invalidate a saved outlook.
        features={'Age':65,'BMI':26,'SystolicBP':138,'DiastolicBP':86,'FastingBloodSugar':112,'HbA1c':6.4,'SerumCreatinine':2.5,'BUNLevels':42,'GFR':25,'ProteinInUrine':120,'ACR':300,'SerumElectrolytesPotassium':5.1,'HemoglobinLevels':10.8,'Edema':1,'FamilyHistoryKidneyDisease':0,'PreviousAcuteKidneyInjury':0,'NSAIDsUse':0}
        sources={key:{'source':'MANUAL','clinicalDate':(now-timedelta(days=2)).isoformat()} for key in features}
        assessment=call('/api/ai-cdss/ckd/predict',{'patientId':ckd,'requestId':uid(),'features':features,'sources':sources})
        for metric,value,unit in [('egfr',25,'mL/min/1.73m2'),('acr',300,'mg/g')]:
            call(base(ckd)+'/observations',{'requestId':uid(),'metric':metric,'value':value,'unit':unit,
                'observedAt':(now-timedelta(days=1)).isoformat(),'sourceNote':'SYNTHETIC SOFTWARE TEST SOURCE','sourceVerified':True})
        ready=call(base(ckd)+'/outlook');assert ready['readiness']['learnedModel']['probability'] is None
        (OUT/'synthetic-ready.json').write_text(json.dumps(ready,indent=2))
        reloaded=call(base(ckd)+'/outlook')
        (OUT/'synthetic-reloaded.json').write_text(json.dumps(reloaded,indent=2))
        if ready['evidence']['fingerprint']!=reloaded['evidence']['fingerprint']:
            changed={k:[v,reloaded['evidence'].get(k)] for k,v in ready['evidence'].items() if v!=reloaded['evidence'].get(k) and k not in ['history','monitoring','excludedData']}
            print('Synthetic evidence changed:',json.dumps(changed),flush=True)
        input={'requestId':uid(),'evidenceFingerprint':ready['evidence']['fingerprint'],'sexForEquation':'MALE','confirmedChronicCkd':True,
            'noKidneyReplacementTherapy':True,'clinicallyStable':True,'sourceNote':'SYNTHETIC VERIFIED SOFTWARE FIXTURE'}
        snapshot=call(base(ckd)+'/outlook/assessments',input);assert snapshot['status']=='AVAILABLE'
        assert call(base(ckd)+'/outlook/assessments',input)['id']==snapshot['id']
        assert call(base(ckd)+'/outlook')['assessment']['fiveYearRisk']==snapshot['fiveYearRisk']
        call(base(ckd)+'/outlook/reviews',{'snapshotId':snapshot['id'],'requestId':uid(),'expectedVersion':0,'action':'ACCEPT',
            'reason':'SYNTHETIC QA REVIEW','note':'Software test only','modifiedInterpretation':'','milestones':[{'year':1,'title':'Synthetic review milestone'}]})
        assert call(base(ckd)+'/outlook')['assessment']['reviewVersion']==1
        result['checks'].append('KFRE calculation, idempotency, PostgreSQL persistence/reload, review and milestone')
        call(base(hd)+'/renal-intelligence/dialysis-status',{'requestId':uid(),'status':'MAINTENANCE_HD','verifiedAt':(now-timedelta(days=1)).isoformat(),'sourceNote':'SYNTHETIC HD CONTEXT','sourceVerified':True})
        for days,hb in [(35,10.2),(1,10.5)]:
            measurements={'hb':hb,'albumin':36,'calcium':2.2,'sodium':138,'potassium_pre':5.1,'potassium_post':3.4,'creatinine_pre':800,'creatinine_post':300,'urea_pre':20,'urea_post':7}
            units={k:'mmol/L' for k in measurements};units.update(hb='g/dL',albumin='g/L',creatinine_pre='umol/L',creatinine_post='umol/L')
            call(base(hd)+'/renal-intelligence/observations',{'requestId':uid(),'observedAt':(now-timedelta(days=days)).isoformat(),
                'maintenanceHemodialysisVerified':True,'measurements':measurements,'units':units,'sourceNote':'SYNTHETIC LAB FIXTURE','sourceVerified':True,'samplingContext':{'sessionId':'SYNTHETIC-HD-'+str(days),'preCollectedAt':(now-timedelta(days=days,hours=4)).isoformat(),'postCollectedAt':(now-timedelta(days=days)).isoformat(),'regimen':'IN_CENTRE_HD_THREE_TIMES_WEEKLY'}})
        for model in ['hb','urr','hyperkalemia']:
            prediction=call(base(hd)+'/renal-intelligence/predict',{'requestId':uid(),'modelKey':model})
            assert prediction.get('status')=='AVAILABLE',prediction
        hd_outlook=call(base(hd)+'/outlook');assert hd_outlook['readiness']['fiveYearRisk'] is None
        result['checks'].append('Spring to dedicated-JWT Django inference and persisted Hb/URR/hyperkalemia responses; HD excluded from first-KRT outlook')
        # Existing report workflow requires its parent CKD assessment.
        report=call(f'/api/ai-cdss/ckd/assessments/{assessment["predictionId"]}/report',{})
        pdf=call(f'/api/ai-cdss/ckd/assessments/reports/{report["id"]}/download')
        assert pdf.content.startswith(b'%PDF-');(OUT/'synthetic-outlook.pdf').write_bytes(pdf.content)
        # Check the saved clinical screen contract against its selected report and database resources.
        modules=call(base(hd)+'/predictive-intelligence')
        assert modules['schemaVersion']==4
        assert abs(modules['dialysisAdequacy']['clinicalAssessment']['currentValue']-65)<1e-8
        assert modules['clinicalRulesVersion']=='GOVCARE-CLINICAL-RULES-2.0'
        review={'snapshotId':modules['snapshotId'],'requestId':uid(),'moduleKey':'dialysisAdequacy','expectedVersion':0,'action':'ACCEPT','reason':'SYNTHETIC SOFTWARE QA','note':'Source reviewed in synthetic test','modifiedInterpretation':''}
        call(base(hd)+'/predictive-intelligence/reviews',review)
        call(base(hd)+'/predictive-intelligence/reviews',review)
        assert call(base(hd)+'/predictive-intelligence')['dialysisAdequacy']['moduleReviewVersion']==1
        result['checks'].append('V48 same-session metadata, measured URR, saved v4 contracts and idempotent append-only review')
        # Screenshot case, undated potassium 2.0. It must survive unavailable ML.
        bad_features={**features,'SerumElectrolytesPotassium':2.0,'HemoglobinLevels':13.8,'GFR':72,'ACR':55,'SerumCreatinine':1.4}
        screenshot=call('/api/ai-cdss/ckd/predict',{'patientId':ckd,'requestId':uid(),'features':bad_features})
        clinical=call(base(ckd)+'/predictive-intelligence')
        k=clinical['hyperkalemia']['clinicalAssessment']
        assert k['currentValue']==2 and k['clinicalSignal']['code']=='SEVERE_HYPOKALEMIA'
        assert k['coverage']['label']=='1 of 1 listed inputs recorded'
        assert k['prediction']['eventProbability'] is None and not k['prediction']['ready']
        assert k['evidenceQuality']['status']=='SOURCE_REVIEW_REQUIRED'
        selected=call(f'/api/ai-cdss/ckd/assessments/{screenshot["predictionId"]}/report',{'clinicalSnapshotId':clinical['snapshotId']})
        selected_pdf=call(f'/api/ai-cdss/ckd/assessments/reports/{selected["id"]}/download')
        assert selected_pdf.content.startswith(b'%PDF-')
        (OUT/'synthetic-selected-screen.pdf').write_bytes(selected_pdf.content)
        (OUT/'synthetic-screen-contract.json').write_text(json.dumps(clinical,indent=2))
        result['checks'].append('Native API screenshot regression: undated potassium 2.0 retained as severe low; inference withheld; selected saved snapshot exported as PDF')
        fhir_rows=db.execute("select resource_type,json_data::text from fhir_resource where patient_id=%s and resource_type in ('RiskAssessment','ClinicalImpression')",(hd,)).fetchall()
        assert fhir_rows
        for resource_type,body in fhir_rows:
            assert 'probabilityDecimal' not in body and 'probabilityRange' not in body
        assert any(t=='ClinicalImpression' and 'renal-predicted-value' in body for t,body in fhir_rows)
        assert any(t=='RiskAssessment' and 'renal-research-score' in body for t,body in fhir_rows)
        result['checks'].append('Native persisted FHIR: continuous forecasts in ClinicalImpression; research score extension only; no unsupported event probability')
        assert db.execute('select count(*) from ckd_outlook_snapshots where patient_id=%s',(ckd,)).fetchone()[0]>=1
        assert db.execute('select count(*) from predictive_audit_events where patient_id in (%s,%s)',(ckd,hd)).fetchone()[0]>0
        assert db.execute('select count(*) from predictive_prediction_snapshots where patient_id=%s',(hd,)).fetchone()[0]>=3
        result.update(status='passed',five_year_risk=snapshot['fiveYearRisk'],clinical_validation='NOT_COMPLETED')
        print(json.dumps(result,indent=2),flush=True)
    except Exception as exc:
        result.update(status='failed',reason=str(exc));raise
    finally:
        (OUT/'report.json').write_text(json.dumps(result,indent=2))
        for child in children:
            # Terminate only processes spawned by this verifier and their descendants.
            import psutil
            try:
                process=psutil.Process(child.pid)
                for descendant in process.children(recursive=True):descendant.terminate()
                process.terminate()
            except psutil.NoSuchProcess:pass
        for handle in handles:handle.close()
        (ROOT/'.venv-cdss312/live-context.json').unlink(missing_ok=True)
        db.close()

if __name__=='__main__':main()
