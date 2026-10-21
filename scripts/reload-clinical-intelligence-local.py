"""Reload only this workspace's existing renal-stack process tree; never log its environment."""
import json,os,subprocess,time
from datetime import datetime,timezone
from pathlib import Path
import psutil,requests

root=Path(__file__).resolve().parents[1]
def owner(port):
    matches={c.pid for c in psutil.net_connections(kind='tcp') if c.status=='LISTEN' and c.laddr.port==port}
    if len(matches)!=1:raise RuntimeError('Expected one existing local listener on port '+str(port))
    return psutil.Process(matches.pop())

api,frontend=owner(4002),owner(5300)
launchers=[]
for process in [api,*api.parents()]:
    if process.name().lower()=='node.exe' and any('run-renal-stack.cjs' in arg for arg in process.cmdline()) and Path(process.cwd()).resolve()==root:
        launchers.append(process)
if len(launchers)!=1:raise RuntimeError('Existing workspace renal-stack launcher could not be uniquely verified')
launcher=launchers[0];children=launcher.children(recursive=True)
if not {api.pid,frontend.pid}.issubset({p.pid for p in children}):raise RuntimeError('API/frontend ownership disagrees')
environment=launcher.environ();executable=launcher.exe()
environment.update(GOVCARE_FRONTEND_PORT='5300',GOVCARE_API_PORT='4002',VITE_API_BASE_URL='http://127.0.0.1:4002',GOVCARE_RENAL_ML_PORT='8001',GOVCARE_RENAL_ML_URL='http://127.0.0.1:8001',BROWSER='none')
compatible=root/'.venv-cdss312/Scripts/python.exe'
if not compatible.is_file():raise RuntimeError('The verified Python 3.12 environment is missing')
environment['GOVCARE_RENAL_PYTHON']=str(compatible)
old={'launcher':launcher.pid,'api':api.pid,'frontend':frontend.pid}
for process in [*reversed(children),launcher]:
    try:process.terminate()
    except psutil.NoSuchProcess:pass
_,alive=psutil.wait_procs([*children,launcher],timeout=5)
for process in alive:
    try:process.kill()
    except psutil.NoSuchProcess:pass
logs=root/'logs';logs.mkdir(exist_ok=True)
startup=subprocess.STARTUPINFO();startup.dwFlags|=subprocess.STARTF_USESHOWWINDOW;startup.wShowWindow=subprocess.SW_HIDE
with (logs/'clinical-intelligence-runtime.out.log').open('a') as stdout,(logs/'clinical-intelligence-runtime.err.log').open('a') as stderr:
    started=subprocess.Popen([executable,str(root/'scripts/run-renal-stack.cjs')],cwd=root,env=environment,stdin=subprocess.DEVNULL,stdout=stdout,stderr=stderr,startupinfo=startup,creationflags=subprocess.DETACHED_PROCESS|subprocess.CREATE_NEW_PROCESS_GROUP)
health={}
for attempt in range(70):
    for name,url in {'frontend':'http://127.0.0.1:5300/ai-cdss/ckd','api':'http://127.0.0.1:4002/health','ml':'http://127.0.0.1:8001/health/'}.items():
        try:health[name]=requests.get(url,timeout=2).status_code
        except requests.RequestException:health[name]=None
    if all(code==200 for code in health.values()):break
    time.sleep(2)
version='GOVCARE-CLINICAL-RULES-2.0'
compiled=(root/'spring-api/target/classes/lk/gov/health/govcare/ai/ClinicalRuleRegistry.class').read_bytes()
result={'checkedAt':datetime.now(timezone.utc).isoformat(),'scope':'Reloaded the verified existing workspace stack only; no environment values retained','previous':old,'launcher':started.pid,'health':health,'rulesVersion':version,'compiledRulesPresent':version.encode() in compiled,'status':'passed' if all(code==200 for code in health.values()) and version.encode() in compiled else 'failed'}
try:
    ml=owner(8001);result['mlPython']=ml.cmdline()[0]
    # Windows venv launchers can spawn the base interpreter; verify the owned launcher ancestry too.
    result['verifiedPython312Selected']=any(p.cmdline() and '.venv-cdss312' in p.cmdline()[0] for p in [ml,*ml.parents()])
except Exception:
    result['verifiedPython312Selected']=False
# Read only the migration version from the configured local database; no credentials are emitted.
try:
    import psycopg
    from urllib.parse import urlparse
    settings=dict(line.split('=',1) for line in (root/'spring-api/.env').read_text().splitlines() if '=' in line and not line.startswith('#'))
    parsed=urlparse(settings['DB_URL'].removeprefix('jdbc:'))
    if parsed.hostname not in {'127.0.0.1','localhost','::1'}:raise ValueError('Not a local database')
    with psycopg.connect(host=parsed.hostname,port=parsed.port or 5432,dbname=parsed.path.lstrip('/'),user=settings['DB_USERNAME'],password=settings['DB_PASSWORD']) as connection:
        row=connection.execute("select version,success from flyway_schema_history where version='48'").fetchone()
        result['migrationV48Applied']=bool(row and row[1])
except Exception:
    result['migrationV48Applied']='NOT_VERIFIED'
destination=root/'verification/clinical-intelligence-v2/runtime.json';destination.write_text(json.dumps(result,indent=2))
print(json.dumps(result,indent=2))
if result['status']!='passed':raise SystemExit(1)
