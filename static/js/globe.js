class Globe {
    /**
     * Set globe focus to a given lat/lng and zoom level.
     * @param {number} lat Latitude
     * @param {number} lng Longitude
     * @param {number} zoom Camera distance (optional)
     * @param {boolean} animate Animate rotation/zoom (default true)
     */
    setGlobeFocus(lat, lng, zoom, animate) {
        // Restore normal centering logic: rotate to lat/lng
        const latRad = lat * Math.PI / 180;
        const lngRad = -lng * Math.PI / 180;
        const target = new THREE.Vector3(
            Math.cos(latRad) * Math.cos(lngRad),
            Math.sin(latRad),
            Math.cos(latRad) * Math.sin(lngRad)
        ).normalize();
        const front = new THREE.Vector3(0, 0, 1);
        const q = new THREE.Quaternion().setFromUnitVectors(target, front);
        if (animate) {
            // Animate rotation
            const startQuat = this.earth.quaternion.clone();
            const endQuat = q;
            const duration = 1200;
            const startTime = Date.now();
            const animateRot = () => {
                const elapsed = Date.now() - startTime;
                const t = Math.min(elapsed / duration, 1);
                // Ease-in-out
                const progress = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
                this.earth.quaternion.slerpQuaternions(startQuat, endQuat, progress);
                if (t < 1) {
                    requestAnimationFrame(animateRot);
                }
            };
            animateRot();
        } else {
            // Instantly set orientation
            this.earth.quaternion.copy(q);
        }
        // Set camera zoom
        if (zoom !== null) {
            if (animate) {
                const startZoom = this.camera.position.length();
                const zoomDuration = 800;
                const zoomStartTime = Date.now();
                const animateZoom = () => {
                    const elapsed = Date.now() - zoomStartTime;
                    const progress = Math.min(elapsed / zoomDuration, 1);
                    const easeProgress = 1 - Math.pow(1 - progress, 3);
                    const newZoom = startZoom + (zoom - startZoom) * easeProgress;
                    this.camera.position.setLength(newZoom);
                    if (progress < 1) {
                        requestAnimationFrame(animateZoom);
                    }
                };
                animateZoom();
            } else {
                this.camera.position.setLength(zoom);
            }
        }
        // Always set controls.target to globe center and update
        if (this.controls) {
            this.controls.target.set(0, 0, 0);
            this.controls.update();
        }
        // Always reset camera up vector for consistent zoom
        this.camera.up.set(0, 1, 0);
    }
    toggleMapTexture(show) {
        if (!this.earth) return;
        if (show) {
            // Restore earth texture from dedicated variable
            this.earth.material.map = this.earthTexture;
            this.earth.material.color.set(0xdddddd); // Lower intensity for natural look
            this.earth.material.needsUpdate = true;
        } else {
            // Hide earth texture, show solid color
            this.earth.material.map = null;
            this.earth.material.color.set(0x222244);
            this.earth.material.needsUpdate = true;
        }
    }
    addDebugLines() {
        // Second prime meridian at lng = 180
        const meridianPoints2 = [];
        for (let lat = -90; lat <= 90; lat += 2) {
            const latRad = lat * Math.PI / 180;
            const lngRad = Math.PI; // 180 degrees in radians
            const radius = 1.02;
            const x = radius * Math.cos(latRad) * Math.cos(lngRad);
            const y = radius * Math.sin(latRad);
            const z = radius * Math.cos(latRad) * Math.sin(lngRad);
            meridianPoints2.push(new THREE.Vector3(x, y, z));
        }
        const meridianGeometry2 = new THREE.BufferGeometry().setFromPoints(meridianPoints2);
        const meridianMaterial2 = new THREE.LineBasicMaterial({ color: 0xff0000 });
        const meridianLine2 = new THREE.Line(meridianGeometry2, meridianMaterial2);
        if (this.earth) {
            this.earth.add(meridianLine2);
        } else {
            this.scene.add(meridianLine2);
        }
        // Equator (lat = 0)
        const equatorPoints = [];
        for (let lng = -180; lng <= 180; lng += 2) {
            const latRad = 0;
            const lngRad = -lng * Math.PI / 180;
            const radius = 1.02;
            const x = radius * Math.cos(latRad) * Math.cos(lngRad);
            const y = radius * Math.sin(latRad);
            const z = radius * Math.cos(latRad) * Math.sin(lngRad);
            equatorPoints.push(new THREE.Vector3(x, y, z));
        }
        const equatorGeometry = new THREE.BufferGeometry().setFromPoints(equatorPoints);
        const equatorMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00 });
        const equatorLine = new THREE.Line(equatorGeometry, equatorMaterial);
        if (this.earth) {
            this.earth.add(equatorLine);
        } else {
            this.scene.add(equatorLine);
        }

        // Prime meridian (lng = 0)
        const meridianPoints = [];
        for (let lat = -90; lat <= 90; lat += 2) {
            const latRad = lat * Math.PI / 180;
            const lngRad = 0; // Prime meridian is always at longitude 0
            const radius = 1.02;
            const x = radius * Math.cos(latRad) * Math.cos(lngRad);
            const y = radius * Math.sin(latRad);
            const z = radius * Math.cos(latRad) * Math.sin(lngRad);
            meridianPoints.push(new THREE.Vector3(x, y, z));
        }
        const meridianGeometry = new THREE.BufferGeometry().setFromPoints(meridianPoints);
        const meridianMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 });
        const meridianLine = new THREE.Line(meridianGeometry, meridianMaterial);
        if (this.earth) {
            this.earth.add(meridianLine);
        } else {
            this.scene.add(meridianLine);
        }
    }
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.earth = null;
        this.highlightedCountry = null;
        this.currentCountryMesh = null;
        this.isLoaded = false;
        this.geojson = null;
        this.borderGroup = new THREE.Group();
        this.allBordersGroup = new THREE.Group();
        this.highlightedBorder = null;
        this.init();
    }

    init() {
    this.setupScene();
    this.setupCamera();
    this.setupRenderer();
    this.setupControls();
        this.createEarth();
        this.setupLighting();
        this.startAnimation();
        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());
        this.loadGeoJSON();
        this.addDebugLines();
    }

    loadGeoJSON() {
        fetch('/static/data/world-countries.geojson')
            .then(response => response.json())
            .then(data => {
                this.geojson = data;
                this.drawAllCountryBorders();
            })
            .catch(err => {
                console.error('Failed to load GeoJSON:', err);
            });
    }
    drawAllCountryBorders() {
        // Remove previous borders
        if (this.allBordersGroup) {
            this.scene.remove(this.allBordersGroup);
        }
        this.allBordersGroup = new THREE.Group();
        if (!this.geojson) return;
        this.geojson.features.forEach(feature => {
            const coords = feature.geometry.coordinates;
            const type = feature.geometry.type;
            let polygons = [];
            if (type === 'Polygon') {
                polygons = coords;
            } else if (type === 'MultiPolygon') {
                polygons = coords.flat();
            }
            polygons.forEach(ring => {
                const points = ring.map(([lng, lat]) => {
                    // Convert lat/lng to radians
                    const latRad = lat * Math.PI / 180;
                    // Try flipping longitude sign for alignment
                    const lngRad = -lng * Math.PI / 180;
                    const radius = 1.01;
                    const x = radius * Math.cos(latRad) * Math.cos(lngRad);
                    const y = radius * Math.sin(latRad);
                    const z = radius * Math.cos(latRad) * Math.sin(lngRad);
                    return new THREE.Vector3(x, y, z);
                });
                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                // Default border color: gray
                const material = new THREE.LineBasicMaterial({ color: 0xcccccc, linewidth: 3 });
                const line = new THREE.Line(geometry, material);
                // Store country code and centroid for later reference
                const code = feature.properties.code || feature.properties['ISO3166-1-Alpha-2'];
                // Calculate centroid for this country
                let centroid = feature.properties.centroid;
                if (!centroid && feature.properties.lat !== undefined && feature.properties.lng !== undefined) {
                    centroid = [feature.properties.lat, feature.properties.lng];
                }
                // Fallback: use first point if no centroid
                if (!centroid && points.length > 0) {
                    // Convert back to lat/lng
                    const p = points[0];
                    const r = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
                    const lat = Math.asin(p.y / r) * 180 / Math.PI;
                    const lng = -Math.atan2(p.z, p.x) * 180 / Math.PI;
                    centroid = [lat, lng];
                }
                line.userData = { code, lat: centroid ? centroid[0] : undefined, lng: centroid ? centroid[1] : undefined };
                this.allBordersGroup.add(line);
            });
        });
        if (this.earth) {
            this.earth.add(this.allBordersGroup);
        } else {
            this.scene.add(this.allBordersGroup);
        }
    }

    setupScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000011);
    }

    setupCamera() {
        const container = document.getElementById('globe-container');
        this.camera = new THREE.PerspectiveCamera(
            75,
            container.clientWidth / container.clientHeight,
            0.1,
            1000
        );
        this.camera.position.set(0, 0, 3);
    }

    setupRenderer() {
        const container = document.getElementById('globe-container');
        this.renderer = new THREE.WebGLRenderer({
            canvas: document.getElementById('globe-canvas'),
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    setupControls() {
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.enableZoom = true;
        this.controls.enablePan = false;
        this.controls.minDistance = 0.7;
        this.controls.maxDistance = 50;
        this.controls.autoRotate = false;
        this.controls.autoRotateSpeed = 0.5;
        // Remove all rotation limitations
        this.controls.minAzimuthAngle = -Infinity;
        this.controls.maxAzimuthAngle = Infinity;
        this.controls.minPolarAngle = 0;
        this.controls.maxPolarAngle = Math.PI;
        this.controls.screenSpacePanning = false;
        this.controls.enableRotate = true;
    }

    createEarth() {
        // Create sphere geometry with higher resolution
        const geometry = new THREE.SphereGeometry(1, 128, 64); // Increased segments for smoother rendering
        
        // Load earth texture
        const textureLoader = new THREE.TextureLoader();
        
        // Using a high-quality earth texture from NASA
        const earthTexture = textureLoader.load(
            'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
            () => {
                this.isLoaded = true;
                this.hideLoading();
                this.earthTexture = earthTexture; // Store reference for toggling
            },
            undefined,
            (error) => {
                console.error('Error loading earth texture:', error);
                // Fallback to a solid color
                this.createFallbackEarth();
            }
        );
        
        // Load bump map for surface detail
        const bumpTexture = textureLoader.load(
            'https://unpkg.com/three-globe/example/img/earth-topology.png'
        );

        // Create material with lower saturation/intensity
        const material = new THREE.MeshPhongMaterial({
            map: earthTexture,
            bumpMap: bumpTexture,
            bumpScale: 0.05,
            shininess: 100,
            color: new THREE.Color(0xdddddd) // Slightly gray filter to reduce intensity
        });

        // Create earth mesh
        this.earth = new THREE.Mesh(geometry, material);
        this.earth.castShadow = true;
        this.earth.receiveShadow = true;
        this.scene.add(this.earth);
    }

    createFallbackEarth() {
        if (this.earth) {
            this.scene.remove(this.earth);
        }
        
        const geometry = new THREE.SphereGeometry(1, 64, 32);
        const material = new THREE.MeshPhongMaterial({
            color: 0x4a90e2,
            shininess: 100
        });
        
        this.earth = new THREE.Mesh(geometry, material);
        this.earth.castShadow = true;
        this.earth.receiveShadow = true;
        this.scene.add(this.earth);
        
        this.isLoaded = true;
        this.hideLoading();
    }

    setupLighting() {
        // Ambient light only for global illumination
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
        this.scene.add(ambientLight);
        // All spotlights and directional lights removed for now
    }

    highlightCountry(lat, lng, code) {
        // Remove previous highlight and reset all borders
        if (this.allBordersGroup && this.allBordersGroup.children) {
            this.allBordersGroup.children.forEach(line => {
                line.material.color.set(0xcccccc);
                line.material.linewidth = 3;
                line.renderOrder = 1;
            });
        }
        this.removeHighlight();
        // Highlight country border using GeoJSON
        let borderFound = false;
        if (this.geojson && code) {
            this.allBordersGroup.children.forEach(line => {
                if (line.userData && (line.userData.code === code)) {
                    line.material.color.set(0xff0033);
                    line.material.linewidth = 7;
                    line.renderOrder = 999;
                    this.highlightedBorder = line;
                    this.highlightedBorder.userData.lat = lat;
                    this.highlightedBorder.userData.lng = lng;
                    borderFound = true;
                }
            });
            if (borderFound) {
                // Add pulsing effect to highlighted border
                let pulseUp = true;
                let pulse = 7;
                const pulseMin = 6;
                const pulseMax = 10;
                const animatePulse = () => {
                    if (this.highlightedBorder) {
                        if (pulseUp) {
                            pulse += 0.2;
                            if (pulse >= pulseMax) pulseUp = false;
                        } else {
                            pulse -= 0.2;
                            if (pulse <= pulseMin) pulseUp = true;
                        }
                        this.highlightedBorder.material.linewidth = pulse;
                        requestAnimationFrame(animatePulse);
                    }
                };
                animatePulse();
                // Only log when actually highlighting
                console.log('Highlighting country border for code:', code);
            } else {
                // Only log once per missing code, not every call
                if (!this._missingBorderCodes) this._missingBorderCodes = new Set();
                if (!this._missingBorderCodes.has(code)) {
                    this._missingBorderCodes.add(code);
                    const codes = this.geojson.features.map(f => f.properties.code || f.properties['ISO3166-1-Alpha-2']);
                    console.warn('No border found for code:', code, 'Available codes:', codes.slice(0, 10));
                }
            }
        }
        // Center camera on country after border highlight
        setTimeout(() => {
            this.setGlobeFocus(lat, lng, null, true);
        }, 100);
    }

    animateHighlight() {
        if (!this.currentCountryMesh) return;
        
        const animate = () => {
            if (this.currentCountryMesh) {
                const time = Date.now() * 0.005;
                this.currentCountryMesh.material.opacity = 0.5 + 0.3 * Math.sin(time);
                this.currentCountryMesh.scale.setScalar(1 + 0.3 * Math.sin(time * 2));
                requestAnimationFrame(animate);
            }
        };
        animate();
    }

    removeHighlight() {
        // Reset highlighted border color to gray
        if (this.highlightedBorder) {
            this.highlightedBorder.material.color.set(0x888888);
            this.highlightedBorder.material.linewidth = 2;
            this.highlightedBorder = null;
        }
    }

    startAnimation() {
        const animate = () => {
            requestAnimationFrame(animate);
            
            this.controls.update();
            this.renderer.render(this.scene, this.camera);
        };
        animate();
    }

    onWindowResize() {
        const container = document.getElementById('globe-container');
        const width = container.clientWidth;
        const height = container.clientHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    showLoading() {
        document.getElementById('loading').classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loading').classList.add('hidden');
    }

    enableAutoRotate() {
        this.controls.autoRotate = true;
    }

    disableAutoRotate() {
        this.controls.autoRotate = false;
    }

    startGame() {
        // Set a comfortable initial zoom (camera distance)
        if (this.camera) {
            this.camera.position.set(0, 0, 2.5); // Less zoomed-in than before
        }
        if (this.controls) {
            this.controls.minDistance = 0.7; // Allow user to zoom in more
            this.controls.maxDistance = 50;
            this.controls.autoRotate = false; // Ensure spinning animation is off
            this.controls.update();
        }
    }
}

// Initialize globe when page loads
let globe;
document.addEventListener('DOMContentLoaded', () => {
    globe = new Globe();
    globe.showLoading();
    // Use the HTML controls div
    const controlsDiv = document.getElementById('controls');
    controlsDiv.style.position = 'fixed';
    controlsDiv.style.top = '20px';
    controlsDiv.style.left = '20px';
    controlsDiv.style.zIndex = '1000';
    controlsDiv.style.background = 'rgba(32,32,64,0.9)';
    controlsDiv.style.padding = '16px';
    controlsDiv.style.borderRadius = '10px';
    controlsDiv.style.color = '#fff';
    controlsDiv.style.border = '2px solid #ff0'; // Debug: make controls visible
    controlsDiv.style.display = 'block'; // Ensure it's not hidden
    controlsDiv.style.minWidth = '180px';
    controlsDiv.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
    console.log('Adding controls to #controls div:', controlsDiv);

    // Map image checkbox
    const mapCheckbox = document.createElement('input');
    mapCheckbox.type = 'checkbox';
    mapCheckbox.id = 'map-checkbox';
    mapCheckbox.checked = true;
    const mapLabel = document.createElement('label');
    mapLabel.htmlFor = 'map-checkbox';
    mapLabel.textContent = 'Show Map Image';
    controlsDiv.appendChild(mapCheckbox);
    controlsDiv.appendChild(mapLabel);
    controlsDiv.appendChild(document.createElement('br'));

    // Globe sphere checkbox
    const globeCheckbox = document.createElement('input');
    globeCheckbox.type = 'checkbox';
    globeCheckbox.id = 'globe-checkbox';
    globeCheckbox.checked = true;
    const globeLabel = document.createElement('label');
    globeLabel.htmlFor = 'globe-checkbox';
    globeLabel.textContent = 'Show Globe Sphere';
    controlsDiv.appendChild(globeCheckbox);
    controlsDiv.appendChild(globeLabel);
    controlsDiv.appendChild(document.createElement('br'));

    mapCheckbox.addEventListener('change', () => {
        globe.toggleMapTexture(mapCheckbox.checked);
    });

    globeCheckbox.addEventListener('change', () => {
        if (globe.earth) {
            // Only toggle the earth mesh's material opacity, not visibility
            if (globeCheckbox.checked) {
                globe.earth.material.opacity = 1;
                globe.earth.material.transparent = false;
            } else {
                globe.earth.material.opacity = 0;
                globe.earth.material.transparent = true;
            }
            globe.earth.material.needsUpdate = true;
        }
    });

    // Add a button for focusing camera on highlighted country
    const focusButton = document.createElement('button');
    focusButton.textContent = 'Focus on Country';
    focusButton.style.margin = '8px';
    controlsDiv.appendChild(focusButton);

    focusButton.addEventListener('click', () => {
        if (globe.highlightedBorder && globe.highlightedBorder.userData) {
            let { lat, lng, code } = globe.highlightedBorder.userData;
            console.log('[FOCUS BUTTON] code:', code, 'lat:', lat, 'lng:', lng);
            if (typeof lat === 'number' && typeof lng === 'number') {
                // Use current zoom for focus
                globe.setGlobeFocus(lat, lng, globe.camera.position.length(), false);
            } else {
                console.warn('No lat/lng found for highlighted country');
            }
        } else {
            console.warn('No highlighted country to focus on');
        }
    });
});