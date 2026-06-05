import requests

API_KEY = "AIzaSyB2urHuowq3a4qzjtRQL1yHlibCNGOX2LU"

def check_place_status(place_id):
    url = f"https://maps.googleapis.com/maps/api/place/details/json?place_id={place_id}&fields=business_status,name&key={API_KEY}"
    try:
        response = requests.get(url).json()
        if response.get('result'):
            result = response['result']
            return result.get('business_status'), result.get('name')
        return 'NOT_FOUND', None
    except Exception as e:
        return f'ERROR: {str(e)}', None

print(check_place_status("ChIJGbZvnbrreC4R86uekrmRMkM"))
