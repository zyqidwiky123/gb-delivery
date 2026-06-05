import json
import sys

filepath = sys.argv[1]
with open(filepath, 'r') as f:
    data = json.load(f)

docs = data.get('documents', [])
ids = [doc['name'] for doc in docs]

with open('all_purge_ids.txt', 'a') as f:
    for doc_id in ids:
        f.write(doc_id + '\n')

token = data.get('nextPageToken', '')
print(f"EXTRACTED:{len(ids)}")
print(f"TOKEN:{token}")
