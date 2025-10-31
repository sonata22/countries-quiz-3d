console.log('game.js loaded');
class Game {
    constructor() {
        console.log('Game constructor called');
        this.currentCountry = null;
        this.score = 0;
        this.totalCountries = 0;
        this.answeredCountries = 0;
        this.startTime = null;
        this.timerInterval = null;
        this.isGameActive = false;
        this.remainingCountries = [];
        this.init();
    }

    init() {
        console.log('Game.init called');
        this.bindEvents();
        this.showScreen('start-screen');
    }

    bindEvents() {
        console.log('Game.bindEvents called');
        // Start game button
        document.getElementById('start-btn').addEventListener('click', () => {
            this.startGame();
        });

        // Submit answer button
        document.getElementById('submit-btn').addEventListener('click', () => {
            this.submitAnswer();
        });

        // Enter key to submit answer
        document.getElementById('country-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                if (this.isGameActive) {
                    const input = document.getElementById('country-input');
                    if (!input.value.trim()) {
                        // Skip country if input is empty
                        this.submitAnswer('');
                    } else {
                        this.submitAnswer();
                    }
                } else {
                    // If game is not active but we're showing feedback, continue to next question
                    if (!document.getElementById('feedback').classList.contains('hidden')) {
                        this.nextQuestion();
                    }
                }
            }
        });

        // Restart game button
        document.getElementById('restart-btn').addEventListener('click', () => {
            this.restartGame();
        });

        // Focus input when game screen is shown
        document.getElementById('country-input').addEventListener('focus', () => {
            globe.disableAutoRotate();
        });

        document.getElementById('country-input').addEventListener('blur', () => {
            if (!this.isGameActive) {
                globe.enableAutoRotate();
            }
        });
    }

    async startGame() {
        console.log('Start Quiz button clicked');
        try {
            this.showLoading(true);
            const response = await fetch('/api/start_game', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            console.log('Fetch /api/start_game response:', response);
            if (!response.ok) {
                console.error('Network error:', response.status, response.statusText);
                this.showFeedback('Network error: Unable to start quiz. Please check your connection and try again.', 'error');
                this.showLoading(false);
                return;
            }
            const data = await response.json();
            console.log('Response JSON from /api/start_game:', data);
            if (!data.success) {
                console.error('Backend error:', data.error || data);
                this.showFeedback('Backend error: Unable to start quiz. Please try again later.', 'error');
                this.showLoading(false);
                return;
            }
            if (!data.current_country) {
                console.error('No current_country in backend response!', data);
            } else {
                console.log('current_country:', data.current_country);
            }
            // Build the pool of all countries from geojson
            if (window.geojson) {
                this.remainingCountries = window.geojson.features.map(f => f.properties.name || f.properties['NAME']);
            } else {
                alert('GeoJSON not loaded!');
                return;
            }
            this.totalCountries = this.remainingCountries.length;
            this.score = 0;
            this.answeredCountries = 0;
            this.startTime = Date.now();
            this.isGameActive = true;
            this.updateUI();
            this.showScreen('game-screen');
            // Pick the first country
            this.nextCountry();
            this.startTimer();
        } catch (error) {
            console.error('Error starting game:', error);
            alert('Error starting game. Please try again.');
        } finally {
            this.showLoading(false);
        }
    }

    async submitAnswer(answerOverride) {
        if (!this.isGameActive) return;
        const input = document.getElementById('country-input');
        const answer = answerOverride !== undefined ? answerOverride : input.value.trim();
        if (!answer && answerOverride === undefined) {
            this.showFeedback('Please enter a country name!', 'error');
            return;
        }

        try {
            this.showLoading(true);
            this.isGameActive = false;
            const response = await fetch('/api/submit_answer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    answer: answer,
                    country: this.currentCountry // always send the country being guessed
                })
            });
            const data = await response.json();
            // Ignore backend's game_finished, always use frontend queue
            this.processAnswer(data);
        } catch (error) {
            console.error('Error submitting answer:', error);
            this.showFeedback('Error submitting answer. Please try again.', 'error');
            this.isGameActive = true;
        } finally {
            this.showLoading(false);
        }
    }

    processAnswer(data) {
        const input = document.getElementById('country-input');
        
        if (data.correct) {
            this.score = (this.score || 0) + 1;
            this.showFeedback(`✅ Correct! Well done!`, 'success');
            // Fill the guessed country area
            if (this.currentCountry && window.geojson) {
                let name = this.currentCountry;
                globe.fillCountryArea(name, window.geojson);
            }
        } else {
            // Debug log for mismatch
            console.warn('Wrong answer:', {
                highlightedCountry: this.currentCountry,
                backendCorrectAnswer: data.correct_answer,
                userAnswer: document.getElementById('country-input').value
            });
            this.showFeedback(`❌ Incorrect. The correct answer was: ${data.correct_answer}`, 'error');
            // Re-add the country to the end of the queue
            if (this.currentCountry) {
                this.remainingCountries.push(this.currentCountry);
            }
        }
        this.answeredCountries = this.totalCountries - this.remainingCountries.length;
        this.updateUI();
        // Clear input and prepare for next question
        input.value = '';
        // Show continue instruction
        const feedback = document.getElementById('feedback');
        feedback.innerHTML += '<br><em>Press Enter to continue...</em>';
        // Focus back on input for next question
        input.focus();
        // Move to next country if any left
        setTimeout(() => this.nextCountry(), 500);
    }

    nextCountry() {
        if (this.remainingCountries.length === 0) {
            this.endGame({
                correct: true,
                final_score: this.score,
                total_countries: this.totalCountries,
                total_time: (Date.now() - this.startTime) / 1000
            });
            return;
        }
        // Always pick the first country in the queue
        this.currentCountry = this.remainingCountries.shift();
        // Highlight on globe
        if (window.geojson) {
            this.highlightCountry({ name: this.currentCountry });
        }
    }

    nextQuestion() {
        if (this.currentCountry) {
            this.isGameActive = true;
            this.hideFeedback();
            this.highlightCountry({ name: this.currentCountry });
            document.getElementById('country-input').focus();
        }
    }

    endGame(data) {
        this.stopTimer();
        this.isGameActive = false;
        
        // Show final feedback for last answer
        const lastAnswerFeedback = data.correct ? 
            `✅ Correct! Final answer was right!` : 
            `❌ Incorrect. The correct answer was: ${data.correct_answer}`;
        
        this.showFeedback(lastAnswerFeedback, data.correct ? 'success' : 'error');
        
        // Calculate final stats
        const accuracy = Math.round((data.final_score / data.total_countries) * 100);
        
        // Update final results
        document.getElementById('final-score').textContent = `${data.final_score}/${data.total_countries}`;
        document.getElementById('final-time').textContent = this.formatTime(data.total_time);
        document.getElementById('accuracy').textContent = `${accuracy}%`;
        
        // Show result screen after a delay
        setTimeout(() => {
            this.showScreen('result-screen');
            globe.enableAutoRotate();
        }, 2000);
    }

    highlightCountry(currentCountry) {
    let name = currentCountry && (currentCountry.name || currentCountry.NAME || currentCountry.Admin || currentCountry.ADMIN || currentCountry.country || currentCountry.Country);
    console.log('highlightCountry called with:', currentCountry, name);
    if (currentCountry && window.geojson) {
        if (!name) {
            console.error('currentCountry.name is missing!', currentCountry);
        }
        globe.highlightCountry(name, window.geojson);
    } else {
        if (!window.geojson) {
            console.error('window.geojson is not loaded yet!');
        }
    }
    }

    updateUI() {
        document.getElementById('current-score').textContent = this.score;
        document.getElementById('total-countries').textContent = this.totalCountries;
        
        // Update progress indicator if exists
        const progress = this.totalCountries > 0 ? (this.answeredCountries / this.totalCountries) * 100 : 0;
        // Could add a progress bar here in the future
    }

    startTimer() {
        this.timerInterval = setInterval(() => {
            if (this.startTime) {
                const elapsed = (Date.now() - this.startTime) / 1000;
                document.getElementById('time-display').textContent = this.formatTime(elapsed);
            }
        }, 100);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    showFeedback(message, type) {
        const feedback = document.getElementById('feedback');
        feedback.innerHTML = message;
        feedback.className = `feedback-${type}`;
        feedback.classList.remove('hidden');
    }

    hideFeedback() {
        const feedback = document.getElementById('feedback');
        feedback.classList.add('hidden');
    }

    showScreen(screenId) {
        // Hide all screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.add('hidden');
        });
        
        // Show target screen
        document.getElementById(screenId).classList.remove('hidden');
    }

    showLoading(show) {
        const loading = document.getElementById('loading');
        if (show) {
            loading.classList.remove('hidden');
        } else {
            loading.classList.add('hidden');
        }
    }

    restartGame() {
        // Reset game state
        this.currentCountry = null;
        this.score = 0;
        this.totalCountries = 0;
        this.answeredCountries = 0;
        this.startTime = null;
        this.isGameActive = false;
        
        // Stop timer
        this.stopTimer();
        
        // Clear input and feedback
        document.getElementById('country-input').value = '';
        this.hideFeedback();
        
        // Remove any country highlighting
        globe.removeHighlight();
        
        // Show start screen
        this.showScreen('start-screen');
        
        // Re-enable auto rotate
        globe.enableAutoRotate();
    }
}

// Delay Game initialization until globe is ready
function fullyInitGame() {
    console.log('fullyInitGame called');
    if (!window.globe) {
        console.log('window.globe is not ready');
    } else if (typeof window.globe.disableAutoRotate !== 'function') {
        console.log('window.globe.disableAutoRotate is not a function');
    } else if (!document.getElementById('start-btn')) {
        console.log('start-btn is not in the DOM');
    }
    if (window.globe && typeof window.globe.disableAutoRotate === 'function' && document.getElementById('start-btn')) {
        console.log('Instantiating Game class...');
        window.game = new Game();
    } else {
        setTimeout(fullyInitGame, 50);
    }
}
document.addEventListener('DOMContentLoaded', fullyInitGame);

// Handle Enter key globally for continuing after wrong answers
document.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && game && !game.isGameActive) {
        const feedback = document.getElementById('feedback');
        if (!feedback.classList.contains('hidden') && game.currentCountry) {
            game.nextQuestion();
        }
    }
});