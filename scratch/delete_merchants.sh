#!/bin/bash
PROJECT_ID="gb-delivery-41bf6"
IDS_FILE="outside_blitar_ids.txt"

echo "Starting deletion of merchants outside Blitar from Firestore..."

while read -r doc_id; do
    echo "Deleting: $doc_id"
    firebase firestore:delete "merchants/$doc_id" --project "$PROJECT_ID" -f
done < "$IDS_FILE"

echo "Done!"
