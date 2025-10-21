# 🌍 3D Countries Quiz

An interactive 3D geography quiz application that challenges users to identify countries on a rotating Earth globe with satellite imagery.

## Features

- **Interactive 3D Globe**: Rotatable Earth with realistic satellite imagery
- **Mouse Controls**: Click and drag to rotate, scroll to zoom
- **Country Highlighting**: Random countries are highlighted with pulsing animations
- **Real-time Quiz**: Type country names and get instant feedback
- **Scoring System**: Track correct answers and completion time
- **Responsive Design**: Works on desktop and mobile devices
- **Smooth Animations**: Globe automatically rotates to show highlighted countries

## Screenshots

The application features:
- A beautiful 3D Earth with satellite textures
- A sleek dark UI panel with game controls
- Real-time scoring and timer
- Animated country highlighting
- Final results with accuracy statistics

## Installation

1. **Clone the repository**:
   ```bash
   git clone <your-repo-url>
   cd countries-quiz-3d
   ```

2. **Create a virtual environment** (recommended):
   ```bash
   python -m venv venv
   venv\Scripts\activate  # On Windows
   # source venv/bin/activate  # On macOS/Linux
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

## Running the Application

1. **Start the Flask server**:
   ```bash
   python app.py
   ```

2. **Open your browser** and navigate to:
   ```
   http://localhost:5000
   ```

3. **Start playing**:
   - Click "Start Quiz" to begin
   - Look at the highlighted country on the globe
   - Type the country name in the input field
   - Press Enter or click Submit
   - Continue until all countries are completed!

## How to Play

1. **Globe Controls**:
   - 🖱️ **Click and drag** to rotate the globe
   - 🔍 **Scroll** to zoom in/out
   - The globe will automatically rotate to show highlighted countries

2. **Quiz Flow**:
   - A random country will be highlighted in red with a pulsing animation
   - Type the country name in the input field
   - Press **Enter** or click **Submit** to answer
   - Get instant feedback on correct/incorrect answers
   - For wrong answers, press **Enter** to continue to the next country

3. **Scoring**:
   - Track your score in real-time
   - Timer shows elapsed time
   - Final results show accuracy percentage and total time

## Technical Details

### Frontend
- **Three.js**: 3D globe rendering and WebGL graphics
- **Vanilla JavaScript**: Game logic and API communication
- **CSS3**: Modern styling with gradients and animations
- **Responsive Design**: Mobile-friendly interface

### Backend
- **Flask**: Lightweight Python web framework
- **RESTful API**: JSON endpoints for game state management
- **Session Management**: Server-side game state tracking

### Assets
- **NASA Earth Textures**: High-quality satellite imagery
- **Country Data**: Coordinate-based country positioning
- **Animations**: Smooth transitions and highlighting effects

## API Endpoints

- `POST /api/start_game` - Initialize a new quiz session
- `POST /api/submit_answer` - Submit user's answer for validation
- `GET /api/game_state` - Retrieve current game state

## Customization

### Adding More Countries
Edit the `load_countries()` function in `app.py` to add more countries with their coordinates:

```python
{'name': 'Country Name', 'code': 'CC', 'lat': latitude, 'lng': longitude}
```

### Styling
Modify `static/css/style.css` to customize the appearance:
- Colors and gradients
- Animation speeds
- UI layout and positioning

### Globe Settings
Adjust globe behavior in `static/js/globe.js`:
- Texture quality and loading
- Rotation speeds
- Highlighting effects
- Camera controls

## Browser Compatibility

- **Chrome/Edge**: Full support
- **Firefox**: Full support
- **Safari**: Full support
- **Mobile browsers**: Responsive design with touch controls

## Performance Notes

- The application loads high-quality Earth textures (~2-3MB)
- WebGL is required for 3D rendering
- Optimized for smooth 60fps animations
- Fallback textures for slower connections

## Future Enhancements

- [ ] More detailed country boundaries with GeoJSON
- [ ] Difficulty levels (capitals, flags, etc.)
- [ ] Multiplayer support
- [ ] Achievement system
- [ ] Custom quiz creation
- [ ] Audio feedback and music
- [ ] Offline mode support

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is open source and available under the [MIT License](LICENSE).

## Credits

- **Earth Textures**: NASA Blue Marble imagery
- **3D Engine**: Three.js library
- **Icons**: Unicode emoji icons
- **Inspiration**: Love for geography and interactive learning

---

Enjoy exploring the world! 🌍✨