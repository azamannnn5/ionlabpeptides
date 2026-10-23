import os, zipfile, sys
root='site'; out='dist'; os.makedirs(out,exist_ok=True)
for f in os.listdir(out): os.remove(os.path.join(out,f))
LIMIT=28*1024*1024
files=[]
for d,_,fs in os.walk(root):
    for f in fs:
        p=os.path.join(d,f); files.append(p)
rel=lambda p: os.path.relpath(p,root)
def kind(p):
    r=rel(p)
    if r.startswith('assets/uploads/') and r.lower().endswith(('.jpg','.jpeg','.png','.webp','.gif','.pdf','.svg')):
        return 'product-images' if '/uploads/' in r and any(s in r for s in ('/2025/','/2026/07','/2026/06','/2026/05')) and False else 'images'
    return 'code'
code=[p for p in files if kind(p)=='code']
imgs=sorted([p for p in files if kind(p)!='code'])
def write_zip(name, plist):
    with zipfile.ZipFile(os.path.join(out,name),'w',zipfile.ZIP_DEFLATED) as z:
        for p in plist: z.write(p, rel(p))
write_zip('ionpeptide-1-code.zip', code)
# product images are the ones referenced by product pages/cards: names from catalog
import json,re
cat=json.load(open(os.path.join(root,'data/catalog.json')))
prod=set()
for c in cat:
    for i in c['images']: prod.add(i['src'])
pi=[p for p in imgs if rel(p) in prod]
oi=[p for p in imgs if rel(p) not in prod]
def split(name, plist):
    part=1; cur=[]; size=0
    for p in plist:
        s=os.path.getsize(p)
        if cur and size+s>LIMIT:
            write_zip(f'{name}-{part}.zip',cur); part+=1; cur=[]; size=0
        cur.append(p); size+=s
    if cur: write_zip(f'{name}-{part}.zip',cur)
split('ionpeptide-2-product-images', pi)
split('ionpeptide-3-other-images', oi)
for f in sorted(os.listdir(out)): print(f, round(os.path.getsize(os.path.join(out,f))/1048576,1),'MB')
