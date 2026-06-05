import json

with open('/home/marco/.gemini/antigravity/brain/23fbf768-604a-4a6d-88c4-5435923b0c68/.system_generated/steps/256/output.txt', 'r') as f:
    data = json.load(f)

merchants = []
for doc in data.get('documents', []):
    fields = doc.get('fields', {})
    name = fields.get('name', {}).get('stringValue', 'Unknown')
    address = fields.get('address', {}).get('stringValue', 'Unknown')
    doc_path = doc.get('name')
    doc_id = doc_path.split('/')[-1]
    merchants.append({
        'id': doc_id,
        'name': name,
        'address': address
    })

print(json.dumps(merchants, indent=2))
