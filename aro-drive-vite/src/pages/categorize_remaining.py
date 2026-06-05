import json

with open('/home/marco/.gemini/antigravity/brain/23fbf768-604a-4a6d-88c4-5435923b0c68/.system_generated/steps/696/output.txt', 'r') as f:
    data = json.load(f)

docs = data.get('documents', [])
total = len(docs)
unknown = 0
place_id_names = 0
valid = 0

categories = {}

for doc in docs:
    fields = doc.get('fields', {})
    name = fields.get('name', {}).get('stringValue', '')
    category = fields.get('category', {}).get('stringValue', 'Uncategorized')
    
    if name.lower() in ['', 'unknown', 'unnamed']:
        unknown += 1
    elif name.startswith('ChIJ'):
        place_id_names += 1
    else:
        valid += 1
    
    categories[category] = categories.get(category, 0) + 1

print(f"Total Remaining: {total}")
print(f"Empty/Unknown Name: {unknown}")
print(f"Name is Place ID: {place_id_names}")
print(f"Likely Valid: {valid}")
print("\nTop Categories:")
for cat, count in sorted(categories.items(), key=lambda x: x[1], reverse=True)[:10]:
    print(f"- {cat}: {count}")
