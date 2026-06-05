import json

with open('merchants_list_clean.json', 'r') as f:
    merchants = json.load(f)

suspicious = []
for m in merchants:
    name = m['name']
    if len(name) < 5 or any(k in name.lower() for k in ['test', 'dummy', 'junk', 'temp']):
        suspicious.append(m)

print(json.dumps(suspicious, indent=2))
