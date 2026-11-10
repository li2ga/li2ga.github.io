"""Cache only the original site's already-public aggregate endpoints; no credentials."""
from pathlib import Path
from datetime import datetime,timezone
import argparse,json,re,urllib.request,xml.etree.ElementTree as ET

ORIGIN='https://jia-li-website-analytics.yrweexnfqa.chatgpt.site'
ROOT=Path(__file__).resolve().parents[1]
def nonnegative(value):return type(value) is int and 0<=value<=2**53-1
def validate_summary(data):
    if not isinstance(data,dict) or set(data)!={'pageviews','visitors','countries','days'}:raise ValueError('Unexpected aggregate schema')
    if not all(nonnegative(data[k]) for k in ['pageviews','visitors']):raise ValueError('Invalid totals')
    if not isinstance(data['countries'],list) or len(data['countries'])>300:raise ValueError('Invalid countries')
    if not isinstance(data['days'],list) or len(data['days'])>40:raise ValueError('Invalid daily totals')
    for r in data['countries']:
        if not isinstance(r,dict) or set(r)!={'country','views'} or not re.fullmatch('[A-Z]{2}',str(r['country'])) or not nonnegative(r['views']):raise ValueError('Invalid country aggregate')
    for r in data['days']:
        if not isinstance(r,dict) or set(r)!={'day','views'} or not re.fullmatch(r'\d{4}-\d{2}-\d{2}',str(r['day'])) or not nonnegative(r['views']):raise ValueError('Invalid day aggregate')
    return data
def validate_svg(raw):
    if len(raw)>500000 or b'<!' in raw:raise ValueError('Unexpected SVG document')
    root=ET.fromstring(raw)
    if root.tag.split('}')[-1]!='svg':raise ValueError('Not an SVG map')
    for el in root.iter():
        if el.tag.split('}')[-1] in {'script','foreignObject','image','use','a'}:raise ValueError('Unexpected active SVG element')
        for key,value in el.attrib.items():
            if key.lower().startswith('on') or 'href' in key.lower() or re.search(r'url\(|https?://|javascript:',value,re.I):raise ValueError('Unexpected SVG attribute')
    return raw
def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--proxy');p.add_argument('--output',type=Path,default=ROOT/'assets/analytics');args=p.parse_args()
    opener=urllib.request.build_opener(urllib.request.ProxyHandler({'https':args.proxy}) if args.proxy else urllib.request.ProxyHandler())
    def read(path,kind,limit):
        req=urllib.request.Request(ORIGIN+path,headers={'User-Agent':'Jia-Li-Public-Stats/1.0','Origin':'https://li2ga.github.io','Accept':kind})
        with opener.open(req,timeout=25) as response:
            raw=response.read(limit+1)
            if len(raw)>limit or kind not in response.headers.get('content-type',''):raise ValueError('Unexpected public endpoint response')
            return raw
    data=validate_summary(json.loads(read('/api/summary','application/json',100000)))
    svg=validate_svg(read('/map.svg','image/svg+xml',500000))
    snapshot={'generated_at':datetime.now(timezone.utc).isoformat(),'source':ORIGIN,'data':data}
    args.output.mkdir(parents=True,exist_ok=True)
    for name,raw in [('summary.json',(json.dumps(snapshot,ensure_ascii=False,indent=2)+'\n').encode()),('visitor-map.svg',svg)]:
        temporary=args.output/(name+'.tmp');temporary.write_bytes(raw);temporary.replace(args.output/name)
    print(json.dumps({'updated':True,'generated_at':snapshot['generated_at'],'public_aggregates_only':True}))
if __name__=='__main__':main()
