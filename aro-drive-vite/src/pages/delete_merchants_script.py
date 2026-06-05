import json
import requests
import sys

# Since I cannot use MCP tools directly from python, I will generate a series of shell commands
# that call the `firestore_delete_document` tool if I could, but I can't.
# Instead, I will use this script to simply output the commands for me to run in batches.

with open('remaining_ids.txt', 'r') as f:
    ids = [line.strip() for line in f if line.strip()]

# Let's say we delete IDs 31 to 100
batch_ids = ids[30:100]
project_id = "gb-delivery-41bf6"

for doc_id in batch_ids:
    print(f"projects/{project_id}/databases/(default)/documents/merchants/{doc_id}")
