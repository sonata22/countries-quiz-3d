class Game {
    constructor() {
        this.currentCountry = null;
        this.score = 0;
        this.totalCountries = 0;
        this.answeredCountries = 0;
        this.startTime = null;
        this.timerInterval = null;
        this.isGameActive = false;
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.showScreen('start-screen');
    }

    bindEvents() {
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
        try {
            this.showLoading(true);
            
            const response = await fetch('/api/start_game', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.currentCountry = data.current_country;
                this.totalCountries = data.total_countries;
                this.score = 0;
                this.answeredCountries = 0;
                this.startTime = Date.now();
                this.isGameActive = true;
                
                this.updateUI();
                this.showScreen('game-screen');
                // Ensure the highlighted country shape is shown and focused
                setTimeout(() => {
                    this.highlightCountry(this.currentCountry);
                    document.getElementById('country-input').focus();
                }, 200);
                this.startTimer();
            }
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
                body: JSON.stringify({ answer: answer })
            });
            
            const data = await response.json();
            
            if (data.game_finished) {
                this.endGame(data);
            } else {
                this.processAnswer(data);
            }
            
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
            this.score = data.score;
            this.showFeedback(`✅ Correct! Well done!`, 'success');
        } else {
            this.showFeedback(`❌ Incorrect. The correct answer was: ${data.correct_answer}`, 'error');
        }
        
        this.answeredCountries = data.answered;
        this.currentCountry = data.next_country;
        this.updateUI();
        
        // Clear input and prepare for next question
        input.value = '';
        
        // Show continue instruction
        const feedback = document.getElementById('feedback');
        feedback.innerHTML += '<br><em>Press Enter to continue...</em>';
        
        // Focus back on input for next question
        input.focus();
    }

    nextQuestion() {
        if (this.currentCountry) {
            this.isGameActive = true;
            this.hideFeedback();
            this.highlightCountry(this.currentCountry);
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

    highlightCountry() {
        if (this.currentCountry && globe.isLoaded) {
            globe.highlightCountry(this.currentCountry.lat, this.currentCountry.lng, this.currentCountry.code);
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

// Initialize game when page loads
let game;
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for globe to initialize
    setTimeout(() => {
        game = new Game();
    }, 1000);
});

// Handle Enter key globally for continuing after wrong answers
document.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && game && !game.isGameActive) {
        const feedback = document.getElementById('feedback');
        if (!feedback.classList.contains('hidden') && game.currentCountry) {
            game.nextQuestion();
        }
    }
});