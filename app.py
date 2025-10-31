from flask import Flask, render_template, jsonify, request, send_from_directory
import os

app = Flask(__name__)


@app.route('/static/data/world-countries.geojson')
def get_world_countries_geojson():
    geojson_path = os.path.join(app.root_path, 'static', 'data')
    return send_from_directory(geojson_path, 'world-countries.geojson')
import json
import random
import time

app = Flask(__name__)

game_state = {
    'countries': [],
    'total_countries': 0
}

def load_countries():
    """Load country data from world-countries.geojson, using centroid for lat/lng"""
    geojson_path = os.path.join(app.root_path, 'static', 'data', 'world-countries.geojson')
    with open(geojson_path, encoding='utf-8') as f:
        data = json.load(f)
    countries = []
    for feature in data['features']:
        props = feature['properties']
        name = props.get('name') or props.get('ADMIN') or props.get('NAME') or props.get('Country') or props.get('country')
        # Calculate geometric centroid using shapely
        geometry = feature['geometry']
        try:
            from shapely.geometry import shape
            geom = shape(geometry)
            centroid = geom.centroid
            lat = centroid.y
            lng = centroid.x
        except Exception as e:
            # Fallback to average if shapely fails
            coords = geometry['coordinates']
            def flatten_coords(coords):
                if isinstance(coords[0][0], (float, int)):
                    return coords
                else:
                    result = []
                    for part in coords:
                        result.extend(flatten_coords(part))
                    return result
            flat = flatten_coords(coords)
            lats = [pt[1] for pt in flat]
            lngs = [pt[0] for pt in flat]
            if lats and lngs:
                lat = sum(lats) / len(lats)
                lng = sum(lngs) / len(lngs)
            else:
                lat = 0
                lng = 0
        if name:
            countries.append({'name': name, 'lat': lat, 'lng': lng})
        else:
            print(f"Skipping feature with missing name: {props}")
    if not countries:
        print("No valid countries found in GeoJSON!")
    else:
        print(f"Loaded {len(countries)} countries. Example: {countries[:3]}")
    return countries

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/start_game', methods=['POST'])
def start_game():
    """Initialize a new game"""
    global game_state
    
    countries = load_countries()
    random.shuffle(countries)
    
    if not countries:
        return jsonify({'success': False, 'error': 'No valid countries found in GeoJSON.'}), 500
    game_state['countries'] = countries
    game_state['total_countries'] = len(countries)
    # Pick a random country to start (for UI, but backend is stateless)
    first_country = countries[0]
    return jsonify({
        'success': True,
        'current_country': {
            'lat': first_country['lat'],
            'lng': first_country['lng'],
            'name': first_country['name']
        },
        'total_countries': game_state['total_countries']
    })

@app.route('/api/submit_answer', methods=['POST'])
def submit_answer():
    """Process user's answer"""
    global game_state
    
    data = request.json
    import unicodedata
    def normalize_ascii(s):
        # Remove accents/diacritics and convert to closest ASCII
        return ''.join(c for c in unicodedata.normalize('NFKD', s) if ord(c) < 128).lower()

    user_answer = data.get('answer', '').strip().lower()
    user_answer_ascii = normalize_ascii(user_answer)
    country = data.get('country')
    if not country:
        return jsonify({'error': 'No country provided'})
    # Find canonical country name from loaded countries
    canonical_country = next((c for c in game_state['countries'] if c['name'] == country), None)
    if not canonical_country:
        return jsonify({'error': 'Country not found'})
    correct_answer = canonical_country['name']
    correct_answer_ascii = normalize_ascii(correct_answer)
    is_correct = (user_answer == correct_answer.lower()) or (user_answer_ascii == correct_answer_ascii)
    # Stateless: just return result for this country
    return jsonify({
        'correct': is_correct,
        'correct_answer': correct_answer
    })

@app.route('/api/game_state')
def get_game_state():
    """Get current game state"""
    if not game_state['countries']:
        return jsonify({'error': 'No active game'})
    # For compatibility, just return the first country and total
    first_country = game_state['countries'][0]
    return jsonify({
        'current_country': {
            'lat': first_country['lat'],
            'lng': first_country['lng'],
            'name': first_country['name']
        },
        'total': game_state['total_countries']
    })

if __name__ == '__main__':
    app.run(debug=True)