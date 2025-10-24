from flask import Flask, render_template, jsonify, request, send_from_directory
import os

app = Flask(__name__)

# ...existing code...

@app.route('/static/data/world-countries.geojson')
def get_world_countries_geojson():
    geojson_path = os.path.join(app.root_path, 'static', 'data')
    return send_from_directory(geojson_path, 'world-countries.geojson')
import json
import random
import time

app = Flask(__name__)

# Global game state
game_state = {
    'countries': [],
    'current_country': None,
    'answered_countries': [],
    'start_time': None,
    'score': 0,
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
        code = props.get('ISO3166-1-Alpha-2') or props.get('ISO_A2') or props.get('iso_a2') or props.get('ISO2') or props.get('ISO') or props.get('code')
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
        if name and code:
            countries.append({'name': name, 'code': code, 'lat': lat, 'lng': lng})
        else:
            print(f"Skipping feature with missing name/code: {props}")
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
    game_state = {
        'countries': countries,
        'current_country': countries[0],
        'answered_countries': [],
        'start_time': time.time(),
        'score': 0,
        'total_countries': len(countries)
    }
    return jsonify({
        'success': True,
        'current_country': {
            'lat': game_state['current_country']['lat'],
            'lng': game_state['current_country']['lng'],
            'code': game_state['current_country']['code'],
            'name': game_state['current_country']['name']
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

    if not game_state['current_country']:
        return jsonify({'error': 'No active game'})

    correct_answer = game_state['current_country']['name'].lower()
    correct_answer_ascii = normalize_ascii(correct_answer)
    is_correct = (user_answer == correct_answer) or (user_answer_ascii == correct_answer_ascii)
    
    # Add current country to answered list
    game_state['answered_countries'].append(game_state['current_country'])
    
    if is_correct:
        game_state['score'] += 1
    
    # Get next country
    remaining_countries = [c for c in game_state['countries'] 
                          if c not in game_state['answered_countries']]
    
    if remaining_countries:
        game_state['current_country'] = remaining_countries[0]
        return jsonify({
            'correct': is_correct,
            'correct_answer': game_state['answered_countries'][-1]['name'],
            'next_country': {
                'lat': game_state['current_country']['lat'],
                'lng': game_state['current_country']['lng'],
                'code': game_state['current_country']['code']
            },
            'score': game_state['score'],
            'answered': len(game_state['answered_countries']),
            'total': game_state['total_countries']
        })
    else:
        # Game finished
        end_time = time.time()
        total_time = end_time - game_state['start_time']
        
        return jsonify({
            'correct': is_correct,
            'correct_answer': game_state['answered_countries'][-1]['name'],
            'game_finished': True,
            'final_score': game_state['score'],
            'total_countries': game_state['total_countries'],
            'total_time': round(total_time, 1)
        })

@app.route('/api/game_state')
def get_game_state():
    """Get current game state"""
    if not game_state['current_country']:
        return jsonify({'error': 'No active game'})
    
    return jsonify({
        'current_country': {
            'lat': game_state['current_country']['lat'],
            'lng': game_state['current_country']['lng'],
            'code': game_state['current_country']['code']
        },
        'score': game_state['score'],
        'answered': len(game_state['answered_countries']),
        'total': game_state['total_countries']
    })

if __name__ == '__main__':
    app.run(debug=True)